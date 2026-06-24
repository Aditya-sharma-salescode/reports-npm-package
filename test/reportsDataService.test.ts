import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './msw/server';
import {
  fetchSalesDesignations,
  fetchUsersByDesignation,
  fetchChildrenUsers,
  fetchGeographicalLevels,
  fetchGeographicalLocations,
  fetchGeographicalLocationsUnder,
  fetchLocationUsers,
  fetchReportData,
  fetchFilterValues,
  fetchAvailableFilters,
  fetchColumnDefinitions,
  submitSnapshotReportAsync,
  submitLiveReportAsync,
  pollAsyncReport,
} from '../src/services/reportsDataService';

const DS = 'https://datastream.salescode.ai';

beforeEach(() => localStorage.clear()); // → env=prod → datastream prod host

describe('sales hierarchy fetchers', () => {
  it('fetchSalesDesignations unwraps .designations and passes the parent', async () => {
    let seen: URLSearchParams | null = null;
    server.use(
      http.get(`${DS}/org/users/designations/by-parent`, ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json({ designations: ['nsm', 'asm'] });
      }),
    );
    const out = await fetchSalesDesignations('saleshead', 'scopeX');
    expect(out).toEqual(['nsm', 'asm']);
    expect(seen!.get('designation')).toBe('saleshead');
    expect(seen!.get('scope')).toBe('scopeX');
  });

  it('fetchSalesDesignations falls back to a bare array response', async () => {
    server.use(http.get(`${DS}/org/users/designations/by-parent`, () => HttpResponse.json(['a', 'b'])));
    expect(await fetchSalesDesignations('x')).toEqual(['a', 'b']);
  });

  it('fetchUsersByDesignation unwraps .users', async () => {
    const users = [{ userId: 'u1', name: 'A', loginId: 'L1' }];
    server.use(http.get(`${DS}/org/users/by-designation`, () => HttpResponse.json({ users })));
    expect(await fetchUsersByDesignation('rsm')).toEqual(users);
  });

  it('fetchChildrenUsers passes userId + designation', async () => {
    let seen: URLSearchParams | null = null;
    server.use(
      http.get(`${DS}/org/users/children`, ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json({ users: [] });
      }),
    );
    await fetchChildrenUsers('u9', 'supplier');
    expect(seen!.get('userId')).toBe('u9');
    expect(seen!.get('designation')).toBe('supplier');
  });
});

describe('geographical hierarchy fetchers', () => {
  it('fetchGeographicalLevels unwraps .levelsLowToHigh', async () => {
    server.use(
      http.get(`${DS}/org/users/location/levels`, () =>
        HttpResponse.json({ levelsLowToHigh: ['city', 'state'] }),
      ),
    );
    expect(await fetchGeographicalLevels()).toEqual(['city', 'state']);
  });

  it('fetchGeographicalLocations maps strings into {value,label}', async () => {
    server.use(
      http.get(`${DS}/org/locations`, () => HttpResponse.json({ locations: ['Mumbai', 'Delhi'] })),
    );
    expect(await fetchGeographicalLocations('state')).toEqual([
      { value: 'Mumbai', label: 'Mumbai' },
      { value: 'Delhi', label: 'Delhi' },
    ]);
  });

  it('fetchGeographicalLocationsUnder maps values into {value,label}', async () => {
    server.use(
      http.get(`${DS}/org/users/location/under`, () => HttpResponse.json({ values: ['North'] })),
    );
    expect(await fetchGeographicalLocationsUnder('state', 'MH', 'city')).toEqual([
      { value: 'North', label: 'North' },
    ]);
  });

  it('fetchLocationUsers unwraps .users and forwards the designation', async () => {
    let seen: URLSearchParams | null = null;
    server.use(
      http.get(`${DS}/org/users/location/users`, ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json({ users: [{ userId: 'u3', loginId: 'L3', name: 'C' }] });
      }),
    );
    const out = await fetchLocationUsers('city', 'Mumbai', 'supplier');
    expect(out).toHaveLength(1);
    expect(seen!.get('level')).toBe('city');
    expect(seen!.get('designation')).toBe('supplier');
  });
});

describe('fetchReportData', () => {
  async function capturePayload(params: Parameters<typeof fetchReportData>[0]) {
    let body: any;
    server.use(
      http.post(`${DS}/rpt-generic/search`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ items: [], total: 0, totalPages: 0, currentPage: 0 });
      }),
    );
    await fetchReportData(params);
    return body;
  }

  it('sends report, count:true and defaults pageSize to 30', async () => {
    const body = await capturePayload({ report: 'sales' });
    expect(body.report).toBe('sales');
    expect(body.count).toBe(true);
    expect(body.pageSize).toBe(30);
  });

  it('spreads filter arrays as top-level keys', async () => {
    const body = await capturePayload({ report: 'sales', filters: { region: ['North', 'South'] } });
    expect(body.region).toEqual(['North', 'South']);
  });

  it('joins distributor_code into a comma-separated string', async () => {
    const body = await capturePayload({
      report: 'sales',
      filters: { distributor_code: ['L1', 'L2'] },
    });
    expect(body.distributor_code).toBe('L1,L2');
  });

  it('forwards paging, since/until, pf and distributorFilter when present', async () => {
    const body = await capturePayload({
      report: 'sales',
      page: 2,
      pageSize: 50,
      since: '2024-01-01',
      until: '2024-02-01',
      pf: 'sales',
      distributorFilter: { userFilters: [{ userId: 'u1', direct: true }] },
    });
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(50);
    expect(body.since).toBe('2024-01-01');
    expect(body.until).toBe('2024-02-01');
    expect(body.pf).toBe('sales');
    expect(body.distributorFilter.userFilters).toHaveLength(1);
  });

  it('returns the response data', async () => {
    server.use(
      http.post(`${DS}/rpt-generic/search`, () =>
        HttpResponse.json({ items: [{ x: 1 }], total: 1, totalPages: 1, currentPage: 0 }),
      ),
    );
    const data = await fetchReportData({ report: 'sales' });
    expect(data.total).toBe(1);
    expect(data.items).toEqual([{ x: 1 }]);
  });
});

