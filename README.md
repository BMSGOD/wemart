# Wemart — Campus Marketplace

Mobile-first marketplace for buying and selling on university campuses.
Static build, no backend yet — sample data only.

**This file is the onboarding doc for agents working here. See `AGENTS.md` first.**

## Stack

- Vite 8 + React 19 + TypeScript 6, Tailwind CSS v4 (via `@tailwindcss/vite`, configured in `vite.config.ts`)

## Commands

```bash
npm run dev       # dev server
npm run build     # typecheck (tsc -b) + production build -> dist/
npm run preview   # preview the production build
npm run lint      # oxlint
```

## Deploy (Cloudflare Pages)

- Build command: `npm run build`
- Output directory: `dist`
- `public/_redirects` already contains the SPA fallback (`/* /index.html 200`)

## Rules

- **Never put secret keys in front-end code.** Anything bundled in `dist/` is public. If an API key is ever needed, it must live on a server/proxy (e.g. a Cloudflare Worker), never in this repo's client code.
- Sample data lives in `src/data/`; it is intentionally fake and local. No API calls exist yet.
