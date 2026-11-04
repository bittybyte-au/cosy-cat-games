/* Run with: npm test  (fakes for Redis, Stripe checkout and email; real Stripe webhook signing) */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Stripe from 'stripe';
import { createApp, LIMITS, dayIn } from '../server/app.js';

const DAY = 86400000;

function fakeRedis(clock) {
  const m = new Map();
  const alive = (k) => { const v = m.get(k); if (!v) return null; if (v.exp && v.exp <= clock.t) { m.delete(k); return null; } return v; };
  return {
    _m: m,
    async get(k) { const v = alive(k); return v ? v.val : null; },
    async set(k, val, o = {}) { if (o.nx && alive(k)) return null; m.set(k, { val: String(val), exp: o.ex ? clock.t + o.ex * 1000 : 0 }); return 'OK'; },
    async del(k) { return m.delete(k) ? 1 : 0; },
    async incr(k) { const v = alive(k); const n = (v ? parseInt(v.val, 10) : 0) + 1; m.set(k, { val: String(n), exp: v ? v.exp : 0 }); return n; },
    async expire(k, s) { const v = alive(k); if (v) v.exp = clock.t + s * 1000; return 1; },
    async sadd(k, x) { const v = alive(k); const set = new Set(v ? JSON.parse(v.val) : []); set.add(x); m.set(k, { val: JSON.stringify([...set]), exp: 0 }); return 1; },
    async srem(k, x) { const v = alive(k); const set = new Set(v ? JSON.parse(v.val) : []); const had = set.delete(x); m.set(k, { val: JSON.stringify([...set]), exp: 0 }); return had ? 1 : 0; },
    async smembers(k) { const v = alive(k); return v ? JSON.parse(v.val) : []; }
  };
}

