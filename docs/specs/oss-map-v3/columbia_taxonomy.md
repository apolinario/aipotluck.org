# v3 Taxonomy — Columbia-aligned product categories

The v3 map is organized on the openness framework from the Columbia Convening on Openness in AI ([arXiv:2405.15802](https://arxiv.org/abs/2405.15802); follow-on [arXiv:2506.22183](https://arxiv.org/abs/2506.22183)). Products sit in recognizable product categories (below), each aligned to its home in the framework's stack. Five of the eleven sit under the system Product/UX layer — that is expected; the framework's depth is carried by the **openness scoring rubric** ([`scoring-rubric-v3.md`](./scoring-rubric-v3.md)), not by adding more categories.

| # | Category | Framework home | Product type | Citation |
|---|---|---|---|---|
| 1 | Base / pretrained models | `model.weights.pretrained` | model | Appendix I, Model Weights |
| 2 | Fine-tuned / chat models | `model.weights.downstream_adapted` | model | Appendix I, Model Weights |
| 3 | Inference code | `model.code.inference` | software | Appendix I, Code |
| 4 | Fine-tuning code | `model.code.finetuning` | software | Appendix I, Code |
| 5 | Evaluation code | `model.code.evaluation` | software | extension (see note) |
| 6 | Benchmark / eval datasets | `model.datasets.evaluation` | dataset | Appendix I, Datasets |
| 7 | Orchestration & agents | `system.product_ux` | software | §3.2, Fig 3 (GPAIS), p.6 |
| 8 | UI & API | `system.product_ux` | software | §3.2, Fig 3, p.6 |
| 9 | Telemetry & observability | `system.product_ux` | software | §3.2, Fig 3, p.6 |
| 10 | Agent tools & protocols | `system.product_ux` | software | §3.2, Fig 3, p.6 |
| 11 | Deployment | `system.product_ux` | software | §3.2, Fig 3, p.6 |

**Note on `model.code.evaluation` (#5):** the framework's Code family does not enumerate an evaluation-code component (evaluation appears under datasets and documentation). We keep evaluation code as an explicit, flagged extension because it is a real product category worth tracking; it can be removed if reviewers prefer strict fidelity to the paper.

Litmus tests per category are inlined alongside each category in the data registry.
