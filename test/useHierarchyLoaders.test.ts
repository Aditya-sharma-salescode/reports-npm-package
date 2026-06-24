import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook } from '@testing-library/react';
import { server } from './msw/server';
import { useHierarchyLoaders } from '../src/hooks/useHierarchyLoaders';
import { makeReportConfig } from './fixtures';
import type { newReportConfig } from '../src/types/mdmReportsUtils';
import type { DrillDownPathItem } from '../src/services/types';

const DS = 'https://datastream.salescode.ai';

/**
 * Capture state mutations. setOptionsMap/setLoadingMap receive an updater fn;
 * we apply it to an accumulating record and record the final value per key.
 */
function makeHarness(overrides: Partial<{
  selectedReport: newReportConfig | null;
  filters: Record<string, string[]>;
  salesDrillDownPath: DrillDownPathItem[];
  geoDrillDownPath: DrillDownPathItem[];
  geoHierarchyOrder: string[];
  salesOptionsCache: Record<string, { label: string; value: string }[]>;
  geoOptionsCache: Record<string, { label: string; value: string }[]>;
}> = {}) {
  let optionsMap: Record<string, { label: string; value: string }[]> = {};
  let loadingMap: Record<string, boolean> = {};
  const setOptionsMap = vi.fn((u: any) => { optionsMap = typeof u === 'function' ? u(optionsMap) : u; });
  const setLoadingMap = vi.fn((u: any) => { loadingMap = typeof u === 'function' ? u(loadingMap) : u; });
  const setGeoHierarchyOrder = vi.fn();
  const setSalesOptionsCache = vi.fn();
  const setGeoOptionsCache = vi.fn();

  const params = {
    selectedReport: overrides.selectedReport ?? null,
    filters: overrides.filters ?? {},
    setOptionsMap,
    setLoadingMap,
    salesDrillDownPath: overrides.salesDrillDownPath ?? [],
    geoDrillDownPath: overrides.geoDrillDownPath ?? [],
    geoHierarchyOrder: overrides.geoHierarchyOrder ?? [],
    setGeoHierarchyOrder,
    salesOptionsCache: overrides.salesOptionsCache ?? {},
    setSalesOptionsCache,
    geoOptionsCache: overrides.geoOptionsCache ?? {},
    setGeoOptionsCache,
  };

  const { result } = renderHook(() => useHierarchyLoaders(params));
  return {
    api: result.current,
    getOptions: () => optionsMap,
    getLoading: () => loadingMap,
    setSalesOptionsCache,
    setGeoHierarchyOrder,
    setGeoOptionsCache,
  };
}

const salesReport = makeReportConfig({
  salesHierarchyFilter: {
    enabled: true,
    levelFilterLabel: 'Level',
    levelFilterField: 'salesLevel',
    valueFilterLabel: 'Users',
    valueFilterField: 'salesValue',
    hierarchyOrder: ['nsm', 'rsm', 'ase', 'supplier'],
  },
});

const geoReport = makeReportConfig({
  geographicalHierarchyFilter: {
    enabled: true,
    levelFilterLabel: 'Geo Level',
    levelFilterField: 'geoLevel',
    valueFilterLabel: 'Locations',
    valueFilterField: 'geoValue',
  },
});

beforeEach(() => localStorage.clear());