function setup(envExtra = {}) {
  const clock = { t: Date.UTC(2026, 10, 4, 3) };
  const real = new Stripe('sk_test_dummy');
  const sessions = new Map(); let n = 0;
  const stripe = {
    checkout: { sessions: {
      async create(p) { const id = 'cs_test_' + (++n); const s = { id, url: 'https://checkout.stripe.test/' + id, payment_status: 'unpaid', customer_email: p.customer_email || null, metadata: p.metadata || {}, amount_total: 599, currency: 'aud', _params: p }; sessions.set(id, s); return s; },
      async retrieve(id) { const s = sessions.get(id); if (!s) throw new Error('no such session'); return s; }
    } },
    webhooks: real.webhooks
  };
  const mail = [];
  const env = { SITE_URL: 'https://cosy.test', STRIPE_WEBHOOK_SECRET: 'whsec_test', CRON_SECRET: 'cron', PASS_REQUIRED: 'on', ...envExtra };
  const redis = fakeRedis(clock);
  const app = createApp({ redis, stripe, mailer: { async send(x) { mail.push(x); } }, env, now: () => clock.t });
  let ip = 1;
  const call = async (method, path, body, headers = {}) => {
    const r = await app.fetch(new Request('https://cosy.test' + path, { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': headers.ip || '10.0.' + (ip++ % 250) + '.1', ...headers }, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }));
    return { status: r.status, ...(await r.json()) };
  };
  const pay = (id, status = 'paid') => { const s = sessions.get(id); s.payment_status = status; s.customer_details = { email: s.customer_email }; return s; };
  const lastCode = (to) => { const ms = mail.filter((x) => !to || x.to === to); const m = ms[ms.length - 1]; return m && (m.subject.match(/(\d{6})/) || [])[1]; };
  return { clock, call, pay, mail, sessions, lastCode, real, redis };
}
const dev = (i) => 'device_' + String(i).padStart(8, '0');

/* check the email, pay, come back on this device */
async function signUp(a, email = 'mum@example.com', device = dev(1), tz) {
  await a.call('POST', '/api/code/send', { purpose: 'pay', email });
  const v = await a.call('POST', '/api/code/verify', { purpose: 'pay', email, code: a.lastCode(email) });
  assert.equal(v.ok, true, 'pay code verified');
  await a.call('POST', '/api/checkout', { ticket: v.ticket, timezone: tz });
  const id = [...a.sessions.keys()].pop();
  a.pay(id);
  return a.call('POST', '/api/claim', { session: id, device, name: 'Mum’s phone' });
}
async function family(a, opts = {}) {
  const s = await signUp(a, opts.email, opts.device, opts.tz);
  await a.call('POST', '/api/pin/set', { token: s.token, pin: '246810' });
  const pr = await a.call('POST', '/api/parent/start', { token: s.token, pin: '246810' });
  return { token: s.token, parent: pr.parent };
}
async function login(a, email, device, name = 'Tablet') {
  await a.call('POST', '/api/code/send', { purpose: 'login', email });
  return a.call('POST', '/api/code/verify', { purpose: 'login', email, code: a.lastCode(email), device, name });
}

test('config reports the switch, price and limits', async () => {
  const a = setup(); const r = await a.call('GET', '/api/config');
  assert.equal(r.passRequired, true); assert.equal(r.price, '$5.99'); assert.equal(r.deviceLimit, 6); assert.equal(r.profileLimit, 4);
});

test('sign up: the email is checked before paying, then this device joins the new family', async () => {
  const a = setup();
  let r = await a.call('POST', '/api/checkout', {});
  assert.equal(r.error, 'check_email_first');
  r = await a.call('POST', '/api/checkout', { ticket: 'made-up' });
  assert.equal(r.error, 'check_email_first');
  await a.call('POST', '/api/code/send', { purpose: 'pay', email: 'Mum@Example.com ' });
  assert.match(a.mail.at(-1).subject, /code/);
  r = await a.call('POST', '/api/code/verify', { purpose: 'pay', email: 'mum@example.com', code: a.lastCode() });
  assert.equal(r.ok, true); assert.equal(r.hasAccount, false);
  r = await a.call('POST', '/api/checkout', { ticket: r.ticket, timezone: 'Australia/Perth' });
  const id = [...a.sessions.keys()][0];
  const p = a.sessions.get(id)._params;
  assert.equal(p.allow_promotion_codes, true); assert.equal(p.customer_email, 'mum@example.com'); assert.equal(p.metadata.tz, 'Australia/Perth');
  r = await a.call('POST', '/api/claim', { session: id, device: dev(1), name: 'iPad' });
  assert.equal(r.error, 'not_paid');
  a.pay(id);
  r = await a.call('POST', '/api/claim', { session: id, device: dev(1), name: 'Mum’s phone' });
  assert.equal(r.ok, true); assert.ok(r.token); assert.equal(r.needsPin, true);
  assert.equal(r.account.pass.expiresAt, a.clock.t + 365 * DAY);
  assert.equal(r.account.timezone, 'Australia/Perth');
  assert.equal(r.account.email, 'm***m@example.com');
  assert.equal(r.account.devices[0].name, 'Mum’s phone');
  assert.equal(r.account.settings.sound, false); assert.equal(r.account.settings.pinToSwitch, true);
  // the paid link can't add a second device
  assert.equal((await a.call('POST', '/api/claim', { session: id, device: dev(2) })).error, 'already_claimed');
  // a $0 promotion code works too, and a bad timezone falls back to Sydney
  const b = setup();
  await b.call('POST', '/api/code/send', { purpose: 'pay', email: 'dad@example.com' });
  const v = await b.call('POST', '/api/code/verify', { purpose: 'pay', email: 'dad@example.com', code: b.lastCode() });
  await b.call('POST', '/api/checkout', { ticket: v.ticket, timezone: 'Mars/Base' });
  const id2 = [...b.sessions.keys()][0]; b.pay(id2, 'no_payment_required');
  r = await b.call('POST', '/api/claim', { session: id2, device: dev(1) });
  assert.equal(r.account.pass.active, true); assert.equal(r.account.timezone, 'Australia/Sydney');
});

test('webhook and claim together count a payment once; renewing adds a year on', async () => {
  const a = setup();
  const s = await signUp(a);
  const end1 = s.account.pass.expiresAt;
  const id = [...a.sessions.keys()][0];
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: a.sessions.get(id) } });
  const sig = a.real.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test' });
  assert.equal((await a.call('POST', '/api/webhook', payload, { 'stripe-signature': sig })).received, true);
  assert.equal((await a.call('POST', '/api/status', { token: s.token })).account.pass.expiresAt, end1);
  assert.equal((await a.call('POST', '/api/webhook', payload, { 'stripe-signature': 't=1,v1=nope' })).status, 400);
  // renew 300 days in: same email, a new code, a year added on from the old end
  a.clock.t += 300 * DAY;
  const r = await signUp(a, 'mum@example.com', dev(1));
  assert.equal(r.account.pass.expiresAt, end1 + 365 * DAY);
  assert.equal(r.account.devices.length, 1);
});

