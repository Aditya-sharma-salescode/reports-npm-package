import React, { useState } from 'react';
import dayjs from 'dayjs';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface GSTRMonthYearPickerProps {
  selectedMonth: number | null; // 0-indexed
  selectedYear: number | null;
  onChange: (month: number, year: number) => void;
  yearsRange?: number; // how many years back to show, default 3
  disabled?: boolean;
}

export function GSTRMonthYearPicker({
  selectedMonth,
  selectedYear,
  onChange,
  yearsRange = 3,
  disabled = false,
}: GSTRMonthYearPickerProps) {
  const currentYear = dayjs().year();
  const years: number[] = [];
  for (let y = currentYear; y >= currentYear - yearsRange; y--) {
    years.push(y);
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
          Month
        </label>
        <select
          value={selectedMonth ?? ''}
          disabled={disabled}
          onChange={(e) => {
            const m = parseInt(e.target.value, 10);
            if (!isNaN(m)) onChange(m, selectedYear ?? currentYear);
          }}
          style={{
            padding: '6px 10px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 13,
            color: '#374151',
            background: '#fff',
            minWidth: 130,
          }}
        >
          <option value="">Select Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
          Year
        </label>
        <select
          value={selectedYear ?? ''}
          disabled={disabled}
          onChange={(e) => {
            const y = parseInt(e.target.value, 10);
            if (!isNaN(y)) onChange(selectedMonth ?? 0, y);
          }}
          style={{
            padding: '6px 10px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 13,
            color: '#374151',
            background: '#fff',
            minWidth: 90,
          }}
        >
          <option value="">Select Year</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
