import { http, HttpResponse } from 'msw';

/**
 * Default MSW handlers. With no `accountId` in localStorage, getEnv() resolves
 * to 'prod', so the package targets the prod hosts below. Tests that need other
 * responses override these with server.use(...).
 */
const DS = 'https://datastream.salescode.ai';
const HOST = 'https://prod.salescode.ai';
const MKT = 'https://salescode-marketplace.salescode.ai';

export const handlers = [
  // Marketplace config fetch
  http.get(`${MKT}/configuration/fetch`, () =>
    HttpResponse.json({
      features: [
        {
          domainName: 'clientconfig',
          domainType: 'distributor_report_configuration',
          domainValues: [
            { id: 'r1', name: 'Sales Report', reportName: 'sales', isDistributorView: false },
          ],
        },
      ],
    }),
  ),

  // Sales hierarchy
  http.get(`${DS}/org/users/designations/by-parent`, () =>
    HttpResponse.json({ designations: ['nsm', 'asm'] }),
  ),
  http.get(`${DS}/org/users/by-designation`, () =>
    HttpResponse.json({ users: [{ userId: 'u1', name: 'Alice', loginId: 'L1' }] }),
  ),
  http.get(`${DS}/org/users/children`, () =>
    HttpResponse.json({ users: [{ userId: 'u2', name: 'Bob', loginId: 'L2' }] }),
  ),

  // Geographical hierarchy
  http.get(`${DS}/org/users/location/levels`, () =>
    HttpResponse.json({ levelsLowToHigh: ['city', 'state', 'country'] }),
  ),
  http.get(`${DS}/org/locations`, () =>
    HttpResponse.json({ locations: ['Mumbai', 'Delhi'] }),
  ),
  http.get(`${DS}/org/users/location/under`, () =>
    HttpResponse.json({ values: ['North', 'South'] }),
  ),
  http.get(`${DS}/org/users/location/users`, () =>
    HttpResponse.json({ users: [{ userId: 'u3', loginId: 'L3', name: 'Carol' }] }),
  ),

  // Report data + filter values + defs
  http.post(`${DS}/rpt-generic/search`, () =>
    HttpResponse.json({ items: [{ a: 1 }], total: 1, totalPages: 1, currentPage: 0 }),
  ),
  http.post(`${DS}/rpt-generic/filter-values`, () =>
    HttpResponse.json({ values: { region: ['North', 'South'] } }),
  ),
  http.get(`${DS}/report-defs/fields`, () =>
    HttpResponse.json({
      fields: {
        columns: [{ alias: 'col1', display: 'Column 1' }],
        filters: { map: { field1: { alias: 'region', display: 'Region' } } },
      },
    }),
  ),

  // Downloads (blobs)
  http.post(`${DS}/rpt-generic/download`, () =>
    HttpResponse.text('snapshot,csv', { headers: { 'Content-Type': 'text/csv' } }),
  ),
  http.post(`${DS}/live/download`, () =>
    HttpResponse.text('live,csv', { headers: { 'Content-Type': 'text/csv' } }),
  ),

  // Host tasks
  http.get(`${HOST}/tasks/:taskId`, () =>
    HttpResponse.json({ features: [{ status: 'success', attributes: { fileKeys: [] } }] }),
  ),
];
