import { getFeatureUsageReportApiKey, getFeatureUsageReportBaseUrl } from '../config/urls';

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

/** Downloads the report and saves it via the browser; returns the file name. */
export async function downloadFeatureUsageReport(req: FeatureUsageReportRequest): Promise<string> {
  const query = new URLSearchParams({ tenant: req.tenant, from: req.from, to: req.to, format: 'xlsx' });
  if (req.userIds?.length) query.set('userIds', req.userIds.join(','));

  let res: Response;
  try {
    res = await fetch(`${getFeatureUsageReportBaseUrl()}/v1/reports/feature-usage?${query}`, {
      headers: { 'X-Api-Key': getFeatureUsageReportApiKey() },
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
