<script lang="ts">
	import { connectionState } from "$lib/stores/connectionState";
	import { fly } from "svelte/transition";
	import { prefersReducedMotion } from "svelte/motion";

	// Connection indicator for flaky conference wifi. Calm, not alarming: nothing renders
	// while healthy; degraded states are debounced upstream (connection store) so a sub-second
	// micro-drop never flashes. Color + SHAPE + TEXT (never color alone) and an aria-live
	// region so screen readers announce changes. "offline" auto-recovers on the browser's
	// `online` event (no destructive Retry that would drop the composer text); the
	// "reconnecting" state is dormant until the stream watchdog feeds a liveness signal.

	const COPY = {
		offline: {
			text: "You're offline. Your message will send once you're back.",
			dot: "var(--ap-coral)",
			tone: "border-[var(--ap-coral)] text-[var(--ap-coral-text)] bg-[var(--ap-coral)]/8",
		},
		reconnecting: {
			text: "Reconnecting…",
			dot: "var(--ap-building)",
			tone: "border-[var(--ap-building)] text-[var(--ap-ink)] bg-[var(--ap-building)]/8",
		},
		slow: {
			text: "Slow connection — answers may take longer.",
			dot: "var(--ap-ink-3)",
			tone: "border-[var(--ap-rule)] text-[var(--ap-ink-2)] bg-[var(--ap-paper)]/60",
		},
	} as const;

	let meta = $derived($connectionState === "online" ? null : COPY[$connectionState]);
</script>

<div role="status" aria-live="polite" class="contents">
	{#if meta}
		<div
			in:fly={{ y: -6, duration: prefersReducedMotion.current ? 0 : 240 }}
			out:fly={{ y: -6, duration: prefersReducedMotion.current ? 0 : 160 }}
			class="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] {meta.tone}"
		>
			<span
				class="size-[6px] shrink-0 rounded-full {$connectionState === 'reconnecting'
					? 'animate-pulse'
					: ''}"
				style="background:{meta.dot};"
			></span>
			<span>{meta.text}</span>
		</div>
	{/if}
</div>
