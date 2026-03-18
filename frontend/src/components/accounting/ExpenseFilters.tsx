/**
 * ExpenseFilters - Filter panel for expenses
 *
 * Now uses dynamic categories from the database via useExpenseCategories hook.
 * Uses debounce for search input to avoid excessive re-renders.
 */
import { useState, useEffect } from 'react';
import { Filter, ChevronDown, ChevronUp, X, Loader2 } from 'lucide-react';
import DatePicker from '../DatePicker';
import CurrencyInput from '../CurrencyInput';
import { type ExpenseFilterState } from '../../hooks/useExpenses';
import { useExpenseCategories } from '../../hooks/useExpenseCategories';
import { useDebounce } from '../../hooks/useDebounce';
import { type CashBalancesResponse } from '../../services/accountingService';

interface ExpenseFiltersProps {
  filters: ExpenseFilterState;
  onChange: (filters: ExpenseFilterState) => void;
  cashBalances: CashBalancesResponse | null;
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
  // Load dynamic categories from database
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
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className={`w-full px-5 py-4 flex items-center justify-between rounded-xl transition ${
          visible ? 'bg-brand-50 rounded-b-none' : 'hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-2">
          <Filter className={`w-5 h-5 ${hasActiveFilters ? 'text-brand-600' : 'text-gray-500'}`} />
          <span className={`font-semibold ${hasActiveFilters ? 'text-brand-700' : 'text-gray-700'}`}>
            Filtros
          </span>
          {hasActiveFilters && (
            <span className="bg-brand-500 text-white text-xs px-2 py-0.5 rounded-full">
              Activos
            </span>
          )}
        </div>
        {visible ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Filter Panel */}
      {visible && (
        <div className="px-5 pb-5 pt-4 bg-brand-50/50 border-t border-brand-100">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
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

            {/* Category - Dynamic from database */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Categoria
              </label>
              <div className="relative">
                <select
                  value={filters.category}
                  onChange={(e) => updateFilter('category', e.target.value as any)}
                  disabled={loadingCategories}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-400 text-sm bg-white disabled:opacity-50"
                >
                  <option value="">Todas las categorias</option>
                  {activeCategories.map(cat => (
                    <option key={cat.id} value={cat.code}>{cat.name}</option>
                  ))}
                </select>
                {loadingCategories && (
                  <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                )}
              </div>
            </div>

            {/* Amount Range */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
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
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Cuenta / Buscar
              </label>
              <div className="flex gap-2">
                <select
                  value={filters.paymentAccountId}
                  onChange={(e) => updateFilter('paymentAccountId', e.target.value)}
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-400 text-sm bg-white"
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
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-400 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={onClear}
                className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 font-medium"
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
