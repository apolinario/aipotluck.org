<script lang="ts">
	// Tiny inline activity sparkline (real star history from the OSO catalog).
	// Ported from the Next chat/ app (components/stack/sparkline.tsx).
	interface Props {
		values: number[];
		width?: number;
		height?: number;
	}
	let { values, width = 96, height = 20 }: Props = $props();

	const points = $derived.by(() => {
		if (!values || values.length < 2) return null;
		const max = Math.max(...values, 1);
		const min = Math.min(...values, 0);
		const span = max - min || 1;
		const step = width / (values.length - 1);
		return values
			.map((v, i) => {
				const x = i * step;
				const y = height - ((v - min) / span) * (height - 2) - 1;
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(" ");
	});
</script>

{#if points}
	<svg
		aria-hidden="true"
		class="overflow-visible"
		{height}
		viewBox="0 0 {width} {height}"
		{width}
	>
		<polyline
			fill="none"
			points={points}
			stroke="var(--ap-live)"
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="1.5"
		/>
	</svg>
{/if}
