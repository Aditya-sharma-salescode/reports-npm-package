import React, { useState, useEffect } from 'react';
import { ReportTiles } from './screens/ReportTiles';
import { MdmReportsNewFilter } from './screens/MdmReportsNewFilter';
import { fetchReportConfigs } from './services/configService';
import { setDatastreamBaseUrl } from './config/urls';
import type { newReportConfig } from './types/mdmReportsUtils';

type Screen = 'tiles' | 'filter';

interface ReportsAppProps {
  /**
   * Report card configs — pass directly OR omit to fetch from marketplace API.
   * When omitted, configs are fetched from the marketplace config endpoint
   * using the accountId (lob) from localStorage.
   */
  reportCards?: newReportConfig[];
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
export function ReportsApp({ reportCards: reportCardsProp }: ReportsAppProps) {
  const [screen, setScreen] = useState<Screen>('tiles');
  const [selectedReport, setSelectedReport] = useState<newReportConfig | null>(null);
  const [fetchedCards, setFetchedCards] = useState<newReportConfig[] | null>(null);
  const [loading, setLoading] = useState(!reportCardsProp);
  const [error, setError] = useState<string | null>(null);

  const reportCards = reportCardsProp ?? fetchedCards ?? [];

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
          Loading reports...
        </div>
      )}
      {error && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ef4444' }}>
          {error}
        </div>
      )}
      {!loading && !error && screen === 'tiles' && (
        <ReportTiles reportCards={reportCards} onSelect={handleSelectReport} />
      )}
      {screen === 'filter' && selectedReport && (
        <MdmReportsNewFilter reportConfig={selectedReport} onBack={handleBack} reportCards={reportCards} onSelectReport={handleSelectReport} />
      )}
    </div>
  );
}
