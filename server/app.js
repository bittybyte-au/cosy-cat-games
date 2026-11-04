/* Cosy Cat Games – family accounts server.
   One fetch handler routes every /api/* request. All storage is in Redis (Upstash).

   What is stored (no real names, ages, birthdays or photos of children, ever):
     acct:<id>                    a family: email, pass expiry, timezone, settings, PIN hash,
                                  devices (name, shared, hashed token) and profiles (nickname, avatar, toddler, limits)
     email:<email>                which family id an email belongs to
     dev:<sha256(token)>          which family and device a device token belongs to
     prog:<id>:<profile>          saved game progress for one profile, one entry per game, each with a revision number
     stats:<id>:<profile>         counts games report (levels finished, dishes cooked) for avatar unlocks
     play:<id>:<profile>:<day>    minutes played that day per device, plus any extra time a parent added (3 days)
     code:<purpose>:<email>       a pending 6-digit email code, hashed (10 minutes)
     ticket:<sha>                 proof an email was checked, for paying or resetting the PIN (1 hour)
     parent:<sha>                 a parent dashboard session after the PIN (15 minutes)
     manage:<sha>                 permission to remove a device when the family is full (10 minutes)
     join:<code>                  a "Join a family" request shown on a child's device (10 minutes)
     req:<id>                     an "ask a grown-up to buy" request (24 hours)
     pinfail / pinlock / pinmail  wrong PIN counts and the 1-hour lock, per device
     undo:<sha>                   lets the old address undo an email change (7 days) */
import crypto from 'node:crypto';
import * as E from './emails.js';

const DAY = 24 * 60 * 60 * 1000;
const YEAR = 365 * DAY;
export const LIMITS = {
  devices: 6,
  profiles: 4,
  removalsPer30Days: 3,
  codeTtlSec: 10 * 60,
  codeTries: 5,
  ticketTtlSec: 60 * 60,
  requestTtlSec: 24 * 60 * 60,
  joinTtlSec: 10 * 60,
  manageTtlSec: 10 * 60,
  parentTtlSec: 15 * 60,
  pinTries: 4,
  pinLockSec: 60 * 60,
  remindDaysBefore: 14,
  progressBytes: 30000,
  gamesPerProfile: 60,
  inactiveDays: 730,
  deleteWarnDays: 30,
  emailChangeEveryDays: 30,
  undoDays: 7,
  extraChoices: [15, 30, 60]
};
export const DEFAULT_TZ = 'Australia/Sydney';
const JOIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0 or I/1
const CODE_PURPOSES = ['pay', 'login', 'join', 'pin-reset', 'delete', 'email-change'];

export function dayIn(tz, t) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz || DEFAULT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
}
export function validTz(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch (e) { return false; }
}

