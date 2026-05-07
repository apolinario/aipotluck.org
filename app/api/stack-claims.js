import { ensureStackClaimsTable, getSql } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await ensureStackClaimsTable();
    const sql = getSql();
    const claimRows = await sql`
      SELECT cat_id, claimed_by
      FROM stack_claims
    `;
    const contributorRows = await sql`
      SELECT cat_id, contributor_name
      FROM stack_contributors
      ORDER BY contributed_at ASC
    `;

    const claims = claimRows.reduce((acc, row) => {
      acc[row.cat_id] = { claimedBy: row.claimed_by, contributors: [] };
      return acc;
    }, {});
    for (const row of contributorRows) {
      if (!claims[row.cat_id]) continue;
      claims[row.cat_id].contributors.push(row.contributor_name);
    }

    return res.status(200).json({ ok: true, claims });
  } catch {
    return res.status(500).json({ error: 'Failed to load claims' });
  }
}
