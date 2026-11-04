/* Run with: node --test tests/  (uses fakes for Redis, Stripe checkout and email; real Stripe webhook signing) */
import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { createApp, LIMITS } from '../server/app.js';

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
    async smembers(k) { const v = alive(k); return v ? JSON.parse(v.val) : []; }
  };
}

function setup(envExtra = {}) {
  const clock = { t: Date.UTC(2026, 10, 4) };
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
    const r = await app.fetch(new Request('https://cosy.test' + path, { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': headers.ip || '10.0.0.' + (ip++ % 200), ...headers }, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }));
    return { status: r.status, ...(await r.json()) };
  };
  const pay = (id, email, status = 'paid') => { const s = sessions.get(id); s.payment_status = status; s.customer_details = { email }; return s; };
  const lastCode = () => { const m = mail[mail.length - 1]; return m && (m.subject.match(/(\d{6})/) || [])[1]; };
  return { clock, call, pay, mail, sessions, lastCode, real, redis };
}
const dev = (i) => 'device_' + String(i).padStart(8, '0');

test('config reports the switch and price', async () => {
  const a = setup(); let r = await a.call('GET', '/api/config');
  assert.equal(r.passRequired, true); assert.equal(r.price, '$5.99'); assert.equal(r.deviceLimit, 6);
  const b = setup({ PASS_REQUIRED: 'off' }); r = await b.call('GET', '/api/config'); assert.equal(r.passRequired, false);
});

test('buy on this device: pay, come back, signed in for a year', async () => {
  const a = setup();
  let r = await a.call('POST', '/api/checkout', {});
  assert.ok(r.url);
  const id = [...a.sessions.keys()][0];
  assert.equal(a.sessions.get(id)._params.allow_promotion_codes, true);
  r = await a.call('POST', '/api/claim', { session: id, device: dev(1), name: 'iPad' });
  assert.equal(r.error, 'not_paid');
  a.pay(id, 'Mum@Example.com');
  r = await a.call('POST', '/api/claim', { session: id, device: dev(1), name: 'iPad' });
  assert.equal(r.ok, true); assert.ok(r.token);
  assert.equal(r.pass.expiresAt, a.clock.t + 365 * DAY);
  assert.equal(r.pass.email, 'm***m@example.com');
  const st = await a.call('POST', '/api/status', { token: r.token });
  assert.equal(st.signedIn, true); assert.equal(st.pass.active, true);
  // the same paid link can't unlock a second device
  const r2 = await a.call('POST', '/api/claim', { session: id, device: dev(2), name: 'Phone' });
  assert.equal(r2.error, 'already_claimed');
  // but the same device can come back
  const r3 = await a.call('POST', '/api/claim', { session: id, device: dev(1), name: 'iPad' });
  assert.equal(r3.ok, true);
});

test('webhook and claim together count the payment once', async () => {
  const a = setup();
  await a.call('POST', '/api/checkout', { email: 'dad@example.com' });
  const id = [...a.sessions.keys()][0];
  const s = a.pay(id, 'dad@example.com');
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: s } });
  const sig = a.real.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test' });
  let r = await a.call('POST', '/api/webhook', payload, { 'stripe-signature': sig });
  assert.equal(r.received, true);
  r = await a.call('POST', '/api/webhook', payload, { 'stripe-signature': sig });
  r = await a.call('POST', '/api/claim', { session: id, device: dev(1), name: 'iPad' });
  assert.equal(r.pass.expiresAt, a.clock.t + 365 * DAY);
  const bad = await a.call('POST', '/api/webhook', payload, { 'stripe-signature': 't=1,v1=nope' });
  assert.equal(bad.status, 400);
});

test('free with a 100% promotion code', async () => {
  const a = setup();
  await a.call('POST', '/api/checkout', {});
  const id = [...a.sessions.keys()][0];
  a.pay(id, 'mum@example.com', 'no_payment_required');
  const r = await a.call('POST', '/api/claim', { session: id, device: dev(1), name: 'iPad' });
  assert.equal(r.ok, true); assert.equal(r.pass.active, true);
});

async function buy(a, email, device) {
  await a.call('POST', '/api/checkout', { email });
  const id = [...a.sessions.keys()].pop();
  a.pay(id, email);
  return a.call('POST', '/api/claim', { session: id, device, name: 'iPad' });
}

