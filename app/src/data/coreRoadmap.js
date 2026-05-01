import { parseRoadmapMarkdown } from './parseRoadmapMarkdown.js';

const rawGlob = import.meta.glob('../../../roadmap/core_roadmap.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const rawPaths = Object.keys(rawGlob);
const raw =
  rawPaths.length > 0 ? rawGlob[rawPaths[0]] : '';

export const coreRoadmap = raw ? parseRoadmapMarkdown(raw) : { title: 'Roadmap', intro: '', steps: [] };

/** Dot jitter per row — keeps visual parity with legacy timeline rhythm */
export const ROADMAP_DOT_OFFSETS = [-18, 14, -7, 21, -13, 9];
