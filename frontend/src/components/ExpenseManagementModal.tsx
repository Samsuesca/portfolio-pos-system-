/**
 * ExpenseManagementModal - Advanced expense management and analysis modal
 *
 * Features:
 * - Dashboard with statistics (total, pending, paid, average)
 * - Bar chart by category
 * - Advanced filters (date, category, amount, account, vendor)
 * - Expandable expense cards with actions
 * - Pay, edit category, delete functionality
 * - CSV export
 *
 * Now uses dynamic categories from the database via useExpenseCategories hook.
 */
import { useState, useEffect, useMemo } from 'react';
import {
  X, Receipt, Filter, ChevronDown, ChevronUp, BarChart3,
  Loader2, AlertCircle, Trash2, Settings, CreditCard,
  Calendar, DollarSign, TrendingUp, Clock, CheckCircle, Download,
  AlertTriangle, Wallet
} from 'lucide-react';
import DatePicker, { formatDateSpanish } from './DatePicker';
import CurrencyInput from './CurrencyInput';
import { globalAccountingService } from '../services/globalAccountingService';
import { getPaymentMethodLabel } from '../services/accountingService';
import { useExpenseCategories } from '../hooks/useExpenseCategories';
import { formatCurrency } from '../utils/formatting';
import type {
  ExpenseListItem,
  ExpensePayment,
  ExpenseCategory,
  AccPaymentMethod
} from '../services/globalAccountingService';
import type { CashBalancesResponse } from '../services/accountingService';

interface ExpenseManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFilter?: 'all' | 'pending' | 'paid';
  cashBalances: CashBalancesResponse | null;
  onDataChange?: () => void;
}

// Get error message helper
const getErrorMessage = (err: unknown, defaultMessage: string): string => {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  if (err instanceof Error) return err.message;
  return defaultMessage;
};

// ============================================
// Sub-components
// ============================================

// Stats Card Component
const StatCard: React.FC<{
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
}> = ({ label, value, subValue, icon, bgColor, textColor }) => (
  <div className={`${bgColor} rounded-lg p-4 text-center`}>
    <div className={`flex items-center justify-center gap-2 ${textColor} mb-1`}>
      {icon}
      <span className="text-xs font-medium uppercase">{label}</span>
    </div>
    <p className={`text-xl font-bold ${textColor.replace('text-', 'text-').replace('-600', '-900').replace('-700', '-900')}`}>
      {value}
    </p>
    {subValue && (
      <p className={`text-xs ${textColor} mt-0.5`}>{subValue}</p>
    )}
  </div>
);

// Bar Chart Component
const ExpenseBarChart: React.FC<{
  data: Array<{ category: ExpenseCategory; label: string; amount: number; count: number; color: string }>;
  maxAmount: number;
}> = ({ data, maxAmount }) => {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No hay datos para mostrar</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.slice(0, 8).map(item => (
        <div key={item.category} className="flex items-center gap-3">
          <span className="w-28 text-sm text-gray-600 truncate" title={item.label}>
            {item.label}
          </span>
          <div className="flex-1 h-7 bg-gray-100 rounded overflow-hidden relative">
            <div
              className="h-full rounded transition-all duration-500"
              style={{
                width: `${maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0}%`,
                backgroundColor: item.color
              }}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-600">
              {item.count} gasto{item.count !== 1 ? 's' : ''}
            </span>
          </div>
          <span className="w-28 text-right font-semibold text-gray-900">
            {formatCurrency(item.amount)}
          </span>
        </div>
      ))}
    </div>
  );
};

