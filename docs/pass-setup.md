# One-year pass: setup guide

The pass code is already in the site, switched **off**. Until you finish these steps and switch it on, every game stays free and nothing changes for anyone.

**What's free without a pass:** the sushi hand roll and Kitty Pop levels 1 to 3. Every other recipe, level and game, including new games added later, needs a pass. This list lives at the top of `shared/pass.js` (`FREE`).

**The pass:** $5.99 AUD for one year, every game, up to 6 devices. It doesn't renew automatically, and families get a reminder email 14 days before it ends.

---

## 1. Database (Upstash Redis, through Vercel)

1. In your Vercel project, open **Storage** (or **Marketplace**) and add **Upstash for Redis**.
2. Connect it to this project for **Production** and **Preview**.
3. Vercel adds the connection settings (`KV_REST_API_URL` and `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`) to the project for you. Either pair works.

## 2. Email (Resend)

1. In Resend, create an API key with **Sending access** only.
2. Decide the From address, for example `Cosy Cat Games <hello@yourdomain.com>`. It must be on your verified domain.

## 3. Stripe, in **test mode** first

Turn on **Test mode** (top right in Stripe) for all of these.

1. **Secret key:** go to **Developers → API keys** and copy the **Secret key** (starts `sk_test_`).
2. **Webhook:** go to **Developers → Webhooks → Add endpoint**.
   - Endpoint URL: `https://YOUR-SITE/api/webhook`
   - Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`
   - After saving, copy the **Signing secret** (starts `whsec_`).
3. **Free code for your family (optional):**
   - Go to **Product catalogue → Coupons → New**, choose **100% off**, duration **Once**.
   - Inside the coupon, add a **promotion code** (for example `COSYCATFAMILY`) and limit how many times it can be used.
4. **Your own product (optional):** without one, checkout shows "Cosy Cat Games – one-year pass, $5.99" automatically. If you create a product with a one-off $5.99 AUD price, copy its price ID (starts `price_`).

## 4. Vercel settings

In **Settings → Environment Variables**, add each of these for **Production** (and **Preview** if you use it):

| Name | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | the `sk_test_…` key |
| `STRIPE_WEBHOOK_SECRET` | the `whsec_…` signing secret |
| `STRIPE_PRICE_ID` | optional: the `price_…` ID |
| `RESEND_API_KEY` | the Resend key |
| `EMAIL_FROM` | for example `Cosy Cat Games <hello@yourdomain.com>` |
| `EMAIL_REPLY_TO` | optional: where replies should go, for example your own inbox |
| `SITE_URL` | your site address, for example `https://yourdomain.com` (no slash at the end) |
| `CODE_SECRET` | any long random text, 40+ characters (a password manager can make one) |
| `CRON_SECRET` | another long random text, different from the one above |
| `PASS_REQUIRED` | `off` for now |

Then **redeploy** (Deployments → ⋯ → Redeploy) so the settings take effect.

**Check it:** open `https://YOUR-SITE/api/config`. It should show `"passRequired":false` and **not** say `"setup":"incomplete"`. If it does say incomplete, one of the settings is missing.

## 5. Test everything (still in test mode)

1. Set `PASS_REQUIRED` to `on` and redeploy. Locked games now show a padlock.
2. Use Stripe's test card `4242 4242 4242 4242`, any future date and any 3 digits.
3. Try each of these:
   - [ ] **Buy on this device:** from the home page, tap Unlock all games, pass the grown-up check, buy, and come back unlocked.
   - [ ] **Promo code:** buy again with your 100% code and see it go through at $0.
   - [ ] **I already have a pass:** on a second device, get a code by email, type it in, and see it unlock.
   - [ ] **Send to a grown-up's email:** on a third device, open the emailed link on your phone, pay, and watch the third device unlock by itself.
   - [ ] **Manage devices:** remove a device and check it locks again next time it's opened online.
4. In Stripe, check **Payments** shows the test payments and **Webhooks** shows successful deliveries.

## 6. Go live

1. In Stripe, turn **Test mode off**. Then:
   - copy the **live** secret key (`sk_live_…`)
   - add the webhook endpoint again in live mode, with the same URL and events, and copy its new signing secret
   - live mode has its own products, coupons and promotion codes, so create the family code again there
2. In Vercel, replace `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (and `STRIPE_PRICE_ID` if you used one) with the live values.
3. Make sure `PASS_REQUIRED` is `on`, then redeploy.

## Before you charge real money

- **Legal pages:** add a privacy policy, terms and a refund policy, and link them in the footer next to About.
- **Stripe account:** complete your business details, including your ABN and bank account.
- **GST:** register once your turnover passes the threshold, then add it in Stripe.

## Handy things

- **Turn the pass off any time:** set `PASS_REQUIRED` to `off` and redeploy. Everything is free again, and paid passes are kept.
- **A pass that never runs out:** for example, for your own family. In the Upstash data browser, open the key `acct:youremail@example.com` and add `"never":true` to it.
- **Refunds:** issue them from Stripe. Refunding doesn't lock the pass automatically. If you want it locked, set its `expiresAt` in Upstash to a past date.
- **Reminder emails:** these go out daily at about 9am Sydney time (Vercel Cron, set in `vercel.json`).
- **Tests:**
  - `npm test` runs the automatic tests.
  - `npm run rehearse` starts a local copy with pretend Stripe and email at `http://localhost:8790`.
