import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './msw/server';
import { fetchReportConfigs } from '../src/services/configService';

const MKT = 'https://salescode-marketplace.salescode.ai';

describe('fetchReportConfigs', () => {
  beforeEach(() => localStorage.clear());

  it('returns [] when no tenant id is set (skips the API call)', async () => {
    await expect(fetchReportConfigs()).resolves.toEqual([]);
  });

  it('sends the lob header and extracts the report configuration feature', async () => {
    localStorage.setItem('accountId', 'tenant-1');
    let seenLob: string | null = null;
    server.use(
      http.get(`${MKT}/configuration/fetch`, ({ request }) => {
        seenLob = request.headers.get('lob');
        return HttpResponse.json({
          features: [
            { domainName: 'other', domainType: 'x', domainValues: [{ id: 'nope' }] },
            {
              domainName: 'clientconfig',
              domainType: 'distributor_report_configuration',
              domainValues: [{ id: 'r1', name: 'Report One' }],
            },
          ],
        });
      }),
    );
    const out = await fetchReportConfigs();
    expect(seenLob).toBe('tenant-1');
    expect(out).toEqual([{ id: 'r1', name: 'Report One' }]);
  });

  it('returns [] when the config feature is absent', async () => {
    localStorage.setItem('accountId', 'tenant-1');
    server.use(
      http.get(`${MKT}/configuration/fetch`, () =>
        HttpResponse.json({ features: [{ domainName: 'other', domainType: 'x', domainValues: [] }] }),
      ),
    );
    await expect(fetchReportConfigs()).resolves.toEqual([]);
  });

  it('returns [] when the config feature has no domainValues', async () => {
    localStorage.setItem('accountId', 'tenant-1');
    server.use(
      http.get(`${MKT}/configuration/fetch`, () =>
        HttpResponse.json({
          features: [
            {
              domainName: 'clientconfig',
              domainType: 'distributor_report_configuration',
              domainValues: [],
            },
          ],
        }),
      ),
    );
    await expect(fetchReportConfigs()).resolves.toEqual([]);
  });

  it('returns [] when the response has no features array', async () => {
    localStorage.setItem('accountId', 'tenant-1');
    server.use(http.get(`${MKT}/configuration/fetch`, () => HttpResponse.json({})));
    await expect(fetchReportConfigs()).resolves.toEqual([]);
  });
});