test('log in on another device with an emailed code; unknown emails get the same answer', async () => {
  const a = setup();
  await signUp(a);
  const before = a.mail.length;
  let r = await a.call('POST', '/api/code/send', { purpose: 'login', email: 'nobody@example.com' });
  assert.equal(r.ok, true); assert.equal(a.mail.length, before);
  r = await login(a, 'mum@example.com', dev(2), 'Dad’s phone');
  assert.equal(r.ok, true); assert.ok(r.token); assert.equal(r.account.devices.length, 2);
  // wrong codes, code used once, codes expire
  await a.call('POST', '/api/code/send', { purpose: 'login', email: 'mum@example.com' });
  const code = a.lastCode();
  r = await a.call('POST', '/api/code/verify', { purpose: 'login', email: 'mum@example.com', code: code === '000000' ? '111111' : '000000', device: dev(3) });
  assert.equal(r.error, 'wrong_code'); assert.equal(r.triesLeft, 4);
  // a code for one purpose doesn't work for another
  r = await a.call('POST', '/api/code/verify', { purpose: 'join', email: 'mum@example.com', code, device: dev(3) });
  assert.equal(r.error, 'code_expired');
  r = await a.call('POST', '/api/code/verify', { purpose: 'login', email: 'mum@example.com', code, device: dev(3) });
  assert.equal(r.ok, true);
  r = await a.call('POST', '/api/code/verify', { purpose: 'login', email: 'mum@example.com', code, device: dev(4) });
  assert.equal(r.error, 'code_expired');
  await a.call('POST', '/api/code/send', { purpose: 'login', email: 'mum@example.com' });
  const c2 = a.lastCode(); a.clock.t += 11 * 60 * 1000;
  assert.equal((await a.call('POST', '/api/code/verify', { purpose: 'login', email: 'mum@example.com', code: c2, device: dev(4) })).error, 'code_expired');
  // the email backup for Join a family uses its own wording
  await a.call('POST', '/api/code/send', { purpose: 'join', email: 'mum@example.com' });
  assert.match(a.mail.at(-1).subject, /Add a device/);
});

test('six devices; when full, remove one to add another; removals are limited', async () => {
  const a = setup();
  const tokens = [(await signUp(a)).token];
  for (let i = 2; i <= 6; i++) {
    a.clock.t += 61 * 60 * 1000;
    const r = await login(a, 'mum@example.com', dev(i), 'Tab ' + i);
    assert.equal(r.ok, true); tokens.push(r.token);
  }
  a.clock.t += 61 * 60 * 1000;
  let r = await login(a, 'mum@example.com', dev(7), 'New');
  assert.equal(r.error, 'device_limit'); assert.equal(r.devices.length, 6); assert.ok(r.manage);
  const manage = r.manage;
  r = await a.call('POST', '/api/devices/remove', { manage, id: dev(2) });
  assert.equal(r.ok, true); assert.equal(r.devices.length, 5);
  r = await a.call('POST', '/api/devices/add', { manage, device: dev(7), name: 'New' });
  assert.equal(r.ok, true);
  assert.equal((await a.call('POST', '/api/status', { token: tokens[1] })).signedIn, false);
  const { parent } = await (async () => { await a.call('POST', '/api/pin/set', { token: tokens[0], pin: '135790' }); return a.call('POST', '/api/parent/start', { token: tokens[0], pin: '135790' }); })();
  r = await a.call('POST', '/api/devices/remove', { parent, id: dev(3) }); assert.equal(r.ok, true);
  r = await a.call('POST', '/api/devices/remove', { parent, id: dev(4) }); assert.equal(r.ok, true);
  r = await a.call('POST', '/api/devices/remove', { parent, id: dev(5) }); assert.equal(r.error, 'removal_limit');
  // a device removing itself never counts
  r = await a.call('POST', '/api/devices/remove', { token: tokens[5], id: dev(6) }); assert.equal(r.ok, true);
  a.clock.t += 31 * DAY;
  const p2 = (await a.call('POST', '/api/parent/start', { token: tokens[0], pin: '135790' })).parent;
  r = await a.call('POST', '/api/devices/remove', { parent: p2, id: dev(5) }); assert.equal(r.ok, true);
});

test('Join a family: the child device shows a code, a parent approves it, the device joins itself', async () => {
  const a = setup();
  const f = await family(a);
  let r = await a.call('POST', '/api/join/start', { device: dev(9), name: 'Lily’s iPad' });
  assert.equal(r.ok, true); assert.match(r.code, /^[A-HJ-NP-Z2-9]{6}$/);
  const { code, secret } = r;
  assert.equal((await a.call('POST', '/api/join/poll', { code, secret })).status, 'waiting');
  assert.equal((await a.call('POST', '/api/join/poll', { code, secret: 'nope' })).status, 403);
  // approving needs a parent session
  assert.equal((await a.call('POST', '/api/join/approve', { code })).error, 'signed_out');
  r = await a.call('POST', '/api/join/approve', { parent: f.parent, code: code.toLowerCase() });
  assert.equal(r.ok, true); assert.equal(r.deviceName, 'Lily’s iPad');
  r = await a.call('POST', '/api/join/poll', { code, secret });
  assert.equal(r.status, 'joined'); assert.ok(r.token);
  assert.equal(r.account.devices.find((d) => d.thisDevice).name, 'Lily’s iPad');
  assert.equal((await a.call('POST', '/api/join/poll', { code, secret })).status, 'expired');
  // codes end after 10 minutes
  r = await a.call('POST', '/api/join/start', { device: dev(10), name: 'Tab' });
  a.clock.t += 11 * 60 * 1000;
  assert.equal((await a.call('POST', '/api/join/poll', { code: r.code, secret: r.secret })).status, 'expired');
});

