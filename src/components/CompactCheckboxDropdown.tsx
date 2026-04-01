import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './CompactCheckboxDropdown.css';

export interface DropdownOption {
  label: string;
  value: string;
}

interface CompactCheckboxDropdownProps {
  label: string | React.ReactNode;
  options: DropdownOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  onOpen?: () => void;
  onClose?: () => void;
  loading?: boolean;
  searchable?: boolean;
  placeholder?: string;
  maxSelected?: number;
  disabled?: boolean;
  selectAllLabel?: string;
  multiSelect?: boolean;
  width?: number | string;
  dropdownWidth?: number | string;
  searchText?: string;
  onSearchChange?: (value: string) => void;
}

export function CompactCheckboxDropdown({
  label,
  options,
  selected,
  onChange,
  onOpen,
  onClose,
  loading = false,
  searchable = true,
  placeholder,
  maxSelected,
  disabled = false,
  selectAllLabel,
  multiSelect = true,
  width,
  dropdownWidth,
  searchText,
  onSearchChange,
}: CompactCheckboxDropdownProps) {
  const [open, setOpen] = useState(false);
  const [internalSearch, setInternalSearch] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  const isSearchControlled = typeof searchText === 'string';
  const effectiveSearch = isSearchControlled ? searchText : internalSearch;

  const hasSelections = selected.length > 0;

  // Position the dropdown
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dw = dropdownWidth
      ? (typeof dropdownWidth === 'number' ? dropdownWidth : parseFloat(dropdownWidth as string) || rect.width)
      : (width ? (typeof width === 'number' ? width : parseFloat(width as string) || rect.width) : rect.width);
    setDropdownPos({
      top: rect.bottom + 4 + window.scrollY,
      left: rect.left + window.scrollX,
      width: Math.max(dw, 220),
    });
  }, [dropdownWidth, width]);

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [open, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleOpen() {
    if (disabled) return;
    setOpen(true);
    onOpen?.();
  }

  function handleClose() {
    setOpen(false);
    if (!isSearchControlled) setInternalSearch('');
    onSearchChange?.('');
    onClose?.();
  }

  function handleToggle(value: string) {
    if (multiSelect) {
      const next = selected.includes(value)
        ? selected.filter(v => v !== value)
        : (maxSelected && selected.length >= maxSelected ? selected : [...selected, value]);
      onChange(next);
    } else {
      onChange(selected.includes(value) ? [] : [value]);
      setTimeout(handleClose, 100);
    }
  }

  function handleSelectAll() {
    const allValues = options.map(o => o.value);
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange(allValues);
    }
  }

  function handleSearchInput(value: string) {
    if (!isSearchControlled) setInternalSearch(value);
    onSearchChange?.(value);
  }

  const filtered = effectiveSearch
    ? options.filter(o => o.label.toLowerCase().includes(effectiveSearch.toLowerCase()))
    : options;

  const isAllSelected = options.length > 0 && options.every(o => selected.includes(o.value));

  const displayText = () => {
    if (selected.length === 0) return null;
    if (multiSelect) return `${selected.length} selected`;
    const opt = options.find(o => o.value === selected[0]);
    return opt?.label || selected[0];
  };

  const triggerStyle = width !== undefined
    ? { width: typeof width === 'number' ? `${width}px` : width }
    : undefined;

  return (
    <>
      <div
        ref={triggerRef}
        className={`compact-dropdown-trigger${disabled ? ' disabled' : ''}${hasSelections ? ' has-selections' : ''}${open ? ' open' : ''}`}
        onClick={() => open ? handleClose() : handleOpen()}
        style={triggerStyle}
      >
        {hasSelections && (
          <span className="compact-dropdown-floating-label">{label}</span>
        )}
        <div className="compact-dropdown-label-wrapper">
          {!hasSelections && (
            <span className="compact-dropdown-label">{label}</span>
          )}
          <div className="compact-dropdown-value-display">
            {hasSelections ? (
              <span className="compact-dropdown-selected">{displayText()}</span>
            ) : (
              <span className="compact-dropdown-placeholder"></span>
            )}
          </div>
        </div>
        <div className="compact-dropdown-arrow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {open
              ? <polyline points="18 15 12 9 6 15" />
              : <polyline points="6 9 12 15 18 9" />
            }
          </svg>
        </div>
      </div>

      {open && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          className="compact-dropdown-portal"
          style={{
            position: 'absolute',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 1300,
          }}
        >
          <div className="compact-dropdown-paper">
            <div className="compact-dropdown-container">
              {searchable && (
                <div className="compact-dropdown-search">
                  <svg className="compact-dropdown-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    className="compact-dropdown-search-input"
                    placeholder="Search..."
                    value={effectiveSearch}
                    onChange={e => handleSearchInput(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
              {selectAllLabel && multiSelect && options.length > 0 && !effectiveSearch && (
                <div className="compact-dropdown-select-all" onClick={handleSelectAll}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    readOnly
                    className="compact-dropdown-checkbox"
                  />
                  <span>{selectAllLabel}</span>
                </div>
              )}
              <div className="compact-dropdown-options">
                {loading ? (
                  <div className="compact-dropdown-loading">
                    <div className="compact-dropdown-spinner" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="compact-dropdown-empty">No options found</div>
                ) : (
                  filtered.map(opt => (
                    <div
                      key={opt.value}
                      className="compact-dropdown-option"
                      onClick={() => handleToggle(opt.value)}
                    >
                      {multiSelect ? (
                        <input
                          type="checkbox"
                          checked={selected.includes(opt.value)}
                          readOnly
                          className="compact-dropdown-checkbox"
                        />
                      ) : (
                        <input
                          type="radio"
                          checked={selected.includes(opt.value)}
                          readOnly
                          className="compact-dropdown-radio"
                        />
                      )}
                      <span className="compact-dropdown-option-label">{opt.label}</span>
                    </div>
                  ))
                )}
              </div>
              {multiSelect && selected.length > 0 && (
                <div className="compact-dropdown-footer">
                  {selected.length} item{selected.length !== 1 ? 's' : ''} selected
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
