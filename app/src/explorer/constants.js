export const FLAGS = {
  USA: '🇺🇸', China: '🇨🇳', UK: '🇬🇧', Germany: '🇩🇪', Canada: '🇨🇦', France: '🇫🇷',
  Japan: '🇯🇵', 'South Korea': '🇰🇷', India: '🇮🇳', Singapore: '🇸🇬', Switzerland: '🇨🇭',
  Netherlands: '🇳🇱', Australia: '🇦🇺', Italy: '🇮🇹', Spain: '🇪🇸', Israel: '🇮🇱',
  Austria: '🇦🇹', Poland: '🇵🇱', Russia: '🇷🇺', Taiwan: '🇹🇼', Sweden: '🇸🇪',
  Brazil: '🇧🇷', Finland: '🇫🇮', Vietnam: '🇻🇳', Norway: '🇳🇴', Ireland: '🇮🇪',
  Denmark: '🇩🇰', Belgium: '🇧🇪', Portugal: '🇵🇹', Greece: '🇬🇷', Czechia: '🇨🇿',
  Estonia: '🇪🇪', Mexico: '🇲🇽', Turkey: '🇹🇷', Ukraine: '🇺🇦', 'Hong Kong': '🇭🇰',
  'New Zealand': '🇳🇿', Hungary: '🇭🇺', Romania: '🇷🇴', Indonesia: '🇮🇩', Thailand: '🇹🇭',
  Argentina: '🇦🇷', 'Czech Republic': '🇨🇿', Iran: '🇮🇷',
};

export const LAYER_COLORS = {
  infrastructure: 'oklch(46% 0.14 252)',
  model_code:     'oklch(40% 0.12 162)',
  model_datasets: 'oklch(52% 0.14 62)',
  model_weights:  'oklch(46% 0.16 22)',
  product_ux:     'oklch(42% 0.12 300)',
  documentation:  'oklch(44% 0.09 200)',
  licensing:      'oklch(46% 0.10 82)',
  safeguards:     'oklch(44% 0.12 190)',
};

export const TYPE_LABELS = {
  repo: 'Repos', model: 'Models', package: 'Packages', model_closed: 'Closed Models',
  chip: 'Chips', runtime: 'Runtimes', dataset_closed: 'Closed Datasets',
  eval_harness: 'Evals', standard: 'Standards', policy: 'Policies',
  service: 'Services', tool: 'Tools', dataset: 'Datasets', paper: 'Papers',
};

export const TYPE_LABEL_S = {
  repo: 'Repo', model: 'Model', package: 'Package', model_closed: 'Closed Model',
  chip: 'Chip', runtime: 'Runtime', dataset_closed: 'Closed Dataset',
  eval_harness: 'Eval', standard: 'Standard', policy: 'Policy',
  service: 'Service', tool: 'Tool', dataset: 'Dataset', paper: 'Paper',
};

export const ENTITY_TYPE_LABELS = {
  company: 'Company', org: 'Open Source Org', individual: 'Individual',
  academic_lab: 'Academic Lab', standards_body: 'Standards Body',
};

export const TYPE_ORDER = [
  'repo', 'model', 'package', 'dataset', 'eval_harness', 'tool',
  'runtime', 'paper', 'standard', 'policy', 'model_closed',
  'dataset_closed', 'service', 'chip',
];

export const OPEN_TYPES = new Set([
  'repo', 'model', 'package', 'dataset', 'eval_harness',
  'tool', 'paper', 'runtime', 'standard',
]);

export const MATURITY_LABELS = {
  breadth: 'Breadth of coverage',
  production_readiness: 'Production readiness',
  ease_of_adoption: 'Ease of adoption',
  documentation: 'Documentation quality',
  community_activity: 'Community activity',
  performance_vs_closed: 'Performance vs. closed source',
  enterprise_readiness: 'Enterprise readiness',
  interoperability: 'Interoperability',
  sustainability: 'Project sustainability',
  standardization: 'Standardization',
};

export const EU = new Set([
  'Germany', 'France', 'Netherlands', 'Italy', 'Spain', 'Sweden', 'Finland',
  'Austria', 'Poland', 'Belgium', 'Ireland', 'Denmark', 'Czechia', 'Czech Republic',
  'Portugal', 'Greece', 'Romania', 'Hungary', 'Bulgaria', 'Slovakia', 'Slovenia',
  'Croatia', 'Estonia', 'Latvia', 'Lithuania', 'Luxembourg', 'Cyprus', 'Malta',
]);

export const VERDICT_CLASS = {
  competitive:   'healthy',
  unique_to_oss: 'unique',
  closed_leads:  'medium',
  no_oss_exists: 'gap',
};

export const SORT_LABELS = {
  stars: 'stars',
  star7d: '+stars / 7d',
  commits90: 'commits / 90d',
  name: 'name',
  entity: 'team',
};

export const SEARCH_PLACEHOLDERS = {
  stacks: 'Search categories…',
  repos: 'Search repos…',
  teams: 'Search teams…',
};
