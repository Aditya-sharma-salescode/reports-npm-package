import React, { useState, useEffect } from 'react';
import { ReportTiles } from './screens/ReportTiles';
import { MdmReportsNewFilter } from './screens/MdmReportsNewFilter';
import { FeatureUsageReport } from './screens/FeatureUsageReport';
import { fetchReportConfigs } from './services/configService';
import { setDatastreamBaseUrl, setFeatureUsageReportBaseUrl, setHostBaseUrl, setReportBaseUrl } from './config/urls';
import { setParentTenantId } from './config/auth';
import type { newReportConfig } from './types/mdmReportsUtils';

type Screen = 'tiles' | 'filter' | 'featureUsage';

/** Id of the Feature Usage Report tile inside the app. */
export const FEATURE_USAGE_REPORT_ID = '__feature_usage_report__';

/**
 * `reportName` that turns the Feature Usage Report on for a tenant. Add an
 * entry with it to the tenant's report config (marketplace clientconfig →
 * distributor_report_configuration); its name / type / description are used
 * for the tile, and absent fields fall back to FEATURE_USAGE_CARD. No entry →
 * no tile.
 *
 *   { "id": "feature_usage_report", "reportName": "feature_usage_report",
 *     "name": "Feature Usage Report", "type": "App Usage" }
 */
export const FEATURE_USAGE_REPORT_NAME = 'feature_usage_report';

const isFeatureUsageConfig = (c: newReportConfig) =>
  c.reportName === FEATURE_USAGE_REPORT_NAME || c.id === FEATURE_USAGE_REPORT_NAME;

/**
 * Defaults for the Feature Usage Report tile. It opens its own screen and
 * downloads from the Tracebit report API, so only `id`/`name`/`type`/
 * `description` are used — the datastream fields are unused placeholders.
 */
const FEATURE_USAGE_CARD: newReportConfig = {
  id: FEATURE_USAGE_REPORT_ID,
  name: 'Feature Usage Report',
  type: 'App Usage',
  description: 'User-wise daily count of app feature usage, devices, logins and logouts.',
  getAPI: '',
  reportName: FEATURE_USAGE_REPORT_NAME,
  templateUrl: '',
  isDistributorView: false,
};

interface ReportsAppProps {
  /**
   * Report card configs — pass directly OR omit to fetch from marketplace API.
   * When omitted, configs are fetched from the marketplace config endpoint
   * using the accountId (lob) from localStorage.
   */
  reportCards?: newReportConfig[];
  /** Override datastream base URL (filters, report data, downloads). Falls back to env-derived URL. */
  datastreamBaseUrl?: string;
  /** Override host base URL (task-based downloads: PDF/GSTR/Custom). Falls back to env-derived URL. */
  hostBaseUrl?: string;
  /** Override report service base URL (file downloads by key). Falls back to env-derived URL. */
  reportBaseUrl?: string;
  /** Hide the Reports title/count/search header bar. Defaults to true. */
  showHeader?: boolean;
  /**
   * Feature Usage Report tile. Unset (default): shown only when the report
   * config has a `feature_usage_report` entry. `true` / `false` force it on /
   * off regardless of config.
   */
  showFeatureUsageReport?: boolean;
  /** Override the Feature Usage Report API base URL. Defaults to the Tracebit dev API. */
  featureUsageReportBaseUrl?: string;
}

/**
 * ReportsApp — root component of the @salescode/reports-ui package.
 *
 * Usage:
 *   <ReportsApp reportCards={reportCards} />   // pass configs directly
 *   <ReportsApp />                              // fetch from marketplace API
 *
 * Prerequisites (set in localStorage before rendering):
 *   localStorage.authToken    — JWT access token
 *   localStorage.accountId   — Tenant ID (used for env detection + marketplace lob)
 *   localStorage.authContext  — JSON: { user: { loginId, email } }
 */
