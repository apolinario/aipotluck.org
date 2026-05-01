/** Map layout helpers: Stack (layer × category quality) vs Galaxy (spiral hubs). */

function clampPct(v, lo = 11, hi = 89) {
  return Math.min(hi, Math.max(lo, v));
}

/** Original dataset positions: hub % + ring offset. */
export function galaxyRepoPosition(cluster, repo) {
  return { x: cluster.lx + repo.dx, y: cluster.ly + repo.dy };
}

/** Centroid under galaxy coords (fallback hub if no repos). */
export function galaxyClusterCentroid(cluster) {
  const n = cluster.repos?.length ?? 0;
  if (!n) return { cx: cluster.lx, cy: cluster.ly };
  let sx = 0;
  let sy = 0;
  for (const r of cluster.repos) {
    const p = galaxyRepoPosition(cluster, r);
    sx += p.x;
    sy += p.y;
  }
  return { cx: sx / n, cy: sy / n };
}

/**
 * Stack layout: Y = explorer layer order (foundation low), X = normalized category criteria_avg (quality).
 * Repo jitter within category cell; star-driven scale for marker size multiplier.
 */
export function buildStackLayout(ecoClusters) {
  const crit = ecoClusters.map((c) => Number(c.criteriaAvg ?? c.gapScore ?? 3));
  const minC = Math.min(...crit);
  const maxC = Math.max(...crit);
  const denom = Math.max(maxC - minC, 0.001);

  const layerOrders = [...new Set(ecoClusters.map((c) => c.layerSortOrder ?? 0))].sort(
    (a, b) => a - b,
  );
  const nLayers = layerOrders.length || 1;
  const layerY = {};
  layerOrders.forEach((ord, idx) => {
    const t = nLayers <= 1 ? 0.5 : idx / (nLayers - 1);
    layerY[ord] = 80 - t * 58;
  });

  const globalMaxStars = Math.max(
    1,
    ...ecoClusters.flatMap((c) => c.repos.map((r) => r.stars || 0)),
  );
  const logGlobal = Math.log1p(globalMaxStars);

  return ecoClusters.map((cluster) => {
    const cval = Number(cluster.criteriaAvg ?? cluster.gapScore ?? 3);
    const nx = (cval - minC) / denom;
    const xHub = 16 + nx * 68;
    const lo = cluster.layerSortOrder ?? 999;
    const yHub = layerY[lo] ?? 48;
    const n = cluster.repos.length;
    const catHash = [...cluster.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

    let sx = 0;
    let sy = 0;
    const reposLayout = cluster.repos.map((repo, ri) => {
      const jx = (ri - (n - 1) / 2) * 0.72;
      const jy = ((ri % 3) - 1) * 0.9;
      const wobble = Math.sin((ri + catHash % 97) * 1.73) * 0.42;
      const x = clampPct(xHub + jx + wobble);
      const y = clampPct(yHub + jy, 14, 86);
      sx += x;
      sy += y;
      const starMulRaw =
        0.38 +
        (Math.log1p(repo.stars || 0) / logGlobal) * 0.92;
      const starMul = Math.min(1.35, Math.max(0.28, starMulRaw));
      return { repo, x, y, starMul };
    });

    const cx = n ? sx / n : xHub;
    const cy = n ? sy / n : yHub;
    return {
      cluster,
      reposLayout,
      centroid: { cx: clampPct(cx), cy: clampPct(cy) },
    };
  });
}
