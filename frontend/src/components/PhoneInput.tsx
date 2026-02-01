/**
 * PhoneInput Component
 *
 * Input component for Colombian phone numbers with validation.
 * - Only accepts digits
 * - Limits to 10 characters
 * - Shows error if doesn't start with 3
 */
import { Phone, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { isValidColombianPhone } from '../utils/whatsapp';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  showValidation?: boolean;
}

export default function PhoneInput({
  value,
  onChange,
  label = 'Telefono',
  required = false,
  disabled = false,
  className = '',
  showValidation = true,
}: PhoneInputProps) {
  const [touched, setTouched] = useState(false);

  // Clean input to only allow digits
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/\D/g, '').slice(0, 10);
    onChange(newValue);
  };

  const handleBlur = () => {
    setTouched(true);
  };

  // Determine validation state
  const isEmpty = value.trim() === '';
  const isValid = isEmpty || isValidColombianPhone(value);
  const showError = showValidation && touched && !isEmpty && !isValid;

  // Get error message
  const getErrorMessage = (): string | null => {
    if (!showValidation || !touched || isEmpty) return null;

    const clean = value.replace(/\D/g, '');
    if (clean.length > 0 && clean.length < 10) {
      return 'Debe tener 10 digitos';
    }
    if (clean.length === 10 && !clean.startsWith('3')) {
      return 'Debe iniciar con 3';
    }
    return null;
  };

  const errorMessage = getErrorMessage();

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Phone className={`w-4 h-4 ${showError ? 'text-red-400' : 'text-gray-400'}`} />
        </div>
        <input
          type="tel"
          inputMode="numeric"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          required={required}
          maxLength={10}
          placeholder="3001234567"
          className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition ${
            showError
              ? 'border-red-300 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        />
      </div>
      {errorMessage && (
        <div className="mt-1 flex items-center text-sm text-red-600">
          <AlertCircle className="w-3.5 h-3.5 mr-1" />
          {errorMessage}
        </div>
      )}
      {!errorMessage && showValidation && !isEmpty && isValid && touched && (
        <p className="mt-1 text-xs text-green-600">Telefono valido</p>
      )}
    </div>
  );
}
