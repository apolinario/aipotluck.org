<script lang="ts">
	// Flat, on-theme assistant marker. The previous version was a morphing SVG blob (`#ball`) that,
	// at 14px with a gaussian blur, rendered as a GLOSSY dark sphere with a specular highlight —
	// read as "shiny black/white" and clashed with the flat warm-paper editorial theme. Recoloring
	// the fill / removing the white disc didn't help because the gloss came from the blur+shape.
	// This is a flat filled dot in the theme ink (currentColor, set via classNames
	// `text-[var(--ap-ink)]`) — matching the map's flat status dots — that gently pulses while a
	// response streams. No blur, gloss, white, morph, or shadow.
	let {
		animating = false,
		classNames = "",
	}: { animating?: boolean; classNames?: string } = $props();
</script>

<span class={`block bg-current ${classNames}`} class:ap-thinking={animating} aria-hidden="true"
></span>

<style>
	.ap-thinking {
		animation: ap-thinking 1.4s ease-in-out infinite;
	}
	@keyframes ap-thinking {
		0%,
		100% {
			opacity: 0.4;
		}
		50% {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ap-thinking {
			animation: none;
			opacity: 0.7;
		}
	}
</style>
