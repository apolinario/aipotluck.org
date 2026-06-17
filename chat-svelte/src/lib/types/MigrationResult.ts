import type { ObjectId } from "bson";

export interface MigrationResult {
	_id: ObjectId;
	name: string;
	status: "success" | "failure" | "ongoing";
}