describe('fetchFilterValues', () => {
  it('returns the values list for the requested field', async () => {
    server.use(
      http.post(`${DS}/rpt-generic/filter-values`, () =>
        HttpResponse.json({ values: { region: ['North', 'South'] } }),
      ),
    );
    expect(await fetchFilterValues({ report: 'sales', which: 'region' })).toEqual(['North', 'South']);
  });

  it('returns [] when the field has no values', async () => {
    server.use(
      http.post(`${DS}/rpt-generic/filter-values`, () => HttpResponse.json({ values: {} })),
    );
    expect(await fetchFilterValues({ report: 'sales', which: 'region' })).toEqual([]);
  });

  it('merges additionalFilters and filters into the payload', async () => {
    let body: any;
    server.use(
      http.post(`${DS}/rpt-generic/filter-values`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ values: { region: [] } });
      }),
    );
    await fetchFilterValues({
      report: 'sales',
      which: 'region',
      additionalFilters: { status: ['active'] },
      filters: { city: ['Mumbai'] },
    });
    expect(body.status).toEqual(['active']);
    expect(body.city).toEqual(['Mumbai']);
    expect(body.which).toBe('region');
  });
});

describe('fetchAvailableFilters / fetchColumnDefinitions', () => {
  it('fetchAvailableFilters returns the values of fields.filters.map', async () => {
    server.use(
      http.get(`${DS}/report-defs/fields`, () =>
        HttpResponse.json({
          fields: { filters: { map: { field1: { alias: 'region', display: 'Region' } } } },
        }),
      ),
    );
    expect(await fetchAvailableFilters('sales')).toEqual([{ alias: 'region', display: 'Region' }]);
  });

  it('fetchAvailableFilters returns [] when the map is missing', async () => {
    server.use(http.get(`${DS}/report-defs/fields`, () => HttpResponse.json({ fields: {} })));
    expect(await fetchAvailableFilters('sales')).toEqual([]);
  });

  it('fetchColumnDefinitions returns fields.columns', async () => {
    server.use(
      http.get(`${DS}/report-defs/fields`, () =>
        HttpResponse.json({ fields: { columns: [{ alias: 'c1', display: 'C1' }] } }),
      ),
    );
    expect(await fetchColumnDefinitions('sales')).toEqual([{ alias: 'c1', display: 'C1' }]);
  });
});

describe('downloads (async submit + poll)', () => {
  it('submitSnapshotReportAsync posts to /rpt-generic/download and returns the runId', async () => {
    let url: string | null = null;
    server.use(
      http.post(`${DS}/rpt-generic/download`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ runId: 'run-1' });
      }),
    );
    const runId = await submitSnapshotReportAsync({ reportName: 'sales' });
    expect(runId).toBe('run-1');
    expect(url).toContain('attachment=false');
  });

  it('submitLiveReportAsync posts to /live/download and returns the runId', async () => {
    server.use(http.post(`${DS}/live/download`, () => HttpResponse.json({ runId: 'live-1' })));
    expect(await submitLiveReportAsync({ configName: 'sales', format: 'csv' })).toBe('live-1');
  });

  it('submitAsync throws when no runId is returned', async () => {
    server.use(http.post(`${DS}/rpt-generic/download`, () => HttpResponse.json({})));
    await expect(submitSnapshotReportAsync({ reportName: 'sales' })).rejects.toThrow(/runId/i);
  });

  it('submitAsync maps a 429 to a "server busy" error', async () => {
    server.use(
      http.post(`${DS}/rpt-generic/download`, () =>
        HttpResponse.json({ error: 'Too many reports' }, { status: 429 }),
      ),
    );
    await expect(submitSnapshotReportAsync({ reportName: 'sales' })).rejects.toThrow(/too many reports/i);
  });

  it('pollAsyncReport returns the Blob once the run completes (200)', async () => {
    server.use(
      http.get(`${DS}/reports/download`, () =>
        HttpResponse.text('a,b,c', { status: 200, headers: { 'Content-Type': 'text/csv' } }),
      ),
    );
    const blob = await pollAsyncReport('run-1', { intervalMs: 1 });
    expect(blob).toBeInstanceOf(Blob);
  });

  it('pollAsyncReport keeps polling on 202 then resolves on 200', async () => {
    let calls = 0;
    server.use(
      http.get(`${DS}/reports/download`, () => {
        calls += 1;
        if (calls === 1) return HttpResponse.json({ status: 'pending' }, { status: 202 });
        return HttpResponse.text('done', { status: 200 });
      }),
    );
    const blob = await pollAsyncReport('run-1', { intervalMs: 1 });
    expect(blob).toBeInstanceOf(Blob);
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('pollAsyncReport rejects on a 422 failure status', async () => {
    server.use(
      http.get(`${DS}/reports/download`, () =>
        HttpResponse.json({ message: 'generation failed' }, { status: 422 }),
      ),
    );
    await expect(pollAsyncReport('run-1', { intervalMs: 1 })).rejects.toThrow(/generation failed/i);
  });

  it('pollAsyncReport rejects on a 404 unknown runId', async () => {
    server.use(
      http.get(`${DS}/reports/download`, () =>
        HttpResponse.json({ message: 'expired' }, { status: 404 }),
      ),
    );
    await expect(pollAsyncReport('bad', { intervalMs: 1 })).rejects.toThrow(/expired/i);
  });
});
