export function buildSearchIndex(repos, packages, models) {
  const entries = [];
  const pkgByRepo = {};
  for (const p of packages) {
    if (!pkgByRepo[p.repo]) pkgByRepo[p.repo] = [];
    pkgByRepo[p.repo].push(p.package_name);
  }
  const modelByRepo = {};
  for (const m of models) {
    if (!modelByRepo[m.repo]) modelByRepo[m.repo] = [];
    modelByRepo[m.repo].push(m.model_id);
  }

  for (const repo of repos) {
    const parts = [
      repo.repo,
      repo.description || '',
      repo.category || '',
      repo.subcategory || '',
      repo.country || '',
      repo.language || '',
      repo.license || '',
      ...(pkgByRepo[repo.repo] || []),
      ...(modelByRepo[repo.repo] || []),
    ];
    entries.push({
      repo: repo.repo,
      text: parts.join(' ').toLowerCase(),
    });
  }
  return entries;
}

export function searchRepos(index, query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const terms = q.split(/\s+/);
  const matches = new Set();
  for (const entry of index) {
    if (terms.every((t) => entry.text.includes(t))) {
      matches.add(entry.repo);
    }
  }
  return matches;
}
