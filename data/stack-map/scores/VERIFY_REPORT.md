# v3 flagship scoring — verification report

- products scored: 32
- models adversarially verified: 18
- unverifiable versions (corrected/flagged): ['Gemini 3.5']
- disputed openness: none

## Flags
- **Qwen 3.6 (Alibaba)**: mixed_tier_openness
- **MiniMax M3**: partial_release_weights_pending, unverified_benchmarks
- **Nemotron 3 (NVIDIA)**: near_open_source_non_osi_license
- **Gemini 3.5 Flash**: renamed_from_gemini_3.5_per_verify

## Per-model verify verdicts
- OLMo 2 (Ai2): exists=True openness_ok=True
- Pythia (EleutherAI): exists=True openness_ok=True
- Llama 4 Scout / Maverick (Meta): exists=True openness_ok=True — The license sub-component is partly inaccurate. The claim includes a "no-compete/no-train-competing-LLM clause" in the Llama 4 Community License. Verified directly against the license text (llama.com/llama4/license): Section 2 contains the 700M MAU commercial cap (confirmed), and Section 1.b.i requires derivative models to include "Llama" in their name plus "Built with Llama" attribution — but there is NO clause prohibiting use of outputs to train a competing/other LLM. That no-train-competitor restriction existed in the Llama 2 license and was dropped/relaxed in Llama 3.x and Llama 4; the claim appears to conflate Llama 2 terms. Everything else verifies: model released Apr 5, 2025 (not forward-dated); HF page meta-llama/Llama-4-Scout-17B-16E exists with downloadable BF16 safetensors weights (~16K downloads/month, plus int4/fp8 quants); data is closed (only high-level ~40T-token description, no dataset); code is partial (inference/utils via llama-models/llama-cookbook, no training code); license is non-OSI. The overall "restricted" class is defensible regardless of the clause error, since the non-OSI MAU cap plus naming/attribution requirements alone justify it.
- DeepSeek-V3.2 (DeepSeek): exists=True openness_ok=True
- DeepSeek-V4-Pro (DeepSeek): exists=True openness_ok=True
- Qwen 3.6 (Alibaba): exists=True openness_ok=True
- Kimi K2.6 (Moonshot AI): exists=True openness_ok=True
- Mistral Large 3: exists=True openness_ok=True
- Gemma 3 (Google): exists=True openness_ok=True
- GLM-5.1 (Zhipu / Z.ai): exists=True openness_ok=True — No blocking issue. Entry verified against the authoritative Hugging Face model card (zai-org/GLM-5.1), which confirms MIT license and downloadable open Safetensors weights, with no public training data or training code released (only weights plus a technical report and inference repo) — consistent with the claimed open_weights class (weights:open(MIT); data:closed; code:closed). Released April 7, 2026 by Z.ai (formerly Zhipu AI); not forward-dated/hallucinated. Two caveats worth noting: (1) the three claimed sources are SEO/aggregator blogs (buildfastwithai, mlhive, llm-stats) rather than primary sources, and one (mlhive) could not be independently confirmed; (2) a minor parameter-count inconsistency appears across sources (744B vs 754B), with HF/llm-stats reporting 754B MoE / 40B active — this does not affect the openness classification.
- Phi-4 (Microsoft): exists=True openness_ok=True
- Falcon 3 (TII): exists=True openness_ok=True — Minor: the claimed license string is written as "TII-Falcon-License-2.0" but the official/exact name is "TII Falcon-LLM License 2.0" (the "LLM" token is missing). This is cosmetic and does not affect the classification.
- MiniMax M3: exists=True openness_ok=True
- Nemotron 3 (NVIDIA): exists=True openness_ok=True — Minor (non-blocking): the "data:open" claim slightly overstates completeness. NVIDIA explicitly states it releases only "all the data for which we hold redistribution rights," so the pretraining/post-training corpora are substantially but not fully released. Everything else (weights open on HF in BF16/FP8/NVFP4, code/recipes + 21 RL env configs on the Nemotron Developer GitHub repo, NVIDIA Nemotron Open Model License = permissive, commercial, non-OSI) is fully corroborated by NVIDIA's own newsroom/blog/research-labs/technical-report and independent coverage (VentureBeat, Artificial Analysis, OpenRouter, Decrypt). Model is real and released (Nemotron 3 Super launched March 11, 2026 at GTC; Nano available; Ultra unveiled June 1, 2026 at Computex) — not a hallucinated or forward-dated version.
- GPT-5: exists=True openness_ok=True
- Claude Opus 4.7: exists=True openness_ok=True
- Gemini 3.5: exists=False openness_ok=True — The bare "Gemini 3.5" is not a released model SKU. The cited Google blog post and Gemini API docs describe Gemini 3.5 as a model *family*; the only generally-available released model is "Gemini 3.5 Flash" (GA May 19, 2026, API ID gemini-3.5-flash). "Gemini 3.5 Pro" was announced as internal-only with a planned rollout the following month and is not confirmed GA as of early June 2026. The entry conflates the family name with a shippable version. The openness class itself is correct: all Gemini 3.5 models are API-only/proprietary with weights, data, and code closed (in contrast to Google's open-weights Gemma line), so closed;weights:closed;data:closed;code:closed;Proprietary(API-only) is accurate.
- Grok 4.20: exists=True openness_ok=True
