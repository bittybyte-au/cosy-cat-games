/* Cosy Cat Games – one-year pass server.
   One fetch handler routes every /api/* request. All storage is in Redis (Upstash).

   What is stored:
     acct:<email>        the pass: expiry, purchases (Stripe ids), devices (id, name, dates)
     dev:<sha256(token)> which account a device token belongs to
     code:<email>        a pending 6-digit sign-in code (hashed), deleted after use or 10 minutes
     req:<id>            an "ask a grown-up" request, deleted after 24 hours
     manage:<token>      short-lived permission to manage devices after a code sign-in (10 minutes)
   No information about children is ever sent here. */
import crypto from 'node:crypto';
import { codeEmail, askEmail, reminderEmail, maskEmail } from './emails.js';

const DAY = 24 * 60 * 60 * 1000;
const YEAR = 365 * DAY;
export const LIMITS = {
  devices: 6,
  removalsPer30Days: 3,
  codeTtlSec: 10 * 60,
  codeTries: 5,
  requestTtlSec: 24 * 60 * 60,
  manageTtlSec: 10 * 60,
  remindDaysBefore: 14
};

export function createApp({ redis, stripe, mailer, env, now = () => Date.now() }) {
  const SITE = (env.SITE_URL || '').replace(/\/$/, '');
  const PRICE_CENTS = parseInt(env.PASS_PRICE_CENTS || '599', 10);
  const SECRET = env.CODE_SECRET || env.STRIPE_WEBHOOK_SECRET || 'dev-only-secret';

  /* ---------- helpers ---------- */
  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
  const fail = (error, status = 400, extra = {}) => json({ ok: false, error, ...extra }, status);
  const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
  const hmac = (s) => crypto.createHmac('sha256', SECRET).update(String(s)).digest('hex');
  const randomToken = () => crypto.randomBytes(32).toString('base64url');
  const normEmail = (e) => String(e || '').trim().toLowerCase();
  const validEmail = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(e) && e.length <= 254;
  const validDevice = (d) => typeof d === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(d);
  const cleanName = (n) => String(n || 'Device').replace(/[^\w\s'’-]/g, '').slice(0, 30) || 'Device';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function getJSON(key) { const v = await redis.get(key); if (v == null) return null; return typeof v === 'string' ? JSON.parse(v) : v; }
  async function setJSON(key, val, ttlSec) { const s = JSON.stringify(val); return ttlSec ? redis.set(key, s, { ex: ttlSec }) : redis.set(key, s); }

  /* simple per-email lock so two requests never overwrite each other's changes to a pass */
  async function withLock(email, fn) {
    const key = 'lock:' + email;
    for (let i = 0; i < 50; i++) {
      const got = await redis.set(key, '1', { nx: true, ex: 10 });
      if (got) { try { return await fn(); } finally { await redis.del(key); } }
      await sleep(100);
    }
    throw new Error('busy');
  }

  /* counts events in a time window; returns false once the limit is passed */
  async function rateOk(key, max, windowSec) {
    const n = await redis.incr('rl:' + key);
    if (n === 1) await redis.expire('rl:' + key, windowSec);
    return n <= max;
  }
  const ipOf = (request) => (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';

  const isActive = (acct) => !!acct && (acct.never === true || (acct.expiresAt || 0) > now());
  const publicPass = (acct) => ({
    active: isActive(acct),
    never: acct.never === true,
    expiresAt: acct.expiresAt || 0,
    email: maskEmail(acct.email),
    deviceCount: (acct.devices || []).length,
    deviceLimit: LIMITS.devices
  });
  const publicDevices = (acct, thisId) => (acct.devices || []).map((d) => ({
    id: d.id, name: d.name, addedAt: d.addedAt, lastSeen: d.lastSeen, thisDevice: d.id === thisId
  }));

  /* ---------- the pass ---------- */
  async function fulfill(session) {
    if (!session || (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required')) return null;
    const email = normEmail(session.customer_details && session.customer_details.email || session.customer_email);
    if (!validEmail(email)) return null;
    const acct = await withLock(email, async () => {
      const a = (await getJSON('acct:' + email)) || { email, createdAt: now(), purchases: [], devices: [], removals: [] };
      if (!a.purchases.some((p) => p.id === session.id)) {
        a.expiresAt = Math.max(now(), a.expiresAt || 0) + YEAR;
        a.purchases.push({ id: session.id, at: now(), amount: session.amount_total || 0, currency: session.currency || 'aud' });
        await setJSON('acct:' + email, a);
        await redis.sadd('accounts', email);
      }
      return a;
    });
    const reqId = session.metadata && session.metadata.request;
    if (reqId) {
      const req = await getJSON('req:' + reqId);
      if (req && req.status === 'waiting') { req.status = 'paid'; req.email = email; await setJSON('req:' + reqId, req, LIMITS.requestTtlSec); }
    }
    return acct;
  }

  /* adds (or re-signs-in) a device; returns { token } or { limit: true } */
  async function addDevice(email, deviceId, name) {
    return withLock(email, async () => {
      const a = await getJSON('acct:' + email);
      if (!a) return { missing: true };
      a.devices = a.devices || [];
      const existing = a.devices.find((d) => d.id === deviceId);
      if (!existing && a.devices.length >= LIMITS.devices) return { limit: true, acct: a };
      const token = randomToken();
      const th = sha(token);
      if (existing) { await redis.del('dev:' + existing.th); existing.th = th; existing.lastSeen = now(); existing.name = cleanName(name); }
      else a.devices.push({ id: deviceId, name: cleanName(name), th, addedAt: now(), lastSeen: now() });
      await setJSON('dev:' + th, { email, id: deviceId });
      await setJSON('acct:' + email, a);
      return { token, acct: a };
    });
  }

  async function fromToken(token) {
    if (!token || typeof token !== 'string' || token.length > 100) return null;
    const dev = await getJSON('dev:' + sha(token));
    if (!dev) return null;
    const acct = await getJSON('acct:' + dev.email);
    if (!acct || !(acct.devices || []).some((d) => d.id === dev.id)) return null;
    return { email: dev.email, id: dev.id, acct };
  }
  async function fromManage(t) {
    if (!t || typeof t !== 'string' || t.length > 100) return null;
    const email = await redis.get('manage:' + sha(t));
    return email ? String(email) : null;
  }
  async function newManage(email) {
    const t = randomToken();
    await redis.set('manage:' + sha(t), email, { ex: LIMITS.manageTtlSec });
    return t;
  }

  /* ---------- routes ---------- */
  const routes = {
    'GET /api/config': async () => json({
      ok: true,
      passRequired: env.PASS_REQUIRED === 'on',
      price: '$' + (PRICE_CENTS / 100).toFixed(2),
      deviceLimit: LIMITS.devices
    }),

    /* start a Stripe checkout. From a signed-in device (token) it renews that pass; from an
       "ask a grown-up" email (request) it is linked to the child's waiting device. */
    'POST /api/checkout': async (body) => {
      let email = null, reqId = null;
      if (body.token) { const t = await fromToken(body.token); if (t) email = t.email; }
      if (body.request) {
        const req = await getJSON('req:' + String(body.request).slice(0, 64));
        if (!req) return fail('request_expired', 410);
        reqId = String(body.request); email = req.email;
      }
      if (!email && body.email && validEmail(normEmail(body.email))) email = normEmail(body.email);
      const params = {
        mode: 'payment',
        allow_promotion_codes: true,
        line_items: [env.STRIPE_PRICE_ID
          ? { price: env.STRIPE_PRICE_ID, quantity: 1 }
          : { quantity: 1, price_data: { currency: 'aud', unit_amount: PRICE_CENTS, product_data: { name: 'Cosy Cat Games – one-year pass', description: 'All games, up to ' + LIMITS.devices + ' devices, for one year. Does not renew automatically.' } } }],
        success_url: SITE + '/unlock/?paid={CHECKOUT_SESSION_ID}' + (reqId ? '&r=' + encodeURIComponent(reqId) : ''),
        cancel_url: SITE + '/unlock/' + (reqId ? '?r=' + encodeURIComponent(reqId) : ''),
        metadata: reqId ? { request: reqId } : {}
      };
      if (email) params.customer_email = email;
      const session = await stripe.checkout.sessions.create(params);
      return json({ ok: true, url: session.url });
    },

    /* the buying device comes back here after paying; it gets signed in straight away */
    'POST /api/claim': async (body) => {
      if (!validDevice(body.device)) return fail('bad_device');
      const id = String(body.session || '');
      if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return fail('bad_session');
      const session = await stripe.checkout.sessions.retrieve(id);
      const acct = await fulfill(session);
      if (!acct) return fail('not_paid', 402);
      // bought from a grown-up's email: the waiting child's device unlocks itself, not this phone
      if (session.metadata && session.metadata.request) return json({ ok: true, forOtherDevice: true, pass: publicPass(acct) });
      // each payment can sign in the device that paid, once; the link can't be shared to unlock more
      const claimKey = 'claimed:' + id;
      const first = await redis.set(claimKey, body.device, { nx: true, ex: 60 * 60 * 24 * 30 });
      if (!first) { const by = await redis.get(claimKey); if (String(by) !== body.device) return fail('already_claimed', 409); }
      const r = await addDevice(acct.email, body.device, body.name);
      if (r.limit) return json({ ok: false, error: 'device_limit', manage: await newManage(acct.email), devices: publicDevices(r.acct), pass: publicPass(r.acct) });
      return json({ ok: true, token: r.token, pass: publicPass(r.acct) });
    },

    'POST /api/code/send': async (body, request) => {
      const email = normEmail(body.email);
      if (!validEmail(email)) return fail('bad_email');
      if (!(await rateOk('code-ip:' + ipOf(request), 20, 3600)) || !(await rateOk('code-email:' + email, 5, 3600))) return fail('slow_down', 429);
      const acct = await getJSON('acct:' + email);
      if (acct) {
        const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        await setJSON('code:' + email, { h: hmac(email + ':' + code), tries: 0 }, LIMITS.codeTtlSec);
        await mailer.send({ to: email, ...codeEmail(code) });
      }
      // same answer either way, so nobody can use this to find out who has a pass
      return json({ ok: true });
    },

    'POST /api/code/verify': async (body) => {
      const email = normEmail(body.email);
      if (!validEmail(email) || !validDevice(body.device)) return fail('bad_request');
      const code = String(body.code || '').replace(/\D/g, '');
      const rec = await getJSON('code:' + email);
      if (!rec) return fail('code_expired');
      if (hmac(email + ':' + code) !== rec.h) {
        rec.tries++;
        if (rec.tries >= LIMITS.codeTries) { await redis.del('code:' + email); return fail('too_many_tries'); }
        await setJSON('code:' + email, rec, LIMITS.codeTtlSec);
        return fail('wrong_code', 400, { triesLeft: LIMITS.codeTries - rec.tries });
      }
      await redis.del('code:' + email);
      const r = await addDevice(email, body.device, body.name);
      if (r.missing) return fail('no_pass');
      const manage = await newManage(email);
      if (r.limit) return json({ ok: false, error: 'device_limit', manage, devices: publicDevices(r.acct), pass: publicPass(r.acct) });
      return json({ ok: true, token: r.token, manage, pass: publicPass(r.acct) });
    },

    /* every device checks in now and then; this is also how a removed device finds out */
    'POST /api/status': async (body) => {
      const t = await fromToken(body.token);
      if (!t) return json({ ok: true, signedIn: false });
      const d = t.acct.devices.find((x) => x.id === t.id);
      if (d && now() - (d.lastSeen || 0) > 60 * 60 * 1000) {
        await withLock(t.email, async () => {
          const a = await getJSON('acct:' + t.email); const dd = a && a.devices.find((x) => x.id === t.id);
          if (dd) { dd.lastSeen = now(); await setJSON('acct:' + t.email, a); }
        });
      }
      return json({ ok: true, signedIn: true, pass: publicPass(t.acct) });
    },

    'POST /api/devices': async (body) => {
      const t = await fromToken(body.token);
      const email = t ? t.email : await fromManage(body.manage);
      if (!email) return fail('signed_out', 401);
      const acct = await getJSON('acct:' + email);
      return json({ ok: true, devices: publicDevices(acct, t && t.id), pass: publicPass(acct) });
    },

    'POST /api/devices/remove': async (body) => {
      const t = await fromToken(body.token);
      const email = t ? t.email : await fromManage(body.manage);
      if (!email) return fail('signed_out', 401);
      return withLock(email, async () => {
        const a = await getJSON('acct:' + email);
        const d = a && a.devices.find((x) => x.id === body.id);
        if (!d) return fail('not_found', 404);
        a.removals = (a.removals || []).filter((at) => now() - at < 30 * DAY);
        const own = t && t.id === d.id;
        if (!own && a.removals.length >= LIMITS.removalsPer30Days) return fail('removal_limit', 429, { nextAt: a.removals[0] + 30 * DAY });
        if (!own) a.removals.push(now());
        a.devices = a.devices.filter((x) => x.id !== d.id);
        await redis.del('dev:' + d.th);
        await setJSON('acct:' + email, a);
        return json({ ok: true, devices: publicDevices(a, t && t.id), pass: publicPass(a) });
      });
    },

    /* after making room with a manage token, sign this device in */
    'POST /api/devices/add': async (body) => {
      const email = await fromManage(body.manage);
      if (!email) return fail('signed_out', 401);
      if (!validDevice(body.device)) return fail('bad_device');
      const r = await addDevice(email, body.device, body.name);
      if (r.limit) return fail('device_limit', 400, { devices: publicDevices(r.acct) });
      return json({ ok: true, token: r.token, pass: publicPass(r.acct) });
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
      const id = crypto.randomBytes(16).toString('base64url');
      await setJSON('req:' + id, { email, device: body.device, name: cleanName(body.name), status: 'waiting', at: now() }, LIMITS.requestTtlSec);
      await mailer.send({ to: email, ...askEmail(SITE + '/unlock/?r=' + id, cleanName(body.name)) });
      return json({ ok: true, request: id });
    },

    /* the waiting device polls this; once paid it is signed in automatically */
    'POST /api/ask/status': async (body) => {
      const id = String(body.request || '').slice(0, 64);
      const req = await getJSON('req:' + id);
      if (!req) return json({ ok: true, status: 'expired' });
      if (req.device !== body.device) return fail('wrong_device', 403);
      if (req.status !== 'paid') return json({ ok: true, status: 'waiting' });
      const r = await addDevice(req.email, req.device, req.name);
      await redis.del('req:' + id);
      if (r.limit) return json({ ok: true, status: 'device_limit' });
      return json({ ok: true, status: 'unlocked', token: r.token, pass: publicPass(r.acct) });
    },

    /* what the grown-up sees when they open the emailed link */
    'POST /api/ask/info': async (body) => {
      const req = await getJSON('req:' + String(body.request || '').slice(0, 64));
      if (!req) return json({ ok: true, status: 'expired' });
      return json({ ok: true, status: req.status, deviceName: req.name, price: '$' + (PRICE_CENTS / 100).toFixed(2) });
    },

    /* Stripe tells us about payments here */
    'POST /api/webhook': async (_body, request, raw) => {
      let event;
      try { event = stripe.webhooks.constructEvent(raw, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET); }
      catch (e) { return fail('bad_signature', 400); }
      if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') await fulfill(event.data.object);
      return json({ received: true });
    },

    /* daily: remind families two weeks before their pass ends */
    'GET /api/cron/reminders': async (_b, request) => {
      if (!env.CRON_SECRET || request.headers.get('authorization') !== 'Bearer ' + env.CRON_SECRET) return fail('unauthorised', 401);
      const emails = await redis.smembers('accounts');
      let sent = 0;
      for (const email of emails) {
        const a = await getJSON('acct:' + email);
        if (!a || a.never) continue;
        const left = a.expiresAt - now();
        if (left > 0 && left <= LIMITS.remindDaysBefore * DAY && a.remindedFor !== a.expiresAt) {
          await mailer.send({ to: email, ...reminderEmail(a.expiresAt, SITE + '/unlock/') });
          await withLock(email, async () => { const b = await getJSON('acct:' + email); if (b) { b.remindedFor = b.expiresAt; await setJSON('acct:' + email, b); } });
          sent++;
        }
      }
      return json({ ok: true, sent });
    }
  };

  return {
    async fetch(request) {
      const url = new URL(request.url);
      const key = request.method + ' ' + url.pathname.replace(/\/$/, '');
      const route = routes[key];
      if (!route) return fail('not_found', 404);
      let raw = '', body = {};
      if (request.method === 'POST') {
        raw = await request.text();
        if (raw.length > 20000) return fail('too_big', 413);
        if (url.pathname !== '/api/webhook') { try { body = raw ? JSON.parse(raw) : {}; } catch (e) { return fail('bad_json'); } }
      }
      try { return await route(body, request, raw); }
      catch (e) { console.error(key, e); return fail('server_error', 500); }
    },
    _fulfill: fulfill
  };
}
