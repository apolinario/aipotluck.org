# Findings — walk-or-drive "Heuristic Override" (summary)

> The current served model is evaluated here at a **high level only**. The full
> per-condition numbers, and the exact served checkpoint, live in the private
> `FINDINGS.local.md` (gitignored) — the current model under test is a
> pre-release build, so the public tree does not name it or publish absolute
> scores. Earlier work on the released `Apertus-*-Instruct-2509` checkpoints is
> summarized directionally below.

**Method.** Walk-or-drive "Heuristic Override" scenarios: an errand where a
spurious distance cue tempts "just walk," but the task actually requires a
vehicle (the car must be co-present to be serviced; a heavy / return payload
must be moved). A distance-occluded, isolated crux-question probe classifies
each trap as **weights-bound** (the model lacks the primitive even when asked
directly) vs **harness-reachable** (capability present but suppressed by the
cue). Gold is derived from scenario structure, not from a model grading a model;
a natural, hand-written set pressure-tests generalization beyond templates. See
`README.md` for the protocol and `REFERENCES.md` for the source papers.

**Directional read.**
- **Co-presence reasoning is weights-bound on the smaller model — a real failure
  mode.** Asked directly whether a service that acts on the car can succeed when
  the car is left at home, the smaller model contradicts itself; decomposition
  cannot supply a primitive the weights lack.
- **Physical-capacity reasoning is harness-reachable.** The same model answers
  pointed capacity questions correctly when the distance cue is occluded — but
  open-ended "does this achieve the goal?" simulation is sycophantic toward
  feasibility, so a pointed, falsifiable verification question is required.
- **Released `Apertus-70B-Instruct-2509` handled the override more reliably than
  `Apertus-8B-Instruct-2509`.** On the isolated crux probe the 70B largely has
  the co-presence primitive (the cue merely suppresses it), where the 8B lacks
  it outright — a model-dependent, not purely prompt-dependent, failure.
- **A neutral reframe → deterministic gate is the fix; a leading reframe is not.**
  Letting the model supply facts with no answer hint, then deciding in a
  deterministic gate, recovers most traps while preserving "walk" cases; a
  leading reframe turns the model into an always-drive yes-machine.
- **The decision must live in the gate, not the model.** When facts are injected
  and the model is left to reason, it can revert to the distance heuristic and
  override supplied truth — so naive fact-injection / commonsense-RAG is risky
  here; the gate decides and the model only phrases the result.
- **A triage pre-filter is required.** Running the world-model pre-pass on
  non-errand chat spuriously fires "drive," so it must gate only on
  travel-decision turns.
- **Persona prompt does not induce the failure** (it mildly helps), and a
  principled, well-shaped question beats an accreted multi-key schema — when a
  decomposition is brittle, ask a better question rather than adding keys.
- **Cross-suite theme.** Added prompt complexity erodes the *effortful* reasoning
  first — it falls on exactly the reasoning-dependent trap items, not the easy
  defaults — arguing for lean prompts on reasoning-dependent turns.
