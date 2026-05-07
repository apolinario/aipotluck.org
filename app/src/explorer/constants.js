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

export const PRODUCT_GROUP_TYPES = {
  repos: new Set(['repo']),
  models: new Set(['model', 'model_closed']),
  packages: new Set(['package']),
  other: new Set(['chip', 'runtime', 'dataset', 'dataset_closed', 'eval_harness', 'standard', 'policy', 'service', 'tool', 'paper']),
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

export const GEO_PRESETS = [
  { key: 'all', label: 'All' },
  { key: 'us', label: '🇺🇸 US' },
  { key: 'cn', label: '🇨🇳 China' },
  { key: 'eu', label: '🇪🇺 EU' },
  { key: 'ex-us-cn', label: 'Excl. US+CN' },
  { key: 'other', label: 'Rest of world' },
];

export const SEARCH_PLACEHOLDERS = {
  stacks: 'Search categories…',
  products: 'Search products…',
  teams: 'Search teams…',
};

export const PRODUCT_GROUP_LABELS = {
  repos: 'Repos',
  models: 'Models',
  packages: 'Packages',
  other: 'Other',
};

export const PRODUCT_COLUMNS = {
  repos: [
    { key: 'entity', label: 'Maintained by', sortable: true, width: '14%' },
    { key: 'name', label: 'Repository', sortable: true, width: '24%' },
    { key: 'category', label: 'Category', sortable: false, width: '12%' },
    { key: 'stars', label: 'Stars', sortable: true, width: '8%', numeric: true },
    { key: 'star7d', label: '+7d', sortable: true, width: '7%', numeric: true },
    { key: 'commits90', label: 'Commits/90d', sortable: true, width: '9%', numeric: true },
    { key: 'language', label: 'Language', sortable: false, width: '9%' },
    { key: 'license', label: 'License', sortable: false, width: '9%' },
  ],
  models: [
    { key: 'entity', label: 'Maintained by', sortable: true, width: '14%' },
    { key: 'name', label: 'Model', sortable: true, width: '24%' },
    { key: 'category', label: 'Category', sortable: false, width: '12%' },
    { key: 'pipeline', label: 'Pipeline', sortable: false, width: '10%' },
    { key: 'downloads', label: 'Downloads', sortable: true, width: '8%', numeric: true },
    { key: 'likes', label: 'Likes', sortable: true, width: '7%', numeric: true },
    { key: 'library', label: 'Library', sortable: false, width: '9%' },
    { key: 'linked_repo', label: 'Repo', sortable: false, width: '8%' },
  ],
  packages: [
    { key: 'entity', label: 'Maintained by', sortable: true, width: '14%' },
    { key: 'name', label: 'Package', sortable: true, width: '24%' },
    { key: 'category', label: 'Category', sortable: false, width: '12%' },
    { key: 'source', label: 'Source', sortable: false, width: '10%' },
    { key: 'package_name', label: 'Package Name', sortable: true, width: '16%' },
    { key: 'linked_repo', label: 'Linked Repo', sortable: false, width: '16%' },
  ],
  other: [
    { key: 'entity', label: 'Maintained by', sortable: true, width: '14%' },
    { key: 'name', label: 'Name', sortable: true, width: '24%' },
    { key: 'category', label: 'Category', sortable: false, width: '12%' },
    { key: 'type', label: 'Type', sortable: false, width: '14%' },
    { key: 'open', label: 'Open?', sortable: false, width: '10%' },
  ],
};

export const PRODUCT_SORT_DEFAULTS = {
  repos: { col: 'stars', dir: 'desc' },
  models: { col: 'downloads', dir: 'desc' },
  packages: { col: 'name', dir: 'asc' },
  other: { col: 'name', dir: 'asc' },
};
