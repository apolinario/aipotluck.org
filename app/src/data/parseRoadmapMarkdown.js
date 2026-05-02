/**
 * Ordered roadmap: numbered steps with `slug`, optional @status, @owners, @label-color,
 * @ready_by: … (time window pill — e.g. Q1 26), @gap, annotations (`-` or blockquote `>`),
 * @note lines (rendered below the card).
 *
 * Legacy aliases still accepted: @label, @period, @highlight, ^
 */

const STATUS_RE = /@status\s*:\s*(gap|partial|active)/i;
const LABEL_RE = /@(?:owners|label)\s*:\s*([^@]+?)(?=\s+@|\s*$)/i;
const LABEL_COLOR_RE = /@label-color\s*:\s*(\S+)/i;
const PERIOD_RE = /@(?:ready_by|period)\s*:\s*([^@]+?)(?=\s+@|\s*$)/i;
const HIGHLIGHT_RE = /@(?:gap|highlight)\s*:\s*(\S+)/i;
const COMPARE_RE = /@compare\s*:\s*([^@]+?)(?=\s+@|\s*$)/i;

/** Accent for @period roadmap chips — signal red aligned with `--signal`/gap accents */
export const ROADMAP_PERIOD_PILL_COLOR = '#b03848';

const NAMED_HIGHLIGHTS = {
  yellow: '#f5e08a',
  amber: '#fcd34d',
  gold: '#fde047',
  lime: '#bef264',
  rose: '#fda4af',
  red: '#c94a5a',
};

/** Default roadmap label pill tint (readable on parchment; darker than prior yellow accents). */
export const DEFAULT_LABEL_COLOR = '#8a6914';

const NAMED_LABEL_COLORS = {
  amber: '#8a6914',
  gold: '#7a5f10',
  brown: '#5c4a29',
  teal: '#1f5f56',
  blue: '#2a4f7f',
  red: '#8f2f3a',
  green: '#2d6044',
  purple: '#4f3d6b',
};

export function resolveLabelColor(raw) {
  if (!raw) return null;
  const t = raw.trim();
  const key = t.toLowerCase();
  if (NAMED_LABEL_COLORS[key]) return NAMED_LABEL_COLORS[key];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) return t;
  return null;
}

export function resolveHighlight(raw) {
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (NAMED_HIGHLIGHTS[key]) return NAMED_HIGHLIGHTS[key];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw.trim())) return raw.trim();
  return key.startsWith('#') ? raw : null;
}

function stripStepMeta(body) {
  let b = body.trim();
  let status = 'partial';
  let labelFromMarkdown = '';
  let labelColorFromMarkdown = null;
  let periodFromMarkdown = '';
  let highlightColor = null;
  let compareFromMarkdown = '';

  for (let iter = 0; iter < 20; iter++) {
    let hit = false;
    const sr = b.match(STATUS_RE);
    if (sr) {
      status = sr[1].toLowerCase();
      b = b.replace(sr[0], '').trim();
      hit = true;
      continue;
    }
    const lr = b.match(LABEL_RE);
    if (lr) {
      labelFromMarkdown = lr[1].trim();
      b = b.replace(lr[0], '').trim();
      hit = true;
      continue;
    }
    const lcr = b.match(LABEL_COLOR_RE);
    if (lcr) {
      labelColorFromMarkdown = resolveLabelColor(lcr[1]) || labelColorFromMarkdown;
      b = b.replace(lcr[0], '').trim();
      hit = true;
      continue;
    }
    const pr = b.match(PERIOD_RE);
    if (pr) {
      periodFromMarkdown = pr[1].trim();
      b = b.replace(pr[0], '').trim();
      hit = true;
      continue;
    }
    const hr = b.match(HIGHLIGHT_RE);
    if (hr) {
      highlightColor = resolveHighlight(hr[1]);
      b = b.replace(hr[0], '').trim();
      hit = true;
      continue;
    }
    const cr = b.match(COMPARE_RE);
    if (cr) {
      compareFromMarkdown = cr[1].trim();
      b = b.replace(cr[0], '').trim();
      hit = true;
      continue;
    }
    if (!hit) break;
  }

  return {
    body: b.trim(),
    status,
    labelFromMarkdown,
    labelColorFromMarkdown,
    periodFromMarkdown,
    highlightColor,
    compareFromMarkdown,
  };
}

export function parseRoadmapMarkdown(content) {
  const lines = content.split(/\r?\n/);
  let i = 0;
  let title = 'Roadmap';
  const introParagraphs = [];

  if (lines[0]?.match(/^#\s+/)) {
    title = lines[0].replace(/^#\s+/, '').trim();
    i = 1;
  }

  while (i < lines.length && !/^\s*\d+\.\s+/.test(lines[i])) {
    const t = lines[i].trim();
    if (t) introParagraphs.push(t);
    i += 1;
  }

  const intro = introParagraphs.join('\n\n').trim();

  const steps = [];
  let cur = null;

  const flushCur = () => {
    if (cur) steps.push(cur);
    cur = null;
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    const num = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (num) {
      flushCur();
      const meta = stripStepMeta(num[2]);
      let body = meta.body;

      let slug = '';
      let subtitle = '';

      const backtick = body.match(/^`([\w.-]+)`\s*(.*)$/);
      if (backtick) {
        slug = backtick[1];
        subtitle = backtick[2].trim();
      } else {
        const loose = body.match(/^([\w.-]+)\s+(.*)$/);
        if (loose?.[2]) {
          slug = loose[1];
          subtitle = loose[2].trim();
        } else {
          slug = body.match(/^([\w.-]+)$/)?.[1] || body;
          subtitle = '';
        }
      }

      cur = {
        order: num[1],
        slug,
        subtitle,
        status: meta.status,
        labelFromMarkdown: meta.labelFromMarkdown || null,
        labelColorFromMarkdown: meta.labelColorFromMarkdown,
        periodFromMarkdown: meta.periodFromMarkdown || null,
        highlightColor: meta.highlightColor,
        compareFromMarkdown: meta.compareFromMarkdown || null,
        annotations: [],
        sidenotes: [],
      };
      continue;
    }

    if (!cur) continue;

    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('@note') || trimmed.startsWith('^')) {
      const text = trimmed.startsWith('@note')
        ? trimmed.slice(5).trimStart()
        : trimmed.slice(1).trim();
      cur.sidenotes.push(text);
      continue;
    }

    if (trimmed.startsWith('>')) {
      cur.annotations.push(trimmed.slice(1).trim());
      continue;
    }

    if (trimmed.startsWith('-')) {
      cur.annotations.push(trimmed.slice(1).trim());
      continue;
    }

    cur.subtitle = `${cur.subtitle} ${trimmed}`.trim();
  }
  flushCur();

  return { title, intro, steps };
}
