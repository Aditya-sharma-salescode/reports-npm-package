import React from 'react';
import type { newReportConfig } from '../types/mdmReportsUtils';

interface ReportTilesProps {
  reportCards: newReportConfig[];
  onSelect: (config: newReportConfig) => void;
}

export function ReportTiles({ reportCards, onSelect }: ReportTilesProps) {
  // Group cards by type
  const groups = reportCards.reduce<Record<string, newReportConfig[]>>((acc, card) => {
    const type = (card as newReportConfig & { type?: string }).type || 'Reports';
    if (!acc[type]) acc[type] = [];
    acc[type].push(card);
    return acc;
  }, {});

  return (
    <div style={{ padding: '24px' }}>
      {Object.entries(groups).map(([type, cards]) => (
        <div key={type} style={{ marginBottom: 36 }}>
          <h2 style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#1f2937',
            marginBottom: 16,
            paddingBottom: 8,
            borderBottom: '2px solid #e5e7eb',
          }}>
            {type}
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}>
            {cards.map((card) => (
              <ReportCard key={card.id} config={card} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}

      {reportCards.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No reports available</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            Pass reportCards config to ReportsApp to see reports here.
          </div>
        </div>
      )}
    </div>
  );
}

interface ReportCardProps {
  config: newReportConfig;
  onSelect: (config: newReportConfig) => void;
}

function ReportCard({ config, onSelect }: ReportCardProps) {
  return (
    <div
      onClick={() => onSelect(config)}
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '20px',
        cursor: 'pointer',
        transition: 'all 0.18s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#6366f1';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(99,102,241,0.12)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e7eb';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Top accent */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 3,
        background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
        borderRadius: '12px 12px 0 0',
      }} />

      {/* Icon */}
      <div style={{
        width: 40, height: 40,
        background: '#eef2ff',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        marginBottom: 14,
      }}>
        📄
      </div>

      <h3 style={{
        fontSize: 14,
        fontWeight: 700,
        color: '#1f2937',
        margin: '0 0 8px 0',
        lineHeight: 1.4,
      }}>
        {config.name}
      </h3>
      <p style={{
        fontSize: 12,
        color: '#6b7280',
        margin: 0,
        lineHeight: 1.5,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {config.description}
      </p>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
        {config.isLiveReport && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 8px',
            background: '#dcfce7', color: '#15803d', borderRadius: 10,
          }}>
            LIVE
          </span>
        )}
        {config.isPDFReport && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 8px',
            background: '#fee2e2', color: '#b91c1c', borderRadius: 10,
          }}>
            PDF
          </span>
        )}
        {config.isGSTRReport && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 8px',
            background: '#fef9c3', color: '#854d0e', borderRadius: 10,
          }}>
            GSTR
          </span>
        )}
      </div>
    </div>
  );
}
