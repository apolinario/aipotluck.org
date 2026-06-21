<script lang="ts">
	// Minimal, on-theme assistant marker: a thin hollow ink RING. History: the original morphing
	// SVG blob (`#ball`) rendered at 14px + blur as a glossy dark sphere ("shiny black"); a flat
	// filled dot fixed the gloss but read too heavy ("hard black circle"). A 1.5px ring (transparent
	// fill, border in the theme ink via currentColor / classNames `text-[var(--ap-ink)]`) is light
	// and editorial. It gently pulses while a response streams; honors prefers-reduced-motion.
	let { animating = false, classNames = "" }: { animating?: boolean; classNames?: string } =
		$props();
</script>

<span
	class={`block border-[1.5px] border-current bg-transparent ${classNames}`}
	class:ap-thinking={animating}
	aria-hidden="true"
></span>

<style>
	/* A clear "breathing" pulse — scale + opacity, not opacity alone, so a 14px hollow ring
	   visibly reads as alive/thinking rather than static. transform-origin is center (block span). */
	.ap-thinking {
		animation: ap-thinking 1.25s ease-in-out infinite;
	}
	@keyframes ap-thinking {
		0%,
		100% {
			opacity: 0.35;
			transform: scale(0.7);
		}
		50% {
			opacity: 1;
			transform: scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ap-thinking {
			animation: none;
			opacity: 0.7;
		}
	}
</style>
