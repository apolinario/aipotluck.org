import { ensureStackClaimsTable, getSql } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { catId, name, inviteCode } = req.body || {};
  const normalizedCatId = String(catId || '').trim();
  const normalizedName = String(name || '').trim();
  const normalizedCode = String(inviteCode || '').trim();
  const adminSecret = String(process.env.ADMIN_SECRET || '').trim();

  if (!normalizedCatId || !normalizedName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!adminSecret) {
    return res.status(500).json({ error: 'ADMIN_SECRET is not configured' });
  }

  if (normalizedCode !== adminSecret) {
    return res.status(401).json({ error: 'Invalid invite code' });
  }

  try {
    await ensureStackClaimsTable();
    const sql = getSql();
    await sql`
      INSERT INTO stack_claims (cat_id, claimed_by)
      VALUES (${normalizedCatId}, ${normalizedName})
      ON CONFLICT (cat_id)
      DO UPDATE SET claimed_by = EXCLUDED.claimed_by, claimed_at = NOW()
    `;

    return res.status(200).json({
      ok: true,
      claim: { catId: normalizedCatId, claimedBy: normalizedName },
    });
  } catch {
    return res.status(500).json({ error: 'Failed to persist claim' });
  }
}
