/* Vercel entry point: every /api/* path is routed here (see vercel.json) and handled in server/app.js.
   All keys come from the project's Environment Variables in Vercel, never from the code. */
import Stripe from 'stripe';
import { Resend } from 'resend';
import { Redis } from '@upstash/redis';
import { createApp } from '../server/app.js';

let app = null;

function build() {
  const env = process.env;
  const missing = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY', 'EMAIL_FROM', 'SITE_URL']
    .filter((k) => !env[k]);
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) missing.push('KV_REST_API_URL / KV_REST_API_TOKEN');
  if (missing.length) return { missing };

  const redis = new Redis({ url, token, automaticDeserialization: false });
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const resend = new Resend(env.RESEND_API_KEY);
  const mailer = {
    async send(msg) {
      const { error } = await resend.emails.send({
        from: env.EMAIL_FROM,
        replyTo: env.EMAIL_REPLY_TO || undefined,
        to: msg.to, subject: msg.subject, html: msg.html, text: msg.text
      });
      if (error) throw new Error('email failed: ' + (error.message || error.name));
    }
  };
  return createApp({ redis, stripe, mailer, env });
}

export default {
  async fetch(request) {
    if (!app) app = build();
    if (app.missing) {
      // Not set up yet: the games keep working, the pass is simply switched off.
      const path = new URL(request.url).pathname;
      if (path === '/api/config') return Response.json({ ok: true, passRequired: false, setup: 'incomplete' });
      return Response.json({ ok: false, error: 'not_set_up', missing: app.missing }, { status: 503 });
    }
    return app.fetch(request);
  }
};
