import { TYPE_LABEL_S } from '../../explorer/constants.js';
import { fmt, entityName, flag } from '../../explorer/helpers.js';

export function ProductRow({
  product: p,
  entityMap,
  catMap,
  reposAttrsByPid,
  modelsAttrsByPid,
  packagesAttrsByPid,
  showDesc,
  showTeam,
  showCategory,
  noEntity,
  noTypeBadge,
}) {
  const entity = entityMap[p.entity_id];
  const cat = showCategory ? catMap?.[p.category_id] : null;
  const typeLabel = TYPE_LABEL_S[p.product_type] || p.product_type || '';
  const r = reposAttrsByPid[p.product_id];
  const isClosed = !p.is_open;
  const slug = p.product_type === 'repo' ? (p.product_id || '').replace('repo:', '') : null;
  const artifactName = slug || p.display_name;
  const href = p.url || (slug ? `https://github.com/${slug}` : '');
  const desc = showDesc
    ? (r?.description || (p.product_type !== 'model' && p.product_type !== 'model_closed' ? p.description : '') || '')
    : '';

  const metrics = [];
  if (p.product_type === 'model' || p.product_type === 'model_closed') {
    const m = modelsAttrsByPid[p.product_id];
    if (m?.pipeline_tag) metrics.push(m.pipeline_tag.replace(/-/g, ' '));
    if (m?.model_family) metrics.push(m.model_family);
    if (m?.architecture) metrics.push(m.architecture);
    if (m?.downloads > 0) metrics.push(`${fmt(m.downloads)} dl`);
    if (m?.likes > 0) metrics.push(`♥ ${fmt(m.likes)}`);
    if (m?.library_name) metrics.push(m.library_name);
  } else if (p.product_type === 'package') {
    const pk = packagesAttrsByPid[p.product_id];
    if (pk?.package_source) metrics.push(pk.package_source);
    if (pk?.package_name) metrics.push(pk.package_name);
    if (r?.stars) metrics.push(`★ ${fmt(r.stars)}`);
  } else {
    if (r?.stars) metrics.push(`★ ${fmt(r.stars)}`);
    if (r?.commits_90d) metrics.push(`${fmt(r.commits_90d)} commits/90d`);
    if (r?.language) metrics.push(r.language);
    if (r?.license || p.license) metrics.push(r?.license || p.license);
  }

  const teamLine = (!noEntity && entity)
    ? `${entityName(entity)}${entity.country ? ' ' + flag(entity.country) : ''}`
    : '';

  const nameStyle = { fontFamily: "'DM Mono', monospace", fontSize: '12px' };

  if (noTypeBadge) {
    const subtitle = teamLine || (cat ? cat.display_name : '');
    return (
      <div className="proj">
        <div className="proj-row1">
          <div className="proj-left">
            {href ? (
              <a className="proj-name" href={href} target="_blank" rel="noopener"
                onClick={e => e.stopPropagation()} style={nameStyle}>
                {artifactName}
              </a>
            ) : (
              <span className="proj-name" style={nameStyle}>{artifactName}</span>
            )}
            {subtitle && <span className="proj-team">{subtitle}</span>}
          </div>
          {metrics.length > 0 && (
            <span className="proj-metrics">{metrics.slice(0, 2).join(' · ')}</span>
          )}
        </div>
        {desc && <div className="proj-desc">{desc.substring(0, 120)}</div>}
        {metrics.length > 2 && (
          <div className="proj-row2">{metrics.slice(2).join(' · ')}</div>
        )}
      </div>
    );
  }

  const catLine = cat ? cat.display_name : '';
  const row2parts = [
    showTeam && !noEntity ? teamLine : '',
    catLine,
  ].filter(Boolean);

  return (
    <div className="proj">
      <div className="proj-row1">
        <span className={`proj-badge${isClosed ? ' proj-badge-closed' : ''}`}>{typeLabel}</span>
        {href ? (
          <a className="proj-name" href={href} target="_blank" rel="noopener"
            onClick={e => e.stopPropagation()} style={nameStyle}>
            {artifactName}
          </a>
        ) : (
          <span className="proj-name" style={nameStyle}>{artifactName}</span>
        )}
        {metrics.length > 0 && (
          <span className="proj-metrics">{metrics.slice(0, 2).join(' · ')}</span>
        )}
      </div>
      {desc && <div className="proj-desc">{desc.substring(0, 120)}</div>}
      {metrics.length > 2 && (
        <div className="proj-row2">{metrics.slice(2).join(' · ')}</div>
      )}
      {row2parts.length > 0 && (
        <div className="proj-row2">{row2parts.join(' · ')}</div>
      )}
    </div>
  );
}
