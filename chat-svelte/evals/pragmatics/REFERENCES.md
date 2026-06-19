# References — 2024-2026 lit review for the walk-or-drive harness

Compiled from a 5-lens parallel literature sweep (decomposition, verify/gating,
the problem domain, world-models/simulation, small-model reasoning). arXiv IDs
are marked **verified** (abstract page resolved) or **UNVERIFIED** (surfaced in
search listings only — confirm before citing in anything formal).

## The problem class (car-wash = "Heuristic Override")

- **The Model Says Walk: How Surface Heuristics Override Implicit Constraints in
  LLM Reasoning** — Li, Zhang, Jiang, Krishnan, Padman (CMU), 2026.
  arXiv:2603.29025 (verified). Ships the **Heuristic Override Benchmark (HOB)**,
  500 items, constraint taxonomy (presence/capability/scope/validity/procedural);
  distance cues 8.7–38× stronger than the stated goal; presence-constraints
  (car-wash class) hardest at 44%; no model >75% strict. **The home paper.**
- **BrainBench** — Tang (Georgia Tech), 2026. arXiv:2603.14761 (verified). 100
  brainteasers, 20 commonsense failure categories; uses "walk or drive my rental
  car to the return lot" verbatim; best = Claude Opus 4.6 +thinking 80.3%.
- **Prompt Architecture Determines Reasoning Quality (Car Wash Problem)** — Jo,
  2026. arXiv:2602.21814 (verified). STAR scaffold: car-wash 0%→85% on Sonnet 4.5.
- **Prompt Complexity Dilutes Structured Reasoning (Car Wash follow-up)** — Jo,
  2026. arXiv:2603.13351 (verified). A conclusion-first production system prompt
  collapses STAR back to 0–30%. **Directly relevant to auditing persona prompts.**
- **Opper AI "Car Wash Test on 53 models"** — opper.ai blog, 2025-26 (grey-lit).
  11/53 correct single-pass; all Llama + Mistral 0/10; human baseline 71.5%.
- Mechanism ancestors: **Shortcut Learning of LLMs** (Du et al., CACM 2024,
  arXiv:2208.11857, verified); **Counter-Commonsense Context / CConS** (Kondo et
  al., ACL 2023, arXiv:2306.02258, verified); **Alice in Wonderland** (Nezhurina
  et al., NeurIPS 2024 D&B, arXiv:2406.02061, verified — different mechanism,
  same genre); **defeasible reasoning** (NAACL 2025, 2025.naacl-long.529).

## Forward-simulation / LLM-as-world-model (condition C's generator)

- **WebDreamer — Is Your LLM Secretly a World Model of the Internet?** — Gu et
  al., 2024/NAACL 2025. arXiv:2411.06559 (verified). Simulate each option's
  outcome → pick best, **no tree search**, **Dreamer-7B ≈ GPT-4o**. Closest
  template to condition C.
- **FaR — How FaR Are LLMs From Agents with Theory-of-Mind?** — Zhou et al.,
  ICLR 2024. arXiv:2310.03051 (verified). Foresee-consequences-then-act;
  GPT-4 action-selection 50%→71%. The cheap single-pass floor.
- **RAP — Reasoning with Language Model is Planning with World Model** — Hao et
  al., EMNLP 2023. arXiv:2305.14992 (verified). Canonical LLM-as-world-model + MCTS.
- **LLM Reasoners** — Hao et al., COLM 2024. arXiv:2404.05221 (verified).
  `WorldModel`+`SearchConfig`+`SearchAlgorithm` abstraction — our seam (swap
  search for a single-rollout gate).
- **PlaSma** — Brahman et al., ICLR 2024. arXiv:2305.19472 (verified).
  Counterfactual planning distilled into 770M–11B models.
- Caveat: **Reasoning or Reciting?** — Wu et al., NAACL 2024. arXiv:2307.02477
  (verified). LLM world-models degrade sharply off-distribution → simulation is
  the weak link; motivates an explicit gate.

## LLM-proposes / deterministic-disposes (condition C's gate)

- **LLM-Modulo** — Kambhampati et al., ICML 2024. arXiv:2402.01817 (verified).
  Generate-test-critique with *external sound verifiers*. The architecture name.
- **LLMs Cannot Self-Correct Reasoning Yet** — Huang et al., ICLR 2024.
  arXiv:2310.01798 (verified). Negative result scoped *only* to **intrinsic**
  self-correction → an external deterministic gate is the explicit escape hatch.
- **Small Language Models Need Strong Verifiers to Self-Correct** — Zhang et al.,
  ACL Findings 2024. arXiv:2404.17140 (verified). Small models gain only with a
  *strong external* verifier; a deterministic rule is the strongest possible.
- **Chain-of-Verification (CoVe)** — Dhuliawala et al., ACL Findings 2024.
  arXiv:2309.11495 (verified). Answer verification questions independently of the
  draft → keep the simulation blind to any proposed answer.
- **Self-Consistency** — Wang et al., ICLR 2023. arXiv:2203.11171 (verified).
  Canonical "LLM proposes (samples), deterministic rule (majority) disposes".
- **Weaver — Shrinking the Generation-Verification Gap** — Saad-Falcon et al.,
  2025. arXiv:2506.18203 (verified). Generation-verification asymmetry: verifying
  is cheaper than generating.
- **Logic-LM** — Pan et al., EMNLP 2023. arXiv:2305.12295 (**UNVERIFIED**).
  LLM→formal spec→symbolic solver decides. Architectural twin of the gate.