export function createApp({ redis, stripe, mailer, env, now = () => Date.now() }) {
  const SITE = (env.SITE_URL || '').replace(/\/$/, '');
  const PRICE_CENTS = parseInt(env.PASS_PRICE_CENTS || '599', 10);
  const SECRET = env.CODE_SECRET || 'dev-only-secret'; // api/index.js refuses to start without CODE_SECRET

  /* ---------- helpers ---------- */
  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
  const fail = (error, status = 400, extra = {}) => json({ ok: false, error, ...extra }, status);
  const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
  const hmac = (s) => crypto.createHmac('sha256', SECRET).update(String(s)).digest('hex');
  const randomToken = () => crypto.randomBytes(32).toString('base64url');
  const randomId = () => crypto.randomBytes(12).toString('base64url');
  const normEmail = (e) => String(e || '').trim().toLowerCase();
  const validEmail = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(e) && e.length <= 254;
  const validDevice = (d) => typeof d === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(d);
  const validGame = (g) => typeof g === 'string' && /^[a-z0-9-]{1,32}$/.test(g);
  const cleanName = (n) => String(n || 'Device').replace(/[^\w\s'’-]/g, '').trim().slice(0, 30) || 'Device';
  const cleanNick = (n) => String(n || '').replace(/[<>"&\u0000-\u001f]/g, '').trim().slice(0, 16);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const isActive = (a) => !!a && (a.never === true || (a.expiresAt || 0) > now());
  const tzOf = (a) => (a && validTz(a.timezone) ? a.timezone : DEFAULT_TZ);

  async function getJSON(key) { const v = await redis.get(key); if (v == null) return null; return typeof v === 'string' ? JSON.parse(v) : v; }
  async function setJSON(key, val, ttlSec) { const s = JSON.stringify(val); return ttlSec ? redis.set(key, s, { ex: ttlSec }) : redis.set(key, s); }

  /* a simple lock so two requests never overwrite each other's changes */
  async function withLock(name, fn) {
    const key = 'lock:' + name;
    for (let i = 0; i < 50; i++) {
      const mine = crypto.randomBytes(9).toString('base64url');
      const got = await redis.set(key, mine, { nx: true, ex: 10 });
      if (got) { try { return await fn(); } finally { await unlock(key, mine); } }
      await sleep(100);
    }
    throw new Error('busy');
  }
  /* only remove the lock if it is still ours (it may have timed out and been taken by another request) */
  async function unlock(key, mine) {
    if (redis.eval) { await redis.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", [key], [mine]); return; }
    if ((await redis.get(key)) === mine) await redis.del(key);
  }
  const getAcct = (id) => getJSON('acct:' + id);
  const putAcct = (a) => setJSON('acct:' + a.id, a);
  /* load, change and save a family under its lock; fn returns a Response or anything */
  const editAcct = (id, fn) => withLock('a:' + id, async () => { const a = await getAcct(id); return fn(a); });

  async function rateOk(key, max, windowSec) {
    // create the counter with its expiry first, so it can never be left without one
    await redis.set('rl:' + key, '0', { nx: true, ex: windowSec });
    return (await redis.incr('rl:' + key)) <= max;
  }
  const ipOf = (request) => (request.headers.get('x-real-ip') || (request.headers.get('x-forwarded-for') || '').split(',')[0]).trim() || 'unknown';

  /* ---------- PIN ---------- */
  const PBKDF2_ITER = 100000;
  function makePin(pin) {
    const salt = crypto.randomBytes(16).toString('hex');
    const osalt = crypto.randomBytes(16).toString('hex');
    return {
      salt, h: crypto.scryptSync(pin, salt, 32).toString('hex'), setAt: now(),
      // devices keep this so the PIN also works offline (PBKDF2-SHA256, which browsers can compute)
      offline: { salt: osalt, iter: PBKDF2_ITER, h: crypto.pbkdf2Sync(pin, osalt, PBKDF2_ITER, 32, 'sha256').toString('hex') }
    };
  }
  function pinMatches(rec, pin) {
    if (!rec || typeof pin !== 'string') return false;
    const h = crypto.scryptSync(pin, rec.salt, 32);
    return crypto.timingSafeEqual(h, Buffer.from(rec.h, 'hex'));
  }
  const validPin = (pin) => typeof pin === 'string' && /^\d{6}$/.test(pin);

  /* ---------- what devices get to see ---------- */
  const publicProfile = (p) => ({
    id: p.id, nickname: p.nickname, avatar: p.avatar || null, toddler: !!p.toddler,
    limitMin: p.limitMin || null, list: p.list || null, filter: p.filter || 'all'
  });
  const publicDevices = (a, thisId) => (a.devices || []).map((d) => ({
    id: d.id, name: d.name, shared: !!d.shared, addedAt: d.addedAt, lastSeen: d.lastSeen, thisDevice: d.id === thisId
  }));
  const publicAccount = (a, thisId) => ({
    email: E.maskEmail(a.email),
    pass: { active: isActive(a), never: a.never === true, expiresAt: a.expiresAt || 0 },
    timezone: tzOf(a),
    today: dayIn(tzOf(a), now()),
    settings: { sound: false, pinToSwitch: true, ...(a.settings || {}) },
    pinSet: !!a.pin,
    pinOffline: a.pin ? a.pin.offline : null,
    profiles: (a.profiles || []).map(publicProfile),
    devices: publicDevices(a, thisId),
    limits: { devices: LIMITS.devices, profiles: LIMITS.profiles }
  });

  function cleanAvatar(av) {
    if (!av || typeof av !== 'object' || Array.isArray(av)) return null;
    const out = {};
    for (const k of ['type', 'color', 'bg', 'head', 'face']) {
      if (av[k] == null || av[k] === '') continue;
      if (typeof av[k] !== 'string' || !/^[#a-zA-Z0-9_-]{1,32}$/.test(av[k])) return null;
      out[k] = av[k];
    }
    return out;
  }
  function cleanList(list) {
    if (list == null) return null;
    if (typeof list !== 'object' || !['allow', 'block'].includes(list.mode) || !Array.isArray(list.games)) return undefined;
    const games = [...new Set(list.games.filter(validGame))].slice(0, 200);
    return { mode: list.mode, games };
  }

  /* ---------- devices and sessions ---------- */
  async function addDevice(acctId, deviceId, name, opts = {}) {
    return editAcct(acctId, async (a) => {
      if (!a) return { missing: true };
      a.devices = a.devices || [];
      const existing = a.devices.find((d) => d.id === deviceId);
      if (!existing && a.devices.length >= LIMITS.devices) return { limit: true, acct: a };
      const token = randomToken();
      const th = sha(token);
      if (existing) { await redis.del('dev:' + existing.th); existing.th = th; existing.lastSeen = now(); if (name) existing.name = cleanName(name); if (opts.payer) existing.payer = true; }
      else a.devices.push({ id: deviceId, name: cleanName(name), th, shared: false, addedAt: now(), lastSeen: now(), ...(opts.payer ? { payer: true } : {}) });
      a.lastUsedAt = now(); a.warnedAt = null;
      await setJSON('dev:' + th, { acct: a.id, id: deviceId });
      await putAcct(a);
      return { token, acct: a };
    });
  }
  async function fromToken(token) {
    if (!token || typeof token !== 'string' || token.length > 100) return null;
    const dev = await getJSON('dev:' + sha(token));
    if (!dev) return null;
    const acct = await getAcct(dev.acct);
    if (!acct) return null;
    const device = (acct.devices || []).find((d) => d.id === dev.id);
    if (!device) return null;
    return { acctId: acct.id, id: dev.id, acct, device };
  }
  async function newSession(prefix, value, ttl) {
    const t = randomToken();
    await setJSON(prefix + ':' + sha(t), value, ttl);
    return t;
  }
  async function fromSession(prefix, t) {
    if (!t || typeof t !== 'string' || t.length > 100) return null;
    return getJSON(prefix + ':' + sha(t));
  }
  const newManage = (acctId) => newSession('manage', { acct: acctId }, LIMITS.manageTtlSec);
  /* parent session from the dashboard, or a device-full "manage" pass for device changes only */
  async function parentOf(body) {
    const s = await fromSession('parent', body.parent);
    if (!s) return null;
    const a = await getAcct(s.acct);
    if (!a || !a.pin || a.pin.salt !== s.pinAt || !(a.devices || []).some((d) => d.id === s.device)) return null;
    return a.id;
  }

  async function deleteAccount(a) {
    for (const d of a.devices || []) await redis.del('dev:' + d.th);
    for (const p of a.profiles || []) { await redis.del('prog:' + a.id + ':' + p.id); await redis.del('stats:' + a.id + ':' + p.id); }
    if ((await redis.get('email:' + a.email)) === a.id) await redis.del('email:' + a.email);
    await redis.del('acct:' + a.id);
    await redis.srem('accounts', a.id);
  }

  /* ---------- email codes ---------- */
  async function sendCode(purpose, email, extra = {}) {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await setJSON('code:' + purpose + ':' + email, { h: hmac(purpose + ':' + email + ':' + code), ...extra }, LIMITS.codeTtlSec);
    await redis.set('codetry:' + purpose + ':' + email, '0', { ex: LIMITS.codeTtlSec });
    await mailer.send({ to: email, ...E.codeEmail(code, purpose) });
  }
  /* returns { rec } when the code is right, or { res } with the error to send back */
  async function checkCode(purpose, email, code) {
    const key = 'code:' + purpose + ':' + email, tryKey = 'codetry:' + purpose + ':' + email;
    const rec = await getJSON(key);
    if (!rec) return { res: fail('code_expired') };
    // count the try first (atomically), so many guesses sent at once still only get 5 between them
    const n = await redis.incr(tryKey);
    if (n > LIMITS.codeTries) { await redis.del(key); return { res: fail('too_many_tries') }; }
    const clean = String(code || '').replace(/\D/g, '');
    const a = Buffer.from(hmac(purpose + ':' + email + ':' + clean), 'hex'), b = Buffer.from(String(rec.h), 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      if (n >= LIMITS.codeTries) { await redis.del(key); return { res: fail('too_many_tries') }; }
      return { res: fail('wrong_code', 400, { triesLeft: LIMITS.codeTries - n }) };
    }
    // only one request can use a code, even if two arrive together
    if (!(await redis.del(key))) return { res: fail('code_expired') };
    await redis.del(tryKey);
    return { rec };
  }

  /* ---------- the pass ---------- */
  async function fulfill(session) {
    if (!session || (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required')) return null;
    const md = session.metadata || {};
    const email = normEmail(md.email || (session.customer_details && session.customer_details.email) || session.customer_email);
    if (!validEmail(email)) return null;
    const seen = await redis.get('paid:' + session.id);
    if (seen) return getAcct(String(seen)).then((a) => a || null);
    const acct = await withLock('e:' + email, async () => {
      let id = await redis.get('email:' + email);
      if (!id) {
        id = randomId();
        const a = {
          id, email, createdAt: now(), lastUsedAt: now(), expiresAt: 0, purchases: [],
          timezone: validTz(md.tz) ? md.tz : DEFAULT_TZ, settings: { sound: false, pinToSwitch: true },
          pin: null, devices: [], removals: [], profiles: []
        };
        await putAcct(a);
        await redis.set('email:' + email, id);
        await redis.sadd('accounts', id);
      }
      return editAcct(String(id), async (a) => {
        // remembered forever, so a deleted or renamed family can't replay an old payment for another year
        const first = await redis.set('paid:' + session.id, a.id, { nx: true });
        if (first && !a.purchases.some((p) => p.id === session.id)) {
          a.expiresAt = Math.max(now(), a.expiresAt || 0) + YEAR;
          a.purchases.push({ id: session.id, at: now(), amount: session.amount_total || 0, currency: session.currency || 'aud' });
          a.remindedFor = null;
          await putAcct(a);
        }
        return a;
      });
    });
    if (md.request) {
      const req = await getJSON('req:' + md.request);
      if (req && req.status === 'waiting') { req.status = 'paid'; req.acct = acct.id; await setJSON('req:' + md.request, req, LIMITS.requestTtlSec); }
    }
    return acct;
  }

  /* ---------- routes ---------- */
  const routes = {
    'GET /api/config': async () => json({
      ok: true,
      passRequired: env.PASS_REQUIRED === 'on',
      price: '$' + (PRICE_CENTS / 100).toFixed(2),
      deviceLimit: LIMITS.devices,
      profileLimit: LIMITS.profiles
    }),

    /* --- email codes, one route for every purpose --- */
    'POST /api/code/send': async (body, request) => {
      const purpose = String(body.purpose || 'login');
      if (!CODE_PURPOSES.includes(purpose)) return fail('bad_purpose');
      let email = normEmail(body.email), acctId = null;
      if (!(await rateOk('code-ip:' + ipOf(request), 20, 3600)) || !(await rateOk('code-all', 2000, 86400))) return fail('slow_down', 429);
      if (purpose === 'delete' || purpose === 'email-change') {
        acctId = await parentOf(body);
        if (!acctId) return fail('signed_out', 401);
        const a = await getAcct(acctId);
        // a just-changed email can't be used to delete the family before the old address has had its 7 days to undo
        if (a.emailChangedAt && now() - a.emailChangedAt < LIMITS.undoDays * DAY) return fail('changed_recently', 429, { nextAt: a.emailChangedAt + LIMITS.undoDays * DAY });
        if (purpose === 'delete') email = a.email;
        else {
          if (a.emailChangedAt && now() - a.emailChangedAt < LIMITS.emailChangeEveryDays * DAY) return fail('changed_recently', 429, { nextAt: a.emailChangedAt + LIMITS.emailChangeEveryDays * DAY });
          if (!validEmail(email)) return fail('bad_email');
          if (email === a.email) return fail('same_email');
          if (await redis.get('email:' + email)) return fail('email_taken', 409);
        }
      }
      if (!validEmail(email)) return fail('bad_email');
      if (!(await rateOk('code-email:' + email, 5, 3600))) return fail('slow_down', 429);
      if (purpose === 'pay' || purpose === 'delete' || purpose === 'email-change') await sendCode(purpose, email, acctId ? { acct: acctId } : {});
      else if (await redis.get('email:' + email)) await sendCode(purpose, email);
      // the same answer whether or not the email has an account, so nobody can use this to look families up
      return json({ ok: true });
    },

    'POST /api/code/verify': async (body, request) => {
      const purpose = String(body.purpose || 'login');
      if (!CODE_PURPOSES.includes(purpose)) return fail('bad_purpose');
      if (!(await rateOk('verify-ip:' + ipOf(request), 60, 3600))) return fail('slow_down', 429);
      let email = normEmail(body.email), acctId = null;
      if (purpose === 'delete' || purpose === 'email-change') {
        acctId = await parentOf(body);
        if (!acctId) return fail('signed_out', 401);
        if (purpose === 'delete') email = (await getAcct(acctId)).email;
      }
      if (!validEmail(email)) return fail('bad_email');
      const c = await checkCode(purpose, email, body.code);
      if (c.res) return c.res;

      if (purpose === 'pay') {
        const ticket = await newSession('ticket', { purpose: 'pay', email }, LIMITS.ticketTtlSec);
        return json({ ok: true, ticket, hasAccount: !!(await redis.get('email:' + email)) });
      }
      const id = acctId || await redis.get('email:' + email);
      if (!id) return fail('no_account');

      if (purpose === 'login' || purpose === 'join') {
        if (!validDevice(body.device)) return fail('bad_device');
        const r = await addDevice(String(id), body.device, body.name);
        if (r.missing) return fail('no_account');
        if (r.limit) return json({ ok: false, error: 'device_limit', manage: await newManage(r.acct.id), devices: publicDevices(r.acct) });
        return json({ ok: true, token: r.token, account: publicAccount(r.acct, body.device) });
      }
      if (purpose === 'pin-reset') {
        if (validDevice(body.device)) { await redis.del('pinlock:' + id + ':' + body.device); await redis.del('pinfail:' + id + ':' + body.device); }
        const ticket = await newSession('ticket', { purpose: 'pin-reset', acct: String(id) }, LIMITS.ticketTtlSec);
        return json({ ok: true, ticket });
      }
      if (purpose === 'delete') {
        const a = await getAcct(acctId);
        if (a) await withLock('a:' + a.id, () => deleteAccount(a));
        return json({ ok: true, deleted: true });
      }
      if (purpose === 'email-change') {
        if (c.rec.acct !== acctId) return fail('code_expired');
        if (await redis.get('email:' + email)) return fail('email_taken', 409);
        const before = await getAcct(acctId);
        const undo = await newSession('undo', { acct: acctId, old: before.email, new: email }, LIMITS.undoDays * 86400);
        // tell the old address first: if that email can't be sent, nothing changes
        await mailer.send({ to: before.email, ...E.emailChangedEmail(E.maskEmail(email), SITE + '/account/?undo=' + undo) });
        return withLock('e:' + email, () => editAcct(acctId, async (a) => {
          if (await redis.get('email:' + email)) return fail('email_taken', 409);
          const old = a.email;
          a.email = email; a.emailChangedAt = now();
          await putAcct(a);
          await redis.set('email:' + email, a.id);
          await redis.del('email:' + old);
          return json({ ok: true, account: publicAccount(a) });
        }));
      }
      return fail('bad_purpose');
    },

    /* the old address can put things back for 7 days */
    'POST /api/email/undo': async (body) => {
      const u = await fromSession('undo', body.t);
      if (!u) return fail('undo_expired');
      return withLock('e:' + u.old, () => editAcct(u.acct, async (a) => {
        if (!a || a.email !== u.new) return fail('undo_expired');
        const taken = await redis.get('email:' + u.old);
        if (taken && taken !== a.id) return fail('email_taken', 409);
        a.email = u.old; a.emailChangedAt = now();
        await putAcct(a);
        await redis.set('email:' + u.old, a.id);
        await redis.del('email:' + u.new);
        await redis.del('undo:' + sha(body.t));
        return json({ ok: true });
      }));
    },

    /* --- buying --- */
    /* paying needs a checked email: a "pay" ticket, or the link from an "ask a grown-up" email */
    'POST /api/checkout': async (body) => {
      let email = null, reqId = null;
      if (body.request) {
        reqId = String(body.request).slice(0, 64);
        const req = await getJSON('req:' + sha(reqId));
        if (!req || req.status !== 'waiting') return fail('request_expired', 410);
        email = req.email;
      } else {
        const t = await fromSession('ticket', body.ticket);
        if (!t || t.purpose !== 'pay') return fail('check_email_first', 401);
        email = t.email;
      }
      const metadata = { email };
      if (reqId) metadata.request = sha(reqId);
      if (validTz(body.timezone)) metadata.tz = body.timezone;
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        allow_promotion_codes: true,
        customer_email: email,
        line_items: [env.STRIPE_PRICE_ID
          ? { price: env.STRIPE_PRICE_ID, quantity: 1 }
          : { quantity: 1, price_data: { currency: 'aud', unit_amount: PRICE_CENTS, product_data: { name: 'Cosy Cat Games – one-year family pass', description: 'All games, up to ' + LIMITS.profiles + ' kids and ' + LIMITS.devices + ' devices, for one year. Does not renew automatically.' } } }],
        success_url: SITE + '/account/?paid={CHECKOUT_SESSION_ID}' + (reqId ? '&r=' + encodeURIComponent(reqId) : ''),
        cancel_url: SITE + '/account/' + (reqId ? '?r=' + encodeURIComponent(reqId) : ''),
        metadata
      });
      return json({ ok: true, url: session.url });
    },

    /* the paying device comes back here; it joins the family straight away */
    'POST /api/claim': async (body, request) => {
      if (!validDevice(body.device)) return fail('bad_device');
      const id = String(body.session || '');
      if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return fail('bad_session');
      if (!(await rateOk('claim-ip:' + ipOf(request), 30, 3600))) return fail('slow_down', 429);
      const session = await stripe.checkout.sessions.retrieve(id);
      // a success link is only good for a day after paying
      if (session.created && now() - session.created * 1000 > DAY) return fail('link_expired', 410);
      const acct = await fulfill(session);
      if (!acct) return fail('not_paid', 402);
      if (session.metadata && session.metadata.request) {
        // paid from an "ask a grown-up" email: the waiting child device joins by itself; this phone may join too
        const first = await redis.set('claimed:' + id, body.device, { nx: true, ex: 2 * 86400 });
        if (!first && String(await redis.get('claimed:' + id)) !== body.device) return json({ ok: true, forOtherDevice: true, pass: publicAccount(acct).pass });
        const r = await addDevice(acct.id, body.device, body.name, { payer: true });
        if (!r.token) return json({ ok: true, forOtherDevice: true, pass: publicAccount(acct).pass });
        return json({ ok: true, forOtherDevice: true, token: r.token, account: publicAccount(r.acct, body.device), needsPin: !r.acct.pin });
      }
      // each payment can add the device that paid, once; the link can't be passed around to add more
      const claimKey = 'claimed:' + id;
      const first = await redis.set(claimKey, body.device, { nx: true, ex: 2 * 86400 });
      if (!first) { const by = await redis.get(claimKey); if (String(by) !== body.device) return fail('already_claimed', 409); }
      const r = await addDevice(acct.id, body.device, body.name, { payer: true });
      if (r.limit) return json({ ok: false, error: 'device_limit', manage: await newManage(acct.id), devices: publicDevices(r.acct) });
      return json({ ok: true, token: r.token, account: publicAccount(r.acct, body.device), needsPin: !r.acct.pin });
    },

    /* a child's device asks a grown-up to buy: we email them a link */
    'POST /api/ask': async (body, request) => {
      const email = normEmail(body.email);
      if (!validEmail(email)) return fail('bad_email');
      if (!validDevice(body.device)) return fail('bad_device');
      const ok = (await rateOk('ask-ip:' + ipOf(request), 10, 3600)) &&
        (await rateOk('ask-dev:' + body.device, 3, 3600)) &&
        (await rateOk('ask-email:' + email, 3, 86400));
      if (!ok) return fail('slow_down', 429);
      if (!(await rateOk('ask-all', 500, 86400))) return fail('slow_down', 429);
      // two secrets: the link in the email (only the inbox owner can pay) and the device's own (only it can collect)
      const id = randomToken(), poll = randomToken();
      await setJSON('req:' + sha(id), { email, device: body.device, ps: sha(poll), name: cleanName(body.name), status: 'waiting', at: now() }, LIMITS.requestTtlSec);
      await setJSON('reqpoll:' + sha(poll), { req: sha(id) }, LIMITS.requestTtlSec);
      await mailer.send({ to: email, ...E.askEmail(SITE + '/account/?r=' + id, cleanName(body.name)) });
      return json({ ok: true, poll });
    },
    'POST /api/ask/status': async (body) => {
      const p = await fromSession('reqpoll', body.poll);
      if (!p) return json({ ok: true, status: 'expired' });
      const req = await getJSON('req:' + p.req);
      if (!req) return json({ ok: true, status: 'expired' });
      if (req.device !== body.device) return fail('wrong_device', 403);
      if (req.status !== 'paid') return json({ ok: true, status: 'waiting' });
      const r = await addDevice(req.acct, req.device, req.name);
      await redis.del('req:' + p.req); await redis.del('reqpoll:' + sha(body.poll));
      if (r.limit || r.missing) return json({ ok: true, status: 'device_limit' });
      return json({ ok: true, status: 'joined', token: r.token, account: publicAccount(r.acct, req.device) });
    },
    'POST /api/ask/info': async (body) => {
      const req = await getJSON('req:' + sha(String(body.request || '').slice(0, 64)));
      if (!req) return json({ ok: true, status: 'expired' });
      return json({ ok: true, status: req.status, deviceName: req.name, price: '$' + (PRICE_CENTS / 100).toFixed(2) });
    },

    'POST /api/webhook': async (_body, request, raw) => {
      let event;
      try { event = stripe.webhooks.constructEvent(raw, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET); }
      catch (e) { return fail('bad_signature', 400); }
      if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') await fulfill(event.data.object);
      return json({ received: true });
    },

    /* --- Join a family: the child's device shows a code, a parent types it in the dashboard --- */
    'POST /api/join/start': async (body, request) => {
      if (!validDevice(body.device)) return fail('bad_device');
      if (!(await rateOk('join-ip:' + ipOf(request), 30, 3600)) || !(await rateOk('join-dev:' + body.device, 10, 3600))) return fail('slow_down', 429);
      const secret = randomToken();
      for (let i = 0; i < 10; i++) {
        let code = '';
        for (let j = 0; j < 6; j++) code += JOIN_ALPHABET[crypto.randomInt(0, JOIN_ALPHABET.length)];
        const ok = await redis.set('join:' + code, JSON.stringify({ device: body.device, name: cleanName(body.name), sh: sha(secret), status: 'waiting' }), { nx: true, ex: LIMITS.joinTtlSec });
        if (ok) return json({ ok: true, code, secret, expiresIn: LIMITS.joinTtlSec });
      }
      return fail('busy', 503);
    },
    'POST /api/join/approve': async (body) => {
      const acctId = await parentOf(body);
      if (!acctId) return fail('signed_out', 401);
      if (!(await rateOk('join-approve:' + acctId, 20, 3600))) return fail('slow_down', 429);
      const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      const key = 'join:' + code;
      const j = await getJSON(key);
      if (!j || j.status !== 'waiting') return fail('join_expired');
      const a = await getAcct(acctId);
      if (!a.devices.some((d) => d.id === j.device) && a.devices.length >= LIMITS.devices) return fail('device_limit', 400, { devices: publicDevices(a) });
      j.status = 'approved'; j.acct = acctId;
      await setJSON(key, j, LIMITS.joinTtlSec);
      return json({ ok: true, deviceName: j.name });
    },
    'POST /api/join/poll': async (body, request) => {
      if (!(await rateOk('poll-ip:' + ipOf(request), 900, 3600))) return fail('slow_down', 429);
      const code = String(body.code || '').toUpperCase().slice(0, 6);
      const key = 'join:' + code;
      const j = await getJSON(key);
      if (!j) return json({ ok: true, status: 'expired' });
      if (sha(String(body.secret || '')) !== j.sh) return fail('wrong_device', 403);
      if (j.status !== 'approved') return json({ ok: true, status: 'waiting' });
      await redis.del(key);
      const r = await addDevice(j.acct, j.device, body.name || j.name);
      if (r.limit || r.missing) return json({ ok: true, status: 'device_limit' });
      return json({ ok: true, status: 'joined', token: r.token, account: publicAccount(r.acct, j.device) });
    },

    /* --- parent PIN --- */
    'POST /api/pin/set': async (body) => {
      const t = await fromToken(body.token);
      if (!t) return fail('signed_out', 401);
      if (!validPin(body.pin)) return fail('bad_pin');
      const parent = await parentOf(body);
      const ticket = await fromSession('ticket', body.ticket);
      return editAcct(t.acctId, async (a) => {
        const me = a.devices.find((d) => d.id === t.id) || {};
        const allowed = (!a.pin && me.payer) || parent === a.id || (ticket && ticket.purpose === 'pin-reset' && ticket.acct === a.id);
        if (!allowed) return fail('not_allowed', 403);
        a.pin = makePin(body.pin);
        await putAcct(a);
        if (body.ticket) await redis.del('ticket:' + sha(body.ticket));
        await redis.del('pinlock:' + a.id + ':' + t.id); await redis.del('pinfail:' + a.id + ':' + t.id);
        return json({ ok: true, pinOffline: a.pin.offline });
      });
    },
    /* the PIN opens a 15-minute parent session for the dashboard */
    'POST /api/parent/start': async (body) => {
      const t = await fromToken(body.token);
      if (!t) return fail('signed_out', 401);
      const a = t.acct;
      if (!a.pin) return fail('no_pin');
      const lockKey = 'pinlock:' + a.id + ':' + t.id, failKey = 'pinfail:' + a.id + ':' + t.id;
      const until = await redis.get(lockKey);
      if (until) return fail('pin_locked', 423, { until: Number(until) });
      // count the try before checking, so a burst of guesses can't all slip in before the lock
      await redis.set(failKey, '0', { nx: true, ex: LIMITS.pinLockSec });
      const n = await redis.incr(failKey);
      if (n > LIMITS.pinTries) return fail('pin_locked', 423, { until: Number(await redis.get(lockKey)) || now() + LIMITS.pinLockSec * 1000 });
      if (!pinMatches(a.pin, String(body.pin || ''))) {
        if (n >= LIMITS.pinTries) {
          const end = now() + LIMITS.pinLockSec * 1000;
          await redis.set(lockKey, String(end), { ex: LIMITS.pinLockSec });
          await redis.del(failKey);
          await sendPinLockEmail(a, t.device, now());
          return fail('pin_locked', 423, { until: end });
        }
        return fail('wrong_pin', 400, { triesLeft: LIMITS.pinTries - n });
      }
      await redis.del(failKey);
      const parent = await newSession('parent', { acct: a.id, device: t.id, pinAt: a.pin.salt }, LIMITS.parentTtlSec);
      return json({ ok: true, parent, expiresIn: LIMITS.parentTtlSec, account: publicAccount(a, t.id) });
    },
    /* a device that locked itself while offline tells us when it is back, so the parent still gets the email */
    'POST /api/pin/report': async (body) => {
      const t = await fromToken(body.token);
      if (!t) return fail('signed_out', 401);
      const at = Math.min(now(), Number(body.lockedAt) || now());
      if (now() - at < 24 * 60 * 60 * 1000) await sendPinLockEmail(t.acct, t.device, at);
      return json({ ok: true });
    },

    /* --- sync: every device sends its changes and gets the family's latest --- */
    'POST /api/sync': async (body) => {
      const t = await fromToken(body.token);
      if (!t) return json({ ok: true, signedIn: false });
      const tz = tzOf(t.acct);
      let a = t.acct;

      // profile changes kids can make themselves (not toddlers: parents do theirs), and last-used dates
      const edits = Array.isArray(body.edits) ? body.edits.slice(0, 20) : [];
      const touch = now() - (a.lastUsedAt || 0) > 60 * 60 * 1000 || now() - (t.device.lastSeen || 0) > 60 * 60 * 1000;
      if (edits.length || touch) {
        a = await editAcct(t.acctId, async (b) => {
          for (const e of edits) {
            const p = (b.profiles || []).find((x) => x.id === e.profile);
            if (!p) continue;
            if (e.filter !== undefined && ['all', 'under5', '5-10', '11+'].includes(e.filter)) p.filter = e.filter;
            if (p.toddler) continue;
            if (e.nickname !== undefined) { const n = cleanNick(e.nickname); if (n) p.nickname = n; }
            if (e.avatar !== undefined) { const av = cleanAvatar(e.avatar); if (av) p.avatar = av; }
            p.updatedAt = now();
          }
          b.lastUsedAt = now(); b.warnedAt = null;
          const d = b.devices.find((x) => x.id === t.id); if (d) d.lastSeen = now();
          await putAcct(b);
          return b;
        });
      }
      const profileIds = new Set((a.profiles || []).map((p) => p.id));

      // progress: a save is accepted only if it was made on top of the newest copy; otherwise the device gets that copy to merge
      const accepted = [], conflicts = [];
      const byProfile = {};
      for (const it of (Array.isArray(body.progress) ? body.progress.slice(0, 100) : [])) {
        if (!it || !profileIds.has(it.profile) || !validGame(it.game)) continue;
        (byProfile[it.profile] = byProfile[it.profile] || []).push(it);
      }
      for (const pid of Object.keys(byProfile)) {
        await withLock('p:' + a.id + ':' + pid, async () => {
          const key = 'prog:' + a.id + ':' + pid;
          const map = (await getJSON(key)) || {};
          let changed = false;
          for (const it of byProfile[pid]) {
            const size = JSON.stringify(it.data === undefined ? null : it.data).length;
            if (size > LIMITS.progressBytes) { conflicts.push({ profile: pid, game: it.game, error: 'too_big' }); continue; }
            const cur = map[it.game];
            if (!cur && Object.keys(map).length >= LIMITS.gamesPerProfile) { conflicts.push({ profile: pid, game: it.game, error: 'too_many_games' }); continue; }
            const base = it.base == null ? 0 : Number(it.base);
            if ((cur ? cur.rev : 0) === base) {
              map[it.game] = { rev: base + 1, data: it.data === undefined ? null : it.data, at: now() };
              accepted.push({ profile: pid, game: it.game, rev: base + 1 });
              changed = true;
            } else conflicts.push({ profile: pid, game: it.game, rev: cur ? cur.rev : 0, data: cur ? cur.data : null });
          }
          if (changed) await setJSON(key, map);
        });
      }

      // stats only ever go up (the highest count any device has seen)
      const statsBy = {};
      for (const s of (Array.isArray(body.stats) ? body.stats.slice(0, 200) : [])) {
        if (!s || !profileIds.has(s.profile) || typeof s.name !== 'string' || !/^[a-z0-9:_-]{1,64}$/.test(s.name)) continue;
        const v = Math.floor(Number(s.value)); if (!(v >= 0 && v <= 1e7)) continue;
        (statsBy[s.profile] = statsBy[s.profile] || []).push([s.name, v]);
      }
      for (const pid of Object.keys(statsBy)) {
        await withLock('s:' + a.id + ':' + pid, async () => {
          const key = 'stats:' + a.id + ':' + pid;
          const m = (await getJSON(key)) || {};
          for (const [n, v] of statsBy[pid]) if (m[n] !== undefined || Object.keys(m).length < 300) m[n] = Math.max(m[n] || 0, v);
          await setJSON(key, m);
        });
      }

      // play time: each device reports its own total for the day; the family total adds the devices up
      const today = dayIn(tz, now()), near = new Set([dayIn(tz, now() - DAY), today, dayIn(tz, now() + DAY)]);
      const playBy = {};
      for (const pl of (Array.isArray(body.play) ? body.play.slice(0, 40) : [])) {
        if (!pl || !profileIds.has(pl.profile) || !near.has(pl.day)) continue;
        const k = pl.profile + '|' + pl.day;
        (playBy[k] = playBy[k] || { profile: pl.profile, day: pl.day, minutes: 0, extend: [] }).minutes = Math.max(playBy[k] ? playBy[k].minutes : 0, Math.min(1440, Math.max(0, Math.floor(Number(pl.minutes) || 0))));
      }
      for (const ex of (Array.isArray(body.extend) ? body.extend.slice(0, 20) : [])) {
        if (!ex || !profileIds.has(ex.profile) || !near.has(ex.day) || typeof ex.id !== 'string' || ex.id.length > 40) continue;
        if (!(ex.minutes === 'unlimited' || LIMITS.extraChoices.includes(ex.minutes))) continue;
        const k = ex.profile + '|' + ex.day;
        (playBy[k] = playBy[k] || { profile: ex.profile, day: ex.day, minutes: -1, extend: [] }).extend.push(ex);
      }
      for (const k of Object.keys(playBy)) {
        const pl = playBy[k];
        await withLock('t:' + a.id + ':' + k, async () => {
          const key = 'play:' + a.id + ':' + pl.profile + ':' + pl.day;
          const rec = (await getJSON(key)) || { dev: {}, extra: 0, ext: [] };
          if (pl.minutes >= 0) rec.dev[t.id] = Math.max(rec.dev[t.id] || 0, pl.minutes);
          for (const ex of pl.extend) {
            if (rec.ext.includes(ex.id)) continue;
            rec.ext.push(ex.id);
            rec.extra = ex.minutes === 'unlimited' || rec.extra === 'unlimited' ? 'unlimited' : rec.extra + ex.minutes;
          }
          await setJSON(key, rec, 3 * 86400);
        });
      }

      // send back everything the device doesn't already have
      const known = body.known && typeof body.known === 'object' ? body.known : {};
      const progress = {}, stats = {}, played = {};
      for (const p of a.profiles || []) {
        const map = (await getJSON('prog:' + a.id + ':' + p.id)) || {};
        const kp = known[p.id] && typeof known[p.id] === 'object' ? known[p.id] : {};
        progress[p.id] = {};
        for (const g of Object.keys(map)) progress[p.id][g] = kp[g] === map[g].rev ? { rev: map[g].rev } : { rev: map[g].rev, data: map[g].data };
        stats[p.id] = (await getJSON('stats:' + a.id + ':' + p.id)) || {};
        const rec = (await getJSON('play:' + a.id + ':' + p.id + ':' + today)) || { dev: {}, extra: 0 };
        played[p.id] = { minutes: Object.values(rec.dev).reduce((x, y) => x + y, 0), extra: rec.extra };
      }
      return json({ ok: true, signedIn: true, account: publicAccount(a, t.id), progress, stats, played, results: { accepted, conflicts } });
    },

    /* a quick check without syncing anything */
    'POST /api/status': async (body) => {
      const t = await fromToken(body.token);
      if (!t) return json({ ok: true, signedIn: false });
      return json({ ok: true, signedIn: true, account: publicAccount(t.acct, t.id) });
    },

    /* --- parent dashboard (needs a parent session from the PIN) --- */
    'POST /api/profiles/save': async (body) => {
      const acctId = await parentOf(body);
      if (!acctId) return fail('signed_out', 401);
      const inp = body.profile || {};
      return editAcct(acctId, async (a) => {
        a.profiles = a.profiles || [];
        let p = inp.id ? a.profiles.find((x) => x.id === inp.id) : null;
        if (inp.id && !p) return fail('not_found', 404);
        if (!p) {
          if (a.profiles.length >= LIMITS.profiles) return fail('profile_limit');
          p = { id: randomId(), createdAt: now(), toddler: false, filter: 'all', limitMin: null, list: null, avatar: null };
          a.profiles.push(p);
        }
        if (inp.nickname !== undefined || !p.nickname) { const n = cleanNick(inp.nickname); if (!n) return fail('bad_nickname'); p.nickname = n; }
        if (inp.avatar !== undefined) { const av = cleanAvatar(inp.avatar); if (inp.avatar && !av) return fail('bad_avatar'); p.avatar = av; }
        if (inp.toddler !== undefined) p.toddler = !!inp.toddler;
        if (inp.limitMin !== undefined) {
          const m = inp.limitMin == null ? null : Math.floor(Number(inp.limitMin));
          if (m !== null && !(m >= 5 && m <= 600)) return fail('bad_limit');
          p.limitMin = m;
        }
        if (inp.list !== undefined) { const l = cleanList(inp.list); if (l === undefined) return fail('bad_list'); p.list = l; }
        p.updatedAt = now();
        await putAcct(a);
        return json({ ok: true, profile: publicProfile(p), account: publicAccount(a) });
      });
    },
    'POST /api/profiles/remove': async (body) => {
      const acctId = await parentOf(body);
      if (!acctId) return fail('signed_out', 401);
      return editAcct(acctId, async (a) => {
        const p = (a.profiles || []).find((x) => x.id === body.id);
        if (!p) return fail('not_found', 404);
        a.profiles = a.profiles.filter((x) => x.id !== p.id);
        await putAcct(a);
        await redis.del('prog:' + a.id + ':' + p.id); await redis.del('stats:' + a.id + ':' + p.id);
        return json({ ok: true, account: publicAccount(a) });
      });
    },
    'POST /api/account/settings': async (body) => {
      const acctId = await parentOf(body);
      if (!acctId) return fail('signed_out', 401);
      return editAcct(acctId, async (a) => {
        if (body.timezone !== undefined) { if (!validTz(body.timezone)) return fail('bad_timezone'); a.timezone = body.timezone; }
        a.settings = { sound: false, pinToSwitch: true, ...(a.settings || {}) };
        if (body.sound !== undefined) a.settings.sound = !!body.sound;
        if (body.pinToSwitch !== undefined) a.settings.pinToSwitch = !!body.pinToSwitch;
        await putAcct(a);
        return json({ ok: true, account: publicAccount(a) });
      });
    },
    'POST /api/account/export': async (body) => {
      const acctId = await parentOf(body);
      if (!acctId) return fail('signed_out', 401);
      const a = await getAcct(acctId);
      const out = {
        exportedAt: new Date(now()).toISOString(), email: a.email, createdAt: a.createdAt, passEnds: a.expiresAt, timezone: tzOf(a),
        settings: a.settings, purchases: a.purchases.map((p) => ({ at: p.at, amount: p.amount, currency: p.currency })),
        devices: a.devices.map((d) => ({ name: d.name, shared: !!d.shared, addedAt: d.addedAt, lastSeen: d.lastSeen })),
        profiles: []
      };
      for (const p of a.profiles || []) {
        out.profiles.push({ ...publicProfile(p), progress: (await getJSON('prog:' + a.id + ':' + p.id)) || {}, stats: (await getJSON('stats:' + a.id + ':' + p.id)) || {} });
      }
      return json({ ok: true, data: out });
    },

    /* devices: the dashboard, or the device-full screen (manage), or a device removing itself (token) */
    'POST /api/devices': async (body) => {
      const t = await fromToken(body.token);
      const acctId = (await parentOf(body)) || ((await fromSession('manage', body.manage)) || {}).acct || null;
      if (!acctId) return fail('signed_out', 401);
      const a = await getAcct(acctId);
      return json({ ok: true, devices: publicDevices(a, t && t.acctId === acctId ? t.id : null) });
    },
    'POST /api/devices/update': async (body) => {
      const acctId = await parentOf(body);
      if (!acctId) return fail('signed_out', 401);
      return editAcct(acctId, async (a) => {
        const d = a.devices.find((x) => x.id === body.id);
        if (!d) return fail('not_found', 404);
        if (body.name !== undefined) d.name = cleanName(body.name);
        if (body.shared !== undefined) d.shared = !!body.shared;
        await putAcct(a);
        return json({ ok: true, devices: publicDevices(a) });
      });
    },
    'POST /api/devices/remove': async (body) => {
      const t = await fromToken(body.token);
      const own = t && t.id === body.id;
      const acctId = own ? t.acctId : ((await parentOf(body)) || ((await fromSession('manage', body.manage)) || {}).acct || null);
      if (!acctId) return fail('signed_out', 401);
      return editAcct(acctId, async (a) => {
        const d = a.devices.find((x) => x.id === body.id);
        if (!d) return fail('not_found', 404);
        a.removals = (a.removals || []).filter((at) => now() - at < 30 * DAY);
        if (!own && a.removals.length >= LIMITS.removalsPer30Days) return fail('removal_limit', 429, { nextAt: a.removals[0] + 30 * DAY });
        if (!own) a.removals.push(now());
        a.devices = a.devices.filter((x) => x.id !== d.id);
        await redis.del('dev:' + d.th);
        await putAcct(a);
        return json({ ok: true, devices: publicDevices(a, t && t.acctId === a.id ? t.id : null) });
      });
    },
    /* after making room on the device-full screen, add this device */
    'POST /api/devices/add': async (body) => {
      const m = await fromSession('manage', body.manage);
      if (!m) return fail('signed_out', 401);
      if (!validDevice(body.device)) return fail('bad_device');
      const r = await addDevice(m.acct, body.device, body.name);
      if (r.limit) return fail('device_limit', 400, { devices: publicDevices(r.acct) });
      return json({ ok: true, token: r.token, account: publicAccount(r.acct, body.device) });
    },

    /* daily: pass reminders, and tidying away families unused for 2 years */
    'GET /api/cron/reminders': async (_b, request) => {
      if (!env.CRON_SECRET || request.headers.get('authorization') !== 'Bearer ' + env.CRON_SECRET) return fail('unauthorised', 401);
      const ids = await redis.smembers('accounts');
      let reminded = 0, warned = 0, deleted = 0;
      for (const id of ids) {
        try {
        const a = await getAcct(id);
        if (!a) { await redis.srem('accounts', id); continue; }
        const tz = tzOf(a);
        const left = (a.expiresAt || 0) - now();
        if (!a.never && left > 0 && left <= LIMITS.remindDaysBefore * DAY && a.remindedFor !== a.expiresAt) {
          await mailer.send({ to: a.email, ...E.reminderEmail(a.expiresAt, SITE + '/account/', tz) });
          await editAcct(id, async (b) => { if (b) { b.remindedFor = b.expiresAt; await putAcct(b); } });
          reminded++;
        }
        const idle = now() - (a.lastUsedAt || a.createdAt || 0);
        if (idle > LIMITS.inactiveDays * DAY) {
          if (!a.warnedAt) {
            await mailer.send({ to: a.email, ...E.deleteWarningEmail(now() + LIMITS.deleteWarnDays * DAY, SITE + '/play/', tz) });
            await editAcct(id, async (b) => { if (b) { b.warnedAt = now(); await putAcct(b); } });
            warned++;
          } else if (now() - a.warnedAt > LIMITS.deleteWarnDays * DAY) {
            const gone = await withLock('a:' + id, async () => {
              const b = await getAcct(id); // look again: they may have come back a moment ago
              if (!b || !b.warnedAt || now() - (b.lastUsedAt || 0) <= LIMITS.inactiveDays * DAY) return false;
              await deleteAccount(b); return true;
            });
            if (gone) deleted++;
          }
        }
        } catch (e) { console.error('cron', id, e); }
      }
      return json({ ok: true, sent: reminded, reminded, warned, deleted });
    }
  };

  async function sendPinLockEmail(a, device, at) {
    // at most one email per device per hour
    const ok = await redis.set('pinmail:' + a.id + ':' + device.id, '1', { nx: true, ex: LIMITS.pinLockSec });
    if (ok) await mailer.send({ to: a.email, ...E.pinLockedEmail(device.name, at, tzOf(a), SITE + '/account/?forgot=pin') });
  }

  return {
    async fetch(request) {
      const url = new URL(request.url);
      const key = request.method + ' ' + url.pathname.replace(/\/$/, '');
      const route = routes[key];
      if (!route) return fail('not_found', 404);
      let raw = '', body = {};
      if (request.method === 'POST') {
        raw = await request.text();
        const max = url.pathname === '/api/sync' ? 400000 : 20000;
        if (raw.length > max) return fail('too_big', 413);
        if (url.pathname !== '/api/webhook') { try { body = raw ? JSON.parse(raw) : {}; } catch (e) { return fail('bad_json'); } }
        if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
      }
      try { return await route(body, request, raw); }
      catch (e) { console.error(key, e); return fail('server_error', 500); }
    },
    _fulfill: fulfill
  };
}
