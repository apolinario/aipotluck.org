<script lang="ts">
	import { page } from "$app/state";
	import { base } from "$app/paths";
	import { SHARE_TITLE, SHARE_TEXT, SHARE_REF } from "$lib/constants/share";
	import { confirm as hapticConfirm } from "$lib/utils/haptics";
	import LucideShare from "~icons/lucide/share";

	// 2026 share UX: prefer the native Web Share API — on the phones the conference audience is
	// on, navigator.share() opens the OS share sheet (the best possible UX, and the only way to
	// reach native apps). Fall back to copying the link with an inline "Link copied" confirm
	// (mirrors CopyToClipBoardBtn) where the API is absent (most desktop browsers).
	//
	// We share the SITE with a non-personal ?ref=share tag — the goal is spreading the
	// initiative, not a private conversation, and the tag carries nothing user-identifying.
	interface Props {
		class?: string;
	}
	let { class: className = "" }: Props = $props();

	let copied = $state(false);
	let timeout: ReturnType<typeof setTimeout>;

	const shareUrl = $derived(`${page.url.origin}${base}/?ref=${SHARE_REF}`);

	async function copyLink(url: string) {
		if (window.isSecureContext && navigator.clipboard) {
			await navigator.clipboard.writeText(url);
			return;
		}
		// Insecure-context fallback (older browsers / non-HTTPS).
		const ta = document.createElement("textarea");
		ta.value = url;
		document.body.appendChild(ta);
		ta.select();
		document.execCommand("copy");
		document.body.removeChild(ta);
	}

	async function share() {
		const url = shareUrl;
		if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
			try {
				await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
				hapticConfirm();
				return;
			} catch (e) {
				// User dismissed the sheet — not an error, just stop (don't then copy).
				if (e instanceof DOMException && e.name === "AbortError") return;
				// Anything else: fall through to the copy path.
			}
		}
		try {
			await copyLink(url);
			hapticConfirm();
			copied = true;
			clearTimeout(timeout);
			timeout = setTimeout(() => (copied = false), 1600);
		} catch (e) {
			console.error("share/copy failed", e);
		}
	}
</script>

<button
	type="button"
	class="inline-flex cursor-pointer items-center gap-1 underline-offset-2 hover:text-[var(--ap-ink)] hover:underline {className}"
	title="Share AI Potluck — opens your device's share sheet, or copies the link"
	onclick={share}
>
	<LucideShare class="size-[10px]" />
	<span>{copied ? "Link copied" : "Share"}</span>
</button>
