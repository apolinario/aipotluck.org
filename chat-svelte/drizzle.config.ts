import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/lib/server/db/schema.ts",
	out: "./drizzle",
	dbCredentials: {
		// Migrations want a DIRECT (non-pooled) connection for DDL; on Vercel the Neon
		// integration provides POSTGRES_URL_NON_POOLING. Fall back through it, then the
		// pooled URL, so `db:migrate` runs in the Vercel build without a copied secret.
		url:
			process.env.DATABASE_URL ??
			process.env.POSTGRES_URL_NON_POOLING ??
			process.env.POSTGRES_URL ??
			"",
	},
	strict: true,
});
