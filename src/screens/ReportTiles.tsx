import { useState } from 'react';
import type { newReportConfig } from '../types/mdmReportsUtils';
import './ReportTiles.css';

interface ReportTilesProps {
  reportCards: newReportConfig[];
  onSelect: (config: newReportConfig) => void;
}

export function ReportTiles({ reportCards, onSelect }: ReportTilesProps) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? reportCards.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.description || '').toLowerCase().includes(search.toLowerCase())
      )
    : reportCards;

  // Group by type
  const groups = filtered.reduce<Record<string, newReportConfig[]>>((acc, card) => {
    const type = card.type || 'Reports';
    if (!acc[type]) acc[type] = [];
    acc[type].push(card);
    return acc;
  }, {});

  return (
    <div className="sc-tiles-page">
      {/* Header bar */}
      <div className="sc-tiles-header">
        <div className="sc-tiles-header-left">
          <h1 className="sc-tiles-title">Reports</h1>
          <span className="sc-tiles-count">{reportCards.length} reports</span>
        </div>
        <div className="sc-tiles-header-right">
          <div className="sc-tiles-search-wrap">
            <span className="sc-tiles-search-icon">🔍</span>
            <input
              className="sc-tiles-search"
              type="text"
              placeholder="Search reports..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <span className="sc-tiles-search-clear" onClick={() => setSearch('')}>×</span>
            )}
          </div>
        </div>
      </div>

      {/* Groups */}
      <div className="sc-tiles-body">
        {filtered.length === 0 ? (
          <div className="sc-tiles-empty">
            <div className="sc-tiles-empty-icon">🔍</div>
            <div className="sc-tiles-empty-title">No reports found</div>
            <div className="sc-tiles-empty-sub">Try a different search term</div>
          </div>
        ) : (
          Object.entries(groups).map(([type, cards]) => (
            <div key={type} className="sc-tiles-group">
              <div className="sc-tiles-group-header">
                <span className="sc-tiles-group-title">{type}</span>
                <span className="sc-tiles-group-count">{cards.length}</span>
              </div>
              <div className="sc-tiles-grid">
                {cards.map((card) => (
                  <ReportCard key={card.id} config={card} onSelect={onSelect} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface ReportCardProps {
  config: newReportConfig;
  onSelect: (config: newReportConfig) => void;
}

function ReportCard({ config, onSelect }: ReportCardProps) {
  const hasPreview = !config.isLiveReport && !config.isPDFReport && !config.isGSTRReport && !config.customDownload;

  return (
    <div className="sc-report-card" onClick={() => onSelect(config)}>
      {/* Top accent stripe */}
      <div className="sc-card-accent" />

      {/* Icon */}
      <div className="sc-card-icon">📄</div>

      {/* Name */}
      <h3 className="sc-card-name">{config.name}</h3>

      {/* Description */}
      {config.description && (
        <p className="sc-card-desc">{config.description}</p>
      )}

      {/* Footer: tags + arrow */}
      <div className="sc-card-footer">
        <div className="sc-card-tags">
          {config.isLiveReport && <span className="sc-tag sc-tag-live">LIVE</span>}
          {config.isPDFReport && <span className="sc-tag sc-tag-pdf">PDF</span>}
          {config.isGSTRReport && <span className="sc-tag sc-tag-gstr">GSTR</span>}
          {hasPreview && <span className="sc-tag sc-tag-preview">Preview</span>}
        </div>
        <span className="sc-card-arrow">→</span>
      </div>
    </div>
  );
}