export function ReportsApp({
  reportCards: reportCardsProp,
  datastreamBaseUrl,
  hostBaseUrl,
  reportBaseUrl,
  showHeader = true,
  showFeatureUsageReport,
  featureUsageReportBaseUrl,
}: ReportsAppProps) {
  const [screen, setScreen] = useState<Screen>('tiles');
  const [selectedReport, setSelectedReport] = useState<newReportConfig | null>(null);
  const [fetchedCards, setFetchedCards] = useState<newReportConfig[] | null>(null);
  const [loading, setLoading] = useState(!reportCardsProp);
  const [error, setError] = useState<string | null>(null);

  // The Feature Usage entry in config is ON/OFF for the tile; everything else
  // is a normal datastream report.
  const configuredCards = reportCardsProp ?? fetchedCards ?? [];
  const featureUsageConfig = configuredCards.find(isFeatureUsageConfig);
  const otherCards = configuredCards.filter((c) => !isFeatureUsageConfig(c));
  const featureUsageOn = showFeatureUsageReport ?? !!featureUsageConfig;
  const reportCards = featureUsageOn
    ? [...otherCards, { ...FEATURE_USAGE_CARD, ...featureUsageConfig, id: FEATURE_USAGE_REPORT_ID }]
    : otherCards;

  useEffect(() => {
    setFeatureUsageReportBaseUrl(featureUsageReportBaseUrl ?? null);
    return () => setFeatureUsageReportBaseUrl(null);
  }, [featureUsageReportBaseUrl]);

  // Apply base URL overrides from props; clear on unmount
  useEffect(() => {
    if (datastreamBaseUrl) setDatastreamBaseUrl(datastreamBaseUrl);
    if (hostBaseUrl) setHostBaseUrl(hostBaseUrl);
    if (reportBaseUrl) setReportBaseUrl(reportBaseUrl);

    return () => {
      if (datastreamBaseUrl) setDatastreamBaseUrl(null);
      if (hostBaseUrl) setHostBaseUrl(null);
      if (reportBaseUrl) setReportBaseUrl(null);
    };
  }, [datastreamBaseUrl, hostBaseUrl, reportBaseUrl]);

  // Fetch configs from marketplace API when not passed as prop
  useEffect(() => {
    if (reportCardsProp) return;
    setLoading(true);
    fetchReportConfigs()
      .then(cards => {
        setFetchedCards(cards);
        // A forced-on Feature Usage tile still has something to show.
        setError(cards.length === 0 && showFeatureUsageReport !== true ? 'No report configurations found.' : null);
      })
      .catch((err) => {
        if (showFeatureUsageReport === true) {
          console.warn('[reports-ui] failed to load report configurations', err);
          setFetchedCards([]);
        } else {
          setError('Failed to load report configurations.');
        }
      })
      .finally(() => setLoading(false));
  }, [reportCardsProp, showFeatureUsageReport]);

  function handleSelectReport(config: newReportConfig) {
    if (config.id === FEATURE_USAGE_REPORT_ID) {
      setSelectedReport(config);
      setScreen('featureUsage');
      return;
    }
    setDatastreamBaseUrl(config.getAPI || datastreamBaseUrl || null);
    // Config-driven x-parent-tenant-id header for this report's requests.
    setParentTenantId(config.sendParentHeader ? config.parentHeaderValue : '');
    setSelectedReport(config);
    setScreen('filter');
  }

  function handleBack() {
    setDatastreamBaseUrl(datastreamBaseUrl || null);
    setParentTenantId('');
    setScreen('tiles');
    setSelectedReport(null);
  }

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      height: '100vh',
      width: '100%',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
          Loading your reports...
        </div>
      )}
      {error && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ef4444' }}>
          {error}
        </div>
      )}
      {!loading && !error && screen === 'tiles' && (
        <ReportTiles reportCards={reportCards} onSelect={handleSelectReport} showHeader={showHeader} />
      )}
      {screen === 'featureUsage' && <FeatureUsageReport onBack={handleBack} />}
      {screen === 'filter' && selectedReport && (
        <MdmReportsNewFilter reportConfig={selectedReport} onBack={handleBack} reportCards={reportCards} onSelectReport={handleSelectReport} />
      )}
    </div>
  );
}
