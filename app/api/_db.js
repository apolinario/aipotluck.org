import { neon } from '@neondatabase/serverless';

let sqlClient;

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ''
  );
}

export function getSql() {
  if (sqlClient) return sqlClient;

  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL/POSTGRES_URL for Neon connection');
  }

  sqlClient = neon(connectionString);
  return sqlClient;
}

export async function ensureStackClaimsTable() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS stack_claims (
      cat_id TEXT PRIMARY KEY,
      claimed_by TEXT NOT NULL,
      claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS stack_contributors (
      id BIGSERIAL PRIMARY KEY,
      cat_id TEXT NOT NULL REFERENCES stack_claims(cat_id) ON DELETE CASCADE,
      contributor_name TEXT NOT NULL,
      contributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(cat_id, contributor_name)
    )
  `;
}
