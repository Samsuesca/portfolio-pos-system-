'use client';

import { useState, useEffect, useRef } from 'react';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
}

export default function CurrencyInput({
  value,
  onChange,
  className = '',
  placeholder = '$0',
  disabled = false,
  min,
  max,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Format number with thousand separators
  const formatNumber = (num: number): string => {
    if (num === 0) return '';
    return num.toLocaleString('es-CO');
  };

  // Parse formatted string back to number
  const parseNumber = (str: string): number => {
    const cleaned = str.replace(/[^\d]/g, '');
    return cleaned ? parseInt(cleaned, 10) : 0;
  };

  // Initialize display value from prop
  useEffect(() => {
    setDisplayValue(formatNumber(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numericValue = parseNumber(rawValue);

    // Apply min/max constraints
    let constrainedValue = numericValue;
    if (min !== undefined && numericValue < min) {
      constrainedValue = min;
    }
    if (max !== undefined && numericValue > max) {
      constrainedValue = max;
    }

    setDisplayValue(formatNumber(constrainedValue));
    onChange(constrainedValue);
  };

  const handleFocus = () => {
    // Select all text on focus for easy replacement
    if (inputRef.current) {
      inputRef.current.select();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-right ${
          disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
        }`}
      />
    </div>
  );
}
