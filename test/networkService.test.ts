import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './msw/server';
import {
  datastreamGet,
  datastreamPost,
  hostGet,
  hostPost,
  fetchAndDownloadReport,
} from '../src/services/networkService';

const DS = 'https://datastream.salescode.ai';
const HOST = 'https://prod.salescode.ai';

describe('networkService', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('accountId', 'tenant-1');
    localStorage.setItem('authToken', 'tok-1');
  });

  it('datastreamGet hits the datastream base with auth + tenant headers', async () => {
    let headers: Headers | null = null;
    server.use(
      http.get(`${DS}/ping`, ({ request }) => {
        headers = request.headers;
        return HttpResponse.json({ ok: true });
      }),
    );
    const res = await datastreamGet('/ping');
    expect(res.data).toEqual({ ok: true });
    expect(headers!.get('X-Tenant-ID')).toBe('tenant-1');
    expect(headers!.get('Authorization')).toBe('Bearer tok-1');
  });

  it('datastreamGet forwards query params', async () => {
    let url: URL | null = null;
    server.use(
      http.get(`${DS}/search`, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json({});
      }),
    );
    await datastreamGet('/search', { foo: 'bar' });
    expect(url!.searchParams.get('foo')).toBe('bar');
  });

  it('datastreamPost sends the body and returns data', async () => {
    let body: any;
    server.use(
      http.post(`${DS}/do`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ done: true });
      }),
    );
    const res = await datastreamPost('/do', { a: 1 });
    expect(body).toEqual({ a: 1 });
    expect(res.data).toEqual({ done: true });
  });

  it('hostGet/hostPost use the host base and lob header', async () => {
    let getLob: string | null = null;
    let postLob: string | null = null;
    server.use(
      http.get(`${HOST}/h`, ({ request }) => {
        getLob = request.headers.get('lob');
        return HttpResponse.json({});
      }),
      http.post(`${HOST}/h`, ({ request }) => {
        postLob = request.headers.get('lob');
        return HttpResponse.json({});
      }),
    );
    await hostGet('/h');
    await hostPost('/h', {});
    expect(getLob).toBe('tenant-1');
    expect(postLob).toBe('tenant-1');
  });

  describe('fetchAndDownloadReport', () => {
    it('throws when the response is not ok', async () => {
      server.use(http.get('https://files.example.com/x.csv', () => new HttpResponse(null, { status: 500 })));
      await expect(fetchAndDownloadReport('https://files.example.com/x.csv')).rejects.toThrow(/download failed/i);
    });

    it('downloads the blob and triggers an anchor click', async () => {
      server.use(
        http.get('https://files.example.com/report.csv', () =>
          HttpResponse.text('a,b,c', {
            headers: { 'Content-Disposition': 'attachment; filename="report.csv"' },
          }),
        ),
      );
      const clickSpy = vi.fn();
      const origCreate = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = clickSpy;
        return el as HTMLElement;
      });

      await fetchAndDownloadReport('https://files.example.com/report.csv');
      expect(clickSpy).toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('derives the filename from the URL when no Content-Disposition', async () => {
      server.use(
        http.get('https://files.example.com/data.xlsx', () => HttpResponse.text('x')),
      );
      const clickSpy = vi.fn();
      const origCreate = document.createElement.bind(document);
      let anchor: any;
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = origCreate(tag);
        if (tag === 'a') {
          el.click = clickSpy;
          anchor = el;
        }
        return el as HTMLElement;
      });

      await fetchAndDownloadReport('https://files.example.com/data.xlsx');
      expect(anchor.download).toBe('data.xlsx');
      vi.restoreAllMocks();
    });
  });
});
