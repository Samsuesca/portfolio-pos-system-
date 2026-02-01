/**
 * ExpensesTab - Main expenses management tab for Accounting page
 *
 * Features:
 * - Dashboard with statistics
 * - Bar chart by category
 * - Advanced filters
 * - Table with expandable rows and actions
 * - Create, pay, edit, delete expenses
 * - CSV export
 */
import { useState, useEffect } from 'react';
import {
  Plus, Download, X, Loader2, Trash2, Settings, CreditCard,
  AlertTriangle, Wallet, Tags, Users, ArrowRight, Search
} from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import ExpenseStats from './ExpenseStats';
import ExpenseChart from './ExpenseChart';
import ExpenseFilters from './ExpenseFilters';
import ExpenseTable from './ExpenseTable';
import ExpenseCategoryManager from './ExpenseCategoryManager';
import CurrencyInput from '../CurrencyInput';
import { formatDateSpanish } from '../DatePicker';
import useExpenses, {
  formatCurrency,
  getErrorMessage
} from '../../hooks/useExpenses';
import { useExpenseCategories } from '../../hooks/useExpenseCategories';
import { globalAccountingService } from '../../services/globalAccountingService';
import { type CashBalancesResponse } from '../../services/accountingService';
import type {
  ExpenseListItem,
  ExpensePayment,
  ExpenseCategory,
  AccPaymentMethod
} from '../../types/api';

interface ExpensesTabProps {
  cashBalances: CashBalancesResponse | null;
  onDataChange: () => void;
  onCreateExpense?: () => void; // Opens create expense modal in parent
}

