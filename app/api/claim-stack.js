import { ensureStackClaimsTable, getSql } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { catId, name, inviteCode, action } = req.body || {};
  const normalizedCatId = String(catId || '').trim();
  const normalizedName = String(name || '').trim();
  const normalizedCode = String(inviteCode || '').trim();
  const adminSecret = String(process.env.ADMIN_SECRET || '').trim();

  if (!normalizedCatId || !normalizedName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const mode = action === 'contribute' ? 'contribute' : 'claim';

  if (!adminSecret) {
    return res.status(500).json({ error: 'ADMIN_SECRET is not configured' });
  }

  if (normalizedCode !== adminSecret) {
    return res.status(401).json({ error: 'Invalid invite code' });
  }

  try {
    await ensureStackClaimsTable();
    const sql = getSql();
    if (mode === 'claim') {
      await sql`
        INSERT INTO stack_claims (cat_id, claimed_by)
        VALUES (${normalizedCatId}, ${normalizedName})
        ON CONFLICT (cat_id)
        DO UPDATE SET claimed_by = EXCLUDED.claimed_by, claimed_at = NOW()
      `;
    } else {
      const existing = await sql`
        SELECT claimed_by
        FROM stack_claims
        WHERE cat_id = ${normalizedCatId}
      `;
      if (existing.length === 0) {
        return res.status(400).json({ error: 'This stack must be claimed first' });
      }
      if (existing[0].claimed_by === normalizedName) {
        return res.status(400).json({ error: 'Claimant is already assigned' });
      }
      await sql`
        INSERT INTO stack_contributors (cat_id, contributor_name)
        VALUES (${normalizedCatId}, ${normalizedName})
        ON CONFLICT (cat_id, contributor_name) DO NOTHING
      `;
    }

    const claimRows = await sql`
      SELECT claimed_by
      FROM stack_claims
      WHERE cat_id = ${normalizedCatId}
      LIMIT 1
    `;
    const contributorsRows = await sql`
      SELECT contributor_name
      FROM stack_contributors
      WHERE cat_id = ${normalizedCatId}
      ORDER BY contributed_at ASC
    `;

    return res.status(200).json({
      ok: true,
      claim: {
        catId: normalizedCatId,
        claimedBy: claimRows[0]?.claimed_by || normalizedName,
        contributors: contributorsRows.map((row) => row.contributor_name),
      },
    });
  } catch {
    return res.status(500).json({ error: 'Failed to persist claim' });
  }
}
