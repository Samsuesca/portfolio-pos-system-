'use client';

import { useState, useEffect } from 'react';
import {
  Plus, Download, X, Loader2, Trash2, Settings, CreditCard,
  AlertTriangle, Wallet, Tags, Search
} from 'lucide-react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import ExpenseStats from './ExpenseStats';
import ExpenseChart from './ExpenseChart';
import ExpenseFilters from './ExpenseFilters';
import ExpenseTable from './ExpenseTable';
import CreateExpenseModal from './CreateExpenseModal';
import ExpenseCategoryManager from './ExpenseCategoryManager';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { formatDateSpanish } from '@/components/ui/DatePicker';
import useExpenses, { formatCurrency, getErrorMessage } from '@/lib/hooks/useExpenses';
import { useExpenseCategories } from '@/lib/hooks/useExpenseCategories';
import accountingService from '@/lib/services/accountingService';
import type { Expense, CashBalances, PaymentMethod } from '@/lib/services/accountingService';

interface ExpensesSectionProps {
  cashBalances: CashBalances | null;
  onDataChange: () => void;
  canCreate?: boolean;
  canPay?: boolean;
}

const ExpensesSection: React.FC<ExpensesSectionProps> = ({
  cashBalances,
  onDataChange,
  canCreate = true,
  canPay = true
}) => {
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

  const {
    activeCategories,
    getCategoryLabel,
    getCategoryColor
  } = useExpenseCategories();

  // View states
  const [showFilters, setShowFilters] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // Modal states
  const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null);
  const [editCategoryExpense, setEditCategoryExpense] = useState<Expense | null>(null);
  const [newCategory, setNewCategory] = useState<string>('other');
  const [payExpense, setPayExpense] = useState<Expense | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  // Action states
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

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

  // Handle delete expense
  const handleDeleteExpense = async () => {
    if (!deleteExpense) return;

    try {
      setSubmitting(true);
      setModalError(null);
      await accountingService.deleteExpense(deleteExpense.id);
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
      await accountingService.updateExpense(editCategoryExpense.id, {
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

      await accountingService.payExpense(payExpense.id, {
        amount: paymentAmount || Number(payExpense.balance),
        payment_method: paymentMethod
      });
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
          <h2 className="text-2xl font-bold text-slate-900">Gestion de Gastos</h2>
          <p className="text-slate-500 mt-1">Administra y analiza todos los gastos del negocio</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCategoryManager(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
          >
            <Tags className="w-5 h-5" />
            <span className="hidden sm:inline">Categorias</span>
          </button>
          <button
            onClick={exportCSV}
            disabled={filteredExpenses.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
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
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por proveedor, descripcion, categoria..."
          className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base shadow-sm"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
        canPay={canPay}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Create Expense Modal */}
      <CreateExpenseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          refresh();
          onDataChange();
        }}
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
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-600">¿Estas seguro de eliminar este gasto?</p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="font-medium text-slate-900">{deleteExpense.description}</p>
                <p className="text-lg font-bold text-red-600 mt-1">{formatCurrency(deleteExpense.amount)}</p>
                <p className="text-sm text-slate-500 mt-1">{formatDateSpanish(deleteExpense.expense_date)}</p>
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
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-xl">
              <button
                onClick={() => { setDeleteExpense(null); setModalError(null); }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
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
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="font-medium text-slate-900">{editCategoryExpense.description}</p>
                <p className="text-lg font-bold text-slate-700 mt-1">{formatCurrency(editCategoryExpense.amount)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria Actual</label>
                <span
                  className="px-3 py-1.5 text-sm font-medium rounded inline-block text-white"
                  style={{ backgroundColor: getCategoryColor(editCategoryExpense.category) }}
                >
                  {getCategoryLabel(editCategoryExpense.category)}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nueva Categoria</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-xl">
              <button
                onClick={() => { setEditCategoryExpense(null); setModalError(null); }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
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
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="font-medium text-slate-900">{payExpense.description}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-slate-600">Monto total:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(payExpense.amount)}</span>
                </div>
                {Number(payExpense.amount_paid) > 0 && (
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-slate-600">Ya pagado:</span>
                    <span className="font-medium text-green-600">{formatCurrency(payExpense.amount_paid)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center mt-1 pt-2 border-t">
                  <span className="text-slate-700 font-medium">Pendiente:</span>
                  <span className="font-bold text-red-600 text-lg">{formatCurrency(payExpense.balance)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto a Pagar</label>
                <CurrencyInput
                  value={paymentAmount}
                  onChange={setPaymentAmount}
                  placeholder="Monto"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Metodo de Pago *</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'cash' as const, label: 'Efectivo', icon: Wallet },
                    { value: 'nequi' as const, label: 'Nequi', icon: CreditCard },
                    { value: 'transfer' as const, label: 'Transferencia', icon: CreditCard },
                    { value: 'card' as const, label: 'Tarjeta', icon: CreditCard }
                  ] as const).map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPaymentMethod(value)}
                      className={`flex items-center gap-2 px-3 py-2 border-2 rounded-lg transition ${
                        paymentMethod === value
                          ? 'border-green-600 bg-green-50 text-green-700'
                          : 'border-slate-200 hover:border-slate-300'
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
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-xl">
              <button
                onClick={() => {
                  setPayExpense(null);
                  setPaymentMethod('');
                  setPaymentAmount(0);
                  setModalError(null);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
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
          refresh();
        }}
      />
    </div>
  );
};

export default ExpensesSection;
