import { hostGet } from './networkService';
import type { DistributorFeature, DistributorMeta } from './types';

const DISTRIBUTOR_HIERARCHY_ENDPOINT =
  '/users/mapped/hierarchy?filter=activeStatus%3Aactive%20and%20designation%5Bin%5D%3A%5Bsupplier%5D&size=10000';

export async function fetchDistributorMeta(): Promise<DistributorMeta> {
  const response = await hostGet(DISTRIBUTOR_HIERARCHY_ENDPOINT);
  const features: DistributorFeature[] = response.data?.features ?? [];

  // Extract unique divisions from prodauthcode (comma-separated)
  const divisionsSet = new Set<string>();
  for (const f of features) {
    if (f.prodauthcode) {
      f.prodauthcode.split(',').forEach((code: string) => {
        const trimmed = code.trim();
        if (trimmed) divisionsSet.add(trimmed);
      });
    }
  }

  // Extract unique types from extendedAttributes.distType
  const typesSet = new Set<string>();
  for (const f of features) {
    const distType = f.extendedAttributes?.distType;
    if (distType && typeof distType === 'string') {
      typesSet.add(distType);
    }
  }

  return {
    features,
    divisions: Array.from(divisionsSet).sort(),
    types: Array.from(typesSet).sort(),
  };
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
