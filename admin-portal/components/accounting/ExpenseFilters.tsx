'use client';

import { useState, useEffect } from 'react';
import { Filter, ChevronDown, ChevronUp, X, Loader2 } from 'lucide-react';
import DatePicker from '@/components/ui/DatePicker';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { type ExpenseFilterState } from '@/lib/hooks/useExpenses';
import { useExpenseCategories } from '@/lib/hooks/useExpenseCategories';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { CashBalances } from '@/lib/services/accountingService';

interface ExpenseFiltersProps {
  filters: ExpenseFilterState;
  onChange: (filters: ExpenseFilterState) => void;
  cashBalances: CashBalances | null;
  visible: boolean;
  onToggle: () => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}

const ExpenseFilters: React.FC<ExpenseFiltersProps> = ({
  filters,
  onChange,
  cashBalances,
  visible,
  onToggle,
  onClear,
  hasActiveFilters
}) => {
  const { activeCategories, loading: loadingCategories } = useExpenseCategories();

  // Debounce search input to avoid excessive filtering
  const [vendorSearch, setVendorSearch] = useState(filters.vendor || '');
  const debouncedVendor = useDebounce(vendorSearch, 300);

  // Apply debounced vendor filter
  useEffect(() => {
    if (debouncedVendor !== filters.vendor) {
      onChange({ ...filters, vendor: debouncedVendor });
    }
  }, [debouncedVendor]);

  // Sync local state when filters.vendor changes externally (e.g., clear filters)
  useEffect(() => {
    if (filters.vendor !== vendorSearch && filters.vendor === '') {
      setVendorSearch('');
    }
  }, [filters.vendor]);

  const updateFilter = <K extends keyof ExpenseFilterState>(
    key: K,
    value: ExpenseFilterState[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <button
        onClick={onToggle}
        className={`w-full px-5 py-4 flex items-center justify-between rounded-xl transition ${
          visible ? 'bg-blue-50 rounded-b-none' : 'hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2">
          <Filter className={`w-5 h-5 ${hasActiveFilters ? 'text-blue-600' : 'text-slate-500'}`} />
          <span className={`font-semibold ${hasActiveFilters ? 'text-blue-700' : 'text-slate-700'}`}>
            Filtros
          </span>
          {hasActiveFilters && (
            <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
              Activos
            </span>
          )}
        </div>
        {visible ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {visible && (
        <div className="px-5 pb-5 pt-4 bg-blue-50/50 border-t border-blue-100">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Rango de Fecha
              </label>
              <div className="flex gap-2">
                <DatePicker
                  value={filters.startDate}
                  onChange={(val) => updateFilter('startDate', val)}
                  placeholder="Desde"
                />
                <DatePicker
                  value={filters.endDate}
                  onChange={(val) => updateFilter('endDate', val)}
                  placeholder="Hasta"
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Categoria
              </label>
              <div className="relative">
                <select
                  value={filters.category}
                  onChange={(e) => updateFilter('category', e.target.value)}
                  disabled={loadingCategories}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white disabled:opacity-50"
                >
                  <option value="">Todas las categorias</option>
                  {activeCategories.map(cat => (
                    <option key={cat.id} value={cat.code}>{cat.name}</option>
                  ))}
                </select>
                {loadingCategories && (
                  <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                )}
              </div>
            </div>

            {/* Amount Range */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Rango de Monto
              </label>
              <div className="flex gap-2">
                <CurrencyInput
                  value={filters.minAmount}
                  onChange={(val) => updateFilter('minAmount', val)}
                  placeholder="Minimo"
                />
                <CurrencyInput
                  value={filters.maxAmount}
                  onChange={(val) => updateFilter('maxAmount', val)}
                  placeholder="Maximo"
                />
              </div>
            </div>

            {/* Account & Search */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Cuenta / Buscar
              </label>
              <div className="flex gap-2">
                <select
                  value={filters.paymentAccountId}
                  onChange={(e) => updateFilter('paymentAccountId', e.target.value)}
                  className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                >
                  <option value="">Cuenta</option>
                  {cashBalances?.caja_menor?.id && (
                    <option value={cashBalances.caja_menor.id}>Caja Menor</option>
                  )}
                  {cashBalances?.caja_mayor?.id && (
                    <option value={cashBalances.caja_mayor.id}>Caja Mayor</option>
                  )}
                  {cashBalances?.nequi?.id && (
                    <option value={cashBalances.nequi.id}>Nequi</option>
                  )}
                  {cashBalances?.banco?.id && (
                    <option value={cashBalances.banco.id}>Banco</option>
                  )}
                </select>
                <input
                  type="text"
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={onClear}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <X className="w-4 h-4" />
                Limpiar todos los filtros
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpenseFilters;
