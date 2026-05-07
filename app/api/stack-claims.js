import { ensureStackClaimsTable, getSql } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await ensureStackClaimsTable();
    const sql = getSql();
    const rows = await sql`
      SELECT cat_id, claimed_by
      FROM stack_claims
    `;

    const claims = rows.reduce((acc, row) => {
      acc[row.cat_id] = row.claimed_by;
      return acc;
    }, {});

    return res.status(200).json({ ok: true, claims });
  } catch {
    return res.status(500).json({ error: 'Failed to load claims' });
  }
}
