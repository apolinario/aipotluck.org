# Handoff seams

The alpha ships a usable chat with honest, minimal safety surfaces. Several of
those surfaces are deliberately built as **seams**: the local behavior is real
and complete, and there is one well-defined point where a future, more capable
system plugs in. This file documents each seam so the integration is obvious and
the current behavior is not mistaken for the finished one.

The guiding rule is honesty over the appearance of safety. Where a capability
does not exist yet, the UI says so and the code fails in the safe direction.

## Report triage

**What works today.** Any signed-in user can flag an assistant response from the
message actions. The report is validated, scoped to the reporter's own
conversation, and persisted to the `Report` table (`reason` ∈ {harmful,
inaccurate, privacy, other}, optional free-text detail). The dialog copy is
explicit that reports are stored for human review and that there is no automated
moderation yet — see `components/chat/report-dialog.tsx`.

**The seam.** `saveReport` in `lib/db/queries.ts` is the single write point, and
the `Report` table is the single read point. A triage integration — routing,
deduplication, escalation, or an external trust-and-safety queue — attaches by
reading `Report`; nothing upstream of the table needs to change. The map's
ROOST / Osprey nodes are marked *building* for exactly this work.

**What flips it.** A consumer of the `Report` table. Until one exists, reports
accumulate for manual review, which is the correct conservative default for a
guest alpha.

## Proactive moderation (toxicity pre-check)

**What works today.** Outbound user messages get a fast toxicity pre-check
(`lib/ai/moderation.ts`). On a flag, the chat declines with a single neutral
message rather than forwarding the text to the model. The check **fails open**:
if the classifier is slow or unreachable, the message proceeds — the model's own
refusals remain the backstop, so an outage degrades to "no extra screen," never
to a hard block on normal use.

**The seam — child safety.** The local classifier covers general toxicity only.
It does **not** detect CSAM or other child-safety harms, and the code says so.
Child safety is therefore its own seam: `checkChildSafety` in
`lib/ai/moderation.ts`, called as a hard stop ahead of the toxicity check in the
chat route. It is **inert today** — there is no open, self-hostable CSAM detector
to call from a serverless app, so it returns `flagged: false` by construction and
cannot fire a false positive. A dedicated detector (e.g. via the ROOST tooling on
the map) is the intended owner of that signal.

The asymmetry is deliberate: unlike the toxicity pre-check, which fails **open**,
the child-safety path is contracted to fail **closed** — on timeout, error, or
uncertainty it must return `flagged: true`. A child-safety check that silently
passes during an outage is worse than no check, which is why it is a separate
function with its own decline copy (firm, no "rephrase" invitation) rather than a
label on the toxicity result.

**What flips it.** Wiring a real detector inside `checkChildSafety`, honoring the
fail-closed contract. Nothing else in the route changes.

## Out of scope here

Two adjacent concerns are intentionally **not** in these seams:

- **Grounding and persona** live in the system-prompt / answer path, not in the
  moderation classifier. Anthropomorphism, refusal phrasing, and tone are tuned
  there.
- **Telemetry** (usage and safety-event counts) has no sink in this app yet. When
  one exists, the report and moderation paths are the natural emit points, but no
  events are emitted today.
