import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './HierarchyDropdown.css';

interface HierarchyDropdownProps {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
  width?: number;
}

export function HierarchyDropdown({
  label,
  children,
  disabled = false,
  isLoading = false,
  width = 360,
}: HierarchyDropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 8 + window.scrollY,
      left: rect.left + window.scrollX,
    });
  }, []);

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

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  function handleToggle() {
    if (disabled) return;
    setOpen(v => !v);
  }

  return (
    <>
      <button
        ref={triggerRef}
        className={`hierarchy-dropdown-trigger${disabled ? ' is-disabled' : ''}${open ? ' is-open' : ''}`}
        onClick={handleToggle}
        disabled={disabled}
        type="button"
      >
        <span className="hierarchy-dropdown-label">{label}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && ReactDOM.createPortal(
        <div
          ref={panelRef}
          className="hierarchy-dropdown-portal"
          style={{
            position: 'absolute',
            top: pos.top,
            left: pos.left,
            width,
            zIndex: 1300,
          }}
        >
          <div className="hierarchy-dropdown-paper">
            <div className="hierarchy-dropdown-content" style={{ position: 'relative' }}>
              {isLoading && (
                <div className="hierarchy-dropdown-loading-overlay">
                  <div className="hierarchy-dropdown-spinner" />
                </div>
              )}
              {React.Children.map(children, child => {
                if (!React.isValidElement(child)) return child;
                return React.cloneElement(child as React.ReactElement<{ onDropdownClose?: () => void }>, {
                  onDropdownClose: () => setOpen(false),
                });
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
