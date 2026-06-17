import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { newReportConfig } from '../types/mdmReportsUtils';
import './ReportTiles.css';

interface ReportTilesProps {
  reportCards: newReportConfig[];
  onSelect: (config: newReportConfig) => void;
  showHeader?: boolean;
}

const FAVS_STORAGE_KEY = 'sc-report-favourites';

function loadFavs(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVS_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveFavs(favs: Set<string>) {
  try {
    localStorage.setItem(FAVS_STORAGE_KEY, JSON.stringify([...favs]));
  } catch {
    /* ignore storage errors */
  }
}

export function ReportTiles({ reportCards, onSelect, showHeader = true }: ReportTilesProps) {
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [favSet, setFavSet] = useState<Set<string>>(loadFavs);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Refs + previous rects power the FLIP move animation when a card jumps
  // between its group and the Favourites section.
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const prevRects = useRef<Record<string, DOMRect> | null>(null);

  const toggleFav = (id: string) => {
    const m: Record<string, DOMRect> = {};
    Object.keys(cardRefs.current).forEach((k) => {
      const el = cardRefs.current[k];
      if (el && el.isConnected) m[k] = el.getBoundingClientRect();
    });
    prevRects.current = m;

    setFavSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavs(next);
      return next;
    });
  };

  useLayoutEffect(() => {
    const prev = prevRects.current;
    if (!prev) return;
    prevRects.current = null;
    Object.keys(cardRefs.current).forEach((k) => {
      const el = cardRefs.current[k];
      if (!el || !el.isConnected || !prev[k]) return;
      const now = el.getBoundingClientRect();
      const dx = prev[k].left - now.left;
      const dy = prev[k].top - now.top;
      if (!dx && !dy) return;
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.transform = '';
      });
    });
  });

  const ql = q.trim().toLowerCase();
  const matches = (c: newReportConfig) =>
    !ql ||
    c.name.toLowerCase().includes(ql) ||
    (c.description || '').toLowerCase().includes(ql);

  const favs = reportCards.filter((c) => favSet.has(c.id) && matches(c));

  // Group the non-favourite, matching cards by type, preserving first-seen order.
  const groupOrder: string[] = [];
  const groups: Record<string, newReportConfig[]> = {};
  reportCards.forEach((c) => {
    if (favSet.has(c.id) || !matches(c)) return;
    const type = c.type || 'Reports';
    if (!groups[type]) {
      groups[type] = [];
      groupOrder.push(type);
    }
    groups[type].push(c);
  });

  const empty = favs.length === 0 && groupOrder.length === 0;
  const setRef = (id: string) => (el: HTMLDivElement | null) => {
    cardRefs.current[id] = el;
  };

  return (
    <div className="sc-tiles-page">
      <div className="sc-tiles-inner">
        {showHeader && (
          <div className="sc-tiles-header">
            <h2 className="sc-tiles-title">Reports</h2>
            {searchOpen ? (
              <div className="sc-search-box">
                <SearchIcon className="sc-search-box-icon" />
                <input
                  ref={searchInputRef}
                  className="sc-search-input"
                  type="text"
                  value={q}
                  placeholder="Search reports…"
                  onChange={(e) => setQ(e.target.value)}
                  onBlur={() => {
                    if (!q.trim()) setSearchOpen(false);
                  }}
                />
                {q && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    className="sc-search-clear"
                    onClick={() => {
                      setQ('');
                      searchInputRef.current?.focus();
                    }}
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                aria-label="Search reports"
                className="sc-search-toggle"
                onClick={() => {
                  setSearchOpen(true);
                  requestAnimationFrame(() => searchInputRef.current?.focus());
                }}
              >
                <SearchIcon />
              </button>
            )}
          </div>
        )}

        {favs.length > 0 && (
          <>
            <div className="sc-section-label">FAVOURITES</div>
            <div className="sc-card-grid">
              {favs.map((c) => (
                <ReportCard
                  key={c.id}
                  config={c}
                  isFav
                  onToggleFav={toggleFav}
                  onSelect={onSelect}
                  cardRef={setRef(c.id)}
                />
              ))}
            </div>
          </>
        )}

        {groupOrder.map((type) => (
          <div key={type}>
            <div className="sc-section-label">{type.toUpperCase()}</div>
            <div className="sc-card-grid">
              {groups[type].map((c) => (
                <ReportCard
                  key={c.id}
                  config={c}
                  isFav={false}
                  onToggleFav={toggleFav}
                  onSelect={onSelect}
                  cardRef={setRef(c.id)}
                />
              ))}
            </div>
          </div>
        ))}

        {empty && (
          <div className="sc-empty">
            <FileSearchIcon className="sc-empty-icon" />
            <div className="sc-empty-text">
              {ql ? `No reports match “${q}”.` : 'No reports available.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ReportCardProps {
  config: newReportConfig;
  isFav: boolean;
  onToggleFav: (id: string) => void;
  onSelect: (config: newReportConfig) => void;
  cardRef: (el: HTMLDivElement | null) => void;
}

function ReportCard({ config, isFav, onToggleFav, onSelect, cardRef }: ReportCardProps) {
  return (
    <div
      ref={cardRef}
      className={`sc-card${isFav ? ' sc-card-is-fav' : ''}`}
      onClick={() => onSelect(config)}
    >
      <span className="sc-card-chip">
        <ReportGlyph name={config.name} />
      </span>

      <span className="sc-card-label">{config.name}</span>

      <div className="sc-card-badges">
        {config.isLiveReport && <span className="sc-badge sc-badge-live">LIVE</span>}
        {config.isPDFReport && <span className="sc-badge sc-badge-pdf">PDF</span>}
        {config.isGSTRReport && <span className="sc-badge sc-badge-gstr">GSTR</span>}
      </div>

      <div className="sc-card-actions">
        <button
          type="button"
          aria-label={isFav ? `Remove ${config.name} from favourites` : `Add ${config.name} to favourites`}
          className={`sc-card-star${isFav ? ' is-fav' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav(config.id);
          }}
        >
          <StarIcon filled={isFav} />
        </button>
        <button
          type="button"
          aria-label={`Open ${config.name}`}
          className="sc-card-download"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(config);
          }}
        >
          <DownloadIcon />
        </button>
      </div>
    </div>
  );
}

/* ─── Inline icons (dependency-free) ──────────────────────────────────────────── */

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function FileSearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="34" height="34" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M11.5 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v3.5" />
      <circle cx="16.5" cy="17.5" r="2.5" />
      <line x1="18.5" y1="19.5" x2="21" y2="22" />
    </svg>
  );
}

/* Chip glyph — picks a simple icon from the report name, defaults to a document. */
function ReportGlyph({ name }: { name: string }) {
  const n = name.toLowerCase();
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const wrap = (children: ReactNode) => (
    <svg width="21" height="21" viewBox="0 0 24 24" {...stroke}>{children}</svg>
  );

  if (n.includes('order') || n.includes('cart'))
    return wrap(<><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></>);
  if (n.includes('user'))
    return wrap(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>);
  if (n.includes('outlet') || n.includes('store'))
    return wrap(<><path d="M3 9l1-5h16l1 5" /><path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" /><path d="M9 21v-6h6v6" /></>);
  if (n.includes('product'))
    return wrap(<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>);
  if (n.includes('visit') || n.includes('pjp') || n.includes('route'))
    return wrap(<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>);
  if (n.includes('attendance') || n.includes('compliance'))
    return wrap(<><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>);
  if (n.includes('notification'))
    return wrap(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>);
  if (n.includes('attendance') || n.includes('survey') || n.includes('cooler'))
    return wrap(<><rect x="6" y="2" width="12" height="20" rx="2" /><line x1="9" y1="6" x2="15" y2="6" /></>);

  // default: document
  return wrap(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></>);
}
