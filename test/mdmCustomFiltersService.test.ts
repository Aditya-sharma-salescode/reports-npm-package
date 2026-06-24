import { describe, it, expect } from 'vitest';
import {
  isMergedFilterForReport,
  getMergedFilterSources,
  loadCustomFiltersForReport,
} from '../src/services/mdmCustomFiltersService';
import { makeReportConfig } from './fixtures';
import { server } from './msw/server';
import { http, HttpResponse } from 'msw';

const DS = 'https://datastream.salescode.ai';

describe('isMergedFilterForReport', () => {
  it('returns false when reportConfig is null', () => {
    expect(isMergedFilterForReport('field1', null)).toBe(false);
  });

  it('returns false when the alias is not a merged filter', () => {
    const cfg = makeReportConfig({ mergedFilters: { combo: [{ alias: 'field1', value: '1' }] } });
    expect(isMergedFilterForReport('other', cfg)).toBe(false);
  });

  it('returns true for a configured merged filter alias', () => {
    const cfg = makeReportConfig({ mergedFilters: { combo: [{ alias: 'field1', value: '1' }] } });
    expect(isMergedFilterForReport('combo', cfg)).toBe(true);
  });
});

describe('getMergedFilterSources', () => {
  it('returns [] when there is no config or no match', () => {
    expect(getMergedFilterSources('x', null)).toEqual([]);
    expect(getMergedFilterSources('x', makeReportConfig())).toEqual([]);
  });

  it('returns the configured source list', () => {
    const sources = [{ alias: 'field1', value: '1' }, { alias: 'field2', value: '2' }];
    const cfg = makeReportConfig({ mergedFilters: { combo: sources } });
    expect(getMergedFilterSources('combo', cfg)).toEqual(sources);
  });
});

describe('loadCustomFiltersForReport', () => {
  it('returns [] for a null config without calling the API', async () => {
    await expect(loadCustomFiltersForReport(null)).resolves.toEqual([]);
  });

  function mockFilters(list: { alias: string; display: string }[]) {
    server.use(
      http.get(`${DS}/report-defs/fields`, () => {
        const map: Record<string, unknown> = {};
        list.forEach((f, i) => (map[`field${i + 1}`] = f));
        return HttpResponse.json({ fields: { filters: { map } } });
      }),
    );
  }

  it('drops the global distributor_code filter', async () => {
    mockFilters([
      { alias: 'distributor_code', display: 'Distributor' },
      { alias: 'region', display: 'Region' },
    ]);
    const out = await loadCustomFiltersForReport(makeReportConfig());
    expect(out.map((f) => f.alias)).toEqual(['region']);
  });

  it('drops filters listed in filtersToHide', async () => {
    mockFilters([
      { alias: 'region', display: 'Region' },
      { alias: 'secret', display: 'Secret' },
    ]);
    const out = await loadCustomFiltersForReport(makeReportConfig({ filtersToHide: ['secret'] }));
    expect(out.map((f) => f.alias)).toEqual(['region']);
  });

  it('drops merged filter aliases and their source aliases', async () => {
    mockFilters([
      { alias: 'combo', display: 'Combo' },
      { alias: 'src1', display: 'Source 1' },
      { alias: 'keep', display: 'Keep' },
    ]);
    const cfg = makeReportConfig({ mergedFilters: { combo: [{ alias: 'src1', value: 'x' }] } });
    const out = await loadCustomFiltersForReport(cfg);
    expect(out.map((f) => f.alias)).toEqual(['keep']);
  });

  it('uses filterReportName over reportName when provided', async () => {
    let seenReport: string | null = null;
    server.use(
      http.get(`${DS}/report-defs/fields`, ({ request }) => {
        seenReport = new URL(request.url).searchParams.get('report');
        return HttpResponse.json({ fields: { filters: { map: {} } } });
      }),
    );
    await loadCustomFiltersForReport(
      makeReportConfig({ reportName: 'base', filterReportName: 'override' }),
    );
    expect(seenReport).toBe('override');
  });
});
