import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import dayjs from 'dayjs';
import { server } from './msw/server';
import { downloadReport } from '../src/services/mdmReportsDownloadService';
import { makeReportConfig } from './fixtures';
import type { DownloadParams } from '../src/services/types';

const DS = 'https://datastream.salescode.ai';
const HOST = 'https://prod.salescode.ai';

function baseParams(overrides: Partial<DownloadParams> = {}): DownloadParams {
  return {
    selectedReport: makeReportConfig(),
    filters: {},
    dateRangeType: 'daterange',
    fromDate: dayjs('2024-01-01'),
    toDate: dayjs('2024-01-31'),
    format: 'csv',
    primaryFilter: null,
    customFilters: [],
    ...overrides,
  };
}

/** Spy on anchor clicks so the blob-download paths don't actually navigate. */
function spyAnchorClick() {
  const clickSpy = vi.fn();
  const orig = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = orig(tag);
    if (tag === 'a') el.click = clickSpy;
    return el as HTMLElement;
  });
  return clickSpy;
}

/**
 * Snapshot/live downloads are async: POST submit → { runId } → GET /reports/download
 * polls until a 200 blob. This wires both halves and captures the submit body.
 * Returns getter for the captured POST payload.
 */
function mockAsyncDownload(submitPath: string) {
  const captured: { body?: any } = {};
  server.use(
    http.post(`${DS}${submitPath}`, async ({ request }) => {
      captured.body = await request.json();
      return HttpResponse.json({ runId: 'run-1' });
    }),
    http.get(`${DS}/reports/download`, () =>
      HttpResponse.text('a,b,c', { status: 200, headers: { 'Content-Type': 'text/csv' } }),
    ),
  );
  return captured;
}

