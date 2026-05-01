import { parseProductMarkdown } from './parseProductMarkdown.js';

const rawModules = import.meta.glob('../../../products/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});

export const productSpecs = Object.entries(rawModules)
  .map(([path, raw]) => {
    const slug = path.split('/').pop().replace(/\.md$/i, '');
    return parseProductMarkdown(raw, slug);
  })
  .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
