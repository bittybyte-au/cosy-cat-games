/* Local rehearsal server: the real site + the real pass code, with pretend Stripe and email.
   node tests/dev-server.mjs  →  http://localhost:8790   (mail log at /__mail) */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import Stripe from 'stripe';
import { createApp } from '../server/app.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8790, SITE = 'http://localhost:' + PORT;
const clock = { t: Date.now() };
const m = new Map();
const redis = {
  async get(k) { const v = m.get(k); if (!v) return null; if (v.exp && v.exp < Date.now()) { m.delete(k); return null; } return v.val; },
  async set(k, val, o = {}) { if (o.nx && await this.get(k) != null) return null; m.set(k, { val: String(val), exp: o.ex ? Date.now() + o.ex * 1000 : 0 }); return 'OK'; },
  async del(k) { return m.delete(k) ? 1 : 0; },
  async incr(k) { const n = parseInt(await this.get(k) || '0', 10) + 1; const old = m.get(k); m.set(k, { val: String(n), exp: old ? old.exp : 0 }); return n; },
  async expire(k, s) { const v = m.get(k); if (v) v.exp = Date.now() + s * 1000; return 1; },
  async sadd(k, x) { const s = new Set(JSON.parse(await this.get(k) || '[]')); s.add(x); m.set(k, { val: JSON.stringify([...s]), exp: 0 }); return 1; },
  async smembers(k) { return JSON.parse(await this.get(k) || '[]'); }
};
const sessions = new Map(); let n = 0;
const stripe = {
  checkout: { sessions: {
    async create(p) { const id = 'cs_test_' + (++n); const s = { id, payment_status: 'unpaid', customer_email: p.customer_email || null, metadata: p.metadata || {}, amount_total: 599, currency: 'aud', success_url: p.success_url.replace('{CHECKOUT_SESSION_ID}', id), url: SITE + '/__checkout?s=' + id }; sessions.set(id, s); return s; },
    async retrieve(id) { const s = sessions.get(id); if (!s) throw new Error('nope'); return s; }
  } },
  webhooks: new Stripe('sk_test_x').webhooks
};
const mail = [];
const app = createApp({ redis, stripe, mailer: { async send(x) { mail.push(x); console.log('MAIL to', x.to, '|', x.subject); } }, env: { SITE_URL: SITE, PASS_REQUIRED: process.env.PASS || 'on', STRIPE_WEBHOOK_SECRET: 'whsec_x', CRON_SECRET: 'c' } });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, SITE);
  if (url.pathname.startsWith('/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await app.fetch(new Request(SITE + req.url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined }));
    res.writeHead(r.status, { 'content-type': 'application/json' }); res.end(await r.text()); return;
  }
  if (url.pathname === '/__mail') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(mail)); return; }
  if (url.pathname === '/__checkout') {
    const s = sessions.get(url.searchParams.get('s'));
    if (url.searchParams.get('pay')) { s.payment_status = 'paid'; s.customer_details = { email: url.searchParams.get('email') || s.customer_email || 'mum@example.com' }; res.writeHead(302, { location: s.success_url }); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<h1>Pretend Stripe checkout</h1><p>$5.99 · email ${s.customer_email || '(ask)'}</p><a id="pay" href="/__checkout?s=${s.id}&pay=1&email=${encodeURIComponent(s.customer_email || 'mum@example.com')}">Pay</a>`);
    return;
  }
  let p = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log('rehearsal server on ' + SITE));
