'use client';

import {
  ChevronDown, ChevronUp, Loader2, Receipt, AlertCircle,
  CreditCard, Settings, Trash2, Calendar, CheckCircle, Clock
} from 'lucide-react';
import { formatDateSpanish } from '@/components/ui/DatePicker';
import { formatCurrency } from '@/lib/hooks/useExpenses';
import { useExpenseCategories } from '@/lib/hooks/useExpenseCategories';
import { getPaymentMethodLabel } from '@/lib/services/accountingService';
import type { Expense } from '@/lib/services/accountingService';

interface ExpenseTableProps {
  expenses: Expense[];
  loading: boolean;
  loadingMore: boolean;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onPay: (expense: Expense) => void;
  onEditCategory: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  error: string | null;
  onRetry: () => void;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
  canPay?: boolean;
}

const ExpenseTable: React.FC<ExpenseTableProps> = ({
  expenses,
  loading,
  loadingMore,
  expandedId,
  onToggleExpand,
  onPay,
  onEditCategory,
  onDelete,
  hasMore,
  onLoadMore,
  error,
  onRetry,
  onClearFilters,
  hasActiveFilters,
  canPay = true
}) => {
  const { getCategoryLabel, getCategoryColor } = useExpenseCategories();

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12">
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
          <p className="text-slate-500">Cargando gastos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12">
        <div className="flex flex-col items-center justify-center">
          <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
          <p className="text-red-600 mb-3">{error}</p>
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12">
        <div className="flex flex-col items-center justify-center text-slate-500">
          <Receipt className="w-16 h-16 mb-4 opacity-40" />
          <p className="text-lg font-medium mb-2">No hay gastos que mostrar</p>
          {hasActiveFilters && onClearFilters && (
            <button
              onClick={onClearFilters}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Table Header */}
      <div className="hidden md:grid md:grid-cols-12 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wide">
        <div className="col-span-1">Fecha</div>
        <div className="col-span-2">Categoria</div>
        <div className="col-span-4">Descripcion</div>
        <div className="col-span-2 text-right">Monto</div>
        <div className="col-span-2">Estado</div>
        <div className="col-span-1"></div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-slate-100">
        {expenses.map((expense) => {
          const isExpanded = expandedId === expense.id;
          const paymentProgress = expense.amount_paid > 0 && expense.amount > 0
            ? (Number(expense.amount_paid) / Number(expense.amount)) * 100
            : 0;

          return (
            <div key={expense.id} className={`transition ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
              {/* Row */}
              <div
                onClick={() => onToggleExpand(expense.id)}
                className="grid grid-cols-12 gap-4 px-5 py-4 cursor-pointer items-center"
              >
                {/* Date */}
                <div className="col-span-6 md:col-span-1">
                  <span className="text-sm text-slate-600">
                    {formatDateSpanish(expense.expense_date)}
                  </span>
                </div>

                {/* Category */}
                <div className="col-span-6 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-1.5 h-6 rounded-full"
                      style={{ backgroundColor: getCategoryColor(expense.category) }}
                    />
                    <span
                      className="px-2 py-1 text-xs font-medium rounded text-white"
                      style={{ backgroundColor: getCategoryColor(expense.category) }}
                    >
                      {getCategoryLabel(expense.category)}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div className="col-span-12 md:col-span-4 order-last md:order-none">
                  <p className="font-medium text-slate-900 truncate">{expense.description}</p>
                  {expense.vendor && (
                    <p className="text-sm text-slate-500 truncate">{expense.vendor}</p>
                  )}
                </div>

                {/* Amount */}
                <div className="col-span-6 md:col-span-2 text-right">
                  <p className="font-bold text-slate-900">{formatCurrency(expense.amount)}</p>
                  {!expense.is_paid && Number(expense.amount_paid) > 0 && (
                    <p className="text-xs text-red-600">
                      Pend: {formatCurrency(expense.balance)}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div className="col-span-4 md:col-span-2">
                  {expense.is_paid ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Pagado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                      <Clock className="w-3.5 h-3.5" />
                      Pendiente
                    </span>
                  )}
                </div>

                {/* Expand Icon */}
                <div className="col-span-2 md:col-span-1 text-right">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400 inline" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 inline" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-200 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Payment Progress */}
                    {!expense.is_paid && Number(expense.amount_paid) > 0 && (
                      <div className="col-span-full">
                        <div className="flex justify-between text-xs text-slate-600 mb-1">
                          <span>Progreso de Pago</span>
                          <span>{paymentProgress.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all"
                            style={{ width: `${paymentProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Details */}
                    <div className="space-y-2 text-sm">
                      {expense.due_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600">Vencimiento:</span>
                          <span className={`font-medium ${
                            new Date(expense.due_date) < new Date() && !expense.is_paid
                              ? 'text-red-600'
                              : 'text-slate-900'
                          }`}>
                            {formatDateSpanish(expense.due_date)}
                          </span>
                        </div>
                      )}
                      {expense.is_paid && expense.paid_at && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-slate-600">Pagado:</span>
                          <span className="font-medium text-slate-900">
                            {formatDateSpanish(expense.paid_at.split('T')[0])}
                          </span>
                        </div>
                      )}
                      {expense.is_paid && expense.payment_account_name && (
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600">Cuenta:</span>
                          <span className="font-medium text-slate-900">{expense.payment_account_name}</span>
                        </div>
                      )}
                      {expense.is_paid && expense.payment_method && (
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600">Metodo:</span>
                          <span className="font-medium text-slate-900">
                            {getPaymentMethodLabel(expense.payment_method)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    {expense.notes && (
                      <div className="text-sm">
                        <span className="text-slate-600">Notas:</span>
                        <p className="text-slate-900 mt-1">{expense.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                    {!expense.is_paid && canPay && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onPay(expense); }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition"
                      >
                        <CreditCard className="w-4 h-4" />
                        Pagar
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditCategory(expense); }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition"
                    >
                      <Settings className="w-4 h-4" />
                      Categoria
                    </button>
                    {!expense.is_paid && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(expense); }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition"
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
        })}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando...
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Cargar mas gastos
              </>
            )}
          </button>
        </div>
      )}

      {/* Footer Summary */}
      <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
        <span className="text-slate-600">
          Mostrando <span className="font-semibold">{expenses.length}</span> gastos
        </span>
        <span className="text-lg font-bold text-slate-900">
          Total: {formatCurrency(expenses.reduce((sum, e) => sum + Number(e.amount), 0))}
        </span>
      </div>
    </div>
  );
};

export default ExpenseTable;
