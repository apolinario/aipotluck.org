import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import Icons from "unplugin-icons/vite";
import { promises } from "fs";
import { defineConfig } from "vitest/config";
import { config } from "dotenv";

config({ path: "./.env.local" });

// Specs still excluded from the hermetic CI gate (CI_HERMETIC=true): these import a route
// module whose graph touches the DB/session layer at import, so a `vi.mock` of one module
// isn't enough to make them hermetic — they need a live DB + auth context. They still run in
// a full local/live test pass. (The four model-coupled specs — mcp/router, search/searchDecision,
// textGeneration/{title,worldModel} — were rejoined to the gate by stubbing $lib/server/models,
// which neutralizes models.ts's import-time buildModels() fetch. Pass 11.)
// Tracked in aipotluck-internal-notes/chat-hardening.md.
const NON_HERMETIC_SERVER_SPECS = [
	"src/routes/login/callback/updateUser.spec.ts",
	"src/lib/server/api/__tests__/conversations-id.spec.ts",
	"src/lib/server/api/__tests__/user.spec.ts",
];
const ciExclude = process.env.CI_HERMETIC === "true" ? NON_HERMETIC_SERVER_SPECS : [];

// used to load fonts server side for thumbnail generation
function loadTTFAsArrayBuffer() {
	return {
		name: "load-ttf-as-array-buffer",
		async transform(_src, id) {
			if (id.endsWith(".ttf")) {
				return `export default new Uint8Array([
			${new Uint8Array(await promises.readFile(id))}
		  ]).buffer`;
			}
		},
	};
}
export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		Icons({
			compiler: "svelte",
		}),
		loadTTFAsArrayBuffer(),
	],
	// Allow external access via ngrok tunnel host
	server: {
		port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
		// Allow any ngrok-free.app subdomain (dynamic tunnels)
		// See Vite server.allowedHosts: string[] | true
		// Using leading dot matches subdomains per Vite's host check logic
		allowedHosts: ["huggingface.ngrok.io"],
	},
	optimizeDeps: {
		include: ["uuid", "sharp", "clsx"],
	},
	// ES-module workers: the markdown worker now dynamic-imports KaTeX/highlight.js on demand
	// (to keep them off the eager bundle), and code-splitting inside a worker requires the "es"
	// format — the default "iife" can't do dynamic import. Module workers are supported by all
	// modern evergreen browsers (the alpha's target).
	worker: {
		format: "es",
	},
	test: {
		// Run test FILES sequentially (root-level — the per-project knob doesn't reliably apply under
		// `workspace`). The DB-integration specs share ONE database: in parallel, report.spec inserts a
		// row that references a conversation while conversations.spec is deleting conversations, tripping
		// the reports→conversations foreign key (PostgresError 23503) — green in isolation, flaky together.
		// Serial execution + FK-safe cleanupTestData (deletes reports before conversations) makes them
		// deterministic. Client/SSR specs are few and fast, so serializing them too costs little.
		fileParallelism: false,
		workspace: [
			...(process.env.VITEST_BROWSER === "true"
				? [
						{
							// Client-side tests (Svelte components), opt-in due flaky browser harness in CI/local
							extends: "./vite.config.ts",
							test: {
								name: "client",
								environment: "browser",
								browser: {
									enabled: true,
									provider: "playwright",
									instances: [{ browser: "chromium", headless: true }],
								},
								include: ["src/**/*.svelte.{test,spec}.{js,ts}"],
								exclude: ["src/lib/server/**", "src/**/*.ssr.{test,spec}.{js,ts}"],
								setupFiles: ["./scripts/setups/vitest-setup-client.ts"],
							},
						},
					]
				: []),
			{
				// SSR tests (Server-side rendering)
				extends: "./vite.config.ts",
				test: {
					name: "ssr",
					environment: "node",
					include: ["src/**/*.ssr.{test,spec}.{js,ts}"],
				},
			},
			{
				// Server-side tests (Node.js utilities)
				extends: "./vite.config.ts",
				test: {
					name: "server",
					environment: "node",
					include: ["src/**/*.{test,spec}.{js,ts}"],
					exclude: [
						"src/**/*.svelte.{test,spec}.{js,ts}",
						"src/**/*.ssr.{test,spec}.{js,ts}",
						...ciExclude,
					],
					setupFiles: ["./scripts/setups/vitest-setup-server.ts"],
					testTimeout: 30000,
					hookTimeout: 30000,
				},
			},
		],
	},
});
