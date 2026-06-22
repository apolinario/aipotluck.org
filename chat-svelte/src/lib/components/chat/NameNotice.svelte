<script lang="ts">
	// Honest correction shown when the post-generation guard ($lib/server/nameGuard) caught the model
	// adopting a personal name for itself this turn. Prompt rules don't reliably stop the slip, so the
	// constraint is enforced at runtime: the answer stays as-is, but this chip states plainly that the
	// system has no name — and the server strips the name from later context so it can't compound.
	interface Props {
		/** the adopted nickname, when known (kept for the tooltip; the visible copy stays generic) */
		name?: string;
	}
	let { name }: Props = $props();
</script>

<div
	class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10.5px] text-[var(--ap-ink-3)]"
	title={name
		? `The model accepted the name "${name}" above. It has no personal name — it's a machine, not a person.`
		: "The model has no personal name — it's a machine, not a person."}
>
	<span class="size-[6px] shrink-0 rounded-full" style="background: var(--ap-gap)"></span>
	<span>This system has no personal name — it's a machine, not a person.</span>
</div>
