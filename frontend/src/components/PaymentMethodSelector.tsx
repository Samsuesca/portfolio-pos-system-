/**
 * Shared PaymentMethodSelector - Reusable dropdown for payment method selection.
 * Used in SaleModal, OrderModal, and SaleChanges approval modals.
 */

export type PaymentMethodValue = '' | 'cash' | 'nequi' | 'transfer' | 'card' | 'credit';

interface PaymentMethodSelectorProps {
  value: string;
  onChange: (method: string) => void;
  includeCredit?: boolean;
  includePlaceholder?: boolean;
  required?: boolean;
  error?: boolean;
  label?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
  accentColor?: 'green' | 'blue' | 'gray';
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
] as const;

const FOCUS_RING: Record<string, string> = {
  green: 'focus:ring-green-500',
  blue: 'focus:ring-blue-500',
  gray: 'focus:ring-gray-500',
};

export default function PaymentMethodSelector({
  value,
  onChange,
  includeCredit = false,
  includePlaceholder = true,
  label,
  hint,
  disabled = false,
  error = false,
  className = '',
  accentColor = 'green',
}: PaymentMethodSelectorProps) {
  const ringClass = FOCUS_RING[accentColor] || FOCUS_RING.green;
  const borderClass = error || (!value && includePlaceholder)
    ? 'border-red-300 text-gray-400'
    : 'border-gray-300';

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 ${ringClass} focus:border-transparent outline-none ${borderClass} ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
      >
        {includePlaceholder && (
          <option value="" disabled>-- Seleccione metodo --</option>
        )}
        {PAYMENT_METHODS.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
        {includeCredit && (
          <option value="credit">Credito</option>
        )}
      </select>
      {hint && (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      )}
      {error && !value && (
        <p className="text-xs text-red-500 mt-1">Debe seleccionar un metodo de pago</p>
      )}
    </div>
  );
}
