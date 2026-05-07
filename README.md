# GOFAMINT Admin Dashboard

The administrator console for the GOFAMINT Sunday School app — manage units,
lessons, quiz questions, hymns, translations, banners, subscribers, churches,
and more.

Built with **Vite + React + Tailwind CSS**. Deploys as a static SPA.

## Local development

```bash
npm install
npm run dev          # → http://localhost:5173
```

## Build

```bash
npm run build        # outputs to dist/
npm run preview      # preview the production build locally
```

## Configuration

The default API URL points to the Railway backend. Override via env var if you
self-host:

```bash
# .env.local
VITE_API_URL=https://your-backend.example.com
```

The user can also set the API URL on the login page; that overrides the env
default and is persisted in `localStorage`.

## Authentication

Sign in with the API URL + the `ADMIN_SECRET` value configured on the backend
(it's sent as the `x-admin-key` header on every request).

## Deploying to Vercel

1. Import this repo in Vercel.
2. Vercel auto-detects Vite — no extra config needed.
3. The included `vercel.json` handles SPA routing fallback.

## Pages

Content: Dashboard · Units · Lessons · Quizzes · Hymns · Quarter Info ·
Translations · Bible Verses
Commerce: Subscribers · Pricing · Ad Banners
Churches: Approvals · Churches
Insights: Leaderboard

## Reference

The legacy single-file HTML version this React app replaces lives in
[`_legacy/admin.html`](_legacy/admin.html) for reference until parity is
verified. Safe to delete after a full click-through of the React version.
