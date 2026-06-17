/**
 * Report write point — the single place reports are persisted, mirroring the Vercel app's
 * `saveReport` (chat/lib/db/queries.ts). A ROOST trust-and-safety triage consumer attaches by READING
 * the `reports` table; nothing upstream of the table needs to change. See MIGRATION-NOTES
 * "ROOST / safety-seam parity".
 */
import { getDb } from "./client";
import { newId } from "./ids";
import { reports, type ReportRow } from "./schema";

export interface SaveReportInput {
	conversationId: string;
	messageId?: string;
	userId?: string;
	sessionId?: string;
	reason: "harmful" | "inaccurate" | "privacy" | "other";
	detail?: string;
}

export async function saveReport(input: SaveReportInput): Promise<ReportRow> {
	const db = getDb();
	const [row] = await db
		.insert(reports)
		.values({
			id: newId(),
			conversationId: input.conversationId,
			messageId: input.messageId,
			userId: input.userId,
			sessionId: input.sessionId,
			reason: input.reason,
			detail: input.detail,
		})
		.returning();
	return row;
}