test('sign in with an emailed code', async () => {
  const a = setup();
  await buy(a, 'mum@example.com', dev(1));
  // unknown email: same answer, no email sent
  let before = a.mail.length;
  let r = await a.call('POST', '/api/code/send', { email: 'nobody@example.com' });
  assert.equal(r.ok, true); assert.equal(a.mail.length, before);
  r = await a.call('POST', '/api/code/send', { email: 'MUM@example.com ' });
  assert.equal(a.mail.length, before + 1);
  const code = a.lastCode(); assert.match(code, /^\d{6}$/);
  const wrong = code === '000000' ? '111111' : '000000';
  r = await a.call('POST', '/api/code/verify', { email: 'mum@example.com', code: wrong, device: dev(2), name: 'Phone' });
  assert.equal(r.error, 'wrong_code'); assert.equal(r.triesLeft, 4);
  r = await a.call('POST', '/api/code/verify', { email: 'mum@example.com', code, device: dev(2), name: 'Phone' });
  assert.equal(r.ok, true); assert.ok(r.token); assert.equal(r.pass.deviceCount, 2);
  // a code works once
  r = await a.call('POST', '/api/code/verify', { email: 'mum@example.com', code, device: dev(3), name: 'Phone' });
  assert.equal(r.error, 'code_expired');
  // too many wrong tries kills the code
  await a.call('POST', '/api/code/send', { email: 'mum@example.com' });
  for (let i = 0; i < 4; i++) await a.call('POST', '/api/code/verify', { email: 'mum@example.com', code: 'abc', device: dev(3) });
  r = await a.call('POST', '/api/code/verify', { email: 'mum@example.com', code: 'abc', device: dev(3) });
  assert.equal(r.error, 'too_many_tries');
  // codes expire after 10 minutes
  await a.call('POST', '/api/code/send', { email: 'mum@example.com' });
  const c2 = a.lastCode(); a.clock.t += 11 * 60 * 1000;
  r = await a.call('POST', '/api/code/verify', { email: 'mum@example.com', code: c2, device: dev(3) });
  assert.equal(r.error, 'code_expired');
});

test('six devices, then remove one to add another; removals are limited', async () => {
  const a = setup();
  const tokens = [(await buy(a, 'mum@example.com', dev(1))).token];
  for (let i = 2; i <= 6; i++) {
    a.clock.t += 61 * 60 * 1000; // stay under the hourly code limit
    await a.call('POST', '/api/code/send', { email: 'mum@example.com' });
    const r = await a.call('POST', '/api/code/verify', { email: 'mum@example.com', code: a.lastCode(), device: dev(i), name: 'Tab ' + i });
    assert.equal(r.ok, true); tokens.push(r.token);
  }
  a.clock.t += 61 * 60 * 1000;
  await a.call('POST', '/api/code/send', { email: 'mum@example.com' });
  let r = await a.call('POST', '/api/code/verify', { email: 'mum@example.com', code: a.lastCode(), device: dev(7), name: 'New' });
  assert.equal(r.error, 'device_limit'); assert.equal(r.devices.length, 6); assert.ok(r.manage);
  const manage = r.manage;
  r = await a.call('POST', '/api/devices/remove', { manage, id: dev(2) });
  assert.equal(r.ok, true); assert.equal(r.devices.length, 5);
  r = await a.call('POST', '/api/devices/add', { manage, device: dev(7), name: 'New' });
  assert.equal(r.ok, true);
  // the removed device is signed out at its next check
  r = await a.call('POST', '/api/status', { token: tokens[1] });
  assert.equal(r.signedIn, false);
  // two more removals are fine, the fourth in 30 days is not
  r = await a.call('POST', '/api/devices/remove', { token: tokens[0], id: dev(3) }); assert.equal(r.ok, true);
  r = await a.call('POST', '/api/devices/remove', { token: tokens[0], id: dev(4) }); assert.equal(r.ok, true);
  r = await a.call('POST', '/api/devices/remove', { token: tokens[0], id: dev(5) }); assert.equal(r.error, 'removal_limit');
  // signing yourself out never counts
  r = await a.call('POST', '/api/devices/remove', { token: tokens[5], id: dev(6) }); assert.equal(r.ok, true);
  a.clock.t += 31 * DAY;
  r = await a.call('POST', '/api/devices/remove', { token: tokens[0], id: dev(5) }); assert.equal(r.ok, true);
});

