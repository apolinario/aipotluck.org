import { FLAGS, EU } from './constants.js';

export function flag(country) {
  return FLAGS[country] || '';
}

export function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'k';
  return String(n || 0);
}

export function fmtN(n) {
  return (n || 0).toLocaleString();
}

export function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function entityName(e) {
  if (!e) return '—';
  const d = e.display_name || '';
  if (d === e.entity_id || /^[a-z0-9_-]+$/.test(d))
    return d.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return d;
}

export function entityTypeSimple(e) {
  return e.type === 'individual' ? 'Individual' : 'Organization';
}

export function bucketFromVerdict(v) {
  if (v === 'competitive') return 'healthy';
  if (v === 'unique_to_oss') return 'unique';
  return 'gap';
}

export function verdictShort(v) {
  return ({
    competitive:   'Competitive',
    closed_leads:  'Closed Leads',
    unique_to_oss: 'OSS Leads',
    no_oss_exists: 'Closed Leads',
  })[v] || v || '—';
}

export function verdictLong(v) {
  return ({
    competitive:   'Competitive with closed',
    closed_leads:  'Closed leads',
    unique_to_oss: 'Unique to OSS',
    no_oss_exists: 'No OSS exists',
  })[v] || v || '—';
}

export function matchesPreset(country, preset) {
  if (!preset || preset === 'all') return true;
  if (preset === 'us') return country === 'USA';
  if (preset === 'cn') return country === 'China';
  if (preset === 'ex-us') return country !== 'USA';
  if (preset === 'ex-cn') return country !== 'China';
  if (preset === 'ex-us-cn') return country !== 'USA' && country !== 'China';
  if (preset === 'eu') return EU.has(country || '');
  if (preset === 'other') return !!country && !EU.has(country) && country !== 'USA' && country !== 'China';
  return true;
}

export function generateEntitySummary(entity, summary) {
  const name = entityName(entity);
  const typeLabel = (entityTypeSimple(entity) || 'entity').toLowerCase();
  const country = entity.country ? `based in ${entity.country}` : '';
  const openCount = summary?.openCount || 0;
  const closedCount = summary?.closedCount || 0;
  const layerCount = (summary?.layers || []).length;
  const parts = [];
  if (openCount > 0) parts.push(`${fmtN(openCount)} OSS`);
  if (closedCount > 0) parts.push(`${fmtN(closedCount)} closed`);
  const prodStr = parts.join(' and ') + (parts.length ? ' products' : 'no mapped products');
  return `${name} is ${/^[aeiou]/i.test(typeLabel) ? 'an' : 'a'} ${typeLabel}${country ? ' ' + country : ''}. They have ${prodStr}${layerCount > 0 ? ` across ${layerCount} layer${layerCount !== 1 ? 's' : ''}` : ''} of the AI stack.`;
}
