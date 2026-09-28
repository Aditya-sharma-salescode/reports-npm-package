import React, { useState } from 'react';
import { getTenantId } from '../config/auth';
import {
  FEATURE_USAGE_MAX_RANGE_DAYS,
  NotAuthenticatedError,
  downloadFeatureUsageReport,
  istToday,
} from '../services/featureUsageReportService';
import './MdmReportsFilter.css';
import './FeatureUsageReport.css';

const DAY_MS = 86_400_000;

interface FeatureUsageReportProps {
  onBack: () => void;
}

/**
 * Feature Usage Report — pick a date range (default today) and optional user
 * IDs, download the .xlsx. The tenant is `localStorage.accountId`, like every
 * other report in this package.
 */
export function FeatureUsageReport({ onBack }: FeatureUsageReportProps) {
  const tenant = getTenantId();
  const [from, setFrom] = useState(istToday);
  const [to, setTo] = useState(istToday);
  const [userIds, setUserIds] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [notAuthenticated, setNotAuthenticated] = useState(false);
  const [done, setDone] = useState('');

  const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
  const rangeError =
    !from || !to
      ? 'Select a date range.'
      : days < 1
        ? '"From" date must be on or before "To" date.'
        : days > FEATURE_USAGE_MAX_RANGE_DAYS
          ? `Date range can be at most ${FEATURE_USAGE_MAX_RANGE_DAYS} days.`
          : '';

  const download = async () => {
    if (rangeError || !tenant) return;
    setDownloading(true);
    setError('');
    setNotAuthenticated(false);
    setDone('');
    try {
      const file = await downloadFeatureUsageReport({
        tenant,
        from,
        to,
        userIds: userIds.split(/[\s,]+/).map((id) => id.trim()).filter(Boolean),
      });
      setDone(`Downloaded ${file}`);
    } catch (err) {
      setNotAuthenticated(err instanceof NotAuthenticatedError);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="sc-report-page">
      <div className="sc-report-header">
        <div className="sc-report-header-left">
          <button className="sc-back-btn" onClick={onBack} title="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div className="sc-report-title-wrap">
            <div className="sc-report-title">
              <h1>Feature Usage Report</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="sc-fu-body">
        <p className="sc-fu-desc">
          Number of times each user used each app feature per day, with devices, logins and logouts.
          Downloads as Excel for tenant <b>{tenant || '—'}</b>.
        </p>

        {!tenant && (
          <div className="sc-fu-alert error">No tenant found (localStorage accountId is empty). Sign in through the portal and reopen reports.</div>
        )}

        <div className="sc-fu-row">
          <label className="sc-fu-field">
            <span>From</span>
            <input type="date" value={from} max={to || istToday()} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="sc-fu-field">
            <span>To</span>
            <input type="date" value={to} min={from} max={istToday()} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>

        <label className="sc-fu-field sc-fu-wide">
          <span>User IDs (optional)</span>
          <input
            type="text"
            value={userIds}
            placeholder="All users — or enter IDs separated by commas, e.g. CUPS011910, CASS009257"
            onChange={(e) => setUserIds(e.target.value)}
          />
        </label>

        {rangeError && <div className="sc-fu-alert warning">{rangeError}</div>}
        {error && notAuthenticated && (
          <div className="sc-fu-alert error">
            <b>Not authenticated.</b> {error.replace(/^Not authenticated[:.]?\s*/i, '')}
          </div>
        )}
        {error && !notAuthenticated && <div className="sc-fu-alert error">{error}</div>}
        {done && <div className="sc-fu-alert success">{done}</div>}

        <div>
          <button className="sc-btn-download" onClick={download} disabled={downloading || !!rangeError || !tenant}>
            {downloading ? 'Preparing report…' : 'Download Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}
