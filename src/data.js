// Open Source AI Market Map — curated dataset
// Health scoring: 0-100. Lower = bigger gap (redder).
// Based on Chip Huyen's methodology + 2024-2026 ecosystem state.

export const MARKET_MAP_DATA = {
  layers: [
    {
      id: "compute",
      title: "Compute & Silicon",
      blurb: "Hardware, kernels, and low-level runtimes that make models run.",
      categories: [
        {
          id: "kernels",
          name: "Kernels & Compilers",
          health: 72,
          projects: [
            { name: "Triton", org: "OpenAI", stars: "13k", license: "MIT", note: "GPU kernel DSL" },
            { name: "TVM", org: "Apache", stars: "11k", license: "Apache-2.0" },
            { name: "MLIR", org: "LLVM", stars: "—", license: "Apache-2.0" },
            { name: "tinygrad", org: "tinygrad", stars: "27k", license: "MIT" },
          ],
        },
        {
          id: "accelerators",
          name: "Accelerator Runtimes",
          health: 38,
          gap: "Vendor lock-in to CUDA; ROCm + non-NVIDIA paths immature.",
          projects: [
            { name: "ROCm", org: "AMD", stars: "5k", license: "MIT" },
            { name: "OpenXLA", org: "Linux Foundation", stars: "3k", license: "Apache-2.0" },
            { name: "oneAPI", org: "Intel", stars: "—", license: "Apache-2.0" },
          ],
        },
        {
          id: "schedulers",
          name: "Cluster Schedulers",
          health: 65,
          projects: [
            { name: "Ray", org: "Anyscale", stars: "33k", license: "Apache-2.0" },
            { name: "Slurm", org: "SchedMD", stars: "—", license: "GPL-2.0" },
            { name: "Volcano", org: "CNCF", stars: "4k", license: "Apache-2.0" },
          ],
        },
        {
          id: "provisioning",
          name: "Open Provisioning",
          health: 28,
          gap: "No open-source equivalent to managed GPU provisioning (e.g. Modal, Replicate).",
          projects: [
            { name: "SkyPilot", org: "UC Berkeley", stars: "7k", license: "Apache-2.0" },
            { name: "dstack", org: "dstack", stars: "2k", license: "MPL-2.0" },
          ],
        },
      ],
    },
    {
      id: "data",
      title: "Data & Datasets",
      blurb: "Datasets, labeling, curation, and lineage for training and evaluation.",
      categories: [
        {
          id: "datasets",
          name: "Open Datasets",
          health: 78,
          projects: [
            { name: "Common Crawl", org: "CC Foundation", license: "Public", note: "Web corpus" },
            { name: "The Pile", org: "EleutherAI", license: "MIT" },
            { name: "RedPajama", org: "Together", license: "Apache-2.0" },
            { name: "FineWeb", org: "Hugging Face", license: "ODC-By" },
            { name: "LAION", org: "LAION", license: "CC-BY-4.0" },
          ],
        },
        {
          id: "labeling",
          name: "Labeling & Annotation",
          health: 55,
          projects: [
            { name: "Label Studio", org: "HumanSignal", stars: "20k", license: "Apache-2.0" },
            { name: "Argilla", org: "Hugging Face", stars: "4k", license: "Apache-2.0" },
            { name: "doccano", org: "doccano", stars: "9k", license: "MIT" },
          ],
        },
        {
          id: "synth",
          name: "Synthetic Data",
          health: 42,
          gap: "Few open tools for high-quality synthetic generation pipelines.",
          projects: [
            { name: "distilabel", org: "Argilla", stars: "2k", license: "Apache-2.0" },
            { name: "Augmentoolkit", org: "community", license: "MIT" },
          ],
        },
        {
          id: "lineage",
          name: "Provenance & Lineage",
          health: 22,
          gap: "No standard for dataset lineage, consent, or content provenance at scale.",
          projects: [
            { name: "Croissant", org: "MLCommons", license: "Apache-2.0" },
            { name: "C2PA (refs)", org: "C2PA", license: "—" },
          ],
        },
      ],
    },
    {
      id: "models",
      title: "Models & Training",
      blurb: "Foundation models, fine-tuning frameworks, and post-training.",
      categories: [
        {
          id: "foundation",
          name: "Foundation Models",
          health: 88,
          projects: [
            { name: "Llama 3.x", org: "Meta", license: "Llama Community" },
            { name: "Mistral", org: "Mistral AI", license: "Apache-2.0" },
            { name: "Qwen", org: "Alibaba", license: "Apache-2.0" },
            { name: "DeepSeek", org: "DeepSeek", license: "MIT" },
            { name: "Gemma", org: "Google", license: "Gemma" },
            { name: "OLMo", org: "AI2", license: "Apache-2.0", note: "Fully open" },
          ],
        },
        {
          id: "training",
          name: "Training Frameworks",
          health: 80,
          projects: [
            { name: "PyTorch", org: "Linux Foundation", stars: "82k", license: "BSD-3" },
            { name: "JAX", org: "Google", stars: "30k", license: "Apache-2.0" },
            { name: "DeepSpeed", org: "Microsoft", stars: "35k", license: "Apache-2.0" },
            { name: "Megatron-LM", org: "NVIDIA", license: "BSD-3" },
          ],
        },
        {
          id: "finetune",
          name: "Fine-tuning & PEFT",
          health: 75,
          projects: [
            { name: "PEFT", org: "Hugging Face", stars: "16k", license: "Apache-2.0" },
            { name: "Axolotl", org: "OpenAccess AI", stars: "8k", license: "Apache-2.0" },
            { name: "Unsloth", org: "Unsloth AI", stars: "17k", license: "Apache-2.0" },
            { name: "TRL", org: "Hugging Face", stars: "10k", license: "Apache-2.0" },
          ],
        },
        {
          id: "rlhf",
          name: "RLHF & Alignment",
          health: 48,
          gap: "Open RLHF tooling fragmented; reproducible recipes scarce.",
          projects: [
            { name: "OpenRLHF", org: "community", stars: "4k", license: "Apache-2.0" },
            { name: "trlX", org: "CarperAI", license: "MIT" },
          ],
        },
      ],
    },
    {
      id: "serve",
      title: "Inference & Serving",
      blurb: "Runtime engines, vector stores, and model gateways.",
      categories: [
        {
          id: "engines",
          name: "Inference Engines",
          health: 90,
          projects: [
            { name: "vLLM", org: "UC Berkeley", stars: "30k", license: "Apache-2.0" },
            { name: "llama.cpp", org: "ggerganov", stars: "67k", license: "MIT" },
            { name: "SGLang", org: "LMSYS", stars: "6k", license: "Apache-2.0" },
            { name: "TGI", org: "Hugging Face", stars: "9k", license: "Apache-2.0" },
            { name: "Ollama", org: "Ollama", stars: "92k", license: "MIT" },
          ],
        },
        {
          id: "vector",
          name: "Vector Stores",
          health: 82,
          projects: [
            { name: "Qdrant", org: "Qdrant", stars: "20k", license: "Apache-2.0" },
            { name: "Weaviate", org: "Weaviate", stars: "11k", license: "BSD-3" },
            { name: "Milvus", org: "LF AI", stars: "30k", license: "Apache-2.0" },
            { name: "Chroma", org: "Chroma", stars: "15k", license: "Apache-2.0" },
          ],
        },
        {
          id: "gateways",
          name: "Model Gateways",
          health: 50,
          projects: [
            { name: "LiteLLM", org: "BerriAI", stars: "13k", license: "MIT" },
            { name: "OpenRouter (refs)", org: "—", license: "—" },
          ],
        },
        {
          id: "edge",
          name: "On-device & Edge",
          health: 58,
          projects: [
            { name: "MLC LLM", org: "MLC", stars: "18k", license: "Apache-2.0" },
            { name: "ExecuTorch", org: "Meta", stars: "2k", license: "BSD-3" },
            { name: "WebLLM", org: "MLC", license: "Apache-2.0" },
          ],
        },
      ],
    },
    {
      id: "agents",
      title: "Agents & Orchestration",
      blurb: "Frameworks for tool-use, retrieval, and multi-step workflows.",
      categories: [
        {
          id: "frameworks",
          name: "Agent Frameworks",
          health: 60,
          projects: [
            { name: "LangChain", org: "LangChain", stars: "94k", license: "MIT" },
            { name: "LlamaIndex", org: "LlamaIndex", stars: "37k", license: "MIT" },
            { name: "Haystack", org: "deepset", stars: "16k", license: "Apache-2.0" },
            { name: "CrewAI", org: "CrewAI", stars: "22k", license: "MIT" },
          ],
        },
        {
          id: "protocols",
          name: "Interop Protocols",
          health: 35,
          gap: "Tool-use & agent protocols just emerging; no clear winner across stacks.",
          projects: [
            { name: "MCP", org: "Anthropic + community", license: "MIT", note: "Model Context Protocol" },
            { name: "OpenAI tool spec", org: "—", license: "—" },
          ],
        },
        {
          id: "memory",
          name: "Long-term Memory",
          health: 30,
          gap: "Memory systems for agents are largely DIY; few open standards.",
          projects: [
            { name: "Mem0", org: "Mem0", stars: "23k", license: "Apache-2.0" },
            { name: "Letta", org: "Letta", stars: "14k", license: "Apache-2.0" },
          ],
        },
        {
          id: "browsers",
          name: "Computer & Browser Use",
          health: 25,
          gap: "Open browser-use agents lag closed counterparts substantially.",
          projects: [
            { name: "browser-use", org: "browser-use", stars: "30k", license: "MIT" },
            { name: "Open Interpreter", org: "OI", stars: "55k", license: "AGPL-3.0" },
          ],
        },
      ],
    },
    {
      id: "eval",
      title: "Evaluation & Safety",
      blurb: "Benchmarks, evals, observability, and safeguards.",
      categories: [
        {
          id: "benchmarks",
          name: "Benchmarks",
          health: 62,
          projects: [
            { name: "lm-evaluation-harness", org: "EleutherAI", stars: "7k", license: "MIT" },
            { name: "HELM", org: "Stanford CRFM", license: "Apache-2.0" },
            { name: "BIG-bench", org: "Google", license: "Apache-2.0" },
          ],
        },
        {
          id: "evals",
          name: "Production Evals",
          health: 40,
          gap: "Standardized eval suites for fine-tuned and domain LLMs missing.",
          projects: [
            { name: "DeepEval", org: "Confident AI", stars: "4k", license: "Apache-2.0" },
            { name: "Promptfoo", org: "Promptfoo", stars: "5k", license: "MIT" },
            { name: "Inspect", org: "UK AISI", license: "MIT" },
          ],
        },
        {
          id: "obs",
          name: "Observability",
          health: 55,
          projects: [
            { name: "Langfuse", org: "Langfuse", stars: "8k", license: "MIT" },
            { name: "Phoenix", org: "Arize", stars: "4k", license: "Elastic-2.0" },
            { name: "OpenLLMetry", org: "Traceloop", license: "Apache-2.0" },
          ],
        },
        {
          id: "safety",
          name: "Safeguards & Red-team",
          health: 32,
          gap: "Open safety classifiers and red-team toolchains thin; uneven coverage.",
          projects: [
            { name: "Llama Guard", org: "Meta", license: "Llama" },
            { name: "Granite Guardian", org: "IBM", license: "Apache-2.0" },
            { name: "Garak", org: "NVIDIA", stars: "3k", license: "Apache-2.0" },
          ],
        },
      ],
    },
    {
      id: "ux",
      title: "Product & UX",
      blurb: "End-user surfaces — chat UIs, IDEs, and developer products.",
      categories: [
        {
          id: "chat",
          name: "Chat UIs",
          health: 70,
          projects: [
            { name: "Open WebUI", org: "Open WebUI", stars: "60k", license: "MIT" },
            { name: "LibreChat", org: "Danny Avila", stars: "20k", license: "MIT" },
            { name: "Chatbot UI", org: "mckaywrigley", stars: "29k", license: "MIT" },
          ],
        },
        {
          id: "ide",
          name: "AI IDEs & Coding",
          health: 52,
          projects: [
            { name: "Continue", org: "Continue", stars: "20k", license: "Apache-2.0" },
            { name: "Aider", org: "Aider", stars: "25k", license: "Apache-2.0" },
            { name: "Cline", org: "Cline", stars: "30k", license: "Apache-2.0" },
          ],
        },
        {
          id: "lowcode",
          name: "Low-code / Visual",
          health: 45,
          projects: [
            { name: "Flowise", org: "FlowiseAI", stars: "32k", license: "Apache-2.0" },
            { name: "Langflow", org: "Langflow", stars: "40k", license: "MIT" },
            { name: "n8n (AI nodes)", org: "n8n", license: "Sustainable Use" },
          ],
        },
        {
          id: "consumer",
          name: "Consumer Apps",
          health: 18,
          gap: "Almost no open-source consumer-grade AI products with mainstream adoption.",
          projects: [
            { name: "Jan", org: "Jan", stars: "26k", license: "AGPL-3.0" },
            { name: "AnythingLLM", org: "Mintplex", stars: "32k", license: "MIT" },
          ],
        },
      ],
    },
  ],
  attributes: [
    { id: "license", name: "Licensing", coverage: 64 },
    { id: "docs", name: "Documentation", coverage: 51 },
    { id: "interop", name: "Interoperability", coverage: 38 },
    { id: "safeguards", name: "Safeguards", coverage: 32 },
    { id: "governance", name: "Governance", coverage: 44 },
  ],
  contributors: [
    { name: "Hugging Face", projects: 9, kind: "Org" },
    { name: "Meta AI", projects: 6, kind: "Org" },
    { name: "EleutherAI", projects: 5, kind: "Community" },
    { name: "UC Berkeley", projects: 4, kind: "Academic" },
    { name: "Linux Foundation", projects: 4, kind: "Foundation" },
    { name: "MLCommons", projects: 3, kind: "Foundation" },
    { name: "Apache", projects: 3, kind: "Foundation" },
    { name: "AI2", projects: 2, kind: "Research" },
  ],
  suggestions: [
    { id: 1, title: "Open evaluation harness for multilingual reasoning", layer: "eval", category: "evals", votes: 142, author: "@aanya.research", state: "Open" },
    { id: 2, title: "Standardized dataset lineage + consent metadata", layer: "data", category: "lineage", votes: 118, author: "@MLCommons-WG", state: "In progress" },
    { id: 3, title: "Vendor-neutral GPU provisioning OSS (Modal-equivalent)", layer: "compute", category: "provisioning", votes: 96, author: "@kyokushinkarate", state: "Open" },
    { id: 4, title: "Open consumer chat product with mobile parity", layer: "ux", category: "consumer", votes: 87, author: "@ji-eun", state: "Open" },
    { id: 5, title: "Reference RLHF recipe with reproducible runs", layer: "models", category: "rlhf", votes: 73, author: "@openrlhf-wg", state: "Funded" },
    { id: 6, title: "Open browser-use agent w/ enterprise safety profile", layer: "agents", category: "browsers", votes: 64, author: "@futura.dev", state: "Open" },
  ],
};
