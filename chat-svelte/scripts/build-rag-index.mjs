// Build the local Tier-A RAG index: chunk the committed catalog data, embed each
// chunk via the HF Inference feature-extraction endpoint, and write the vectors to
// src/lib/server/rag/data/rag-index.json (committed, so CI/deploys need no key).
//
// Sources (Tier A only — small, curated, already grounding the chat):
//   - categories.json   one chunk per gap-map subcategory (rationale + maturity)
//   - exemplars.json    one chunk per category listing real exemplar repos
//   - stack-map.json    one chunk per stack node (the live product narrative)
//   - PROJECT_CONTEXT    the "about AI Potluck" blurb (kept in sync by hand)
//
//   node scripts/build-rag-index.mjs            # rebuild the index
//   node scripts/build-rag-index.mjs --check    # assert non-empty + dim match (CI)
//
// The embedding request shape mirrors src/lib/server/rag/embed.ts (that module is
// TS and can't be imported here); keep the two in sync.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const CATEGORIES = resolve(root, "src/lib/server/textGeneration/data/categories.json");
const EXEMPLARS = resolve(root, "src/lib/server/textGeneration/data/exemplars.json");
const STACK_MAP = resolve(root, "static/data/stack-map.json");
const OUT = resolve(root, "src/lib/server/rag/data/rag-index.json");

const check = process.argv.includes("--check");

// Load .env.local so a manual rebuild picks up the embedding model + key.
loadDotEnv(resolve(root, ".env.local"));

const MODEL = (process.env.RAG_EMBEDDING_MODEL || "sentence-transformers/all-MiniLM-L6-v2").trim();
const BASE = (
	process.env.RAG_EMBEDDING_BASE_URL || "https://router.huggingface.co/hf-inference/models"
)
	.trim()
	.replace(/\/$/, "");
const TOKEN = (process.env.OPENAI_API_KEY || process.env.HF_TOKEN || "").trim();

function loadDotEnv(path) {
	if (!existsSync(path)) return;
	for (const line of readFileSync(path, "utf8").split("\n")) {
		const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
		if (!m) continue;
		const [, k, raw] = m;
		if (process.env[k] === undefined) {
			process.env[k] = raw.replace(/^["']|["']$/g, "");
		}
	}
}

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

// --- Chunk builders ----------------------------------------------------------

function categoryChunks() {
	if (!existsSync(CATEGORIES)) return [];
	const cats = readJson(CATEGORIES);
	return cats
		.filter((c) => c && c.id && c.display_name)
		.map((c) => {
			const parts = [
				`${c.display_name} (${c.layer_id ?? "catalog"}).`,
				c.description || "",
				c.parity_rationale || "",
				c.maturity ? `Maturity: ${c.maturity}.` : "",
				typeof c.gap_score === "number" ? `Gap score: ${c.gap_score}.` : "",
			];
			return {
				id: `category:${c.id}`,
				source: "categories",
				title: c.display_name,
				text: parts.filter(Boolean).join(" "),
			};
		});
}

function exemplarChunks() {
	if (!existsSync(EXEMPLARS)) return [];
	const ex = readJson(EXEMPLARS);
	return Object.entries(ex)
		.filter(([, repos]) => Array.isArray(repos) && repos.length)
		.map(([id, repos]) => ({
			id: `exemplars:${id}`,
			source: "exemplars",
			title: `Exemplar projects — ${id}`,
			text: `Open-source projects tracked in ${id}: ${repos.slice(0, 12).join(", ")}.`,
		}));
}

function stackMapChunks() {
	if (!existsSync(STACK_MAP)) return [];
	const map = readJson(STACK_MAP);
	const chunks = [];
	for (const layer of map.layers ?? []) {
		for (const node of layer.nodes ?? []) {
			const text = [
				`${node.nm ?? node.id} — ${layer.label} layer.`,
				node.org ? `By ${node.org}.` : "",
				node.st ? `Status: ${node.st}.` : "",
				node.d || "",
				node.prov ? `Provenance: ${node.prov}.` : "",
			]
				.filter(Boolean)
				.join(" ");
			chunks.push({
				id: `stack:${layer.label}:${node.id}`,
				source: "stack-map",
				title: `${node.nm ?? node.id} (${layer.label})`,
				url: node.url,
				text,
			});
		}
	}
	return chunks;
}

function projectChunk() {
	// Mirror of PROJECT_CONTEXT in src/lib/server/textGeneration/grounding.ts.
	return [
		{
			id: "project:about",
			source: "project",
			title: "AI Potluck",
			text: "AI Potluck is the open, map-grounded chat from Current AI, a nonprofit coalition assembling a full-stack, open-source alternative to closed AI from open components. Current AI serves open models here, it does not build them. For the current list of partners or how the project is funded, point people to the project website rather than naming specific partners, funders, or funding sources.",
		},
	];
}

// --- Embedding ---------------------------------------------------------------

async function embed(text) {
	const url = `${BASE}/${MODEL}/pipeline/feature-extraction`;
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
		body: JSON.stringify({ inputs: text }),
	});
	if (!res.ok) {
		throw new Error(`embedding failed (${res.status}) for ${url}: ${await res.text()}`);
	}
	const json = await res.json();
	if (Array.isArray(json) && typeof json[0] === "number") return json;
	if (Array.isArray(json) && Array.isArray(json[0])) return json[0];
	throw new Error("unexpected embedding response shape");
}

// --- Main --------------------------------------------------------------------

async function main() {
	if (check) {
		if (!existsSync(OUT)) {
			console.error("build-rag-index: index missing — run `npm run build:rag-index`.");
			process.exit(1);
		}
		const idx = readJson(OUT);
		if (!idx.chunks?.length) {
			console.error("build-rag-index: index is empty — run `npm run build:rag-index`.");
			process.exit(1);
		}
		const bad = idx.chunks.find((c) => !Array.isArray(c.vector) || c.vector.length !== idx.dim);
		if (bad) {
			console.error(`build-rag-index: dimension mismatch on chunk ${bad.id}.`);
			process.exit(1);
		}
		console.log(`build-rag-index: index OK (${idx.chunks.length} chunks, dim ${idx.dim}). ✓`);
		process.exit(0);
	}

	if (!TOKEN) {
		console.error(
			"build-rag-index: no OPENAI_API_KEY / HF_TOKEN found (set it in chat-svelte/.env.local)."
		);
		process.exit(1);
	}

	const chunks = [...categoryChunks(), ...exemplarChunks(), ...stackMapChunks(), ...projectChunk()];
	console.log(`build-rag-index: ${chunks.length} chunks; embedding with ${MODEL}…`);

	const out = [];
	let dim = 0;
	for (let i = 0; i < chunks.length; i++) {
		const c = chunks[i];
		const vector = await embed(c.text);
		dim = vector.length;
		out.push({ ...c, vector });
		if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
			console.log(`  embedded ${i + 1}/${chunks.length}`);
		}
	}

	const index = { model: MODEL, dim, builtAt: new Date().toISOString(), chunks: out };
	writeFileSync(OUT, `${JSON.stringify(index, null, 0)}\n`);
	console.log(`build-rag-index: wrote ${out.length} chunks (dim ${dim}) -> ${OUT} ✓`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
