# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

AI Potluck Chat — the SvelteKit chat behind [aipotluck.org](https://aipotluck.org). It began as a fork of [Hugging Face chat-ui](https://github.com/huggingface/chat-ui) (Apache-2.0, the codebase that powers HuggingChat) and has been heavily reshaped: persistence moved to Postgres, plus a provenance/honesty layer, open web-search grounding, and a multi-model second-opinion panel. It serves [Apertus](https://huggingface.co/swiss-ai) (SwissAI, open weights) via an OpenAI-compatible endpoint (`OPENAI_BASE_URL`). See `README.md` for the fork story and `NOTICE` for attribution.

## Commands

```bash
npm run dev          # Start dev server on localhost:5173
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # TypeScript validation (svelte-kit sync + svelte-check)
npm run lint         # Check formatting (Prettier) and linting (ESLint)
npm run format       # Auto-format with Prettier
npm run test         # Run all tests (Vitest)
```

### Running a Single Test

```bash
npx vitest run path/to/file.spec.ts        # Run specific test file
npx vitest run -t "test name"              # Run test by name
npx vitest --watch path/to/file.spec.ts    # Watch mode for single file
```

### Test Environments

Tests are split into three workspaces (configured in vite.config.ts):

- **Client tests** (`*.svelte.test.ts`): Browser environment with Playwright
- **SSR tests** (`*.ssr.test.ts`): Node environment for server-side rendering
- **Server tests** (`*.test.ts`, `*.spec.ts`): Node environment for utilities

## Architecture

### Stack

- **SvelteKit 2** with Svelte 5 (uses runes: `$state`, `$effect`, `$bindable`)
- **Postgres** for persistence via **Drizzle ORM** (Neon in production); migrations in `drizzle/`, schema via `drizzle-kit`. A doc-store adapter preserves the original collection-shaped call sites over Postgres tables.
- **TailwindCSS** for styling

### Key Directories

```
src/
├── lib/
│   ├── components/       # Svelte components (chat/, mcp/, voice/, icons/)
│   ├── server/
│   │   ├── api/utils/       # Shared API helpers (auth, superjson, model/conversation resolvers)
│   │   ├── textGeneration/  # LLM streaming pipeline
│   │   ├── mcp/          # Model Context Protocol integration
│   │   ├── router/       # Smart model routing (Omni)
│   │   ├── database.ts   # collections seam (doc-store adapter over Postgres/Drizzle)
│   │   ├── models.ts     # Model registry from OPENAI_BASE_URL/models
│   │   └── auth.ts       # OpenID Connect authentication
│   ├── types/            # TypeScript interfaces (Conversation, Message, User, Model, etc.)
│   ├── stores/           # Svelte stores for reactive state
│   └── utils/            # Helpers (tree/, marked.ts, auth.ts, etc.)
├── routes/               # SvelteKit file-based routing
│   ├── conversation/[id]/  # Chat page + streaming endpoint
│   ├── settings/         # User settings pages
│   ├── api/              # Legacy v1 API endpoints (mcp, transcribe, fetch-url)
│   ├── api/v2/           # REST API endpoints (+server.ts)
│   └── r/[id]/           # Shared conversation view
```

### Text Generation Flow

1. User sends message via `POST /conversation/[id]`
2. Server validates user, fetches conversation history
3. Builds message tree structure (see `src/lib/utils/tree/`)
4. Calls LLM endpoint via OpenAI client
5. Streams response back, persists to Postgres (Drizzle) through the collections seam

### Model Context Protocol (MCP)

MCP servers are configured via `MCP_SERVERS` env var. When enabled, tools are exposed as OpenAI function calls. The router can auto-select tools-capable models when `LLM_ROUTER_ENABLE_TOOLS=true`.

### LLM Router (Omni)

Smart routing via Arch-Router model. Configured with:

- `LLM_ROUTER_ROUTES_PATH`: JSON file defining routes
- `LLM_ROUTER_ARCH_BASE_URL`: Router endpoint
- Shortcuts: multimodal routes bypass router if `LLM_ROUTER_ENABLE_MULTIMODAL=true`

### Database Collections (logical, over Postgres)

- `conversations` - Chat sessions with the message tree
- `users` - User accounts (OIDC-backed)
- `sessions` - Session data
- `settings` - User preferences

Community sharing (`sharedConversations`) and the analytics/reporting stack were removed in the fork.

## Environment Setup

Create `.env.local` (gitignored — never commit secrets). Minimum to boot:

```env
OPENAI_BASE_URL=https://router.huggingface.co/v1
OPENAI_API_KEY=hf_***
MODEL_ALLOWLIST=swiss-ai/Apertus-70B-Instruct-2509
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
APP_BASE=
```

Run `npm run db:migrate` once to apply the Drizzle journal. `.env.ci` lists every config key the code reads (empty values — a typecheck scaffold, not a runtime template).

## Code Conventions

- TypeScript strict mode enabled
- ESLint: no `any`, no non-null assertions
- Prettier: tabs, 100 char width, Tailwind class sorting
- Server vs client separation via SvelteKit conventions (`+page.server.ts` vs `+page.ts`)

## Feature Development Checklist

When building new features, consider:

1. **HuggingChat vs self-hosted**: Wrap HuggingChat-specific features with `publicConfig.isHuggingChat`
2. **Settings persistence**: Add new fields to `src/lib/types/Settings.ts`, update API endpoint at `src/routes/api/v2/user/settings/+server.ts`
3. **Rich dropdowns**: Use `bits-ui` (Select, DropdownMenu) instead of native elements when you need icons/images in options
4. **Scrollbars**: Use `scrollbar-custom` class for styled scrollbars
5. **Icons**: Custom icons in `$lib/components/icons/`, use Carbon (`~icons/carbon/*`) or Lucide (`~icons/lucide/*`) for standard icons
6. **Provider avatars**: Use `PROVIDERS_HUB_ORGS` from `@huggingface/inference` for HF provider avatar URLs
