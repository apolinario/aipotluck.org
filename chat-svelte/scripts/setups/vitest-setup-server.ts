import { vi } from "vitest";
import dotenv from "dotenv";
import { resolve } from "path";
import fs from "fs";

// Load the .env file
const envPath = resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

// Read the .env file content
const envContent = fs.readFileSync(envPath, "utf-8");

// Parse the .env content
const envVars = dotenv.parse(envContent);

// Separate public and private variables
const publicEnv = {};
const privateEnv = {};

for (const [key, value] of Object.entries(envVars)) {
	if (key.startsWith("PUBLIC_")) {
		publicEnv[key] = value;
	} else {
		privateEnv[key] = value;
	}
}

vi.mock("$env/dynamic/public", () => ({
	env: publicEnv,
}));

// Persistence migrated from MongoDB to Postgres (doc-store adapter); the old
// in-memory Mongo bootstrap is gone. Server tests run against the parsed env.
vi.mock("$env/dynamic/private", () => ({
	env: privateEnv,
}));
