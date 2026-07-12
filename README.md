# Pica — landing page

Pixel-art cat that teaches designers the code their AI agent wrote. One job: get a ₹99 sale or an email.

## Run locally
```bash
npm run dev        # serves at http://localhost:5173
```
Everything works offline — forms log to the console until `CONVEX_URL` is set in `app.js`.

## All tunables live in one place
Top of [`app.js`](app.js) → `CONFIG`: price, Dodo checkout URL, Telegram bot URL, Convex URL.

## Convex (waitlist + orders)
```bash
npm install
npx convex dev     # first run: log in, creates a deployment, prints the URL
```
Paste the printed `https://<name>.convex.cloud` URL into `CONFIG.CONVEX_URL`.
Tables: `waitlist { email, building?, source, createdAt }`, `orders { email, amount, status, dodoRef?, createdAt }`. Emails deduped.

## Dodo Payments
Create a ₹99 product, copy the hosted-checkout link into `CONFIG.DODO_CHECKOUT_URL`.
Email is written to Convex `orders` **before** the redirect, so bounced checkouts still leave a lead.

## Deploy — Cloudflare Pages
```bash
npx wrangler pages deploy . --project-name=pica-landing
```
Static site, no build step. Add the same `CONFIG` values before deploying.