test('parent PIN: set once, opens the dashboard, 4 wrong tries lock that device for an hour and email the parent', async () => {
  const a = setup();
  const s = await signUp(a);
  assert.equal(s.account.pinSet, false);
  assert.equal((await a.call('POST', '/api/parent/start', { token: s.token, pin: '000000' })).error, 'no_pin');
  assert.equal((await a.call('POST', '/api/pin/set', { token: s.token, pin: '12345' })).error, 'bad_pin');
  let r = await a.call('POST', '/api/pin/set', { token: s.token, pin: '246810' });
  assert.equal(r.ok, true); assert.ok(r.pinOffline.salt); assert.equal(r.pinOffline.iter, 100000);
  // the offline copy really matches the PIN (what a device checks without internet)
  const h = crypto.pbkdf2Sync('246810', r.pinOffline.salt, r.pinOffline.iter, 32, 'sha256').toString('hex');
  assert.equal(h, r.pinOffline.h);
  // once set, changing it needs the dashboard (or a reset code)
  assert.equal((await a.call('POST', '/api/pin/set', { token: s.token, pin: '111111' })).error, 'not_allowed');
  const kid = (await login(a, 'mum@example.com', dev(2), 'Lily’s iPad')).token;
  for (let i = 1; i <= 3; i++) {
    r = await a.call('POST', '/api/parent/start', { token: kid, pin: '000000' });
    assert.equal(r.error, 'wrong_pin'); assert.equal(r.triesLeft, 4 - i);
  }
  const mails = a.mail.length;
  r = await a.call('POST', '/api/parent/start', { token: kid, pin: '000000' });
  assert.equal(r.error, 'pin_locked'); assert.equal(r.status, 423);
  assert.equal(a.mail.length, mails + 1);
  assert.match(a.mail.at(-1).subject, /Lily’s iPad/); assert.match(a.mail.at(-1).text, /4 times/);
  // even the right PIN is refused on that device for an hour, but other devices are fine
  assert.equal((await a.call('POST', '/api/parent/start', { token: kid, pin: '246810' })).error, 'pin_locked');
  assert.equal((await a.call('POST', '/api/parent/start', { token: s.token, pin: '246810' })).ok, true);
  a.clock.t += 61 * 60 * 1000;
  assert.equal((await a.call('POST', '/api/parent/start', { token: kid, pin: '246810' })).ok, true);
  // a device that locked while offline reports it later; one email per hour per device
  const m2 = a.mail.length;
  await a.call('POST', '/api/pin/report', { token: kid, lockedAt: a.clock.t - 5 * 60 * 1000 });
  await a.call('POST', '/api/pin/report', { token: kid, lockedAt: a.clock.t - 4 * 60 * 1000 });
  assert.equal(a.mail.length, m2 + 1);
});

test('forgot PIN: an email code unlocks the device and lets the parent set a new PIN', async () => {
  const a = setup();
  const f = await family(a);
  for (let i = 0; i < 4; i++) await a.call('POST', '/api/parent/start', { token: f.token, pin: '999999' });
  assert.equal((await a.call('POST', '/api/parent/start', { token: f.token, pin: '246810' })).error, 'pin_locked');
  await a.call('POST', '/api/code/send', { purpose: 'pin-reset', email: 'mum@example.com' });
  assert.match(a.mail.at(-1).subject, /Reset your parent PIN/);
  const r = await a.call('POST', '/api/code/verify', { purpose: 'pin-reset', email: 'mum@example.com', code: a.lastCode(), device: dev(1) });
  assert.equal(r.ok, true);
  assert.equal((await a.call('POST', '/api/pin/set', { token: f.token, pin: '112233', ticket: r.ticket })).ok, true);
  assert.equal((await a.call('POST', '/api/parent/start', { token: f.token, pin: '112233' })).ok, true);
  // the reset ticket works once
  assert.equal((await a.call('POST', '/api/pin/set', { token: f.token, pin: '445566', ticket: r.ticket })).error, 'not_allowed');
});

