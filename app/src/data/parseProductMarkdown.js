/**
 * Parse product spec markdown: first # heading = title, bullets = repo slugs.
 * Accepts `owner/name` or `repo:owner/name` (must exist on the ecosystem map dataset).
 */
export function parseProductMarkdown(content, slug) {
  const titleMatch = content.match(/^#\s+([^\n#]+)/m);
  const title = (titleMatch ? titleMatch[1] : slug).trim();
  const repoProductIds = [];

  for (const line of content.split(/\n/)) {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (!bullet) continue;
    let rest = bullet[1].trim().replace(/^`+|`+$/g, '');
    rest = rest.split('#')[0].trim().split(/\s+/)[0];
    if (!rest || !rest.includes('/')) continue;
    if (rest.startsWith('repo:')) {
      repoProductIds.push(rest);
    } else {
      repoProductIds.push(`repo:${rest}`);
    }
  }

  return { slug, title, repoProductIds };
}
