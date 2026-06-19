# calque registry — adjudicated dual-path / behavioral-twin verdicts

Externalized "these must agree" memory for the chat-svelte tree. `calque check`
diffs new suspects against this file; an adjudicated pair stops re-surfacing.
Verdicts: **drift** (same contract, diverging — collapse), **contracted-twin-ok**
(intentionally parallel, currently in sync), **false-alarm** (coincidental signal).

First full pass: 2026-06-19, calque v0.9.0, 30 scan pairs + 13 confessions.
Result: ONE genuine drift (`sanitizeJSONEnv` ×3); the rest are name-coincidence,
SvelteKit-handler structural, or eval-harness-sibling false alarms.

---

## Real drift — collapse candidates

### sanitizeJSONEnv — byte-identical triplet
The exact same backtick-unquoting env sanitizer is copy-pasted into three files.
If the env-quoting convention changes, all three must change in lockstep.
**Collapse to one shared helper** (e.g. `src/lib/server/envParse.ts`) and import.
⚠ DEFERRED, not collapsed yet: two of the three sites are in `models.ts`, the one
file shared with the agent-service track — editing it now risks their rebase.
Collapse after the agent-service fold window (coordinate on #potluck).

- pair: src/lib/server/models.ts::sanitizeJSONEnv | src/lib/server/usageLimits.ts::sanitizeJSONEnv
- verdict: drift
- reviewed: 2026-06-19
- pair: src/lib/server/models.ts::sanitizeJSONEnv | src/routes/login/callback/+server.ts::sanitizeJSONEnv
- verdict: drift
- reviewed: 2026-06-19
- pair: src/lib/server/usageLimits.ts::sanitizeJSONEnv | src/routes/login/callback/+server.ts::sanitizeJSONEnv
- verdict: drift
- reviewed: 2026-06-19

---

## Intentionally parallel — in sync (contracted-twin-ok)

### stripReasoningBlocks — near-twin, divergent regex
Same 3-line shape but DIFFERENT regex constants (`REASONING_BLOCK_REGEX` vs
`ROUTER_REASONING_REGEX`) and different wrappers (the routing copy also deletes a
`reasoning` field). Intentional divergence, not a copy. Low-pri: a shared core
`stripReasoningBlocks(text, regex)` taking the regex as a param would unify them.

- pair: src/lib/server/router/endpoint.ts::stripReasoningBlocks | src/lib/server/textGeneration/utils/routing.ts::stripReasoningBlocks
- verdict: contracted-twin-ok
- reviewed: 2026-06-19

### uploadFile / downloadFile — shared filename-key convention
Self-witnessed (comment: "Filename mirrors the GridFS convention so downloadFile
can locate it: `${convId}-${sha}`"). Write side and read side must agree on the
key format — currently a comment, not a shared function. File path is gated off
for the text-only alpha; low-pri. Consider extracting a `blobKey(convId, sha)`.

- pair: src/lib/server/files/uploadFile.ts::uploadFile | src/lib/server/files/downloadFile.ts::downloadFile
- verdict: contracted-twin-ok
- reviewed: 2026-06-19

### v1/v2 DELETE conversations — parallel API versions
High overlap (shared-calls=6); v1 and v2 delete handlers run in parallel. If v1 is
deprecated, removing it kills the twin; until then verify they delete identically.

- pair: src/routes/api/conversations/+server.ts::DELETE | src/routes/api/v2/conversations/+server.ts::DELETE
- verdict: contracted-twin-ok
- reviewed: 2026-06-19

### settings POST — same override fields, two endpoints
Both write `parsedSettings.{multimodal,reasoning,tools}Overrides` (legacy nav form
vs v2 API). Parallel persistence of one settings shape; keep field handling in sync.

- pair: src/routes/api/v2/user/settings/+server.ts::POST | src/routes/settings/(nav)/+server.ts::POST
- verdict: contracted-twin-ok
- reviewed: 2026-06-19

### model subscribe — model-level vs namespace-level
Parallel subscribe handlers (one model, whole namespace). Consider a shared helper.

- pair: src/routes/api/v2/models/[namespace]/[model]/subscribe/+server.ts::POST | src/routes/api/v2/models/[namespace]/subscribe/+server.ts::POST
- verdict: contracted-twin-ok
- reviewed: 2026-06-19

### scroll-affordance sibling components
ScrollToBottomBtn and ScrollToPreviousBtn are parallel scroll buttons; their
visibility/teardown logic is intentionally parallel.

- pair: src/lib/components/ScrollToBottomBtn.svelte::updateVisibility | src/lib/components/ScrollToPreviousBtn.svelte::updateVisibility
- verdict: contracted-twin-ok
- reviewed: 2026-06-19
- pair: src/lib/components/ScrollToBottomBtn.svelte::destroy | src/lib/components/ScrollToPreviousBtn.svelte::destroy
- verdict: contracted-twin-ok
- reviewed: 2026-06-19

---

## False alarms — coincidental signal (suppressed)

### Modal `close()` handlers — name coincidence
Each modal has a trivial local `close()` (`dialog.close()` / `open=false`); distinct
components, no shared contract.

- pair: src/lib/components/EditConversationModal.svelte::close | src/lib/components/chat/UrlFetchModal.svelte::close
- verdict: false-alarm
- reviewed: 2026-06-19
- pair: src/lib/components/DeleteAllConversationsModal.svelte::close | src/lib/components/DeleteConversationModal.svelte::close
- verdict: false-alarm
- reviewed: 2026-06-19
- pair: src/lib/components/DeleteAllConversationsModal.svelte::close | src/lib/components/EditConversationModal.svelte::close
- verdict: false-alarm
- reviewed: 2026-06-19
- pair: src/lib/components/DeleteConversationModal.svelte::close | src/lib/components/EditConversationModal.svelte::close
- verdict: false-alarm
- reviewed: 2026-06-19
- pair: src/lib/components/DeleteConversationModal.svelte::close | src/lib/components/chat/UrlFetchModal.svelte::close
- verdict: false-alarm
- reviewed: 2026-06-19
- pair: src/lib/components/DeleteAllConversationsModal.svelte::close | src/lib/components/chat/UrlFetchModal.svelte::close
- verdict: false-alarm
- reviewed: 2026-06-19

### confirmDelete — parallel but deliberately separate
Delete-all vs delete-one are intentionally different scopes, not a drifting twin.

- pair: src/lib/components/DeleteAllConversationsModal.svelte::confirmDelete | src/lib/components/DeleteConversationModal.svelte::confirmDelete
- verdict: false-alarm
- reviewed: 2026-06-19

### matchesAllowed — different allow-lists
UploadedFile checks file MIME types; UrlFetchModal checks URL hosts. Same name,
different domains.

- pair: src/lib/components/chat/UploadedFile.svelte::matchesAllowed | src/lib/components/chat/UrlFetchModal.svelte::matchesAllowed
- verdict: false-alarm
- reviewed: 2026-06-19

### handleKeydown — every modal's Esc handler
Component-local keyboard handlers; name coincidence, no shared contract.

- pair: src/lib/components/Modal.svelte::handleKeydown | src/lib/components/chat/ImageLightbox.svelte::handleKeydown
- verdict: false-alarm
- reviewed: 2026-06-19
- pair: src/lib/components/Modal.svelte::handleKeydown | src/lib/components/chat/ArtifactPanel.svelte::handleKeydown
- verdict: false-alarm
- reviewed: 2026-06-19
- pair: src/lib/components/chat/ArtifactPanel.svelte::handleKeydown | src/routes/conversation/[id]/+page.svelte::handleKeydown
- verdict: false-alarm
- reviewed: 2026-06-19
- pair: src/lib/components/Modal.svelte::handleKeydown | src/routes/conversation/[id]/+page.svelte::handleKeydown
- verdict: false-alarm
- reviewed: 2026-06-19
- pair: src/lib/components/chat/ArtifactPanel.svelte::handleKeydown | src/lib/components/chat/ImageLightbox.svelte::handleKeydown
- verdict: false-alarm
- reviewed: 2026-06-19
- pair: src/lib/components/chat/ImageLightbox.svelte::handleKeydown | src/routes/conversation/[id]/+page.svelte::handleKeydown
- verdict: false-alarm
- reviewed: 2026-06-19

### SvelteKit GET handlers — structural false alarm
Distinct route endpoints; the shared signal is the framework handler signature.

- pair: src/routes/api/v2/models/[namespace]/+server.ts::GET | src/routes/api/v2/models/[namespace]/[model]/+server.ts::GET
- verdict: false-alarm
- reviewed: 2026-06-19
- pair: src/routes/api/v2/debug/config/+server.ts::GET | src/routes/api/v2/models/+server.ts::GET
- verdict: false-alarm
- reviewed: 2026-06-19

### eval-harness siblings — independent throwaway scripts
Duplicated boilerplate across separate eval dirs (env-load, churn metric, verify
scaffold, dataset download, CoT variants). Not shipping contracts; some belong to
sibling tracks (verifier-loop, pragmatics). Suppressed.

- pair: evals/search-decision/run.ts::loadEnv | evals/tool-serving-probe/run.ts::loadEnv
- verdict: false-alarm
- reviewed: 2026-06-19
- pair: evals/verifier-loop/run_delta.py::churn | evals/verifier-loop/run_unpuzzles.py::churn
- verdict: false-alarm
- reviewed: 2026-06-19
- pair: scripts/verify-cleanup.ts::check | scripts/verify-drizzle-slice.ts::check
- verdict: false-alarm
- reviewed: 2026-06-19
- pair: evals/implicature/build_set.py::download | evals/sycophancy/build_set.py::download
- verdict: false-alarm
- reviewed: 2026-06-19
- pair: evals/pragmatics/pragmatics.py::cond_cot | evals/pragmatics/pragmatics.py::cond_cot_heavy
- verdict: false-alarm
- reviewed: 2026-06-19