test('profiles: up to 4, parents add and edit, kids change their own nickname and avatar but not toddlers', async () => {
  const a = setup();
  const f = await family(a);
  assert.equal((await a.call('POST', '/api/profiles/save', { profile: { nickname: 'Lily' } })).error, 'signed_out');
  const ids = [];
  for (const n of ['Lily', 'Max', 'Rosie', 'Bub']) {
    const r = await a.call('POST', '/api/profiles/save', { parent: f.parent, profile: { nickname: n, avatar: { type: 'fluffy', color: '#FFA94D', bg: '#BFE0FF' }, toddler: n === 'Bub' } });
    assert.equal(r.ok, true); ids.push(r.profile.id);
  }
  assert.equal((await a.call('POST', '/api/profiles/save', { parent: f.parent, profile: { nickname: 'Fifth' } })).error, 'profile_limit');
  assert.equal((await a.call('POST', '/api/profiles/save', { parent: f.parent, profile: { id: ids[0], nickname: '   ' } })).error, 'bad_nickname');
  assert.equal((await a.call('POST', '/api/profiles/save', { parent: f.parent, profile: { id: ids[0], avatar: { type: '<script>' } } })).error, 'bad_avatar');
  let r = await a.call('POST', '/api/profiles/save', { parent: f.parent, profile: { id: ids[1], limitMin: 45, list: { mode: 'block', games: ['yarn', 'BAD GAME'] } } });
  assert.equal(r.profile.limitMin, 45); assert.deepEqual(r.profile.list, { mode: 'block', games: ['yarn'] });
  // kids' own changes come in through sync
  r = await a.call('POST', '/api/sync', { token: f.token, edits: [
    { profile: ids[0], nickname: 'Lily Pad', avatar: { type: 'calico', color: '#fff' }, filter: '11+' },
    { profile: ids[3], nickname: 'Not allowed' }
  ] });
  const byId = Object.fromEntries(r.account.profiles.map((p) => [p.id, p]));
  assert.equal(byId[ids[0]].nickname, 'Lily Pad'); assert.equal(byId[ids[0]].avatar.type, 'calico'); assert.equal(byId[ids[0]].filter, '11+');
  assert.equal(byId[ids[3]].nickname, 'Bub'); assert.equal(byId[ids[3]].toddler, true);
  // removing a profile removes its progress
  await a.call('POST', '/api/sync', { token: f.token, progress: [{ profile: ids[2], game: 'yarn', data: { level: 9 } }] });
  r = await a.call('POST', '/api/profiles/remove', { parent: f.parent, id: ids[2] });
  assert.equal(r.account.profiles.length, 3);
  assert.equal(await a.redis.get('prog:' + (await a.redis.get('email:mum@example.com')) + ':' + ids[2]), null);
});

test('sync: progress follows a profile to every device; a save made on an old copy comes back to be merged', async () => {
  const a = setup();
  const f = await family(a);
  const pid = (await a.call('POST', '/api/profiles/save', { parent: f.parent, profile: { nickname: 'Lily' } })).profile.id;
  const tab = (await login(a, 'mum@example.com', dev(2), 'Lily’s iPad')).token;
  let r = await a.call('POST', '/api/sync', { token: tab, progress: [{ profile: pid, game: 'kitty-pop', data: { level: 4 }, base: 0 }] });
  assert.deepEqual(r.results.accepted, [{ profile: pid, game: 'kitty-pop', rev: 1 }]);
  r = await a.call('POST', '/api/sync', { token: f.token });
  assert.deepEqual(r.progress[pid]['kitty-pop'], { rev: 1, data: { level: 4 } });
  // the phone saves on top of rev 1; the tablet, offline, also saved on top of rev 1 and is told to merge
  await a.call('POST', '/api/sync', { token: f.token, progress: [{ profile: pid, game: 'kitty-pop', data: { level: 5 }, base: 1 }] });
  r = await a.call('POST', '/api/sync', { token: tab, progress: [{ profile: pid, game: 'kitty-pop', data: { level: 7 }, base: 1 }] });
  assert.equal(r.results.accepted.length, 0);
  assert.deepEqual(r.results.conflicts[0], { profile: pid, game: 'kitty-pop', rev: 2, data: { level: 5 } });
  // the tablet merges (keeps the furthest level) and saves on top of rev 2
  r = await a.call('POST', '/api/sync', { token: tab, progress: [{ profile: pid, game: 'kitty-pop', data: { level: 7 }, base: 2 }] });
  assert.equal(r.results.accepted[0].rev, 3);
  // what a device already has isn't sent again
  r = await a.call('POST', '/api/sync', { token: f.token, known: { [pid]: { 'kitty-pop': 3 } } });
  assert.deepEqual(r.progress[pid]['kitty-pop'], { rev: 3 });
  // big saves (like pictures) are turned away; unknown profiles are ignored
  r = await a.call('POST', '/api/sync', { token: tab, progress: [{ profile: pid, game: 'cooking', data: { pic: 'x'.repeat(40000) } }, { profile: 'nope', game: 'yarn', data: {} }] });
  assert.equal(r.results.conflicts[0].error, 'too_big'); assert.equal(r.results.conflicts.length, 1);
  // stats only go up
  await a.call('POST', '/api/sync', { token: tab, stats: [{ profile: pid, name: 'levels', value: 12 }] });
  r = await a.call('POST', '/api/sync', { token: f.token, stats: [{ profile: pid, name: 'levels', value: 9 }, { profile: pid, name: 'cooking:dishes', value: 3 }] });
  assert.deepEqual(r.stats[pid], { levels: 12, 'cooking:dishes': 3 });
  // another family can't read or write this one
  const b = await family(a, { email: 'other@example.com', device: dev(50) });
  r = await a.call('POST', '/api/sync', { token: b.token, progress: [{ profile: pid, game: 'yarn', data: { level: 99 } }] });
  assert.equal(r.results.accepted.length, 0); assert.equal(r.progress[pid], undefined);
});

