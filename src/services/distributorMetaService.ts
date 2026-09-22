import { hostGet, saleshubGet } from './networkService';
import type { DistributorFeature, DistributorMeta } from './types';

const DISTRIBUTOR_HIERARCHY_ENDPOINT =
  '/users/mapped/hierarchy?filter=activeStatus%3Aactive%20and%20designation%5Bin%5D%3A%5Bsupplier%5D&size=10000';

export async function fetchDistributorMeta(): Promise<DistributorMeta> {
  // Temporarily disabled: host API call to uat.salescode.ai
  // Returning empty meta so dependent UI renders without distributor filters.
  return { features: [], divisions: [], types: [] };

  // const response = await hostGet(DISTRIBUTOR_HIERARCHY_ENDPOINT);
  // const features: DistributorFeature[] = response.data?.features ?? [];
  //
  // // Extract unique divisions from prodauthcode (comma-separated)
  // const divisionsSet = new Set<string>();
  // for (const f of features) {
  //   if (f.prodauthcode) {
  //     f.prodauthcode.split(',').forEach((code: string) => {
  //       const trimmed = code.trim();
  //       if (trimmed) divisionsSet.add(trimmed);
  //     });
  //   }
  // }
  //
  // // Extract unique types from extendedAttributes.distType
  // const typesSet = new Set<string>();
  // for (const f of features) {
  //   const distType = f.extendedAttributes?.distType;
  //   if (distType && typeof distType === 'string') {
  //     typesSet.add(distType);
  //   }
  // }
  //
  // return {
  //   features,
  //   divisions: Array.from(divisionsSet).sort(),
  //   types: Array.from(typesSet).sort(),
  // };
}

export function filterDistributorsBySelections(
  features: DistributorFeature[],
  selectedTypes: string[],
  selectedDivisions: string[],
  allowedLoginIds?: string[]
): string[] {
  let result = features;

  if (selectedTypes.length > 0) {
    result = result.filter((f) =>
      selectedTypes.includes(f.extendedAttributes?.distType as string)
    );
  }

  if (selectedDivisions.length > 0) {
    result = result.filter((f) => {
      if (!f.prodauthcode) return false;
      const codes = f.prodauthcode.split(',').map((c: string) => c.trim());
      return selectedDivisions.some((div) => codes.includes(div));
    });
  }

  let loginIds = result.map((f) => f.loginId);

  if (allowedLoginIds && allowedLoginIds.length > 0) {
    const allowed = new Set(allowedLoginIds);
    loginIds = loginIds.filter((id) => allowed.has(id));
  }

  return loginIds;
}

// ─── New distributor filter (EMAMI-2054) ──────────────────────────────────────
// GET /distributors?limit=&offset=&active=all&basic=true
// Returns ALL distributors (not just parent DTs). Rendered as a single-select
// custom filter when the report config sets `newDistFilter: true`.

/** Alias used for the new distributor filter throughout filters/options/payloads. */
export const NEW_DIST_FILTER_ALIAS = 'distributor_code';

const NEW_DIST_PAGE_SIZE = 500;
/** Safety bound so a misbehaving/looping API can't spin forever. */
const NEW_DIST_MAX_PAGES = 40;

interface DistributorListItem {
  code?: string;
  loginId?: string;
  name?: string;
  distributorName?: string;
  [key: string]: unknown;
}

/** Picks the API value to send, preferring an explicit code over the login id. */
function toDistributorOption(item: DistributorListItem): { label: string; value: string } | null {
  const value = String(item.code ?? item.loginId ?? '').trim();
  if (!value) return null;
  const name = String(item.name ?? item.distributorName ?? '').trim();
  return { label: name ? `${name} (${value})` : value, value };
}

/**
 * Fetches all distributors for the new single-select distributor filter, paging
 * until the API returns a short page. `contains` is passed through for
 * server-side search when the dropdown's search box is used.
 */
export async function fetchNewDistributorOptions(
  contains?: string
): Promise<{ label: string; value: string }[]> {
  const options: { label: string; value: string }[] = [];
  const seen = new Set<string>();
  const query = contains?.trim();

  for (let page = 0; page < NEW_DIST_MAX_PAGES; page++) {
    const params = new URLSearchParams({
      limit: String(NEW_DIST_PAGE_SIZE),
      offset: String(page * NEW_DIST_PAGE_SIZE),
      active: 'all',
      basic: 'true',
    });
    if (query) params.set('search', query);

    const response = await saleshubGet(`/distributors?${params.toString()}`);
    const data = response.data;
    // The endpoint has been seen returning both a bare array and a wrapped
    // object, so accept either rather than assuming one shape.
    const items: DistributorListItem[] = Array.isArray(data)
      ? data
      : data?.features ?? data?.items ?? data?.data ?? [];

    for (const item of items) {
      const opt = toDistributorOption(item);
      if (opt && !seen.has(opt.value)) {
        seen.add(opt.value);
        options.push(opt);
      }
    }

    if (items.length < NEW_DIST_PAGE_SIZE) break;
  }

  return options;
}
