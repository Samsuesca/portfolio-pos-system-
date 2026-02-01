/**
 * CurrencyInput - Input con formato monetario colombiano
 * Muestra el valor formateado ($1,234,567) mientras permite edición limpia
 */
import { useState, useEffect, useRef } from 'react';
import { DollarSign } from 'lucide-react';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  showIcon?: boolean;
}

export default function CurrencyInput({
  value,
  onChange,
  placeholder = '0',
  className = '',
  min,
  max,
  disabled = false,
  showIcon = true,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Formatear número a moneda colombiana
  const formatCurrency = (num: number): string => {
    if (num === 0) return '';
    return num.toLocaleString('es-CO');
  };

  // Actualizar display cuando cambia el valor externo
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatCurrency(value));
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    // Mostrar el número sin formato al enfocar
    setDisplayValue(value > 0 ? value.toString() : '');
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Aplicar formato al perder foco
    setDisplayValue(formatCurrency(value));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;

    // Solo permitir dígitos
    const cleanValue = rawValue.replace(/[^\d]/g, '');

    // Parsear a número
    let numValue = parseInt(cleanValue, 10) || 0;

    // Aplicar límites
    if (min !== undefined && numValue < min) numValue = min;
    if (max !== undefined && numValue > max) numValue = max;

    // Actualizar el display y notificar el cambio
    setDisplayValue(cleanValue);
    onChange(numValue);
  };

  const baseClass = `w-full py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
    disabled ? 'bg-gray-100 cursor-not-allowed' : ''
  }`;

  return (
    <div className="relative">
      {showIcon && (
        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={isFocused ? displayValue : (value > 0 ? `$${formatCurrency(value)}` : '')}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`${baseClass} ${showIcon ? 'pl-9 pr-3' : 'px-3'} ${className}`}
      />
    </div>
  );
}

// Exportación nombrada para compatibilidad
export { CurrencyInput };