test('play time adds up across devices in the family’s timezone; a parent can add extra time once per tap', async () => {
  const a = setup();
  const f = await family(a, { tz: 'Australia/Melbourne' });
  const pid = (await a.call('POST', '/api/profiles/save', { parent: f.parent, profile: { nickname: 'Max', limitMin: 60 } })).profile.id;
  const tab = (await login(a, 'mum@example.com', dev(2))).token;
  const today = dayIn('Australia/Melbourne', a.clock.t);
  await a.call('POST', '/api/sync', { token: f.token, play: [{ profile: pid, day: today, minutes: 20 }] });
  await a.call('POST', '/api/sync', { token: tab, play: [{ profile: pid, day: today, minutes: 30 }] });
  // a device sending an older, smaller total doesn't lower it
  let r = await a.call('POST', '/api/sync', { token: tab, play: [{ profile: pid, day: today, minutes: 25 }] });
  assert.equal(r.played[pid].minutes, 50); assert.equal(r.account.today, today);
  r = await a.call('POST', '/api/sync', { token: tab, extend: [{ profile: pid, day: today, minutes: 30, id: 'x1' }, { profile: pid, day: today, minutes: 30, id: 'x1' }, { profile: pid, day: today, minutes: 45, id: 'x2' }] });
  assert.equal(r.played[pid].extra, 30);
  r = await a.call('POST', '/api/sync', { token: f.token, extend: [{ profile: pid, day: today, minutes: 'unlimited', id: 'x3' }] });
  assert.equal(r.played[pid].extra, 'unlimited');
  // days far from today are ignored; tomorrow starts fresh
  r = await a.call('POST', '/api/sync', { token: f.token, play: [{ profile: pid, day: '2020-01-01', minutes: 99 }] });
  a.clock.t += DAY;
  r = await a.call('POST', '/api/sync', { token: f.token });
  assert.deepEqual(r.played[pid], { minutes: 0, extra: 0 });
});

test('dashboard: settings, timezone, device names and shared devices, export', async () => {
  const a = setup();
  const f = await family(a);
  let r = await a.call('POST', '/api/account/settings', { parent: f.parent, timezone: 'Pacific/Auckland', sound: true, pinToSwitch: false });
  assert.equal(r.account.timezone, 'Pacific/Auckland'); assert.equal(r.account.settings.sound, true); assert.equal(r.account.settings.pinToSwitch, false);
  assert.equal((await a.call('POST', '/api/account/settings', { parent: f.parent, timezone: 'Nowhere/Land' })).error, 'bad_timezone');
  r = await a.call('POST', '/api/devices/update', { parent: f.parent, id: dev(1), name: 'Kitchen iPad', shared: true });
  assert.equal(r.devices[0].name, 'Kitchen iPad'); assert.equal(r.devices[0].shared, true);
  r = await a.call('POST', '/api/account/export', { parent: f.parent });
  assert.equal(r.data.email, 'mum@example.com'); assert.equal(r.data.devices[0].name, 'Kitchen iPad');
  assert.equal(JSON.stringify(r.data).includes('"th"'), false); // no device secrets in the export
  // parent sessions end after 15 minutes
  a.clock.t += 16 * 60 * 1000;
  assert.equal((await a.call('POST', '/api/account/export', { parent: f.parent })).error, 'signed_out');
});

test('changing email: code to the new address, notice with undo to the old one', async () => {
  const a = setup();
  const f = await family(a);
  await signUp(a, 'taken@example.com', dev(40));
  assert.equal((await a.call('POST', '/api/code/send', { purpose: 'email-change', email: 'new@example.com' })).error, 'signed_out');
  assert.equal((await a.call('POST', '/api/code/send', { purpose: 'email-change', parent: f.parent, email: 'taken@example.com' })).error, 'email_taken');
  await a.call('POST', '/api/code/send', { purpose: 'email-change', parent: f.parent, email: 'New@Example.com' });
  assert.equal(a.mail.at(-1).to, 'new@example.com');
  let r = await a.call('POST', '/api/code/verify', { purpose: 'email-change', parent: f.parent, email: 'new@example.com', code: a.lastCode('new@example.com') });
  assert.equal(r.ok, true); assert.equal(r.account.email, 'n***w@example.com');
  const notice = a.mail.at(-1);
  assert.equal(notice.to, 'mum@example.com'); assert.match(notice.subject, /changed/);
  const undo = notice.text.match(/undo=([\w-]+)/)[1];
  // logging in now uses the new address
  assert.equal((await login(a, 'new@example.com', dev(2))).ok, true);
  // once per 30 days
  assert.equal((await a.call('POST', '/api/code/send', { purpose: 'email-change', parent: f.parent, email: 'third@example.com' })).error, 'changed_recently');
  // the old address undoes it
  r = await a.call('POST', '/api/email/undo', { t: undo });
  assert.equal(r.ok, true);
  assert.equal((await a.call('POST', '/api/status', { token: f.token })).account.email, 'm***m@example.com');
  assert.equal((await a.call('POST', '/api/email/undo', { t: undo })).error, 'undo_expired');
});

