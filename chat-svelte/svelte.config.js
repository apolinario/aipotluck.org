import adapterVercel from "@sveltejs/adapter-vercel";
import adapterNode from "@sveltejs/adapter-node";
import adapterStatic from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import dotenv from "dotenv";
import { execSync } from "child_process";

dotenv.config({ path: "./.env.local", override: true });
dotenv.config({ path: "./.env" });

// Deploy target. Default is Vercel serverless (the B1-lite goal); ADAPTER=node/static for other hosts.
const adapterChoice = process.env.ADAPTER ?? "vercel";

function getCurrentCommitSHA() {
	try {
		return execSync("git rev-parse HEAD").toString();
	} catch (error) {
		console.error("Error getting current commit SHA:", error);
		return "unknown";
	}
}

process.env.PUBLIC_VERSION ??= process.env.npm_package_version;
process.env.PUBLIC_COMMIT_SHA ??= getCurrentCommitSHA();
process.env.PUBLIC_APP_ASSETS ??= "chatui";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter:
			adapterChoice === "static"
				? adapterStatic({ fallback: "index.html", strict: false })
				: adapterChoice === "node"
					? adapterNode()
					: // Vercel serverless: postgres.js + Node APIs (Buffer/streams) require the Node runtime.
						adapterVercel({ runtime: "nodejs22.x" }),

		paths: {
			base: process.env.APP_BASE || "",
			relative: false,
		},
		csrf: {
			// handled in hooks.server.ts, because we can have multiple valid origins
			trustedOrigins: ["*"],
		},
		csp: {
			directives: {
				...(process.env.ALLOW_IFRAME === "true"
					? {}
					: { "frame-ancestors": ["https://huggingface.co"] }),
			},
		},
		alias: {},
	},
};

export default config;