describe('useHierarchyLoaders — sales', () => {
  it('no-ops loadSalesLevels when no sales filter is configured', async () => {
    const h = makeHarness({ selectedReport: makeReportConfig() });
    await h.api.loadSalesLevels();
    expect(h.getOptions()).toEqual({});
  });

  it('loadSalesLevels derives levels from hierarchyOrder, excluding supplier', async () => {
    const h = makeHarness({ selectedReport: salesReport });
    await h.api.loadSalesLevels();
    expect(h.getOptions().salesLevel.map((o) => o.value)).toEqual(['nsm', 'rsm', 'ase']);
    expect(h.getLoading().salesLevel).toBe(false);
  });

  it('loadSalesLevels falls back to the API when hierarchyOrder is empty', async () => {
    server.use(
      http.get(`${DS}/org/users/designations/by-parent`, () =>
        HttpResponse.json({ designations: ['nsm', 'supplier', 'rsm'] }),
      ),
    );
    const noOrder = makeReportConfig({
      salesHierarchyFilter: { ...salesReport.salesHierarchyFilter!, hierarchyOrder: undefined },
    });
    const h = makeHarness({ selectedReport: noOrder });
    await h.api.loadSalesLevels();
    expect(h.getOptions().salesLevel.map((o) => o.value)).toEqual(['nsm', 'rsm']); // supplier filtered out
  });

  it('loadSalesValues fetches top-level users by designation', async () => {
    server.use(
      http.get(`${DS}/org/users/by-designation`, () =>
        HttpResponse.json({ users: [{ userId: 'u1', name: 'Alice', loginId: 'L1' }] }),
      ),
    );
    const h = makeHarness({ selectedReport: salesReport });
    await h.api.loadSalesValues('nsm');
    expect(h.getOptions().nsm).toEqual([{ label: 'Alice', value: 'u1' }]);
    expect(h.setSalesOptionsCache).toHaveBeenCalled();
  });

  it('loadSalesValues fetches children when a parent is selected in filters', async () => {
    let childRequested = false;
    server.use(
      http.get(`${DS}/org/users/children`, ({ request }) => {
        childRequested = true;
        const u = new URL(request.url);
        expect(u.searchParams.get('designation')).toBe('rsm');
        return HttpResponse.json({ users: [{ userId: 'c1', name: 'Child', loginId: 'LC1' }] });
      }),
    );
    const h = makeHarness({ selectedReport: salesReport, filters: { nsm: ['u1'] } });
    await h.api.loadSalesValues('rsm');
    expect(childRequested).toBe(true);
    expect(h.getOptions().rsm).toEqual([{ label: 'Child', value: 'c1' }]);
  });

  it('loadSalesValues serves from cache when the parent context is valid', async () => {
    const cached = [{ label: 'Cached', value: 'cv' }];
    const h = makeHarness({ selectedReport: salesReport, salesOptionsCache: { nsm: cached } });
    await h.api.loadSalesValues('nsm'); // index 0 → always valid context
    expect(h.getOptions().nsm).toEqual(cached);
    // No cache write because we returned early from the cache.
    expect(h.setSalesOptionsCache).not.toHaveBeenCalled();
  });

  it('loadSalesValues falls the option list back to [] on API error', async () => {
    server.use(http.get(`${DS}/org/users/by-designation`, () => new HttpResponse(null, { status: 500 })));
    const h = makeHarness({ selectedReport: salesReport });
    await h.api.loadSalesValues('nsm');
    expect(h.getOptions().nsm).toEqual([]);
  });

  it('dedupes children users across multiple parents', async () => {
    server.use(
      http.get(`${DS}/org/users/children`, () =>
        HttpResponse.json({ users: [{ userId: 'dup', name: 'D', loginId: 'L' }] }),
      ),
    );
    const h = makeHarness({ selectedReport: salesReport, filters: { nsm: ['p1', 'p2'] } });
    await h.api.loadSalesValues('rsm');
    expect(h.getOptions().rsm).toEqual([{ label: 'D', value: 'dup' }]); // deduped to one
  });
});

describe('useHierarchyLoaders — geographical', () => {
  it('no-ops when no geo filter is configured', async () => {
    const h = makeHarness({ selectedReport: makeReportConfig() });
    await h.api.loadGeographicalLevels();
    expect(h.getOptions()).toEqual({});
  });

  it('loadGeographicalLevels reverses the API levels (high→low) and sets order', async () => {
    server.use(
      http.get(`${DS}/org/users/location/levels`, () =>
        HttpResponse.json({ levelsLowToHigh: ['city', 'state', 'country'] }),
      ),
    );
    const h = makeHarness({ selectedReport: geoReport });
    await h.api.loadGeographicalLevels();
    expect(h.getOptions().geoLevel.map((o) => o.value)).toEqual(['country', 'state', 'city']);
    expect(h.setGeoHierarchyOrder).toHaveBeenCalledWith(['country', 'state', 'city']);
  });

  it('loadGeographicalValues fetches root locations for the top level', async () => {
    server.use(
      http.get(`${DS}/org/locations`, () => HttpResponse.json({ locations: ['India'] })),
    );
    const h = makeHarness({ selectedReport: geoReport, geoHierarchyOrder: ['country', 'state', 'city'] });
    await h.api.loadGeographicalValues('country');
    expect(h.getOptions().country).toEqual([{ label: 'India', value: 'India' }]);
    expect(h.setGeoOptionsCache).toHaveBeenCalled();
  });

  it('loadGeographicalValues fetches locations under a selected parent', async () => {
    let underCalled = false;
    server.use(
      http.get(`${DS}/org/users/location/under`, () => {
        underCalled = true;
        return HttpResponse.json({ values: ['Maharashtra'] });
      }),
    );
    const h = makeHarness({
      selectedReport: geoReport,
      geoHierarchyOrder: ['country', 'state', 'city'],
      filters: { country: ['India'] },
    });
    await h.api.loadGeographicalValues('state');
    expect(underCalled).toBe(true);
    expect(h.getOptions().state).toEqual([{ label: 'Maharashtra', value: 'Maharashtra' }]);
  });

  it('loadGeographicalValues lazily loads the hierarchy order when empty', async () => {
    server.use(
      http.get(`${DS}/org/users/location/levels`, () =>
        HttpResponse.json({ levelsLowToHigh: ['city', 'state', 'country'] }),
      ),
      http.get(`${DS}/org/locations`, () => HttpResponse.json({ locations: ['India'] })),
    );
    const h = makeHarness({ selectedReport: geoReport, geoHierarchyOrder: [] });
    await h.api.loadGeographicalValues('country');
    expect(h.setGeoHierarchyOrder).toHaveBeenCalledWith(['country', 'state', 'city']);
    expect(h.getOptions().country).toEqual([{ label: 'India', value: 'India' }]);
  });

  it('falls the geo option list back to [] on API error', async () => {
    server.use(http.get(`${DS}/org/locations`, () => new HttpResponse(null, { status: 500 })));
    const h = makeHarness({ selectedReport: geoReport, geoHierarchyOrder: ['country'] });
    await h.api.loadGeographicalValues('country');
    expect(h.getOptions().country).toEqual([]);
  });
});
