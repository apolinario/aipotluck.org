# Contributing

Thanks for your interest in AI Potluck Chat. This is a public-interest project, and we mean
the "potluck" literally — **everyone is welcome to bring something to the table.** You don't
need permission to propose a change.

## Ways to help

- **Found a bug or have an idea?** [Open an issue](../../issues).
- **Small fix** (a typo, a broken link, a clear bug)? Open a pull request directly.
- **Bigger change** (a new feature, a refactor, a dependency)? Open an issue first so we can
  agree on the approach before you invest the time.

## Local setup

This is a [SvelteKit](https://kit.svelte.dev/) app (a fork of Hugging Face's
[chat-ui](https://github.com/huggingface/chat-ui)). You need Node 20+ and `npm`.

```bash
npm install
cp .env.ci .env.local   # then fill in the values you need (see README "Environment Setup")
npm run dev             # http://localhost:5173
```

`.env.ci` lists every config key the app reads, with empty values — a useful checklist.

## Before you open a PR

Please make sure these pass — they're the same gates CI runs:

```bash
npm run check     # TypeScript + Svelte type-check
npm run lint      # Prettier + ESLint
npm test          # unit/integration tests (green on a fresh clone, no env needed)
```

- `npm test` excludes the few live-only specs by default. To run the full suite (needs a real
  DB + model env), use `npm run test:live`.
- `npm run format` auto-fixes most lint issues.

## Pull request guidelines

- **Keep PRs focused** — one logical change per PR is easier to review and revert.
- **Write a clear description**: what changed, why, and how you verified it.
- **Match the surrounding code** — its naming, its comment style, its idioms. Comments here
  explain _why_, not _what_.
- **New behavior gets a test.** Touching the chat/answer path? Note how you checked it works.
- **Honesty matters in this codebase.** The UI makes provenance claims (what's live, what's
  grounded, what's a guess). If your change touches those surfaces, keep them truthful — don't
  let copy claim a capability or partner that hasn't shipped.

## Code of conduct

By participating you agree to our [Code of Conduct](./CODE_OF_CONDUCT.md). Be kind.

## Questions

Open an issue, or email **[hello@publicai.network](mailto:hello@publicai.network)**. For
security issues, see [SECURITY.md](./SECURITY.md) instead — don't file those publicly.
