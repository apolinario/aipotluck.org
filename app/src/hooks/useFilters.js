import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { healthBucket } from '../utils/health.js';
import { searchRepos } from '../utils/search.js';

const ACTIVITY_THRESHOLDS = { high: 100, medium: 10 };

export function useFilters(data, indexes) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => ({
    layer: searchParams.get('layer') || null,
    subcategory: searchParams.get('subcategory') || null,
    health: searchParams.getAll('health'),
    country: searchParams.get('country') || null,
    license: searchParams.get('license') || null,
    activity: searchParams.get('activity') || null,
    hasPackages: searchParams.get('hasPackages') === 'true',
    hasModels: searchParams.get('hasModels') === 'true',
    q: searchParams.get('q') || '',
  }), [searchParams]);

  const setFilter = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key === 'health') {
        next.delete('health');
        if (Array.isArray(value)) value.forEach((v) => next.append('health', v));
      } else if (value === null || value === '' || value === false) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.layer) n++;
    if (filters.subcategory) n++;
    if (filters.health.length) n++;
    if (filters.country) n++;
    if (filters.license) n++;
    if (filters.activity) n++;
    if (filters.hasPackages) n++;
    if (filters.hasModels) n++;
    if (filters.q) n++;
    return n;
  }, [filters]);

  const filteredRepos = useMemo(() => {
    let repos = data.repos;

    const searchMatches = searchRepos(indexes.searchIndex, filters.q);
    if (searchMatches) {
      repos = repos.filter((r) => searchMatches.has(r.repo));
    }

    if (filters.layer) {
      const projectsInLayer = new Set(
        data.taxonomy
          .filter((t) => t.osai_layer === filters.layer)
          .map((t) => t.project_slug)
      );
      repos = repos.filter((r) => projectsInLayer.has(r.repo));
    }

    if (filters.subcategory) {
      const projectsInSub = new Set(
        data.taxonomy
          .filter((t) => t.osai_subcategory === filters.subcategory)
          .map((t) => t.project_slug)
      );
      repos = repos.filter((r) => projectsInSub.has(r.repo));
    }

    if (filters.health.length > 0) {
      const taxScores = {};
      for (const t of data.taxonomy) {
        if (!taxScores[t.project_slug] || t.gap_score < taxScores[t.project_slug]) {
          taxScores[t.project_slug] = t.gap_score;
        }
      }
      repos = repos.filter((r) => {
        const score = taxScores[r.repo];
        if (score == null) return filters.health.includes('gap');
        const h = (score / 5) * 100;
        return filters.health.includes(healthBucket(h));
      });
    }

    if (filters.country) {
      repos = repos.filter((r) => r.country === filters.country);
    }
    if (filters.license) {
      repos = repos.filter((r) => r.license === filters.license);
    }

    if (filters.activity === 'high') {
      repos = repos.filter((r) => r.commits_90d >= ACTIVITY_THRESHOLDS.high);
    } else if (filters.activity === 'medium') {
      repos = repos.filter((r) => r.commits_90d >= ACTIVITY_THRESHOLDS.medium && r.commits_90d < ACTIVITY_THRESHOLDS.high);
    } else if (filters.activity === 'low') {
      repos = repos.filter((r) => r.commits_90d < ACTIVITY_THRESHOLDS.medium);
    }

    if (filters.hasPackages) {
      repos = repos.filter((r) => indexes.packagesByRepo[r.repo]?.length > 0);
    }
    if (filters.hasModels) {
      repos = repos.filter((r) => indexes.modelsByRepo[r.repo]?.length > 0);
    }

    return repos;
  }, [data, indexes, filters]);

  const filterOptions = useMemo(() => {
    const countries = [...new Set(data.repos.map((r) => r.country).filter(Boolean))].sort();
    const licenses = [...new Set(data.repos.map((r) => r.license).filter(Boolean))].sort();
    const subcategories = filters.layer
      ? data.layers.find((l) => l.layer === filters.layer)?.subcategories.map((s) => s.subcategory) || []
      : [];
    return { countries, licenses, subcategories };
  }, [data, filters.layer]);

  return { filters, setFilter, clearFilters, activeCount, filteredRepos, filterOptions };
}
