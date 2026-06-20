<script lang="ts">
	import { env as publicEnv } from "$env/dynamic/public";
	import CarbonArrowRight from "~icons/carbon/arrow-right";
	import CarbonRenew from "~icons/carbon/renew";

	// Opt-in escalation, honest by construction. The sovereign Apertus answer is
	// already shown above; this asks a MORE CAPABLE OPEN model (on a non-sovereign
	// provider) for an independent take, so the user can compare. We never claim the
	// first answer was "low confidence" — we proved that can't be detected honestly
	// per-answer; we surface a real second answer and let the disagreement speak.
	interface Props {
		question?: string;
	}
	let { question }: Props = $props();

	// Flow A (default): opt-in button. Flow B: PUBLIC_SECOND_OPINION_AUTO=true makes
	// it auto-fetch after each answer. Read at runtime from the public env.
	const auto = publicEnv.PUBLIC_SECOND_OPINION_AUTO === "true";

	type State =
		| { kind: "idle" }
		| { kind: "loading" }
		| { kind: "unavailable" }
		| {
				kind: "done";
				answer: string;
				modelShort: string;
				openness: string;
				sovereign: boolean;
		  };

	let state = $state<State>({ kind: "idle" });

	function flashRoute() {
		// A real, user-initiated routing event — graduates the honestly-"building"
		// router node to a live route, because a route actually happened.
		if (typeof window !== "undefined") {
			window.dispatchEvent(new CustomEvent("ap:flash", { detail: { ids: ["router"] } }));
		}
	}

	async function getSecondOpinion() {
		const q = (question ?? "").trim();
		if (!q || state.kind === "loading") return;
		state = { kind: "loading" };
		flashRoute();
		try {
			const res = await fetch("/api/second-opinion", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ question: q }),
			});
			const data = await res.json();
			if (!data?.available) {
				state = { kind: "unavailable" };
				return;
			}
			state = {
				kind: "done",
				answer: data.answer,
				modelShort: data.modelShort ?? "a more capable open model",
				openness: data.openness ?? "open weights",
				sovereign: Boolean(data.sovereign),
			};
		} catch {
			state = { kind: "unavailable" };
		}
	}

	// Flow B: auto-fetch once, after the answer is in. Still honest — it surfaces a
	// real second answer; it just doesn't wait for a click.
	let started = false;
	$effect(() => {
		if (auto && !started && question && state.kind === "idle") {
			started = true;
			getSecondOpinion();
		}
	});
</script>

{#if state.kind === "idle"}
	<button
		onclick={getSecondOpinion}
		class="group inline-flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
		title="Ask a more capable open model for an independent take"
	>
		Get a second opinion
		<CarbonArrowRight class="text-[0.7rem] transition-transform group-hover:translate-x-0.5" />
	</button>
{:else if state.kind === "loading"}
	<div class="inline-flex items-center gap-1.5 text-xs text-gray-400">
		<CarbonRenew class="animate-spin text-[0.7rem]" />
		Routing to a more capable open model…
	</div>
{:else if state.kind === "unavailable"}
	<div class="text-xs text-gray-400 italic">
		Second opinion unavailable right now — the sovereign answer above stands on its own.
	</div>
{:else if state.kind === "done"}
	<div class="mt-1 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/40">
		<div class="mb-1 flex items-center gap-2 text-[0.7rem] text-gray-500 dark:text-gray-400">
			<span class="font-medium text-gray-600 dark:text-gray-300">Second opinion · {state.modelShort}</span>
			<span class="rounded-sm bg-amber-100 px-1 py-px text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
				{state.openness}{state.sovereign ? "" : " · not sovereign"}
			</span>
		</div>
		<div class="text-sm whitespace-pre-line text-gray-800 dark:text-gray-200">{state.answer}</div>
		<div class="mt-1.5 text-[0.7rem] text-gray-400 italic">
			An independent take from a more capable open model on a non-sovereign provider — shown so you can
			compare with the sovereign answer above. Comparing two independent answers is more reliable than trusting either alone.
		</div>
	</div>
{/if}
