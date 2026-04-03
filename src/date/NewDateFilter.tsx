import React, { useState, useRef, useEffect } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import '../screens/MdmReportsFilter.css';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_OF_WEEK = ['S','M','T','W','T','F','S'];

interface CalendarProps {
  year: number;
  month: number;
  startDate: Date | null;
  endDate: Date | null;
  hoverDate: Date | null;
  onDayClick: (date: Date) => void;
  onDayHover: (date: Date | null) => void;
  onPrev?: () => void;
  onNext?: () => void;
  disablePrev?: boolean;
  disableNext?: boolean;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function Calendar({ year, month, startDate, endDate, hoverDate, onDayClick, onDayHover, onPrev, onNext, disablePrev, disableNext }: CalendarProps) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const today = new Date();

  const cells: React.ReactNode[] = [];

  // Empty padding cells
  for (let i = 0; i < firstDow; i++) {
    cells.push(<div key={`e${i}`} className="sc-cal-day empty" />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const isStart = startDate ? isSameDay(date, startDate) : false;
    const isEnd = endDate ? isSameDay(date, endDate) : false;
    const effectiveEnd = endDate ?? (hoverDate && startDate && hoverDate >= startDate ? hoverDate : null);
    const isInRange = startDate && effectiveEnd && date > startDate && date < effectiveEnd;
    const isToday = isSameDay(date, today);

    let cls = 'sc-cal-day';
    if (isStart) {
      cls += ' selected-start';
      if (effectiveEnd && !isSameDay(startDate!, effectiveEnd)) cls += ' has-range-end';
    } else if (isEnd) {
      cls += ' selected-end';
      if (startDate && !isSameDay(startDate, endDate!)) cls += ' has-range-start';
    } else if (isInRange) {
      cls += ' in-range';
    }
    if (isToday) cls += ' today';

    cells.push(
      <div
        key={d}
        className={cls}
        onClick={() => onDayClick(date)}
        onMouseEnter={() => onDayHover(date)}
        onMouseLeave={() => onDayHover(null)}
      >
        {d}
      </div>
    );
  }

  return (
    <div className="sc-calendar">
      <div className="sc-cal-header">
        <button className="sc-cal-nav" onClick={onPrev} disabled={disablePrev}>‹</button>
        <div className="sc-cal-month-title">
          {MONTHS[month]} {year}
        </div>
        <button className="sc-cal-nav" onClick={onNext} disabled={disableNext}>›</button>
      </div>
      <div className="sc-cal-grid">
        {DAYS_OF_WEEK.map((d, i) => (
          <div key={i} className="sc-cal-dow">{d}</div>
        ))}
        {cells}
      </div>
    </div>
  );
}

interface NewDateFilterProps {
  fromDate: Dayjs;
  toDate: Dayjs;
  onFromChange: (d: Dayjs) => void;
  onToChange: (d: Dayjs) => void;
  dateRangeAllowed?: string;
}

export function NewDateFilter({ fromDate, toDate, onFromChange, onToChange }: NewDateFilterProps) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('Custom Date Filter');
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [leftYear, setLeftYear] = useState(fromDate.year());
  const [leftMonth, setLeftMonth] = useState(fromDate.month());
  const [rightYear, setRightYear] = useState(toDate.year());
  const [rightMonth, setRightMonth] = useState(toDate.month());
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function prevMonth() {
    if (leftMonth === 0) { setLeftMonth(11); setLeftYear(y => y - 1); }
    else setLeftMonth(m => m - 1);
  }

  function nextMonth() {
    if (leftMonth === 11) { setLeftMonth(0); setLeftYear(y => y + 1); }
    else setLeftMonth(m => m + 1);
  }

  function prevRightMonth() {
    if (rightMonth === 0) { setRightMonth(11); setRightYear(y => y - 1); }
    else setRightMonth(m => m - 1);
  }

  function nextRightMonth() {
    if (rightMonth === 11) { setRightMonth(0); setRightYear(y => y + 1); }
    else setRightMonth(m => m + 1);
  }

  function handleStartDayClick(date: Date) {
    const d = dayjs(date);
    onFromChange(d.startOf('day'));
    if (d.isAfter(toDate)) {
      onToChange(d.endOf('day'));
    }
    setActivePreset('Custom Date Filter');
  }

  function handleEndDayClick(date: Date) {
    const d = dayjs(date);
    onToChange(d.endOf('day'));
    if (d.isBefore(fromDate)) {
      onFromChange(d.startOf('day'));
    }
    setActivePreset('Custom Date Filter');
  }

  function applyPreset(label: string, from: Dayjs, to: Dayjs) {
    setActivePreset(label);
    onFromChange(from);
    onToChange(to);
    setLeftYear(from.year());
    setLeftMonth(from.month());
    setRightYear(to.year());
    setRightMonth(to.month());
  }

  const presets = [
    { label: 'Last 7 days', from: dayjs().subtract(6, 'day').startOf('day'), to: dayjs().endOf('day') },
    { label: 'Last 3 months', from: dayjs().subtract(3, 'month').startOf('day'), to: dayjs().endOf('day') },
    { label: 'Custom Date Filter', from: fromDate, to: toDate },
  ];

  const displayText = `${fromDate.format('DD MMM YYYY')} - ${toDate.format('DD MMM YYYY')}`;

  return (
    <div className="sc-date-range-wrapper" ref={wrapperRef}>
      <button
        className={`sc-date-range-btn${open ? ' open' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <span className="sc-date-range-value">{displayText}</span>
      </button>

      {open && (
        <div className="sc-datepicker-popup">
          <div className="sc-datepicker-presets">
            {presets.map(p => (
              <div
                key={p.label}
                className={`sc-preset-item${activePreset === p.label ? ' active' : ''}`}
                onClick={() => {
                  if (p.label !== 'Custom Date Filter') {
                    applyPreset(p.label, p.from, p.to);
                  } else {
                    applyPreset('Custom Date Filter', dayjs().startOf('day'), dayjs().endOf('day'));
                  }
                }}
              >
                {p.label}
              </div>
            ))}
          </div>

          <div className="sc-datepicker-calendars">
            <Calendar
              year={leftYear}
              month={leftMonth}
              startDate={fromDate.toDate()}
              endDate={toDate.toDate()}
              hoverDate={hoverDate}
              onDayClick={handleStartDayClick}
              onDayHover={setHoverDate}
              onPrev={prevMonth}
              disableNext={true}
            />
            <Calendar
              year={rightYear}
              month={rightMonth}
              startDate={fromDate.toDate()}
              endDate={toDate.toDate()}
              hoverDate={hoverDate}
              onDayClick={handleEndDayClick}
              onDayHover={setHoverDate}
              onPrev={prevRightMonth}
              onNext={nextRightMonth}
            />
          </div>
        </div>
      )}
    </div>
  );
}
