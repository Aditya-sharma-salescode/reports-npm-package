import React, { useState, useRef, useEffect } from 'react';
import './HierarchyDropdown.css';

interface HierarchyDropdownProps {
  label: string;
  summaryText?: string;
  isActive?: boolean;
  onReset?: () => void;
  children: React.ReactNode;
  onApply?: () => void;
}

export function HierarchyDropdown({
  label,
  summaryText,
  isActive = false,
  onReset,
  children,
  onApply,
}: HierarchyDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="sc-hierarchy-dropdown" ref={wrapperRef}>
      <div
        className={`sc-hierarchy-trigger${isActive ? ' active' : ''}${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
      >
        <span>{summaryText || label}</span>
        <span style={{ fontSize: 10 }}>▾</span>
      </div>

      {open && (
        <div className="sc-hierarchy-panel">
          <div className="sc-hierarchy-panel-header">
            <span>{label}</span>
            <span
              className="sc-hierarchy-panel-close"
              onClick={() => setOpen(false)}
              role="button"
              aria-label="Close"
            >
              ✕
            </span>
          </div>
          <div className="sc-hierarchy-panel-body">{children}</div>
          <div className="sc-hierarchy-panel-footer">
            {onReset && (
              <button
                className="sc-hierarchy-btn"
                onClick={() => {
                  onReset();
                  setOpen(false);
                }}
              >
                Reset
              </button>
            )}
            {onApply && (
              <button
                className="sc-hierarchy-btn primary"
                onClick={() => {
                  onApply();
                  setOpen(false);
                }}
              >
                Apply
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
