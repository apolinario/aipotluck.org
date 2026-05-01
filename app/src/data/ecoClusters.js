/**
 * Ecosystem map: clusters from generated explorer data (top repos per stack category).
 * @see scripts/generate_ecosystem_map_data.py — regenerate ecosystemTopReposByCategory.json
 */
import ecosystemTopReposByCategory from './ecosystemTopReposByCategory.json';

export const ecoClusters = ecosystemTopReposByCategory.clusters;

export { galaxyRepoPosition as repoPosition, galaxyClusterCentroid as clusterCentroid } from './ecosystemLayout.js';