test('deleting an account needs the PIN and an email code, and removes everything', async () => {
  const a = setup();
  const f = await family(a);
  const pid = (await a.call('POST', '/api/profiles/save', { parent: f.parent, profile: { nickname: 'Lily' } })).profile.id;
  await a.call('POST', '/api/sync', { token: f.token, progress: [{ profile: pid, game: 'yarn', data: { level: 3 } }] });
  await a.call('POST', '/api/code/send', { purpose: 'delete', parent: f.parent });
  assert.equal(a.mail.at(-1).to, 'mum@example.com'); assert.match(a.mail.at(-1).subject, /Delete/);
  const r = await a.call('POST', '/api/code/verify', { purpose: 'delete', parent: f.parent, code: a.lastCode() });
  assert.equal(r.deleted, true);
  assert.equal((await a.call('POST', '/api/status', { token: f.token })).signedIn, false);
  const left = [...a.redis._m.keys()].filter((k) => /^(acct|email|dev|prog|stats):/.test(k));
  assert.deepEqual(left, []);
  // the email can sign up again from scratch
  assert.equal((await signUp(a, 'mum@example.com', dev(1))).account.profiles.length, 0);
});

test('reminders two weeks before the pass ends; unused families are warned, then deleted', async () => {
  const a = setup();
  const s = await signUp(a, 'aunt@example.com', dev(5));
  a.clock.t = s.account.pass.expiresAt - 10 * DAY;
  assert.equal((await a.call('GET', '/api/cron/reminders')).status, 401);
  const auth = { authorization: 'Bearer cron' };
  let r = await a.call('GET', '/api/cron/reminders', undefined, auth);
  assert.equal(r.reminded, 1); assert.match(a.mail.at(-1).subject, /ends on/);
  assert.equal((await a.call('GET', '/api/cron/reminders', undefined, auth)).reminded, 0);
  a.clock.t = s.account.pass.expiresAt + DAY;
  r = await a.call('POST', '/api/status', { token: s.token });
  assert.equal(r.signedIn, true); assert.equal(r.account.pass.active, false);
  // two years without use: a warning, and coming back cancels it
  a.clock.t += 731 * DAY;
  r = await a.call('GET', '/api/cron/reminders', undefined, auth);
  assert.equal(r.warned, 1); assert.match(a.mail.at(-1).subject, /deleted on/);
  await a.call('POST', '/api/sync', { token: s.token });
  a.clock.t += 31 * DAY;
  r = await a.call('GET', '/api/cron/reminders', undefined, auth);
  assert.equal(r.deleted, 0);
  // gone quiet again: warned, then deleted 30 days later
  a.clock.t += 731 * DAY;
  assert.equal((await a.call('GET', '/api/cron/reminders', undefined, auth)).warned, 1);
  a.clock.t += 31 * DAY;
  assert.equal((await a.call('GET', '/api/cron/reminders', undefined, auth)).deleted, 1);
  assert.equal((await a.call('POST', '/api/status', { token: s.token })).signedIn, false);
});

test('ask a grown-up: only the emailed link can pay; the child device joins itself; the paying phone sets the PIN', async () => {
  const a = setup();
  let r = await a.call('POST', '/api/ask', { email: 'dad@example.com', device: dev(9), name: 'iPad' });
  const poll = r.poll; assert.ok(poll); assert.equal(r.request, undefined);
  const link = a.mail.at(-1).text.match(/\?r=([\w-]+)/)[1];
  assert.notEqual(link, poll);
  // the child device's own secret can't start a payment (that was a way into someone else's family)
  assert.equal((await a.call('POST', '/api/checkout', { request: poll })).error, 'request_expired');
  assert.equal((await a.call('POST', '/api/ask/status', { poll, device: dev(9) })).status, 'waiting');
  assert.equal((await a.call('POST', '/api/ask/status', { poll, device: dev(8) })).status, 403);
  assert.equal((await a.call('POST', '/api/ask/info', { request: link })).deviceName, 'iPad');
  await a.call('POST', '/api/checkout', { request: link });
  const id = [...a.sessions.keys()].pop();
  assert.equal(a.sessions.get(id).customer_email, 'dad@example.com');
  a.pay(id);
  r = await a.call('POST', '/api/claim', { session: id, device: dev(20), name: 'Dad’s phone' });
  assert.equal(r.forOtherDevice, true); assert.ok(r.token); assert.equal(r.needsPin, true);
  r = await a.call('POST', '/api/ask/status', { poll, device: dev(9) });
  assert.equal(r.status, 'joined'); assert.ok(r.token);
  // the child's device can't set the first PIN; Dad's phone (which paid) can
  assert.equal((await a.call('POST', '/api/pin/set', { token: r.token, pin: '123456' })).error, 'not_allowed');
  assert.equal((await a.call('POST', '/api/pin/set', { token: (await a.call('POST', '/api/claim', { session: id, device: dev(20) })).token, pin: '123456' })).ok, true);
  for (let i = 0; i < 2; i++) await a.call('POST', '/api/ask', { email: 'dad@example.com', device: dev(10), name: 'iPad' });
  assert.equal((await a.call('POST', '/api/ask', { email: 'dad@example.com', device: dev(11), name: 'iPad' })).status, 429);
});

