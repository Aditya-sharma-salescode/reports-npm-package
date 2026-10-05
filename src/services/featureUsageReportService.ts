import { getAccessToken, getTenantId } from '../config/auth';
import { getBuildEnv, getFeatureUsageReportApiKey, getFeatureUsageReportBaseUrl } from '../config/urls';

/**
 * Feature Usage Report download from the Tracebit report API
 * (salescode-monitor-api `GET /v1/reports/feature-usage`): one row per user per
 * day with devices, feature taps, logins and logouts, as .xlsx.
 */

export interface FeatureUsageReportRequest {
  tenant: string;
  /** IST dates, "YYYY-MM-DD", inclusive. */
  from: string;
  to: string;
  /** Optional exact user IDs. */
  userIds?: string[];
}

/** Max days one request may cover (enforced by the API too). */
export const FEATURE_USAGE_MAX_RANGE_DAYS = 31;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today's date in IST as "YYYY-MM-DD". */
export function istToday(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Thrown when the SalesHub session is missing, invalid or expired (HTTP 401). */
export class NotAuthenticatedError extends Error {
  constructor(message = 'Not authenticated. Please sign in again.') {
    super(message);
    this.name = 'NotAuthenticatedError';
  }
}

/**
 * Downloads the report and saves it via the browser; returns the file name.
 *
 * Authenticated with the API key plus the user's SalesHub session: the token
 * (`localStorage.authToken`), the tenant as `lob` (`localStorage.accountId`)
 * and the build's SalesHub environment. The API validates the token with
 * SalesHub `/auth/me` and limits the report to the token's tenant.
 */
export async function downloadFeatureUsageReport(req: FeatureUsageReportRequest): Promise<string> {
  const token = getAccessToken().replace(/^Bearer\s+/i, '').trim();
  // No early "not signed in" here: when the portal's SALESHUB_TOKEN cookie is
  // HttpOnly the token can't be read, but the browser still sends the cookie
  // (credentials: 'include') and the API validates it. The API is the check.

  const query = new URLSearchParams({ tenant: req.tenant, from: req.from, to: req.to, format: 'xlsx' });
  if (req.userIds?.length) query.set('userIds', req.userIds.join(','));

  let res: Response;
  try {
    res = await fetch(`${getFeatureUsageReportBaseUrl()}/v1/reports/feature-usage?${query}`, {
      // Send the portal's cookies (SALESHUB_TOKEN / ACCOUNT_ID) — same as the
      // package's other downloads; they reach the API on *.salescodeai.com.
      credentials: 'include',
      headers: {
        'X-Api-Key': getFeatureUsageReportApiKey(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        lob: getTenantId() || req.tenant,
        'x-saleshub-env': getBuildEnv(),
      },
    });
  } catch {
    throw new Error('Could not reach the report service. Check your connection and try again.');
  }

  if (!res.ok) {
    let message = `Report download failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* non-JSON error body — keep the status message */
    }
    if (res.status === 401) throw new NotAuthenticatedError(message);
    throw new Error(message);
  }

  const blob = await res.blob();
  const filename =
    res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ??
    `Feature_Usage_Report_${req.tenant}_${req.from}_to_${req.to}.xlsx`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}
