import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value: string; // ISO format: YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
}

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAYS_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

/**
 * Convierte fecha ISO (YYYY-MM-DD) a formato español (DD/MM/YYYY)
 */
function formatToSpanish(isoDate: string): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Convierte fecha español (DD/MM/YYYY) a ISO (YYYY-MM-DD)
 */
function parseSpanishDate(spanishDate: string): string {
  if (!spanishDate) return '';
  const parts = spanishDate.split('/');
  if (parts.length !== 3) return '';
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'DD/MM/AAAA',
  className = '',
  disabled = false,
  minDate,
  maxDate
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(formatToSpanish(value));
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) {
      const date = new Date(value);
      return new Date(date.getFullYear(), date.getMonth(), 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizar valor externo con input
  useEffect(() => {
    setInputValue(formatToSpanish(value));
    if (value) {
      const date = new Date(value);
      setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }, [value]);

  // Cerrar calendario al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Manejar cambio manual en input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;

    // Auto-formatear mientras escribe
    val = val.replace(/[^\d/]/g, ''); // Solo números y /

    // Auto-agregar / después de día y mes
    if (val.length === 2 && !val.includes('/')) {
      val = val + '/';
    } else if (val.length === 5 && val.split('/').length === 2) {
      val = val + '/';
    }

    // Limitar longitud
    if (val.length > 10) val = val.slice(0, 10);

    setInputValue(val);

    // Validar y enviar si es fecha completa
    if (val.length === 10) {
      const isoDate = parseSpanishDate(val);
      const date = new Date(isoDate);
      if (!isNaN(date.getTime())) {
        onChange(isoDate);
        setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      }
    }
  };

  // Manejar blur para validar fecha
  const handleInputBlur = () => {
    if (inputValue && inputValue.length === 10) {
      const isoDate = parseSpanishDate(inputValue);
      const date = new Date(isoDate);
      if (!isNaN(date.getTime())) {
        onChange(isoDate);
      } else {
        setInputValue(formatToSpanish(value));
      }
    } else if (inputValue && inputValue.length > 0) {
      setInputValue(formatToSpanish(value));
    }
  };

  // Navegar meses
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Seleccionar día
  const selectDay = (day: number) => {
    const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const isoDate = selectedDate.toISOString().split('T')[0];

    // Validar min/max
    if (minDate && isoDate < minDate) return;
    if (maxDate && isoDate > maxDate) return;

    onChange(isoDate);
    setIsOpen(false);
  };

  // Generar días del mes
  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Día de la semana del primer día (0=Dom, convertir a 0=Lun)
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days: (number | null)[] = [];

    // Días vacíos al inicio
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // Días del mes
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  // Verificar si un día está seleccionado
  const isSelected = (day: number) => {
    if (!value) return false;
    const selectedDate = new Date(value);
    return (
      selectedDate.getFullYear() === currentMonth.getFullYear() &&
      selectedDate.getMonth() === currentMonth.getMonth() &&
      selectedDate.getDate() === day
    );
  };

  // Verificar si un día es hoy
  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getFullYear() === currentMonth.getFullYear() &&
      today.getMonth() === currentMonth.getMonth() &&
      today.getDate() === day
    );
  };

  // Verificar si un día está deshabilitado
  const isDisabledDay = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const isoDate = date.toISOString().split('T')[0];
    if (minDate && isoDate < minDate) return true;
    if (maxDate && isoDate > maxDate) return true;
    return false;
  };

  const days = getDaysInMonth();

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => !disabled && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full px-3 py-2 pr-10 border rounded-lg
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-text'}
          `}
        />
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded
            ${disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}
          `}
        >
          <Calendar size={18} />
        </button>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 bg-white border rounded-lg shadow-lg p-3 w-72">
          {/* Header con navegación */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded hover:bg-gray-100"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="font-semibold text-gray-800">
              {MONTHS_ES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded hover:bg-gray-100"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS_ES.map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Días del mes */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => (
              <div key={index} className="aspect-square">
                {day !== null && (
                  <button
                    type="button"
                    onClick={() => selectDay(day)}
                    disabled={isDisabledDay(day)}
                    className={`
                      w-full h-full rounded-full text-sm font-medium
                      transition-colors duration-150
                      ${isSelected(day)
                        ? 'bg-blue-600 text-white'
                        : isToday(day)
                          ? 'bg-blue-100 text-blue-700'
                          : isDisabledDay(day)
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    {day}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Botón para seleccionar hoy */}
          <div className="mt-3 pt-3 border-t">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                const isoDate = today.toISOString().split('T')[0];
                if ((!minDate || isoDate >= minDate) && (!maxDate || isoDate <= maxDate)) {
                  onChange(isoDate);
                  setIsOpen(false);
                }
              }}
              className="w-full py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded"
            >
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Función utilitaria para formatear fecha ISO a español (para mostrar)
 */
export function formatDateSpanish(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  return formatToSpanish(isoDate.split('T')[0]);
}

/**
 * Función utilitaria para formatear fecha y hora ISO a español
 * Acepta tanto strings ISO como objetos Date
 */
export function formatDateTimeSpanish(isoDate: string | Date | null | undefined): string {
  if (!isoDate) return '-';
  try {
    const date = isoDate instanceof Date ? isoDate : new Date(isoDate);
    if (isNaN(date.getTime())) return '-';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '-';
  }
}
