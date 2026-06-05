# OSS Map v3 — Coverage & Review Report (final)

Generated 2026-06-04. **284 products** (264 re-scored + 32 anchors, post review-cleanup + independent verify pass). Source: `all_scores_v3.json`; removed items in `rejects_v3.json`.

## Coverage by category

| category | n | open* | open_wt | restr | src_avail | open_core | closed | gated | stale |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| base_pretrained | 33 | 2 | 13 | 8 | 0 | 0 | 10 | 0 | 3 |
| finetuned_chat | 41 | 1 | 15 | 9 | 0 | 0 | 16 | 0 | 5 |
| inference_code | 18 | 8 | 0 | 0 | 1 | 0 | 9 | 0 | 1 |
| finetuning_code | 27 | 13 | 0 | 0 | 0 | 2 | 12 | 0 | 5 |
| evaluation_code | 22 | 12 | 0 | 0 | 1 | 4 | 5 | 0 | 2 |
| benchmark_eval_data | 22 | 17 | 0 | 0 | 0 | 0 | 3 | 2 | 0 |
| orchestration_agents | 25 | 9 | 0 | 0 | 3 | 3 | 10 | 0 | 1 |
| ui_api | 28 | 7 | 0 | 0 | 2 | 2 | 17 | 0 | 1 |
| telemetry_observability | 25 | 6 | 0 | 0 | 1 | 7 | 11 | 0 | 2 |
| agent_tools_protocols | 20 | 6 | 0 | 0 | 0 | 5 | 9 | 0 | 0 |
| deployment | 23 | 7 | 0 | 0 | 1 | 10 | 5 | 0 | 1 |

## Openness by type
- **model** (74): open_weights 28, closed 26, restricted 17, open_source 3
- **software** (188): closed 78, open_source 68, open_core 33, source_available 9
- **dataset** (22): open 17, closed 3, gated 2

**Headline:** of the models, only the handful classed `open_source` are full-pipeline open; the rest are open-weights, restricted (non-OSI), or closed. Software skews genuinely open-source. *The tools are open; the models are at best open-weights.*

## Audit
- `rejects_v3.json` — removed during review (unverifiable, out-of-scope, dedup-vs-anchor).
- Independent verify pass `wem88cyxg` corrected ~30 records (existence/class/headline-source vs primary sources).
- Deferred: long-tail (~24.7k) + new/unmapped-product intake.
