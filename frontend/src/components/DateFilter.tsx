import React, { useCallback } from 'react';

export type DatePreset = 'today' | 'yesterday' | 'last7days' | 'this_month' | 'all';

export interface DateRange {
  start_date?: string; // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD
}

interface DateFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

function getColombiaToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function getPresetRange(preset: DatePreset): DateRange {
  const today = getColombiaToday();
  switch (preset) {
    case 'today':
      return { start_date: today, end_date: today };
    case 'yesterday': {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yesterday = d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      return { start_date: yesterday, end_date: yesterday };
    }
    case 'last7days': {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      const weekAgo = d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      return { start_date: weekAgo, end_date: today };
    }
    case 'this_month': {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const first = firstOfMonth.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      return { start_date: first, end_date: today };
    }
    case 'all':
      return {};
  }
}

function detectPreset(range: DateRange): DatePreset | null {
  const today = getColombiaToday();
  if (!range.start_date && !range.end_date) return 'all';
  if (range.start_date === today && range.end_date === today) return 'today';

  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  if (range.start_date === yesterday && range.end_date === yesterday) return 'yesterday';

  const d2 = new Date();
  d2.setDate(d2.getDate() - 6);
  const weekAgo = d2.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  if (range.start_date === weekAgo && range.end_date === today) return 'last7days';

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const first = firstOfMonth.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  if (range.start_date === first && range.end_date === today) return 'this_month';

  return null;
}

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'last7days', label: '7 dias' },
  { key: 'this_month', label: 'Este mes' },
  { key: 'all', label: 'Todo' },
];

const DateFilter: React.FC<DateFilterProps> = ({ value, onChange, className = '' }) => {
  const activePreset = detectPreset(value);

  const handlePreset = useCallback((preset: DatePreset) => {
    onChange(getPresetRange(preset));
  }, [onChange]);

  const handleStartDate = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value || undefined;
    onChange({ start_date: newStart, end_date: value.end_date });
  }, [onChange, value.end_date]);

  const handleEndDate = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = e.target.value || undefined;
    onChange({ start_date: value.start_date, end_date: newEnd });
  }, [onChange, value.start_date]);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1">
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => handlePreset(key)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activePreset === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-300 mx-1 hidden sm:block" />

      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">Desde:</label>
        <input
          type="date"
          value={value.start_date || ''}
          onChange={handleStartDate}
          className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <label className="text-sm text-gray-500">Hasta:</label>
        <input
          type="date"
          value={value.end_date || ''}
          onChange={handleEndDate}
          className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  );
};

export default DateFilter;
