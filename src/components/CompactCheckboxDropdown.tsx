import React, { useState, useRef, useEffect, useCallback } from 'react';
import './CompactCheckboxDropdown.css';

export interface DropdownOption {
  label: string;
  value: string;
}

interface CompactCheckboxDropdownProps {
  label: string;
  options: DropdownOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  loading?: boolean;
  searchable?: boolean;
  placeholder?: string;
  maxSelected?: number;
  disabled?: boolean;
}

export function CompactCheckboxDropdown({
  label,
  options,
  selected,
  onChange,
  loading = false,
  searchable = true,
  placeholder,
  maxSelected,
  disabled = false,
}: CompactCheckboxDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggle = useCallback(
    (value: string) => {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value));
      } else {
        if (maxSelected && selected.length >= maxSelected) return;
        onChange([...selected, value]);
      }
    },
    [selected, onChange, maxSelected]
  );

  const triggerLabel =
    selected.length === 0
      ? placeholder ?? `Select ${label}`
      : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
      : `${selected.length} selected`;

  return (
    <div className="sc-ccd-wrapper" ref={wrapperRef}>
      <div
        className={`sc-ccd-trigger${open ? ' open' : ''}${disabled ? ' disabled' : ''}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
        aria-label={label}
      >
        <span className={`sc-ccd-label${selected.length === 0 ? ' placeholder' : ''}`}>
          {triggerLabel}
        </span>
        {selected.length > 0 && (
          <span className="sc-ccd-badge">{selected.length}</span>
        )}
        <span className={`sc-ccd-chevron${open ? ' open' : ''}`}>▾</span>
      </div>

      {open && (
        <div className="sc-ccd-dropdown">
          {searchable && (
            <div className="sc-ccd-search">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          )}
          <div className="sc-ccd-options">
            {loading ? (
              <div className="sc-ccd-loading">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="sc-ccd-empty">No options</div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={opt.value}
                  className={`sc-ccd-option${selected.includes(opt.value) ? ' selected' : ''}`}
                  onClick={() => toggle(opt.value)}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span>{opt.label}</span>
                </div>
              ))
            )}
          </div>
          <div className="sc-ccd-footer">
            <button onClick={() => onChange([])}>Clear</button>
            <button className="primary" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