test('guesses sent all at once still only get 5 tries at an email code', async () => {
  const a = setup();
  await signUp(a);
  await a.call('POST', '/api/code/send', { purpose: 'login', email: 'mum@example.com' });
  const code = a.lastCode();
  const guesses = [];
  for (let i = 0; i < 40; i++) { const g = String(i).padStart(6, '0'); if (g !== code) guesses.push(a.call('POST', '/api/code/verify', { purpose: 'login', email: 'mum@example.com', code: g, device: dev(30) })); }
  const rs = await Promise.all(guesses);
  assert.ok(rs.filter((r) => r.error === 'wrong_code').length <= 5);
  assert.equal((await a.call('POST', '/api/code/verify', { purpose: 'login', email: 'mum@example.com', code, device: dev(30) })).ok, false);
});

test('a paid Stripe session adds a year once, even after the family is deleted; old success links stop working', async () => {
  const a = setup();
  const f = await family(a);
  const id = [...a.sessions.keys()][0];
  await a.call('POST', '/api/code/send', { purpose: 'delete', parent: f.parent });
  await a.call('POST', '/api/code/verify', { purpose: 'delete', parent: f.parent, code: a.lastCode() });
  const r = await a.call('POST', '/api/claim', { session: id, device: dev(1) });
  assert.equal(r.ok, false);
  // a link more than a day old is refused
  const b = setup();
  await b.call('POST', '/api/code/send', { purpose: 'pay', email: 'x@example.com' });
  const v = await b.call('POST', '/api/code/verify', { purpose: 'pay', email: 'x@example.com', code: b.lastCode() });
  await b.call('POST', '/api/checkout', { ticket: v.ticket });
  const sid = [...b.sessions.keys()][0]; b.pay(sid); b.sessions.get(sid).created = Math.floor(b.clock.t / 1000) - 2 * 86400;
  assert.equal((await b.call('POST', '/api/claim', { session: sid, device: dev(1) })).error, 'link_expired');
});

test('parent sessions end when the PIN changes or that device is removed; PIN guesses at once still lock', async () => {
  const a = setup();
  const f = await family(a);
  assert.equal((await a.call('POST', '/api/pin/set', { token: f.token, parent: f.parent, pin: '111222' })).ok, true);
  assert.equal((await a.call('POST', '/api/account/export', { parent: f.parent })).error, 'signed_out');
  const kid = (await login(a, 'mum@example.com', dev(2))).token;
  const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => a.call('POST', '/api/parent/start', { token: kid, pin: String(900000 + i) })));
  assert.ok(rs.filter((r) => r.error === 'wrong_pin').length <= 3);
  assert.equal((await a.call('POST', '/api/parent/start', { token: kid, pin: '111222' })).error, 'pin_locked');
  // a sync about a game the server has never seen, with an old base, doesn't crash
  const pid = (await a.call('POST', '/api/profiles/save', { parent: (await a.call('POST', '/api/parent/start', { token: f.token, pin: '111222' })).parent, profile: { nickname: 'Lily' } })).profile.id;
  const r = await a.call('POST', '/api/sync', { token: f.token, progress: [{ profile: pid, game: 'yarn', data: { level: 2 }, base: 4 }] });
  assert.equal(r.ok, true); assert.deepEqual(r.results.conflicts[0], { profile: pid, game: 'yarn', rev: 0, data: null });
});

test('bad input is turned away', async () => {
  const a = setup();
  assert.equal((await a.call('POST', '/api/claim', { session: 'nope', device: dev(1) })).error, 'bad_session');
  assert.equal((await a.call('POST', '/api/claim', { session: 'cs_1', device: 'x' })).error, 'bad_device');
  assert.equal((await a.call('POST', '/api/code/send', { purpose: 'pay', email: 'not an email' })).error, 'bad_email');
  assert.equal((await a.call('POST', '/api/code/send', { purpose: 'hack', email: 'a@b.co' })).error, 'bad_purpose');
  assert.equal((await a.call('POST', '/api/status', { token: 'made-up' })).signedIn, false);
  assert.equal((await a.call('POST', '/api/sync', { token: 'made-up' })).signedIn, false);
  assert.equal((await a.call('POST', '/api/status', 'not json')).error, 'bad_json');
  assert.equal((await a.call('POST', '/api/status', '[1,2]')).signedIn, false);
  assert.equal((await a.call('GET', '/api/nothing')).status, 404);
  assert.equal(LIMITS.pinTries, 4);
});
