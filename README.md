# RealNews

RealNews is a Next.js application for AI-assisted credibility checks on headlines, claims, and links. A user can paste a claim, news headline, or article URL and receive a structured verdict with reasoning, provider transparency, and suggested next steps.

![RealNews homepage preview](docs/realnews-home.png)

## Highlights

- Single input flow for headlines, claims, and links
- Gemini-first analysis with labeled Mistral fallback
- Supabase-backed caching to reduce repeated provider calls
- Clear demo behavior when live providers are unavailable
- API routes for interactive checks and optional scheduled refreshes

## Architecture

- Next.js App Router for the UI and API layer
- Gemini and Mistral provider integrations for analysis
- Supabase for cached results and persistence
- Cron-style refresh endpoint for controlled background updates

## Live Demo

https://realnews-lovat.vercel.app

## Local Development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Required:

```bash
GEMINI_API_KEY=your_key_here
MISTRAL_API_KEY=your_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
CRON_SECRET=your_cron_secret
```

Optional:

```bash
GEMINI_MODEL=gemini-2.5-flash
MISTRAL_MODEL=mistral-small-latest
DAILY_CHECK_LIMIT=12
```

## Notes

- The app is designed to stay usable even when live AI providers are unavailable.
- Free-tier limits are enforced explicitly and surfaced in the UI.
- The current public MVP focuses on manual checks rather than aggressive background refreshes.
