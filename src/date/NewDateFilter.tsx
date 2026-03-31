import React, { useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { parseDateRangeAllowed, getLabelFromAllowed } from '../types/mdmReportsUtils';

interface Preset {
  label: string;
  from: Dayjs;
  to: Dayjs;
}

function buildPresets(dateRangeAllowed?: string): Preset[] {
  const presets: Preset[] = [
    { label: 'Today', from: dayjs().startOf('day'), to: dayjs().endOf('day') },
    { label: 'Yesterday', from: dayjs().subtract(1, 'day').startOf('day'), to: dayjs().subtract(1, 'day').endOf('day') },
    { label: 'Last 7 Days', from: dayjs().subtract(6, 'day').startOf('day'), to: dayjs().endOf('day') },
    { label: 'Last 30 Days', from: dayjs().subtract(29, 'day').startOf('day'), to: dayjs().endOf('day') },
    { label: 'This Month', from: dayjs().startOf('month'), to: dayjs().endOf('month') },
    { label: 'Last Month', from: dayjs().subtract(1, 'month').startOf('month'), to: dayjs().subtract(1, 'month').endOf('month') },
  ];

  if (dateRangeAllowed) {
    const label = getLabelFromAllowed(dateRangeAllowed);
    const parsed = parseDateRangeAllowed(dateRangeAllowed);
    if (parsed) {
      const to = dayjs();
      let from: Dayjs;
      switch (parsed.unit) {
        case 'day': from = to.subtract(parsed.amount, 'day'); break;
        case 'week': from = to.subtract(parsed.amount * 7, 'day'); break;
        case 'month': from = to.subtract(parsed.amount, 'month'); break;
        case 'year': from = to.subtract(parsed.amount, 'year'); break;
      }
      presets.unshift({ label, from: from!.startOf('day'), to: to.endOf('day') });
    }
  }

  return presets;
}

interface NewDateFilterProps {
  fromDate: Dayjs;
  toDate: Dayjs;
  onFromChange: (date: Dayjs) => void;
  onToChange: (date: Dayjs) => void;
  dateRangeAllowed?: string;
  disabled?: boolean;
}

export function NewDateFilter({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  dateRangeAllowed,
  disabled = false,
}: NewDateFilterProps) {
  const presets = buildPresets(dateRangeAllowed);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  function applyPreset(preset: Preset) {
    setActivePreset(preset.label);
    onFromChange(preset.from);
    onToChange(preset.to);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Preset chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
            disabled={disabled}
            style={{
              padding: '4px 12px',
              borderRadius: 20,
              border: '1px solid',
              borderColor: activePreset === p.label ? '#6366f1' : '#e5e7eb',
              background: activePreset === p.label ? '#eef2ff' : '#fff',
              color: activePreset === p.label ? '#4338ca' : '#374151',
              fontSize: 12,
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontWeight: activePreset === p.label ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
            From
          </label>
          <input
            type="date"
            value={fromDate.format('YYYY-MM-DD')}
            max={toDate.format('YYYY-MM-DD')}
            disabled={disabled}
            onChange={(e) => {
              setActivePreset(null);
              onFromChange(dayjs(e.target.value));
            }}
            style={{
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
              color: '#374151',
              outline: 'none',
            }}
          />
        </div>
        <span style={{ color: '#9ca3af', paddingTop: 20 }}>→</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
            To
          </label>
          <input
            type="date"
            value={toDate.format('YYYY-MM-DD')}
            min={fromDate.format('YYYY-MM-DD')}
            max={dayjs().format('YYYY-MM-DD')}
            disabled={disabled}
            onChange={(e) => {
              setActivePreset(null);
              onToChange(dayjs(e.target.value));
            }}
            style={{
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
              color: '#374151',
              outline: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}
