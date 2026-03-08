# RealNews.tech

RealNews.tech is a Next.js MVP for AI-assisted credibility checks. Users can paste a headline, claim, or link and receive a structured verdict with reasoning and suggested sources.

## Local Development

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Use `http://localhost:3000` for local testing.

Required environment variables in `.env.local`:

```bash
GEMINI_API_KEY=your_key_here
MISTRAL_API_KEY=your_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
CRON_SECRET=your_cron_secret
```

Optional environment variables:

```bash
GEMINI_MODEL=gemini-2.5-flash
MISTRAL_MODEL=mistral-small-latest
DAILY_CHECK_LIMIT=12
```

## Free-Tier Defaults

- The Vercel cron is intentionally disabled for this MVP. On `Vercel Free + Gemini Free`, the manual `Check now` flow is the core feature and background refreshes burn through quota too fast.
- `DAILY_CHECK_LIMIT` caps fresh Gemini analyses per UTC day. Cache hits still work normally and do not spend additional Gemini quota.
- If Gemini is unavailable or the daily cap is exhausted and `MISTRAL_API_KEY` is configured, the app falls back to Mistral analysis mode. That fallback does not have live web verification and is labeled explicitly in the result UI.
- If both providers are unavailable, the app stays in demo mode and keeps the example results visible.

## Troubleshooting

- If the homepage shows that live checks are unavailable because the app server is not responding, confirm you opened the app on `http://localhost:3000`.
- If you open a stale local port such as `http://localhost:3001` while this app is only running on `3000`, same-origin requests to `/api/check` will fail before they reach the Next.js route.
- If you see `Daily free quota reached. Try again tomorrow.`, the app intentionally stopped sending fresh Gemini requests for the rest of the UTC day.
- If live AI checks are temporarily unavailable, Gemini may be rate-limited and Mistral may be unavailable or unconfigured. The UI will keep the demo state visible and prompt you to retry.

## Verification

Use the production build to validate the app before deploy:

```bash
npm run build
```
