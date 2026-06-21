# AI Potluck Chat

The chat application behind [aipotluck.org](https://aipotluck.org) — Public AI's demonstrator for a
sovereign, fully-open assistant. It runs on [Apertus](https://huggingface.co/swiss-ai), the open-weights
model from the Swiss AI Initiative (SwissAI), served through an OpenAI-compatible inference provider, with
a live "Under the hood" provenance map that shows exactly what stack is answering each message.

## Built on Hugging Face chat-ui

This started as a fork of [`huggingface/chat-ui`](https://github.com/huggingface/chat-ui) (Apache-2.0),
the SvelteKit codebase that powers HuggingChat. We're grateful to have had such a solid, well-built
starting point — it saved us months. We then reshaped it heavily for what we needed, so it has diverged
quite a bit from upstream:

- **Persistence moved from MongoDB to Postgres** (Drizzle ORM, Neon) so the app runs clean on Vercel
  serverless. The Mongo-specific patterns (GridFS, startup migrations under a lock, embedded-array
  message storage) were replaced.
- **A provenance and honesty layer** was added on top: every answer derives its model identity and
  serving facts from config (never hardcoded), so the UI can't claim a model or a datacenter that isn't
  actually running. The model is told to be honest about what it is and where it runs.
- **Web search grounding** against open sources (Wikipedia, Marginalia) rather than the upstream
  local-embedding search, with a logprob-margin gate deciding when to search.
- **A "second opinion" panel** that fans a question out to independent open models and reports where they
  agree or disagree with the primary answer — verification, not synthesis.
- **Subsystems we didn't need were removed** (assistants, community sharing, the analytics/reporting
  stack) to shrink the surface.

The upstream `LICENSE` (Apache-2.0) and `NOTICE` are carried unchanged — this code genuinely is, at its
root, chat-ui, and we want the attribution to say so.

## Quickstart

You need an OpenAI-compatible model endpoint and a Postgres database. The fastest path uses the Hugging
Face Inference Providers router for the model and a free [Neon](https://neon.tech) branch for Postgres.

**1. Create `.env.local`** (this file is gitignored — never commit real secrets):

```env
# Model: any OpenAI-compatible endpoint. HF router shown; a CSCS-direct base also works.
OPENAI_BASE_URL=https://router.huggingface.co/v1
OPENAI_API_KEY=hf_************************
# Which served checkpoint(s) the app is allowed to use (comma-separated id list).
MODEL_ALLOWLIST=swiss-ai/Apertus-70B-Instruct-2509

# Postgres (Neon or any Postgres 14+). Used by Drizzle for all persistence.
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require

# Base path the app is served under, e.g. "" for root or "/chat" behind a proxy.
APP_BASE=
```

`.env.ci` lists every config key the code reads (empty values — it's a typecheck scaffold for
`npm run check`, not a runtime template). Use it as a reference for the optional variables.

**2. Install, migrate the database, and run:**

```bash
npm install
npm run db:migrate   # apply the Drizzle migration journal to your Postgres
npm run dev -- --open
```

The dev server listens on `http://localhost:5173`. Open it and start chatting.

## Commands

```bash
npm run dev          # dev server (localhost:5173)
npm run build        # production build
npm run preview      # preview the production build
npm run check        # svelte-check typecheck
npm run lint         # Prettier + ESLint
npm run format       # auto-format
npm run test         # full Vitest suite (needs a model endpoint for some specs)
npm run test:ci      # hermetic specs only (CI_HERMETIC=true) — no secrets or network
npm run db:migrate   # apply Drizzle migrations
npm run db:drift     # fail if the schema and migration snapshots have drifted
```

## Deployment

The app targets Vercel serverless on Neon Postgres. `npm run vercel-build` runs the Drizzle migration
then the Vite build. See `vite.config.ts` for the adapter wiring and the workspace test projects.

## License

Apache-2.0, inherited from upstream Hugging Face chat-ui. See [`LICENSE`](./LICENSE) and
[`NOTICE`](./NOTICE).
