/**
 * Ecosystem map: clusters and repo dots are positioned with lx, ly (hub %)
 * and small dx, dy offsets so everything sits in the middle of the viewport.
 */
export const ecoClusters = [
  {
    id: 'benchmarks',
    color: '#9DCFCA',
    label: 'An open source safety benchmark',
    lx: 46,
    ly: 36,
    repos: [
      { name: 'HELM', dx: -2.2, dy: -1.4 },
      { name: 'BIG-bench', dx: 1.8, dy: -0.8 },
      { name: 'Eval Harness', dx: -2.8, dy: 1.2 },
      { name: 'MMLU', dx: 2.4, dy: 0.6 },
      { name: 'OpenLLM', dx: 0.4, dy: 2.1 },
      { name: 'MT-Bench', dx: -0.6, dy: -2.2 },
    ],
  },
  {
    id: 'models',
    color: '#E8796A',
    label: 'A truly open weights frontier model',
    lx: 54,
    ly: 36,
    repos: [
      { name: 'Llama 3', dx: -1.6, dy: -1.2 },
      { name: 'Mistral 7B', dx: 1.4, dy: -1.8 },
      { name: 'Falcon 180B', dx: -2.4, dy: 0.9 },
      { name: 'Qwen 2', dx: 2.2, dy: -0.2 },
      { name: 'Phi-3', dx: 2.6, dy: -1.6 },
      { name: 'Gemma 2', dx: 0.2, dy: 1.9 },
      { name: 'OLMo', dx: -1.8, dy: 1.4 },
    ],
  },
  {
    id: 'data',
    color: '#3DAAB8',
    label: 'Public domain training data at scale',
    lx: 47,
    ly: 42,
    repos: [
      { name: 'Common Crawl', dx: -2.6, dy: -0.9 },
      { name: 'The Pile', dx: 1.6, dy: -1.4 },
      { name: 'Dolma', dx: -2.2, dy: 1.5 },
      { name: 'FineWeb', dx: 2.4, dy: -0.4 },
      { name: 'RedPajama', dx: 2.0, dy: 1.2 },
      { name: 'ROOTS', dx: -0.4, dy: 2.0 },
    ],
  },
  {
    id: 'inference',
    color: '#5B9E8A',
    label: 'Open source inference infrastructure',
    lx: 53,
    ly: 42,
    repos: [
      { name: 'vLLM', dx: -2.3, dy: -0.8 },
      { name: 'Ollama', dx: 0.8, dy: -1.6 },
      { name: 'llama.cpp', dx: -2.8, dy: 1.0 },
      { name: 'TGI', dx: 2.2, dy: -0.2 },
      { name: 'ExLlamaV2', dx: 2.6, dy: -1.2 },
    ],
  },
  {
    id: 'governance',
    color: '#D4A255',
    label: 'An open AI governance toolkit',
    lx: 46,
    ly: 48,
    repos: [
      { name: 'Model Cards', dx: -1.9, dy: -1.1 },
      { name: 'AI Incident DB', dx: 1.8, dy: -0.9 },
      { name: 'DataSheets', dx: -2.4, dy: 0.9 },
      { name: 'RAIL Licenses', dx: 2.2, dy: 0.8 },
    ],
  },
  {
    id: 'compute',
    color: '#7AB8A4',
    label: 'Open access compute for researchers',
    lx: 54,
    ly: 48,
    repos: [
      { name: 'SkyPilot', dx: -2.5, dy: -0.9 },
      { name: 'Ray', dx: 0.6, dy: -1.4 },
      { name: 'Petals', dx: -2.2, dy: 1.3 },
      { name: 'Together AI', dx: 2.3, dy: -0.2 },
      { name: 'Modal', dx: 2.6, dy: -1.2 },
    ],
  },
];

export function repoPosition(cluster, repo) {
  return { x: cluster.lx + repo.dx, y: cluster.ly + repo.dy };
}

export function clusterCentroid(cluster) {
  return {
    cx: cluster.lx + cluster.repos.reduce((s, r) => s + r.dx, 0) / cluster.repos.length,
    cy: cluster.ly + cluster.repos.reduce((s, r) => s + r.dy, 0) / cluster.repos.length,
  };
}
