// Build a compact `public/data/stack-map.json` for the "Under the hood" stack
// map: the curated AI Potluck narrative stack (faithful to the validated POC),
// hydrated with REAL stats from the local OSO product-view data. We bake a small
// file rather than shipping ~10MB of source JSON for ~13 nodes.
//
// Run: node scripts/build-stack-map.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OSO = join(
  __dirname,
  "../../app/public/data" // OSO product-view data, shared in-repo from the Vite app
);
const OUT = join(__dirname, "../public/data/stack-map.json");

// Mirror of lib/ai/model-identity.ts (kept tiny + standalone for the build step)
// so the map's Model node reflects the actually-served model, not a hardcoded name.
const MODEL_ID = process.env.HF_MODEL ?? "swiss-ai/Apertus-70B-Instruct-2509";
const MODEL = (() => {
  const lo = MODEL_ID.toLowerCase();
  const url = `https://huggingface.co/${MODEL_ID}`;
  // Dataset lineage — the "trace it yourself" depth behind the model's
  // provenance. Verified against the Apertus model card + technical report
  // (arXiv 2509.14233): fully open weights + open data + reproducible recipe,
  // trained respecting data-owner opt-out (even retroactively). These are the
  // facts that make it a genuinely open, public-interest model, with the
  // authoritative trail to check.
  const apertusLineage = {
    summary: "fully open & reproducible, opt-out-respecting",
    facts: [
      "15T tokens · 1811 languages",
      "open weights + open data + open training recipe",
      "respects data-owner opt-out, even retroactively",
    ],
    links: [
      { label: "Technical report ↗", url: "https://arxiv.org/abs/2509.14233" },
      {
        label: "Data recipe ↗",
        url: "https://github.com/swiss-ai/pretrain-data",
      },
    ],
  };
  if (lo.includes("apertus") && lo.includes("8b")) {
    return {
      nm: "Apertus 1.5",
      d: "Open-weights Swiss model. Multimodal, multilingual, open training data.",
      url,
      lineage: apertusLineage,
    };
  }
  if (lo.includes("apertus")) {
    return {
      nm: "Apertus 70B",
      d: "Open-weights Swiss foundation model (text-only today; multimodal incoming). Multilingual, open training data.",
      url,
      lineage: apertusLineage,
    };
  }
  return {
    nm: MODEL_ID.split("/").pop() ?? MODEL_ID,
    d: "Open-weights model.",
    url,
    lineage: null,
  };
})();

// --- Curated narrative stack (mirrors the blessed POC). `pid` links a node to
// its real OSO product_id when one exists; nodes without `pid` show curated
// provenance only (compute/partners/gaps that aren't GitHub repos). ---
const LAYERS = [
  {
    label: "Routing",
    nodes: [
      {
        id: "router",
        nm: "model-router",
        org: "Arch-Router · Katanemo",
        st: "building",
        d: "Planned: route each query to the right open model by task (Arch-Router-1.5B). One model serves every answer today; provider routing (LiteLLM) is already live via HuggingFace.",
      },
    ],
  },
  {
    label: "Model",
    nodes: [
      {
        id: "apertus",
        nm: MODEL.nm,
        org: "Swiss AI Initiative (SwissAI)",
        st: "live",
        d: MODEL.d,
        prov: "open weights · HuggingFace · trained on CSCS",
        url: MODEL.url,
        ...(MODEL.lineage ? { lineage: MODEL.lineage } : {}),
      },
    ],
  },
  {
    label: "Compute",
    nodes: [
      {
        id: "cscs",
        nm: "CSCS 🇨🇭",
        org: "Swiss National Supercomputing Centre",
        st: "live",
        d: "Sovereign public compute — owned by the public, not a company. Apertus was trained here; production serves from here too (this prototype runs via HuggingFace).",
        prov: "public infrastructure · Switzerland",
      },
      {
        id: "lumi",
        nm: "LUMI 🇫🇮",
        org: "CSC, Finland",
        st: "live",
        d: "EuroHPC sovereign compute pool — a production serving target for the public stack.",
        prov: "public infrastructure · EuroHPC",
      },
    ],
  },
  {
    label: "Safety",
    nodes: [
      {
        id: "toxicbert",
        nm: "toxic-bert",
        org: "Unitary · Detoxify",
        st: "live",
        d: "Apache-2.0 toxicity classifier — screens every message before it reaches the model. Flags toxic or abusive language (not all harmful requests).",
        prov: "open safety classifier",
      },
      {
        id: "osprey",
        nm: "Osprey",
        org: "ROOST.tech",
        st: "building",
        d: "Request-path abuse detection with reviewable logs — building.",
        prov: "open moderation tooling",
      },
    ],
  },
  {
    label: "Tools",
    nodes: [
      {
        id: "websearch",
        nm: "Web search",
        org: "Wikipedia · Marginalia",
        st: "building",
        d: "Wiring open-knowledge search: Wikipedia (open public knowledge) + Marginalia (open independent index). A Google-scale open web index is still the honest gap.",
        prov: "open knowledge + open independent index",
      },
      {
        id: "upload",
        nm: "File upload",
        org: "Docling · pgvector",
        st: "building",
        d: "Open document parsing + retrieval over open vector stores — building. Files attach today but aren't parsed yet.",
        pid: "repo:docling-project/docling",
      },
      {
        id: "voice",
        nm: "Voice",
        org: "open invitation",
        st: "wanted",
        d: "Talk to it out loud. Not part of the open stack here yet — an open invitation, not a closed door.",
      },
      {
        id: "imagegen",
        nm: "Image generation",
        org: "open invitation",
        st: "wanted",
        d: "Make images from a prompt. Open projects exist; nobody has wired one in here yet.",
      },
    ],
  },
  {
    label: "Agent",
    nodes: [
      {
        id: "hermes",
        nm: "Nous Hermes",
        org: "Nous Research",
        st: "building",
        d: "Hosted agent service — developer API only for the alpha.",
        prov: "open agent models · API-only for alpha",
      },
      {
        id: "computeruse",
        nm: "Computer use",
        org: "open invitation",
        st: "wanted",
        d: "Let the AI act in apps and the browser on your behalf.",
      },
      {
        id: "memory",
        nm: "Memory",
        org: "open invitation",
        st: "wanted",
        d: "Remember context across conversations.",
      },
    ],
  },
  {
    label: "Community",
    nodes: [
      {
        id: "localculture",
        nm: "local-culture",
        org: "open invitation",
        st: "gap",
        d: "Community self-configuration of a live deployment. Not built yet — an open gap, not a promise. This is where a contribution would land.",
      },
    ],
  },
];

