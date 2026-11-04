import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import './GSTRMonthYearPicker.css';

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface GSTRMonthYearPickerProps {
  selectedMonth: number | null; // 0-indexed
  selectedYear: number | null;
  onChange: (month: number, year: number) => void;
  /** How many years back to show, inclusive of the current year. */
  yearsRange?: number;
  /** Months back from the current month the window ends. 1 → last month. */
  monthOffsetCount?: number;
  disabled?: boolean;
}

/**
 * Single-button month/year picker for GSTR reports: the button shows the current
 * selection and opens a popover with a 4-column month grid and a year row.
 * Future months/years are disabled — a GSTR return can only be pulled for a
 * period that has already started.
 */
export function GSTRMonthYearPicker({
  selectedMonth,
  selectedYear,
  onChange,
  yearsRange = 3,
  monthOffsetCount,
  disabled = false,
}: GSTRMonthYearPickerProps) {
  const today = useMemo(() => dayjs(), []);
  // Latest selectable month. monthOffsetCount counts back from the current
  // month, so 1 ends the window at last month; 0/absent keeps today's month.
  const lastMonth = useMemo(
    () => today.subtract(Math.max(0, Math.floor(monthOffsetCount ?? 0)), 'month').startOf('month'),
    [today, monthOffsetCount]
  );
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Default to the current month/year so the report is downloadable immediately,
  // matching how the date-range filter starts pre-filled.
  const month = selectedMonth ?? lastMonth.month();
  const year = selectedYear ?? lastMonth.year();

  const years = useMemo(() => {
    // Anchor on the last selectable month's year: with an offset set in January
    // the newest allowed year is the previous one.
    const newestYear = lastMonth.year();
    const list: number[] = [];
    for (let y = newestYear - yearsRange + 1; y <= newestYear; y++) {
      list.push(y);
    }
    return list;
  }, [lastMonth, yearsRange]);

  // Close on outside click, matching the other dropdowns in the filter bar.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isMonthDisabled = (m: number) =>
    year > lastMonth.year() || (year === lastMonth.year() && m > lastMonth.month());

  const handleMonthSelect = (m: number) => {
    if (isMonthDisabled(m)) return;
    onChange(m, year);
    setOpen(false);
  };

  const handleYearSelect = (y: number) => {
    // Switching year can strand the month past the cutoff — clamp it back.
    const nextMonth =
      y === lastMonth.year() && month > lastMonth.month() ? lastMonth.month() : month;
    onChange(nextMonth, y);
  };

  return (
    <div className="sc-gstr-picker" ref={wrapRef}>
      <button
        type="button"
        className="sc-gstr-trigger"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
      >
        <span>{`${MONTHS_FULL[month]} ${year}`}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="sc-gstr-popover">
          <div className="sc-gstr-section-label">SELECT MONTH</div>
          <div className="sc-gstr-month-grid">
            {MONTHS_SHORT.map((label, i) => {
              const isDisabled = isMonthDisabled(i);
              return (
                <button
                  key={label}
                  type="button"
                  className={`sc-gstr-cell${month === i ? ' sc-gstr-cell-selected' : ''}`}
                  disabled={isDisabled}
                  onClick={() => handleMonthSelect(i)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="sc-gstr-year-section">
            <div className="sc-gstr-section-label">SELECT YEAR</div>
            <div className="sc-gstr-year-row">
              {years.map(y => (
                <button
                  key={y}
                  type="button"
                  className={`sc-gstr-cell${year === y ? ' sc-gstr-cell-selected' : ''}`}
                  onClick={() => handleYearSelect(y)}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
