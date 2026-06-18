<script lang="ts">
	// First-run orientation overlay (the Feature Lock's top item): a non-technical
	// attendee arriving cold via the summit QR code needs to know what AI Potluck
	// is, who built it, and why it differs from ChatGPT before the chat reads as
	// "just another chatbot". Per the Web UX wireframe it overlays the CHAT PANEL
	// only — on desktop the live-stack map stays visible on the right, so the copy
	// and the map reinforce each other. Svelte 5 port of the Vercel app's
	// components/chat/welcome-overlay.tsx, on the editorial paper theme (--ap-*).
	//
	// Voice: flat, declarative, non-anthropomorphic, honest about the alpha (gaps
	// are framed as open invitations, not hidden).
	import { resolveModelIdentity } from "$lib/identity";
	import { contributeOpen } from "$lib/stores/contribute";

	interface Props {
		onStartChatting: () => void;
		onSeeHowBuilt: () => void;
		onSkip: () => void;
		// Served model id — the "Apertus 70B" slot is DERIVED from it, never
		// hardcoded, so the copy can't claim a model that isn't running.
		modelId?: string;
		// "See the ecosystem" target. A plain <a> to the broader gap map (the
		// Explorer at the site root, OUTSIDE this chat's basePath), opened in a new
		// tab so the visitor isn't pulled out of onboarding.
		ecosystemUrl?: string;
	}

	let { onStartChatting, onSeeHowBuilt, onSkip, modelId, ecosystemUrl = "/app" }: Props = $props();

	let modelShort = $derived(resolveModelIdentity(modelId).short);
</script>

<div
	role="dialog"
	aria-modal="true"
	aria-label="Welcome to AI Potluck"
	class="pointer-events-auto absolute inset-0 z-20 flex flex-col overflow-y-auto bg-[color:var(--ap-paper)]/95 backdrop-blur-sm"
>
	<button
		type="button"
		aria-label="Skip the introduction"
		class="absolute top-1 right-1 z-10 inline-flex min-h-9 items-center p-2 font-mono text-[10px] tracking-[0.1em] text-[var(--ap-ink-3)] uppercase transition-colors hover:text-[var(--ap-ink)]"
		onclick={onSkip}
	>
		Skip →
	</button>

	<div class="mx-auto flex min-h-full max-w-prose flex-col justify-center gap-4 px-6 py-12">
		<div class="flex items-center gap-2">
			<span class="size-2 rounded-full" style="background:var(--ap-live);"></span>
			<span class="font-mono text-[10px] tracking-[0.12em] text-[var(--ap-ink-3)] uppercase">
				A Current AI · Alpha
			</span>
		</div>

		<h1 class="font-serif text-[28px] leading-tight text-[var(--ap-ink)] md:text-[34px]">
			A model for collective abundance.
		</h1>

		<p class="text-[14px] leading-relaxed text-[var(--ap-ink)]/85">
			AI Potluck is not a product. It is methodology for bringing together the best that exists in
			open-source AI, in service of the public interest.
		</p>

		<p class="text-[14px] leading-relaxed text-[var(--ap-ink)]/85">
			Our intelligence comes from {modelShort}, the open model from the Swiss National AI
			Initiative. This prototype is served via HuggingFace Inference and the Public AI Inference
			Utility; the production stack is being built on sovereign public compute at CSCS (Switzerland)
			and LUMI (Finland). ROOST covers safety while OpenMined helps ensure responsible use of data.
			The Mozilla Data Collective rounds out our stack with locally-sourced data sets.
		</p>

		<p class="text-[14px] leading-relaxed text-[var(--ap-ink)]/85">
			This website is a demonstration of what we can do together. But it's also a demonstration of
			all the gaps in open source, and where we need to focus if we're going to catch up with the
			big closed AI labs. Our little chatbot, like much of open source, is also a work-in-progress.
			That's okay. We think of every gap as an open invitation. Come join the Potluck.
		</p>

		<div class="mt-2 flex flex-wrap items-center gap-2.5">
			<button
				type="button"
				class="rounded-full bg-[var(--ap-ink)] px-4 py-2 font-mono text-[11px] tracking-[0.08em] text-[color:var(--ap-paper)] uppercase transition-opacity hover:opacity-85"
				onclick={onStartChatting}
			>
				Start chatting
			</button>
			<!-- "See the ecosystem" = the broader gap map (the Explorer at the site
			     root, OUTSIDE this chat's basePath). A plain <a> (not goto) so the
			     basePath isn't prepended, opened in a new tab so the visitor isn't
			     pulled out of onboarding — the chat stays put behind it. -->
			<a
				href={ecosystemUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="rounded-full border border-[var(--ap-rule)] px-4 py-2 font-mono text-[11px] tracking-[0.08em] text-[var(--ap-ink)] uppercase transition-colors hover:bg-[var(--ap-ink)]/5"
			>
				See the ecosystem
			</a>
			<button
				type="button"
				class="rounded-full border border-[var(--ap-rule)] px-4 py-2 font-mono text-[11px] tracking-[0.08em] text-[var(--ap-ink)] uppercase transition-colors hover:bg-[var(--ap-ink)]/5"
				onclick={onSeeHowBuilt}
			>
				See how it's built
			</button>
			<button
				type="button"
				class="rounded-full border border-[var(--ap-rule)] px-4 py-2 font-mono text-[11px] tracking-[0.08em] text-[var(--ap-ink)] uppercase transition-colors hover:bg-[var(--ap-ink)]/5"
				onclick={() => contributeOpen.set(true)}
			>
				How to contribute
			</button>
		</div>
	</div>
</div>
