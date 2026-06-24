# @aditya-sharma-salescode/reports-ui — Test Suite

Automated tests for the reports-ui package: **168 tests**, Vitest + React Testing Library + MSW, all against **mocked dependencies** (no real datastream/host/marketplace API is contacted). Coverage: ~92% statements, ~95% functions, ~93% lines.

## Layers

| Layer | File(s) | What it covers |
|-------|---------|----------------|
| Unit — date ranges | `dateRangeUtils.test.ts` | `parseDateRangeAllowed`, `getDateRangeFromAllowed`, `getLabelFromAllowed`, `getMaxDateFromCustomRange` across day/week/month/year, singular/plural, invalid input, boundary math, immutability |
| Unit — config | `configUrls.test.ts`, `configAuth.test.ts` | env detection from `accountId`, base-URL resolution per env, the datastream override, token/tenant/auth-context reads, header construction (Bearer prefixing), cookie sync |
| Unit — transforms | `hierarchyHelpers.test.ts`, `distributorMetaService.test.ts`, `mdmCustomFiltersService.test.ts`, `downloadBuilders.test.ts` | drill-down summarization, API→option mapping, distributor filtering (type/division/allowed), merged-filter predicates, custom-filter exclusion rules, location/user filter builders |
| Service / Data access | `reportsDataService.test.ts`, `networkService.test.ts`, `configService.test.ts` | every fetcher's request shape + response unwrapping, `distributor_code` comma-joining, axios header/param wiring, file download (Content-Disposition parsing), marketplace config extraction — all via MSW |
| Hook | `useHierarchyLoaders.test.ts` | sales + geo level/value loading, cache-validity logic, parent-context resolution from filters & drill-down path, child-user dedup, lazy hierarchy-order loading, error fallbacks |
| Component | `CompactCheckboxDropdown.test.tsx`, `ReportTiles.test.tsx` | dropdown open/close, multi/single select, maxSelected, search filter, select-all, outside-click, loading/empty states, controlled search; report tile search/group/select/empty-state/tags |
| Download orchestration | `downloadReport.test.ts` | `downloadReport` across live / PDF / GSTR / custom / snapshot paths, task-poll success & failure, distributor-code resolution, metadata assembly |

## Running

```bash
cd npm-package
npm test                 # run all tests
npm run test:watch       # watch mode
npm run test:coverage    # with coverage (thresholds enforced)
```

## How the mocking works

- `getEnv()` reads `localStorage.accountId`; with none set it resolves to `prod`, so the package targets the prod hosts. MSW handlers in `test/msw/handlers.ts` intercept those hosts (`datastream.salescode.ai`, `prod.salescode.ai`, the marketplace). Tests override per-case with `server.use(...)`.
- Coverage uses the **istanbul** provider (the v8 provider interferes with the MSW + real-timer fetch round-trips this suite relies on) and files run sequentially (`fileParallelism: false`) for determinism.
- Fixtures (`test/fixtures.ts`) build valid `newReportConfig` and `DistributorFeature` objects.

## Unified report

This package is wired into the cross-repo Excel report. From the dashboard repo:

```bash
cd ../salescode-monitor-dashboard
npm run test:report      # runs backend + dashboard + E2E + reports-ui, builds the workbook
```

Reports UI appears as its own suite row (Summary + Coverage sheets) and its 168 tests are listed in the Test Cases sheet.

## CI

`.github/workflows/test.yml` runs Vitest with coverage on push to main/master and on every PR, uploading the coverage report as an artifact.
