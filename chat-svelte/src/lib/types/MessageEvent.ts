import type { Session } from "./Session";
import type { Timestamps } from "./Timestamps";
import type { User } from "./User";

export interface MessageEvent extends Pick<Timestamps, "createdAt"> {
	userId: User["_id"] | Session["sessionId"];
	// Keyed HMAC of the client IP (domain "rate-limit"), never the raw IP — see db/ipHash.ts.
	ipHash?: string;
	expiresAt: Date;
	// "globalDaily" = a row in the service-wide 24h request-cap window (see conversation/[id]/+server).
	type: "message" | "export" | "globalDaily";
}
