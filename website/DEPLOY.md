# ProvSelf Website Deploy (Free + Secure)

This folder is a static site ready for free hosting with HTTPS.

## 1) Before deploy

Update these placeholders in all HTML files:

- `https://provself.app` -> your real domain
- `support@provself.app` / `privacy@provself.app` / `legal@provself.app` / `review@provself.app` -> your real emails
- App Store download link (`https://apps.apple.com/`) -> your actual app URL
- Pricing numbers if needed

## 2) Recommended host: Cloudflare Pages (free)

1. Push repo to GitHub.
2. Open Cloudflare Dashboard -> `Workers & Pages` -> `Create` -> `Pages` -> `Connect to Git`.
3. Select this repo.
4. Build settings:
   - Framework preset: `None`
   - Build command: *(leave empty)*
   - Build output directory: `website`
5. Deploy.
6. Add custom domain (optional) and enable it.

Cloudflare provides free SSL automatically.

## 3) Security headers

This repo includes `website/_headers` with:

- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Content-Security-Policy`

If your host does not use `_headers`, configure equivalent headers in host settings.

## 4) App Store Connect URLs

Use these in App Store Connect:

- Support URL: `https://your-domain/support.html`
- Marketing URL: `https://your-domain/`
- Privacy Policy URL (in App Privacy): `https://your-domain/privacy.html`
- Terms (optional field/review notes): `https://your-domain/terms.html`
- Optional Review Notes URL: `https://your-domain/appstore-review.html`

## 5) Optional: Netlify / Vercel

### Netlify
- New site from Git -> Publish directory: `website`
- `_headers` file works automatically.

### Vercel
- Import Git project
- Set output directory to `website`
- Add equivalent security headers in `vercel.json` or dashboard.