describe('downloadReport orchestrator', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('accountId', 'tenant-1');
    localStorage.setItem('authToken', 'tok');
  });

  it('snapshot (default): submits to /rpt-generic/download, polls, and triggers a browser download', async () => {
    const captured = mockAsyncDownload('/rpt-generic/download');
    const click = spyAnchorClick();
    // dateRangeFilter:true so the orchestrator includes the date range.
    await downloadReport(
      baseParams({
        selectedReport: makeReportConfig({ dateRangeFilter: true }),
        filters: { region: ['North'] },
      }),
    );
    expect(captured.body.reportName).toBe('sales');
    // startDate is a UTC "YYYY-MM-DD HH:mm:ss" string derived from local midnight.
    expect(captured.body.dateRange.startDate).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(captured.body.dateRange.endDate).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(captured.body.filters.map.region).toEqual(['North']);
    expect(click).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('snapshot omits dateRange when the report has no date filter', async () => {
    const captured = mockAsyncDownload('/rpt-generic/download');
    spyAnchorClick();
    await downloadReport(baseParams({ selectedReport: makeReportConfig({ dateRangeFilter: false }) }));
    expect(captured.body.dateRange).toBeUndefined();
    vi.restoreAllMocks();
  });

  it('live report: submits to /live/download, polls, and triggers a browser download', async () => {
    const captured = mockAsyncDownload('/live/download');
    const click = spyAnchorClick();
    await downloadReport(
      baseParams({ selectedReport: makeReportConfig({ isLiveReport: true, reportName: 'liverpt' }) }),
    );
    expect(captured.body.configName).toBe('liverpt');
    expect(click).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('live report with period date type sends period/year instead of dateRange', async () => {
    const captured = mockAsyncDownload('/live/download');
    spyAnchorClick();
    await downloadReport(
      baseParams({
        selectedReport: makeReportConfig({ isLiveReport: true, dateRangeFilter: true }),
        dateRangeType: 'period',
        period: 'Q1',
        year: '2024',
      }),
    );
    expect(captured.body.period).toBe('Q1');
    expect(captured.body.year).toBe('2024');
    expect(captured.body.dateRange).toBeUndefined();
    vi.restoreAllMocks();
  });

  it('PDF report: creates a batchInvoicePdf task then polls it to success', async () => {
    let taskCreated = false;
    server.use(
      http.post(`${HOST}/tasks/types/batchInvoicePdf/execute`, () => {
        taskCreated = true;
        return HttpResponse.json({ features: [{ id: 'task-1' }] });
      }),
      http.get(`${HOST}/tasks/task-1`, () =>
        HttpResponse.json({ features: [{ status: 'success', attributes: { fileKeys: [] } }] }),
      ),
    );
    await downloadReport(
      baseParams({ selectedReport: makeReportConfig({ isPDFReport: true }) }),
    );
    expect(taskCreated).toBe(true);
  });

  it('PDF report: throws when no task id is returned', async () => {
    server.use(
      http.post(`${HOST}/tasks/types/batchInvoicePdf/execute`, () => HttpResponse.json({ features: [] })),
    );
    await expect(
      downloadReport(baseParams({ selectedReport: makeReportConfig({ isPDFReport: true }) })),
    ).rejects.toThrow(/task id/i);
  });

  it('GSTR report: creates an ExcelerExecutor task and polls it', async () => {
    let url: string | null = null;
    server.use(
      http.post(`${HOST}/tasks/types/ExcelerExecutor/execute`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ features: [{ id: 'gstr-1' }] });
      }),
      http.get(`${HOST}/tasks/gstr-1`, () =>
        HttpResponse.json({ features: [{ status: 'success', attributes: { fileKeys: [] } }] }),
      ),
    );
    await downloadReport(
      baseParams({ selectedReport: makeReportConfig({ isGSTRReport: true }) }),
    );
    expect(url).toContain('source=portal');
  });

  it('custom download: includes metadata from optionsMap when sendMetadata is set', async () => {
    let body: any;
    server.use(
      http.post(`${HOST}/tasks/types/ExcelerExecutor/execute`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ features: [{ id: 'cust-1' }] });
      }),
      http.get(`${HOST}/tasks/cust-1`, () =>
        HttpResponse.json({ features: [{ status: 'success', attributes: { fileKeys: [] } }] }),
      ),
    );
    await downloadReport(
      baseParams({
        selectedReport: makeReportConfig({
          customDownload: true,
          sendMetadata: true,
          metadataFields: ['brand'],
        }),
        optionsMap: { brand: [{ label: 'Acme', value: 'acme' }, { label: 'Globex', value: 'globex' }] },
      }),
    );
    expect(body.attributes.metadata.brand).toBe('acme,globex');
  });

  it('task polling rejects when the task reports failure', async () => {
    server.use(
      http.post(`${HOST}/tasks/types/batchInvoicePdf/execute`, () =>
        HttpResponse.json({ features: [{ id: 'fail-1' }] }),
      ),
      http.get(`${HOST}/tasks/fail-1`, () =>
        HttpResponse.json({ features: [{ status: 'failure' }] }),
      ),
    );
    await expect(
      downloadReport(baseParams({ selectedReport: makeReportConfig({ isPDFReport: true }) })),
    ).rejects.toThrow(/failed/i);
  });

  it('distributor primaryFilter passes distributor_code into the filters map', async () => {
    const captured = mockAsyncDownload('/rpt-generic/download');
    spyAnchorClick();
    await downloadReport(
      baseParams({
        primaryFilter: 'distributor',
        filters: { distributor_code: ['L1', 'L2'] },
      }),
    );
    expect(captured.body.filters.map.distributor_code).toEqual(['L1', 'L2']);
    vi.restoreAllMocks();
  });

  it('isDistributorView falls back to the logged-in user when no distributor selected', async () => {
    localStorage.setItem('authContext', JSON.stringify({ user: { loginId: 'me-1', email: 'm@x' } }));
    const captured = mockAsyncDownload('/rpt-generic/download');
    spyAnchorClick();
    await downloadReport(
      baseParams({ selectedReport: makeReportConfig({ isDistributorView: true }) }),
    );
    expect(captured.body.filters.map.distributor_code).toEqual(['me-1']);
    vi.restoreAllMocks();
  });
});
