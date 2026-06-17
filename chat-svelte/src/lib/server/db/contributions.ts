/**
 * Contribution write point — the single place "Get involved" submissions are persisted,
 * mirroring the Vercel app's `saveContribution` (chat/lib/db/queries.ts). The public welcome
 * overlay's ContributeDialog posts here via /api/contribute.
 *
 * Adds a DB-backed per-IP daily cap primitive (countContributionsByIpSince) because chat-svelte
 * has no Redis — the Vercel app caps per IP via Redis (lib/ratelimit.ts checkContributionRateLimit).
 */
import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "./client";
import { newId } from "./ids";
import { contributions, type ContributionRow } from "./schema";

export interface SaveContributionInput {
	kind: "subscribe" | "contribute";
	email: string;
	name?: string | null;
	organization?: string | null;
	contributionType?: "compute" | "data" | "code" | "funding" | "other" | null;
	detail?: string | null;
	userId?: string | null;
	ip?: string | null;
}

export async function saveContribution(input: SaveContributionInput): Promise<ContributionRow> {
	const db = getDb();
	const [row] = await db
		.insert(contributions)
		.values({
			id: newId(),
			kind: input.kind,
			email: input.email,
			name: input.name ?? null,
			organization: input.organization ?? null,
			contributionType: input.contributionType ?? null,
			detail: input.detail ?? null,
			userId: input.userId ?? null,
			ip: input.ip ?? null,
		})
		.returning();
	return row;
}

/**
 * DB-backed per-IP daily cap primitive (mirrors the messageEvents countDocuments pattern).
 * Returns how many contributions the given IP has submitted since `since`.
 */
export async function countContributionsByIpSince(ip: string, since: Date): Promise<number> {
	const db = getDb();
	const [row] = await db
		.select({ value: count() })
		.from(contributions)
		.where(and(eq(contributions.ip, ip), gte(contributions.createdAt, since)));
	return row?.value ?? 0;
}
