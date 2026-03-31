import React, { useState } from 'react';
import { ReportTiles } from './screens/ReportTiles';
import { MdmReportsNewFilter } from './screens/MdmReportsNewFilter';
import type { newReportConfig } from './types/mdmReportsUtils';

type Screen = 'tiles' | 'filter';

interface ReportsAppProps {
  /** Array of report card configs — the only required prop */
  reportCards: newReportConfig[];
}

/**
 * ReportsApp — the root component of the @salescode/reports-ui package.
 *
 * The host app simply renders:
 *   <ReportsApp reportCards={reportCards} />
 *
 * Prerequisites (set before rendering):
 *   localStorage.authToken    — JWT access token
 *   localStorage.accountId   — Tenant ID (also used to detect env)
 *   localStorage.authContext  — JSON: { user: { loginId, email } }
 */
export function ReportsApp({ reportCards }: ReportsAppProps) {
  const [screen, setScreen] = useState<Screen>('tiles');
  const [selectedReport, setSelectedReport] = useState<newReportConfig | null>(null);

  function handleSelectReport(config: newReportConfig) {
    setSelectedReport(config);
    setScreen('filter');
  }

  function handleBack() {
    setScreen('tiles');
    setSelectedReport(null);
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {screen === 'tiles' && (
        <ReportTiles reportCards={reportCards} onSelect={handleSelectReport} />
      )}
      {screen === 'filter' && selectedReport && (
        <MdmReportsNewFilter reportConfig={selectedReport} onBack={handleBack} />
      )}
    </div>
  );
}