const ExpensesTab: React.FC<ExpensesTabProps> = ({
  cashBalances,
  onDataChange,
  onCreateExpense
}) => {
  // Use expenses hook
  const {
    filteredExpenses,
    stats,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    hasMore,
    loadingMore,
    loadMore,
    refresh,
    exportCSV
  } = useExpenses({ cashBalances });

  // Use expense categories hook for dynamic categories
  const {
    activeCategories,
    getCategoryLabel,
    getCategoryColor
  } = useExpenseCategories();

  // View states
  const [showFilters, setShowFilters] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

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
  const [hidePayrollAlert, setHidePayrollAlert] = useState(false);

  // Search state with debounce
  const [searchTerm, setSearchTerm] = useState(filters.vendor || '');
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Apply debounced search to filters
  useEffect(() => {
    if (debouncedSearch !== filters.vendor) {
      setFilters(prev => ({ ...prev, vendor: debouncedSearch }));
    }
  }, [debouncedSearch]);

  // Sync search term when filters are cleared
  useEffect(() => {
    if (filters.vendor === '' && searchTerm !== '') {
      setSearchTerm('');
    }
  }, [filters.vendor]);

  // Check for payroll expenses (manual payroll entries instead of using Payroll module)
  const payrollExpenses = filteredExpenses.filter(e => e.category === 'payroll');
  const hasManualPayrollExpenses = payrollExpenses.length > 0 && !hidePayrollAlert;

  // Handle delete expense
  const handleDeleteExpense = async () => {
    if (!deleteExpense) return;

    try {
      setSubmitting(true);
      setModalError(null);
      await globalAccountingService.deleteGlobalExpense(deleteExpense.id);
      setDeleteExpense(null);
      await refresh();
      onDataChange();
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
      await refresh();
      onDataChange();
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
      await refresh();
      onDataChange();
    } catch (err) {
      console.error('Error paying expense:', err);
      setModalError(getErrorMessage(err, 'Error al pagar gasto'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion de Gastos</h2>
          <p className="text-gray-500 mt-1">Administra y analiza todos los gastos del negocio</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCategoryManager(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            <Tags className="w-5 h-5" />
            <span className="hidden sm:inline">Categorias</span>
          </button>
          <button
            onClick={exportCSV}
            disabled={filteredExpenses.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
          {onCreateExpense && (
            <button
              onClick={onCreateExpense}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Nuevo Gasto
            </button>
          )}
        </div>
      </div>

      {/* Search Bar - Always visible */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por proveedor, descripcion, categoria..."
          className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base shadow-sm"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <ExpenseStats
        stats={stats}
        activeFilter={statusFilter}
        onFilterClick={setStatusFilter}
      />

      {/* Payroll Alert - Recommend using Payroll module */}
      {hasManualPayrollExpenses && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Users className="w-5 h-5 text-blue-600 mt-0.5" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-blue-800">
                Gastos de nomina detectados
              </h4>
              <p className="text-sm text-blue-700 mt-1">
                Se encontraron <span className="font-semibold">{payrollExpenses.length}</span> gasto(s)
                de nomina registrados manualmente por un total de{' '}
                <span className="font-semibold">
                  {formatCurrency(payrollExpenses.reduce((sum, e) => sum + Number(e.amount), 0))}
                </span>.
              </p>
              <p className="text-sm text-blue-600 mt-2">
                Para mejor gestion y proyeccion financiera, usa el <strong>modulo de Nomina</strong> en
                lugar de registrar gastos manuales. El modulo permite gestionar empleados,
                bonificaciones y genera automaticamente los gastos al aprobar la nomina.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <a
                  href="/payroll"
                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900 underline"
                >
                  Ir al modulo de Nomina
                  <ArrowRight className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setHidePayrollAlert(true)}
                  className="text-sm text-blue-500 hover:text-blue-700"
                >
                  Ocultar alerta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <ExpenseFilters
        filters={filters}
        onChange={setFilters}
        cashBalances={cashBalances}
        visible={showFilters}
        onToggle={() => setShowFilters(!showFilters)}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Chart */}
      <ExpenseChart
        data={stats.byCategory}
        maxAmount={stats.maxCategoryAmount}
        visible={showChart}
        onToggle={() => setShowChart(!showChart)}
      />

      {/* Table */}
      <ExpenseTable
        expenses={filteredExpenses}
        loading={loading}
        loadingMore={loadingMore}
        expandedId={expandedExpenseId}
        onToggleExpand={(id) => setExpandedExpenseId(expandedExpenseId === id ? null : id)}
        onPay={(expense) => {
          setPayExpense(expense);
          setPaymentAmount(Number(expense.balance));
          setModalError(null);
        }}
        onEditCategory={(expense) => {
          setEditCategoryExpense(expense);
          setNewCategory(expense.category);
          setModalError(null);
        }}
        onDelete={(expense) => {
          setDeleteExpense(expense);
          setModalError(null);
        }}
        hasMore={hasMore}
        onLoadMore={loadMore}
        error={error}
        onRetry={refresh}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Delete Confirmation Modal */}
      {deleteExpense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-red-600 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Eliminar Gasto
              </h3>
              <button
                onClick={() => { setDeleteExpense(null); setModalError(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
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
              <button
                onClick={() => { setDeleteExpense(null); setModalError(null); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-600" />
                Editar Categoria
              </h3>
              <button
                onClick={() => { setEditCategoryExpense(null); setModalError(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
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
              <button
                onClick={() => { setEditCategoryExpense(null); setModalError(null); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-green-600" />
                Pagar Gasto
              </h3>
              <button
                onClick={() => {
                  setPayExpense(null);
                  setPaymentMethod('');
                  setPaymentAmount(0);
                  setModalError(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
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
              <button
                onClick={() => {
                  setPayExpense(null);
                  setPaymentMethod('');
                  setPaymentAmount(0);
                  setModalError(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
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

      {/* Category Manager Modal */}
      <ExpenseCategoryManager
        isOpen={showCategoryManager}
        onClose={() => {
          setShowCategoryManager(false);
          // Refresh to pick up any category changes
          refresh();
        }}
      />
    </div>
  );
};

export default ExpensesTab;
