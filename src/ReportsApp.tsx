import React, { useState, useEffect } from 'react';
import { ReportTiles } from './screens/ReportTiles';
import { MdmReportsNewFilter } from './screens/MdmReportsNewFilter';
import { fetchReportConfigs } from './services/configService';
import { setDatastreamBaseUrl, setHostBaseUrl, setReportBaseUrl } from './config/urls';
import type { newReportConfig } from './types/mdmReportsUtils';

type Screen = 'tiles' | 'filter';

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
export function ReportsApp({ reportCards: reportCardsProp, datastreamBaseUrl, hostBaseUrl, reportBaseUrl, showHeader = true }: ReportsAppProps) {
  const [screen, setScreen] = useState<Screen>('tiles');
  const [selectedReport, setSelectedReport] = useState<newReportConfig | null>(null);
  const [fetchedCards, setFetchedCards] = useState<newReportConfig[] | null>(null);
  const [loading, setLoading] = useState(!reportCardsProp);
  const [error, setError] = useState<string | null>(null);

  const reportCards = reportCardsProp ?? fetchedCards ?? [];

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
        setError(cards.length === 0 ? 'No report configurations found.' : null);
      })
      .catch(() => setError('Failed to load report configurations.'))
      .finally(() => setLoading(false));
  }, [reportCardsProp]);

  function handleSelectReport(config: newReportConfig) {
    // Set datastream base URL from report's getAPI field
    setDatastreamBaseUrl(config.getAPI || null);
    setSelectedReport(config);
    setScreen('filter');
  }

  function handleBack() {
    setDatastreamBaseUrl(null);
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
      {screen === 'filter' && selectedReport && (
        <MdmReportsNewFilter reportConfig={selectedReport} onBack={handleBack} reportCards={reportCards} onSelectReport={handleSelectReport} />
      )}
    </div>
  );
}
