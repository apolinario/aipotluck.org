# AI Potluck — chat

The AI Potluck chat surface: an anonymous, streaming chat that runs on an
**open-source model** (Apertus, served openly) and surfaces what powers each
answer — a live "under the hood" stack map and an honest provenance badge.

Built on a fork of [vercel/ai-chatbot](https://github.com/vercel/ai-chatbot)
(Apache-2.0) — see [`UPSTREAM.md`](./UPSTREAM.md) for the exact commit. Stack:
Next.js + the [AI SDK](https://ai-sdk.dev), Postgres (Neon) via Drizzle, Auth.js
(guest sessions), Tailwind + shadcn/ui.

In-app inference is **open-source only** by design — no closed model providers.

## Running locally

```bash
pnpm install
pnpm db:migrate   # apply schema to your own Neon database
pnpm dev          # http://localhost:3000
```

Configure environment variables in `.env.local` (see `.env.example`). The model
token and database URL live there and are never committed.