// Expense Card Component
const ExpenseCard: React.FC<{
  expense: ExpenseListItem;
  isExpanded: boolean;
  onToggle: () => void;
  onPay: () => void;
  onEditCategory: () => void;
  onDelete: () => void;
  getCategoryLabel: (code: string) => string;
  getCategoryColor: (code: string) => string;
}> = ({ expense, isExpanded, onToggle, onPay, onEditCategory, onDelete, getCategoryLabel, getCategoryColor }) => {
  const paymentProgress = expense.amount_paid > 0 && expense.amount > 0
    ? (Number(expense.amount_paid) / Number(expense.amount)) * 100
    : 0;

  return (
    <div className={`border rounded-lg transition hover:shadow-md ${
      expense.is_paid ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div
        onClick={onToggle}
        className="p-4 cursor-pointer"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Badges */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div
                className="w-1 h-8 rounded-full"
                style={{ backgroundColor: getCategoryColor(expense.category) }}
              />
              <span
                className="px-2 py-0.5 text-xs font-medium rounded text-white"
                style={{ backgroundColor: getCategoryColor(expense.category) }}
              >
                {getCategoryLabel(expense.category)}
              </span>
              {expense.is_paid ? (
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Pagado
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-700 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Pendiente
                </span>
              )}
              {expense.is_paid && expense.payment_account_name && (
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                  {expense.payment_account_name}
                </span>
              )}
              {expense.is_paid && expense.payment_method && (
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                  {getPaymentMethodLabel(expense.payment_method)}
                </span>
              )}
            </div>
            {/* Description */}
            <p className="font-medium text-gray-900">{expense.description}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {expense.vendor && <span className="font-medium">{expense.vendor} • </span>}
              {formatDateSpanish(expense.expense_date)}
              {expense.due_date && !expense.is_paid && (
                <span className={`ml-2 ${new Date(expense.due_date) < new Date() ? 'text-red-600 font-medium' : ''}`}>
                  • Vence: {formatDateSpanish(expense.due_date)}
                </span>
              )}
            </p>
          </div>
          {/* Amount */}
          <div className="text-right ml-4 flex items-start gap-2">
            <div>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(expense.amount)}</p>
              {!expense.is_paid && Number(expense.amount_paid) > 0 && (
                <p className="text-sm text-green-600">
                  Pagado: {formatCurrency(expense.amount_paid)}
                </p>
              )}
              {!expense.is_paid && (
                <p className="text-sm font-medium text-red-600">
                  Pendiente: {formatCurrency(expense.balance)}
                </p>
              )}
            </div>
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-200 space-y-3">
          {/* Payment Progress */}
          {!expense.is_paid && Number(expense.amount_paid) > 0 && (
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Progreso de Pago</span>
                <span>{paymentProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${paymentProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {expense.due_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Vencimiento:</span>
                <span className="font-medium">{formatDateSpanish(expense.due_date)}</span>
              </div>
            )}
            {expense.is_paid && expense.paid_at && (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">Pagado:</span>
                <span className="font-medium">{formatDateSpanish(expense.paid_at.split('T')[0])}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            {/* Pay Button - only for pending */}
            {!expense.is_paid && (
              <button
                onClick={(e) => { e.stopPropagation(); onPay(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition"
              >
                <CreditCard className="w-4 h-4" />
                Pagar
              </button>
            )}
            {/* Edit Category - always */}
            <button
              onClick={(e) => { e.stopPropagation(); onEditCategory(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition"
            >
              <Settings className="w-4 h-4" />
              Categoria
            </button>
            {/* Delete - only for pending */}
            {!expense.is_paid && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// Main Component
// ============================================

const ExpenseManagementModal: React.FC<ExpenseManagementModalProps> = ({
  isOpen,
  onClose,
  initialFilter = 'all',
  cashBalances,
  onDataChange
}) => {
  // Load dynamic categories
  const {
    activeCategories,
    getCategoryLabel,
    getCategoryColor
  } = useExpenseCategories();

  // Data states
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>(initialFilter);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    category: '' as ExpenseCategory | '',
    minAmount: 0,
    maxAmount: 0,
    paymentAccountId: '',
    vendor: ''
  });

  // View states
  const [showChart, setShowChart] = useState(true);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);

  // Modal states
  const [deleteExpense, setDeleteExpense] = useState<ExpenseListItem | null>(null);
  const [editCategoryExpense, setEditCategoryExpense] = useState<ExpenseListItem | null>(null);
  const [newCategory, setNewCategory] = useState<ExpenseCategory>('other');
  const [payExpense, setPayExpense] = useState<ExpenseListItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<AccPaymentMethod | ''>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  // Action states
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Load expenses on mount
  useEffect(() => {
    if (isOpen) {
      loadExpenses();
    }
  }, [isOpen]);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await globalAccountingService.getGlobalExpenses({ limit: 500 });
      setExpenses(data);
    } catch (err) {
      console.error('Error loading expenses:', err);
      setError(getErrorMessage(err, 'Error al cargar gastos'));
    } finally {
      setLoading(false);
    }
  };

  // Filter expenses
  const getFilteredExpenses = () => {
    let filtered = expenses;

    // Status filter
    if (statusFilter === 'pending') {
      filtered = filtered.filter(e => !e.is_paid);
    } else if (statusFilter === 'paid') {
      filtered = filtered.filter(e => e.is_paid);
    }

    // Date range
    if (filters.startDate) {
      filtered = filtered.filter(e => e.expense_date >= filters.startDate);
    }
    if (filters.endDate) {
      filtered = filtered.filter(e => e.expense_date <= filters.endDate);
    }

    // Category
    if (filters.category) {
      filtered = filtered.filter(e => e.category === filters.category);
    }

    // Amount range
    if (filters.minAmount > 0) {
      filtered = filtered.filter(e => Number(e.amount) >= filters.minAmount);
    }
    if (filters.maxAmount > 0) {
      filtered = filtered.filter(e => Number(e.amount) <= filters.maxAmount);
    }

    // Payment account
    if (filters.paymentAccountId && cashBalances) {
      const accountNameMap: Record<string, string> = {};
      if (cashBalances.caja_menor?.id) accountNameMap[cashBalances.caja_menor.id] = 'Caja Menor';
      if (cashBalances.caja_mayor?.id) accountNameMap[cashBalances.caja_mayor.id] = 'Caja Mayor';
      if (cashBalances.nequi?.id) accountNameMap[cashBalances.nequi.id] = 'Nequi';
      if (cashBalances.banco?.id) accountNameMap[cashBalances.banco.id] = 'Banco';
      const targetName = accountNameMap[filters.paymentAccountId];
      if (targetName) {
        filtered = filtered.filter(e => e.payment_account_name === targetName);
      }
    }

    // Vendor search
    if (filters.vendor) {
      const searchTerm = filters.vendor.toLowerCase();
      filtered = filtered.filter(e =>
        e.vendor?.toLowerCase().includes(searchTerm) ||
        e.description.toLowerCase().includes(searchTerm)
      );
    }

    return filtered;
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const filtered = getFilteredExpenses();
    const pending = filtered.filter(e => !e.is_paid);
    const paid = filtered.filter(e => e.is_paid);

    // Use dynamic categories from the hook
    const byCategory = activeCategories.map(cat => ({
      category: cat.code as ExpenseCategory,
      label: cat.name,
      amount: filtered.filter(e => e.category === cat.code).reduce((sum, e) => sum + Number(e.amount), 0),
      count: filtered.filter(e => e.category === cat.code).length,
      color: cat.color
    })).filter(c => c.count > 0).sort((a, b) => b.amount - a.amount);

    return {
      totalAmount: filtered.reduce((sum, e) => sum + Number(e.amount), 0),
      totalCount: filtered.length,
      pendingAmount: pending.reduce((sum, e) => sum + Number(e.balance), 0),
      pendingCount: pending.length,
      paidAmount: paid.reduce((sum, e) => sum + Number(e.amount), 0),
      paidCount: paid.length,
      averageAmount: filtered.length > 0
        ? filtered.reduce((sum, e) => sum + Number(e.amount), 0) / filtered.length
        : 0,
      byCategory,
      maxCategoryAmount: byCategory.length > 0 ? byCategory[0].amount : 0
    };
  }, [expenses, statusFilter, filters, cashBalances, activeCategories]);

  // Check if any filter is active
  const hasActiveFilters = () => {
    return filters.startDate !== '' ||
           filters.endDate !== '' ||
           filters.category !== '' ||
           filters.minAmount > 0 ||
           filters.maxAmount > 0 ||
           filters.paymentAccountId !== '' ||
           filters.vendor !== '';
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      category: '',
      minAmount: 0,
      maxAmount: 0,
      paymentAccountId: '',
      vendor: ''
    });
  };

  // Handle delete expense
  const handleDeleteExpense = async () => {
    if (!deleteExpense) return;

    try {
      setSubmitting(true);
      setModalError(null);
      await globalAccountingService.deleteGlobalExpense(deleteExpense.id);
      setDeleteExpense(null);
      await loadExpenses();
      onDataChange?.();
    } catch (err) {
      console.error('Error deleting expense:', err);
      setModalError(getErrorMessage(err, 'Error al eliminar gasto'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit category
  const handleEditCategory = async () => {
    if (!editCategoryExpense) return;

    try {
      setSubmitting(true);
      setModalError(null);
      await globalAccountingService.updateGlobalExpense(editCategoryExpense.id, {
        category: newCategory
      });
      setEditCategoryExpense(null);
      await loadExpenses();
      onDataChange?.();
    } catch (err) {
      console.error('Error updating category:', err);
      setModalError(getErrorMessage(err, 'Error al actualizar categoria'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle pay expense
  const handlePayExpense = async () => {
    if (!payExpense || !paymentMethod) return;

    try {
      setSubmitting(true);
      setModalError(null);

      const payment: ExpensePayment = {
        amount: paymentAmount || Number(payExpense.balance),
        payment_method: paymentMethod
      };

      await globalAccountingService.payGlobalExpense(payExpense.id, payment);
      setPayExpense(null);
      setPaymentMethod('');
      setPaymentAmount(0);
      await loadExpenses();
      onDataChange?.();
    } catch (err) {
      console.error('Error paying expense:', err);
      setModalError(getErrorMessage(err, 'Error al pagar gasto'));
    } finally {
      setSubmitting(false);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const filtered = getFilteredExpenses();
    const headers = ['Fecha', 'Categoria', 'Descripcion', 'Vendedor', 'Monto', 'Pagado', 'Pendiente', 'Estado', 'Metodo Pago', 'Cuenta'];

    const rows = filtered.map(e => [
      e.expense_date,
      getCategoryLabel(e.category),
      `"${e.description.replace(/"/g, '""')}"`,
      e.vendor || '',
      Number(e.amount),
      Number(e.amount_paid),
      Number(e.balance),
      e.is_paid ? 'Pagado' : 'Pendiente',
      e.payment_method ? getPaymentMethodLabel(e.payment_method) : '',
      e.payment_account_name || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gastos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (!isOpen) return null;

  const filteredExpenses = getFilteredExpenses();

  return (
    <>
      {/* Main Modal */}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl mx-4 max-h-[95vh] flex flex-col">
          {/* Header with Stats */}
          <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Receipt className="w-6 h-6 text-blue-600" />
                Gestion de Gastos
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-white/50 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Total"
                value={formatCurrency(stats.totalAmount)}
                subValue={`${stats.totalCount} gastos`}
                icon={<DollarSign className="w-4 h-4" />}
                bgColor="bg-white"
                textColor="text-gray-600"
              />
              <StatCard
                label="Pendientes"
                value={formatCurrency(stats.pendingAmount)}
                subValue={`${stats.pendingCount} gastos`}
                icon={<Clock className="w-4 h-4" />}
                bgColor="bg-red-50"
                textColor="text-red-600"
              />
              <StatCard
                label="Pagados"
                value={formatCurrency(stats.paidAmount)}
                subValue={`${stats.paidCount} gastos`}
                icon={<CheckCircle className="w-4 h-4" />}
                bgColor="bg-green-50"
                textColor="text-green-600"
              />
              <StatCard
                label="Promedio"
                value={formatCurrency(stats.averageAmount)}
                subValue="por gasto"
                icon={<TrendingUp className="w-4 h-4" />}
                bgColor="bg-blue-50"
                textColor="text-blue-600"
              />
            </div>
          </div>

          {/* Controls Bar */}
          <div className="px-6 py-3 border-b bg-gray-50 flex flex-wrap items-center gap-3">
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                showFilters || hasActiveFilters()
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filtros
              {hasActiveFilters() && (
                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">!</span>
              )}
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {/* Status Tabs */}
            <div className="flex gap-1 bg-white rounded-lg p-1 border border-gray-200">
              {(['all', 'pending', 'paid'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    statusFilter === filter
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {filter === 'all' ? 'Todos' : filter === 'pending' ? 'Pendientes' : 'Pagados'}
                </button>
              ))}
            </div>

            {/* Chart Toggle */}
            <button
              onClick={() => setShowChart(!showChart)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                showChart
                  ? 'bg-purple-100 text-purple-700 border border-purple-300'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Grafico
            </button>

            {/* Export */}
            <button
              onClick={exportToCSV}
              disabled={filteredExpenses.length === 0}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="px-6 py-4 border-b bg-blue-50/50">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Date Range */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 uppercase">Fecha</label>
                  <div className="flex gap-2">
                    <DatePicker
                      value={filters.startDate}
                      onChange={(val) => setFilters(prev => ({ ...prev, startDate: val }))}
                      placeholder="Desde"
                    />
                    <DatePicker
                      value={filters.endDate}
                      onChange={(val) => setFilters(prev => ({ ...prev, endDate: val }))}
                      placeholder="Hasta"
                    />
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 uppercase">Categoria</label>
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value as ExpenseCategory | '' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">Todas</option>
                    {activeCategories.map(cat => (
                      <option key={cat.id} value={cat.code}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Amount Range */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 uppercase">Monto</label>
                  <div className="flex gap-2">
                    <CurrencyInput
                      value={filters.minAmount}
                      onChange={(val) => setFilters(prev => ({ ...prev, minAmount: val }))}
                      placeholder="Min"
                    />
                    <CurrencyInput
                      value={filters.maxAmount}
                      onChange={(val) => setFilters(prev => ({ ...prev, maxAmount: val }))}
                      placeholder="Max"
                    />
                  </div>
                </div>

                {/* Account & Vendor */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 uppercase">Cuenta / Buscar</label>
                  <div className="flex gap-2">
                    <select
                      value={filters.paymentAccountId}
                      onChange={(e) => setFilters(prev => ({ ...prev, paymentAccountId: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="">Cuenta</option>
                      {cashBalances?.caja_menor?.id && <option value={cashBalances.caja_menor.id}>Caja Menor</option>}
                      {cashBalances?.caja_mayor?.id && <option value={cashBalances.caja_mayor.id}>Caja Mayor</option>}
                      {cashBalances?.nequi?.id && <option value={cashBalances.nequi.id}>Nequi</option>}
                      {cashBalances?.banco?.id && <option value={cashBalances.banco.id}>Banco</option>}
                    </select>
                    <input
                      type="text"
                      value={filters.vendor}
                      onChange={(e) => setFilters(prev => ({ ...prev, vendor: e.target.value }))}
                      placeholder="Buscar..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters() && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Limpiar todos los filtros
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Chart Section */}
          {showChart && stats.byCategory.length > 0 && (
            <div className="px-6 py-4 border-b bg-white">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-600" />
                Gastos por Categoria
              </h3>
              <ExpenseBarChart
                data={stats.byCategory}
                maxAmount={stats.maxCategoryAmount}
              />
            </div>
          )}

          {/* Expense List */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="text-red-600">{error}</p>
                <button
                  onClick={loadExpenses}
                  className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Reintentar
                </button>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No hay gastos que mostrar</p>
                {hasActiveFilters() && (
                  <button
                    onClick={clearFilters}
                    className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredExpenses.map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    isExpanded={expandedExpenseId === expense.id}
                    onToggle={() => setExpandedExpenseId(expandedExpenseId === expense.id ? null : expense.id)}
                    onPay={() => {
                      setPayExpense(expense);
                      setPaymentAmount(Number(expense.balance));
                    }}
                    onEditCategory={() => {
                      setEditCategoryExpense(expense);
                      setNewCategory(expense.category);
                    }}
                    onDelete={() => setDeleteExpense(expense)}
                    getCategoryLabel={getCategoryLabel}
                    getCategoryColor={getCategoryColor}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">
                Total ({filteredExpenses.length} gastos):
              </span>
              <span className="text-2xl font-bold text-gray-900">
                {formatCurrency(filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteExpense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-red-600 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Eliminar Gasto
              </h3>
              <button onClick={() => { setDeleteExpense(null); setModalError(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600">¿Estas seguro de eliminar este gasto?</p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="font-medium text-gray-900">{deleteExpense.description}</p>
                <p className="text-lg font-bold text-red-600 mt-1">{formatCurrency(deleteExpense.amount)}</p>
                <p className="text-sm text-gray-500 mt-1">{formatDateSpanish(deleteExpense.expense_date)}</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Esta accion no se puede deshacer
                </p>
              </div>
              {modalError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{modalError}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => { setDeleteExpense(null); setModalError(null); }} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                Cancelar
              </button>
              <button
                onClick={handleDeleteExpense}
                disabled={submitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editCategoryExpense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-600" />
                Editar Categoria
              </h3>
              <button onClick={() => { setEditCategoryExpense(null); setModalError(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-medium text-gray-900">{editCategoryExpense.description}</p>
                <p className="text-lg font-bold text-gray-700 mt-1">{formatCurrency(editCategoryExpense.amount)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria Actual</label>
                <span
                  className="px-3 py-1.5 text-sm font-medium rounded inline-block text-white"
                  style={{ backgroundColor: getCategoryColor(editCategoryExpense.category) }}
                >
                  {getCategoryLabel(editCategoryExpense.category)}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Categoria</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  {activeCategories.map(cat => (
                    <option key={cat.id} value={cat.code}>{cat.name}</option>
                  ))}
                </select>
              </div>
              {modalError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{modalError}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => { setEditCategoryExpense(null); setModalError(null); }} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                Cancelar
              </button>
              <button
                onClick={handleEditCategory}
                disabled={submitting || newCategory === editCategoryExpense.category}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Expense Modal */}
      {payExpense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-green-600" />
                Pagar Gasto
              </h3>
              <button onClick={() => { setPayExpense(null); setPaymentMethod(''); setPaymentAmount(0); setModalError(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-medium text-gray-900">{payExpense.description}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-gray-600">Monto total:</span>
                  <span className="font-bold text-gray-900">{formatCurrency(payExpense.amount)}</span>
                </div>
                {Number(payExpense.amount_paid) > 0 && (
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-gray-600">Ya pagado:</span>
                    <span className="font-medium text-green-600">{formatCurrency(payExpense.amount_paid)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center mt-1 pt-2 border-t">
                  <span className="text-gray-700 font-medium">Pendiente:</span>
                  <span className="font-bold text-red-600 text-lg">{formatCurrency(payExpense.balance)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto a Pagar</label>
                <CurrencyInput
                  value={paymentAmount}
                  onChange={setPaymentAmount}
                  placeholder="Monto"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Metodo de Pago *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'cash', label: 'Efectivo', icon: Wallet },
                    { value: 'nequi', label: 'Nequi', icon: CreditCard },
                    { value: 'transfer', label: 'Transferencia', icon: CreditCard },
                    { value: 'card', label: 'Tarjeta', icon: CreditCard }
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPaymentMethod(value as AccPaymentMethod)}
                      className={`flex items-center gap-2 px-3 py-2 border-2 rounded-lg transition ${
                        paymentMethod === value
                          ? 'border-green-600 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {modalError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{modalError}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => { setPayExpense(null); setPaymentMethod(''); setPaymentAmount(0); setModalError(null); }} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                Cancelar
              </button>
              <button
                onClick={handlePayExpense}
                disabled={submitting || !paymentMethod || paymentAmount <= 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Pagar {formatCurrency(paymentAmount)}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ExpenseManagementModal;