test('ask a grown-up: email link, pay on their phone, child device unlocks itself', async () => {
  const a = setup();
  let r = await a.call('POST', '/api/ask', { email: 'dad@example.com', device: dev(9), name: 'iPad' });
  assert.equal(r.ok, true);
  const reqId = r.request;
  const m = a.mail.pop(); assert.match(m.html, /cosy\.test\/unlock\/\?r=/); assert.match(m.subject, /unlock/);
  r = await a.call('POST', '/api/ask/status', { request: reqId, device: dev(9) });
  assert.equal(r.status, 'waiting');
  r = await a.call('POST', '/api/ask/status', { request: reqId, device: dev(8) });
  assert.equal(r.status, 403);
  r = await a.call('POST', '/api/ask/info', { request: reqId });
  assert.equal(r.status, 'waiting'); assert.equal(r.deviceName, 'iPad');
  r = await a.call('POST', '/api/checkout', { request: reqId });
  const id = [...a.sessions.keys()].pop();
  assert.equal(a.sessions.get(id).customer_email, 'dad@example.com');
  assert.match(a.sessions.get(id)._params.success_url, /&r=/);
  a.pay(id, 'dad@example.com');
  r = await a.call('POST', '/api/claim', { session: id, device: dev(20), name: 'Phone' });
  assert.equal(r.forOtherDevice, true); assert.equal(r.token, undefined);
  r = await a.call('POST', '/api/ask/status', { request: reqId, device: dev(9) });
  assert.equal(r.status, 'unlocked'); assert.ok(r.token);
  r = await a.call('POST', '/api/ask/status', { request: reqId, device: dev(9) });
  assert.equal(r.status, 'expired');
  // can't be used to spam an inbox
  for (let i = 0; i < 2; i++) await a.call('POST', '/api/ask', { email: 'dad@example.com', device: dev(10), name: 'iPad' });
  r = await a.call('POST', '/api/ask', { email: 'dad@example.com', device: dev(11), name: 'iPad' });
  assert.equal(r.status, 429);
  // requests disappear after a day
  r = await a.call('POST', '/api/ask', { email: 'nan@example.com', device: dev(12), name: 'iPad' });
  a.clock.t += 25 * 60 * 60 * 1000;
  assert.equal((await a.call('POST', '/api/ask/status', { request: r.request, device: dev(12) })).status, 'expired');
});

test('renewing early adds a year on; passes end; reminders go out once', async () => {
  const a = setup();
  const first = await buy(a, 'mum@example.com', dev(1));
  const end1 = first.pass.expiresAt;
  a.clock.t += 300 * DAY;
  await a.call('POST', '/api/checkout', { token: first.token });
  const id = [...a.sessions.keys()].pop();
  assert.equal(a.sessions.get(id).customer_email, 'mum@example.com');
  a.pay(id, 'mum@example.com');
  let r = await a.call('POST', '/api/claim', { session: id, device: dev(1), name: 'iPad' });
  assert.equal(r.pass.expiresAt, end1 + 365 * DAY);
  // a different family whose pass runs out
  const other = await buy(a, 'aunt@example.com', dev(5));
  a.clock.t = other.pass.expiresAt - 10 * DAY;
  r = await a.call('GET', '/api/cron/reminders', undefined, {});
  assert.equal(r.status, 401);
  const before = a.mail.length;
  r = await a.call('GET', '/api/cron/reminders', undefined, { authorization: 'Bearer cron' });
  assert.equal(r.sent, 1); assert.equal(a.mail[before].to, 'aunt@example.com'); assert.match(a.mail[before].subject, /ends on/);
  r = await a.call('GET', '/api/cron/reminders', undefined, { authorization: 'Bearer cron' });
  assert.equal(r.sent, 0);
  a.clock.t = other.pass.expiresAt + DAY;
  r = await a.call('POST', '/api/status', { token: other.token });
  assert.equal(r.signedIn, true); assert.equal(r.pass.active, false);
});

test('bad input is turned away', async () => {
  const a = setup();
  assert.equal((await a.call('POST', '/api/claim', { session: 'nope', device: dev(1) })).error, 'bad_session');
  assert.equal((await a.call('POST', '/api/claim', { session: 'cs_1', device: 'x' })).error, 'bad_device');
  assert.equal((await a.call('POST', '/api/code/send', { email: 'not an email' })).error, 'bad_email');
  assert.equal((await a.call('POST', '/api/status', { token: 'made-up' })).signedIn, false);
  assert.equal((await a.call('POST', '/api/status', 'not json')).error, 'bad_json');
  assert.equal((await a.call('GET', '/api/nothing')).status, 404);
});