function loadJSON(name) {
  const p = join(OSO, name);
  if (!existsSync(p)) {
    console.warn(
      `! missing ${name} — nodes will fall back to curated provenance`
    );
    return null;
  }
  return JSON.parse(readFileSync(p, "utf8"));
}

const products = loadJSON("products.json") ?? [];
const repos = loadJSON("repos_attrs.json") ?? [];
const sparks = loadJSON("sparklines.json") ?? {};

const productById = new Map(products.map((p) => [p.product_id, p]));
const repoById = new Map(repos.map((r) => [r.product_id, r]));
// sparklines keyed by repo slug, case can drift — index lowercased
const sparkByslug = new Map(
  Object.entries(sparks).map(([k, v]) => [k.toLowerCase(), v])
);

function atlasFor(node) {
  if (!node.pid) {
    return null;
  }
  const r = repoById.get(node.pid);
  const p = productById.get(node.pid);
  if (!r && !p) {
    return null;
  }
  const slug = node.pid.replace(/^repo:/, "").toLowerCase();
  const spark = sparkByslugSafe(slug);
  return {
    pid: node.pid,
    stars: r?.stars ?? null,
    stars7d: r?.star_7d ?? null,
    contributors: r?.total_contributors ?? r?.contributors ?? null,
    commits90d: r?.commits_90d ?? null,
    language: r?.language || null,
    license: r?.license || null,
    desc: r?.description || null,
    url:
      p?.url ||
      (node.pid.startsWith("repo:")
        ? `https://github.com/${node.pid.slice(5)}`
        : null),
    openness: p ? (p.is_open ? "open" : "closed") : "open",
    sparkline: spark?.stars?.slice(-16) ?? null,
  };
}
function sparkByslugSafe(slug) {
  return sparkByslug.get(slug) ?? null;
}

const out = {
  generatedFrom: "OSO product-view (local)",
  layers: LAYERS.map((l) => ({
    label: l.label,
    ghost: l.ghost ?? false,
    nodes: l.nodes.map((n) => {
      const atlas = atlasFor(n);
      return {
        id: n.id,
        nm: n.nm,
        org: n.org,
        st: n.st,
        d: n.d,
        ...(n.prov ? { prov: n.prov } : {}),
        ...(n.url ? { url: n.url } : {}),
        ...(n.lineage ? { lineage: n.lineage } : {}),
        ...(atlas ? { atlas } : {}),
      };
    }),
  })),
};

// coverage counts
const counts = { live: 0, building: 0, gap: 0, wanted: 0 };
for (const l of out.layers) {
  for (const n of l.nodes) {
    counts[n.st] = (counts[n.st] || 0) + 1;
  }
}
out.coverage = counts;

writeFileSync(OUT, JSON.stringify(out, null, 2));
const hydrated = out.layers.flatMap((l) => l.nodes).filter((n) => n.atlas);
console.log(`✓ wrote ${OUT}`);
console.log(
  `  coverage: ${counts.live} live · ${counts.building} building · ${counts.gap} gap · ${counts.wanted} wanted`
);
console.log(
  `  hydrated with real OSO data: ${hydrated.map((n) => `${n.nm} (★${n.atlas.stars})`).join(", ")}`
);
