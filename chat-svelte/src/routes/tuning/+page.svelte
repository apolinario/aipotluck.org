<!-- TEMP: pre-launch tuning panel. Remove routes/tuning/ before public launch. -->
<script lang="ts">
	import { enhance } from "$app/forms";
	import { base } from "$app/paths";
	import type { PageData, ActionData } from "./$types";

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let saving = $state(false);

	const cur = $derived(data.current);
	const def = $derived(data.defaults);
</script>

<svelte:head><title>Gap Chat · tuning</title></svelte:head>

<!-- h-dvh + overflow so the panel scrolls inside the chat shell's fixed-height layout -->
<div class="mx-auto h-dvh max-w-3xl space-y-6 overflow-y-auto bg-white p-6 text-sm text-black">
	<header class="space-y-1">
		<a href={base || "/"} class="text-xs text-gray-500 hover:underline">← Back to chat</a>
		<h1 class="text-xl font-semibold">Gap Chat — tuning</h1>
		<p class="text-gray-600">
			Edit the prompts and parameters live. Changes apply to new chats within ~20 seconds — no
			deploy. <strong>Leave a field blank to use the built-in default.</strong>
		</p>
		{#if cur.editedBy}
			<p class="text-xs text-gray-500">Last edited by {cur.editedBy} · {cur.editedAt}</p>
		{/if}
		{#if form?.saved}
			<p role="status" aria-live="polite" class="rounded bg-green-100 px-3 py-2 text-green-800">
				Saved.
			</p>
		{/if}
		{#if form?.error}
			<p role="alert" class="rounded bg-red-100 px-3 py-2 text-red-800">Error: {form.error}</p>
		{/if}
	</header>

	<form
		method="POST"
		action="?/save"
		class="space-y-6"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				await update({ reset: false });
				saving = false;
			};
		}}
	>
		<label class="block space-y-1">
			<span class="font-medium">System persona</span>
			<span class="block text-xs text-gray-500"
				>Use tokens <code>{"{model}"}</code> <code>{"{maker}"}</code> <code>{"{served}"}</code>
				<code>{"{training}"}</code> for the identity — they're auto-filled from the live served
				model, so the model name stays correct if we swap models. (Don't hardcode a model name.)</span
			>
			<textarea
				name="persona"
				aria-label="System persona prompt"
				rows="14"
				class="w-full rounded border p-2 font-mono text-xs"
				value={cur.persona ?? ""}
			></textarea>
			<details class="text-xs text-gray-500">
				<summary class="cursor-pointer">Show default</summary>
				<pre class="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-2">{def.persona}</pre>
			</details>
		</label>

		<label class="block space-y-1">
			<span class="font-medium">Search grounding prompt</span>
			<span class="block text-xs text-gray-500"
				>Tokens <code>{"{asOf}"}</code> and <code>{"{evidence}"}</code> are auto-filled with the
				retrieved sources.</span
			>
			<textarea
				name="grounding"
				aria-label="Search grounding prompt"
				rows="8"
				class="w-full rounded border p-2 font-mono text-xs"
				value={cur.grounding ?? ""}
			></textarea>
			<details class="text-xs text-gray-500">
				<summary class="cursor-pointer">Show default</summary>
				<pre class="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-2">{def.grounding}</pre>
			</details>
		</label>

		<fieldset class="space-y-2">
			<legend class="font-medium">Decoding (blank = default)</legend>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<label class="space-y-1"
					><span class="block text-xs">temperature ({def.decoding.temperature})</span>
					<input
						name="temperature"
						aria-label="temperature"
						type="number"
						step="0.05"
						min="0"
						max="2"
						class="w-full rounded border p-1"
						value={cur.decoding?.temperature ?? ""}
					/></label
				>
				<label class="space-y-1"
					><span class="block text-xs">frequency_penalty ({def.decoding.frequency_penalty})</span>
					<input
						name="frequency_penalty"
						aria-label="frequency_penalty"
						type="number"
						step="0.05"
						min="-2"
						max="2"
						class="w-full rounded border p-1"
						value={cur.decoding?.frequency_penalty ?? ""}
					/></label
				>
				<label class="space-y-1"
					><span class="block text-xs">presence_penalty ({def.decoding.presence_penalty})</span>
					<input
						name="presence_penalty"
						aria-label="presence_penalty"
						type="number"
						step="0.05"
						min="-2"
						max="2"
						class="w-full rounded border p-1"
						value={cur.decoding?.presence_penalty ?? ""}
					/></label
				>
				<label class="space-y-1"
					><span class="block text-xs">max_tokens ({def.decoding.max_tokens})</span>
					<input
						name="max_tokens"
						aria-label="max_tokens"
						type="number"
						step="1"
						min="1"
						max="4096"
						class="w-full rounded border p-1"
						value={cur.decoding?.max_tokens ?? ""}
					/></label
				>
			</div>
		</fieldset>

		<label class="block space-y-1">
			<span class="font-medium">Starter prompts</span>
			<span class="block text-xs text-gray-500">One per line; blank = the defaults below.</span>
			<textarea
				name="starters"
				aria-label="Starter prompts, one per line"
				rows="5"
				class="w-full rounded border p-2 text-xs"
				value={cur.starters?.join("\n") ?? ""}
			></textarea>
			<details class="text-xs text-gray-500">
				<summary class="cursor-pointer">Show default</summary>
				<pre class="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-2">{def.starters.join("\n")}</pre>
			</details>
		</label>

		<button
			type="submit"
			disabled={saving}
			class="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
		>
			{saving ? "Saving…" : "Save"}
		</button>
	</form>
</div>