## Decomposition (condition C's "easy sub-questions" move)

- **Least-to-Most** — Zhou et al., ICLR 2023. arXiv:2205.10625 (verified).
- **Self-Ask / compositionality gap** — Press et al., EMNLP Findings 2023.
  arXiv:2210.03350 (verified). "Knows all sub-facts, fails to compose" = our thesis.
- **Factored decomposition** — Radhakrishnan et al. (Anthropic), 2023.
  arXiv:2307.11768 (verified). Answer each sub-question in an *isolated fresh
  context* → most exact match to "decompose below threshold then recombine".
- **DecomP** (arXiv:2210.02406, verified); **Plan-and-Solve** (arXiv:2305.04091,
  verified); **Selection-Inference** (arXiv:2205.09712, verified — 7B in-framework
  beat a 280B baseline); **Faithful CoT** (arXiv:2301.13379, verified).
- **Collab-RAG** — Xu et al., 2025. arXiv:2504.04915 (verified). A fine-tuned 3B
  decomposer out-decomposes a frozen 32B → small-model decomposer is viable.
- Caveat: **Decomposed Prompting Does Not Fix Knowledge Gaps** — Madhwal et al.,
  2026. arXiv:2602.04853 (**UNVERIFIED ID**). Decomposition can't conjure missing
  facts; gains shrink on stronger models; residual value is abstention.
- **AtomR — Atomic Reasoning Tree** — 2024-25. arXiv:2411.16495 (**UNVERIFIED**).
  Recurse until each leaf is atomic/directly-answerable.

## Small-model reasoning via external structure

- **CoT Elicits Reasoning** — Wei et al., NeurIPS 2022. arXiv:2201.11903
  (verified). CoT emerges ~100B; **below threshold it degrades small models**.
- **Divide-and-Conquer Prompting** — 2024. arXiv:2402.05359 (verified ID). D&C
  helps specifically on deceptive/trap-like sub-structure.
- **LM-Guided CoT** — Lee et al., LREC-COLING 2024. arXiv:2404.03414 (verified).
  Decouple "produce structure" (small model) from "produce answer".
- **Distilling Step-by-Step** — Hsieh et al., ACL Findings 2023. arXiv:2305.02301
  (verified). 770M beats 540B on the specialized task (FT path we're avoiding).
- **Do LLMs Overthink Basic Math?** — 2025. arXiv:2507.04023 (verified ID).
  **Inverse-U**: longer chains correlate with *wrong* answers on easy inputs.
- **Are BabyLMs Deaf to Gricean Maxims?** — 2025. arXiv:2510.04764 (verified ID).
  Small models fail to *generate* implicature even when they can *recognize* it →
  a constrained/gated format recovers competence the free path loses.
- **DeepSeek-R1 distilled** — 2025. arXiv:2501.12948 (**UNVERIFIED ID**).
  Distillation > direct RL on small models; 1.5B falls off a cliff, 7-8B holds.

## Other UNVERIFIED IDs flagged by the agents (confirm before citing)

2503.04421, 2502.16690 (world-model coherence); Global/Ko/EPiK-PIQA
(2510.24081 / 2509.11303 / 2509.17807, IDs verified, author lists not);
self-consistency successors 2410.10857 / 2407.02056 / 2506.16043; simulation
frontier 2601.03905 / 2503.10480 / 2601.08955 / 2506.06725 / 2410.13232;
T1 tool-verification 2504.04718; PUB pragmatics benchmark (arXiv ID unverified).

## Sibling eval-suite candidates (verified 2026-06-18)

The walk-or-drive harness is one instance of a "surface shortcut over an implicit
constraint" eval. Citations below were web-verified (existence, arXiv id, data
availability) before listing — three of my from-memory ids were wrong and are
corrected here.

| paper | arXiv | data | for a chat product |
|-------|-------|------|--------------------|
| Sharma et al. 2023, Towards Understanding Sycophancy | 2310.13548 | RELEASED (github.com/meg-tong/sycophancy-eval) | high — agreeing with a wrong premise = trust failure |
| Ruis et al. 2022, LLMs are not zero-shot communicators | 2210.14986 | dataset exists (name unconfirmed) | high — pragmatic over-literalness |
| Mirzadeh et al. 2024, GSM-Symbolic | 2410.05229 | RELEASED (templates, HF) | med — irrelevant-clause robustness, same mechanism as HOB |
| Berglund et al. 2023, The Reversal Curse | 2309.12288 | synthetic (trivial gen) | low — knowledge-consistency |
| Wu et al. 2023, Reasoning or Reciting? | 2307.02477 | released | low — counterfactual world-model robustness |
| McCoy et al. 2024, Embers of Autoregression | 2309.13638 (PNAS) | method reproducible | low — surface-statistics-over-logic |

Latest (2026) in this lineage:
- **2603.13351 — "Prompt Complexity Dilutes Structured Reasoning: A Follow-Up
  Study on the Car Wash Problem"** — a direct follow-up to *this* problem;
  validates the P_persona finding (heavy prompts dilute the reasoning). Fold into
  this harness as a prompt-complexity condition.
- A 2026 pragmatic-competence benchmark (child-level competence / Quantity-maxim
  violations) may supersede Ruis 2022 as the implicature instrument — verify data
  before choosing.
- 2602.06176 (LLM reasoning-failure taxonomy), 2603.19997 (cancelability in
  interactive instruction following) — adjacent, worth a scan.

Roadmap to build these (leverage order) lives in the session task list.
