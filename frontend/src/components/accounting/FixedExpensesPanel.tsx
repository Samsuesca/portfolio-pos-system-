/**
 * FixedExpensesPanel - Fixed/recurring expenses management component
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Clock, DollarSign, CalendarClock, CheckCircle,
  Pencil, Trash2, Loader2, X, Users, ExternalLink
} from 'lucide-react';
import CurrencyInput from '../CurrencyInput';
import {
  getExpenseTypeLabel,
  getFrequencyLabel,
  getExpenseTypeColor,
  formatAmountRange
} from '../../services/fixedExpenseService';
import { useExpenseCategories } from '../../hooks/useExpenseCategories';
import type {
  FixedExpenseListItem,
  FixedExpenseCreate,
  FixedExpenseUpdate,
  FixedExpenseType,
  ExpenseFrequency,
  PendingGenerationResponse,
  ExpenseCategory
} from './types';

interface FixedExpensesPanelProps {
  fixedExpensesList: FixedExpenseListItem[];
  pendingGeneration: PendingGenerationResponse | null;
  filter: 'all' | 'active' | 'inactive';
  onFilterChange: (filter: 'all' | 'active' | 'inactive') => void;
  onCreateExpense: (data: FixedExpenseCreate) => Promise<void>;
  onUpdateExpense: (id: string, data: FixedExpenseUpdate) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  onGenerateExpenses: () => Promise<void>;
  submitting: boolean;
  generatingExpenses: boolean;
}

const FixedExpensesPanel: React.FC<FixedExpensesPanelProps> = ({
  fixedExpensesList,
  pendingGeneration,
  filter,
  onFilterChange,
  onCreateExpense,
  onUpdateExpense,
  onDeleteExpense,
  onGenerateExpenses,
  submitting,
  generatingExpenses
}) => {
  // Use dynamic categories from hook
  const { activeCategories, getCategoryLabel, getCategoryColor } = useExpenseCategories();

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FixedExpenseListItem | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [useAdvancedRecurrence, setUseAdvancedRecurrence] = useState(false);

  // Form state
  const [form, setForm] = useState<Partial<FixedExpenseCreate>>({
    name: '',
    description: '',
    category: 'other',
    expense_type: 'exact',
    amount: 0,
    frequency: 'monthly',
    day_of_month: 1,
    auto_generate: true,
    vendor: '',
    recurrence_frequency: undefined,
    recurrence_interval: 1,
    recurrence_weekdays: [],
    recurrence_month_days: [],
    recurrence_month_day_type: undefined,
  });

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      category: 'other',
      expense_type: 'exact',
      amount: 0,
      frequency: 'monthly',
      day_of_month: 1,
      auto_generate: true,
      vendor: '',
      recurrence_frequency: undefined,
      recurrence_interval: 1,
      recurrence_weekdays: [],
      recurrence_month_days: [],
      recurrence_month_day_type: undefined,
    });
    setUseAdvancedRecurrence(false);
  };

  const openCreateModal = () => {
    setEditingExpense(null);
    resetForm();
    setModalError(null);
    setShowModal(true);
  };

  const openEditModal = (item: FixedExpenseListItem) => {
    setEditingExpense(item);
    const usesAdvanced = item.uses_new_recurrence || item.recurrence_frequency != null;
    setUseAdvancedRecurrence(usesAdvanced);
    setForm({
      name: item.name,
      description: '',
      category: item.category,
      expense_type: item.expense_type,
      amount: item.amount,
      min_amount: item.min_amount ?? undefined,
      max_amount: item.max_amount ?? undefined,
      frequency: item.frequency ?? undefined,
      day_of_month: item.day_of_month ?? undefined,
      recurrence_frequency: item.recurrence_frequency ?? undefined,
      recurrence_interval: item.recurrence_interval ?? 1,
      recurrence_weekdays: item.recurrence_weekdays ?? [],
      recurrence_month_days: item.recurrence_month_days ?? [],
      recurrence_month_day_type: item.recurrence_month_day_type ?? undefined,
      auto_generate: item.auto_generate,
      vendor: item.vendor || ''
    });
    setModalError(null);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.amount) return;
    try {
      if (editingExpense) {
        await onUpdateExpense(editingExpense.id, form as FixedExpenseUpdate);
      } else {
        await onCreateExpense(form as FixedExpenseCreate);
      }
      setShowModal(false);
      setEditingExpense(null);
      resetForm();
    } catch (err: any) {
      setModalError(err.message || 'Error al guardar gasto fijo');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Esta seguro de eliminar este gasto fijo?')) return;
    await onDeleteExpense(id);
  };

  // Calculate monthly estimate
  const monthlyEstimate = fixedExpensesList
    .filter(e => e.is_active)
    .reduce((sum, e) => {
      const amount = Number(e.amount);
      if (e.uses_new_recurrence || e.recurrence_frequency) {
        const interval = e.recurrence_interval || 1;
        switch (e.recurrence_frequency) {
          case 'daily':
            return sum + (amount * (30 / interval));
          case 'weekly':
            const weekdayCount = e.recurrence_weekdays?.length || 1;
            return sum + (amount * ((4 / interval) * weekdayCount));
          case 'monthly':
            const monthDayCount = e.recurrence_month_days?.length || 1;
            return sum + (amount * (monthDayCount / interval));
          case 'yearly':
            return sum + (amount * (1 / (12 * interval)));
          default:
            return sum + amount;
        }
      }
      const legacyMultiplier: Record<string, number> = {
        'weekly': 4,
        'biweekly': 2,
        'monthly': 1,
        'quarterly': 1/3,
        'yearly': 1/12
      };
      return sum + (amount * (legacyMultiplier[e.frequency || 'monthly'] || 1));
    }, 0);

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Gastos Fijos Activos</p>
              <p className="text-2xl font-bold text-gray-800">
                {fixedExpensesList.filter(e => e.is_active).length}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <CalendarClock className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Mensual Estimado</p>
              <p className="text-2xl font-bold text-green-600">
                ${monthlyEstimate.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pendientes de Generar</p>
              <p className="text-2xl font-bold text-amber-600">
                {pendingGeneration?.pending_count || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          {pendingGeneration && pendingGeneration.pending_count > 0 && (
            <button
              onClick={onGenerateExpenses}
              disabled={generatingExpenses}
              className="mt-3 w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {generatingExpenses ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Generar Gastos del Mes
            </button>
          )}
        </div>
      </div>

      {/* Payroll Integration Info Banner */}
      {fixedExpensesList.some(e => e.category === 'payroll' && e.name === 'Nómina Mensual') ? (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-800">
                <strong>Nomina Mensual</strong> esta integrada automaticamente desde el modulo de Nomina.
              </span>
            </div>
            <Link
              to="/payroll"
              className="flex items-center gap-1 text-sm text-green-700 hover:text-green-900 font-medium"
            >
              Ir a Nomina <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                Gestiona la nomina desde el modulo dedicado para integrarla automaticamente aqui.
              </span>
            </div>
            <Link
              to="/payroll"
              className="flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900 font-medium"
            >
              Ir a Nomina <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="all">Todos</option>
          </select>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nuevo Gasto Fijo
        </button>
      </div>

      {/* Fixed Expenses Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frecuencia</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prox. Generacion</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {fixedExpensesList.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  No hay gastos fijos configurados
                </td>
              </tr>
            ) : (
              fixedExpensesList.map((item) => {
                const isPayrollManaged = item.category === 'payroll' && item.name === 'Nómina Mensual';
                return (
                <tr key={item.id} className={`${!item.is_active ? 'bg-gray-50 opacity-60' : ''} ${isPayrollManaged ? 'bg-green-50/50' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{item.name}</span>
                      {isPayrollManaged && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                          <Users className="w-3 h-3" /> Auto
                        </span>
                      )}
                    </div>
                    {item.vendor && <div className="text-sm text-gray-500">{item.vendor}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="inline-flex px-2 py-1 text-xs font-medium rounded-full text-white"
                      style={{ backgroundColor: getCategoryColor(item.category) }}
                    >
                      {getCategoryLabel(item.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getExpenseTypeColor(item.expense_type)}`}>
                      {getExpenseTypeLabel(item.expense_type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium">
                    {item.expense_type === 'variable' ? (
                      formatAmountRange(item.amount, item.min_amount, item.max_amount, item.expense_type)
                    ) : (
                      `$${item.amount.toLocaleString('es-CO')}`
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {item.uses_new_recurrence || item.recurrence_frequency ? (
                      <>
                        {item.recurrence_frequency === 'daily' && `Diario`}
                        {item.recurrence_frequency === 'weekly' && `Semanal`}
                        {item.recurrence_frequency === 'monthly' && `Mensual`}
                        {item.recurrence_frequency === 'yearly' && `Anual`}
                        {(item.recurrence_interval && item.recurrence_interval > 1) && ` (cada ${item.recurrence_interval})`}
                        {item.recurrence_weekdays && item.recurrence_weekdays.length > 0 && (
                          <span className="text-xs text-blue-600 ml-1">
                            ({item.recurrence_weekdays.length} dias)
                          </span>
                        )}
                        {item.recurrence_month_days && item.recurrence_month_days.length > 0 && (
                          <span className="text-xs text-blue-600 ml-1">
                            (dias: {item.recurrence_month_days.join(', ')})
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {item.frequency ? getFrequencyLabel(item.frequency) : '-'}
                        {item.day_of_month && ` (dia ${item.day_of_month})`}
                      </>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {item.next_generation_date ? (
                      (() => {
                        const nextDate = new Date(item.next_generation_date + 'T00:00:00');
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const isPastDue = nextDate <= today;
                        return (
                          <span className={`inline-flex items-center gap-1 ${isPastDue ? 'text-amber-600 font-medium' : 'text-gray-600'}`}>
                            {isPastDue && <Clock className="w-3 h-3" />}
                            {nextDate.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${item.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {item.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );})
            )}
          </tbody>
        </table>
      </div>

      {/* Fixed Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">
                {editingExpense ? 'Editar Gasto Fijo' : 'Nuevo Gasto Fijo'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingExpense(null);
                  setModalError(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {modalError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.name || ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Internet Claro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                <input
                  type="text"
                  value={form.vendor || ''}
                  onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Claro Colombia"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select
                    value={form.category || 'other'}
                    onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {activeCategories.map(cat => (
                      <option key={cat.code} value={cat.code}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={form.expense_type || 'exact'}
                    onChange={(e) => setForm({ ...form, expense_type: e.target.value as FixedExpenseType })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="exact">Valor Exacto</option>
                    <option value="variable">Valor Variable</option>
                  </select>
                </div>
              </div>

              {form.expense_type === 'exact' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
                  <CurrencyInput
                    value={form.amount || 0}
                    onChange={(val) => setForm({ ...form, amount: val })}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monto Base</label>
                    <CurrencyInput
                      value={form.amount || 0}
                      onChange={(val) => setForm({ ...form, amount: val })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Minimo</label>
                    <CurrencyInput
                      value={form.min_amount || 0}
                      onChange={(val) => setForm({ ...form, min_amount: val })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Maximo</label>
                    <CurrencyInput
                      value={form.max_amount || 0}
                      onChange={(val) => setForm({ ...form, max_amount: val })}
                    />
                  </div>
                </div>
              )}

              {/* Frequency Toggle */}
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="use_advanced_recurrence"
                  checked={useAdvancedRecurrence}
                  onChange={(e) => {
                    setUseAdvancedRecurrence(e.target.checked);
                    if (e.target.checked) {
                      setForm({
                        ...form,
                        frequency: undefined,
                        recurrence_frequency: 'monthly',
                        recurrence_interval: 1,
                      });
                    } else {
                      setForm({
                        ...form,
                        frequency: 'monthly',
                        recurrence_frequency: undefined,
                        recurrence_weekdays: [],
                        recurrence_month_days: [],
                      });
                    }
                  }}
                  className="rounded border-gray-300"
                />
                <label htmlFor="use_advanced_recurrence" className="text-sm text-gray-600">
                  Periodicidad avanzada (estilo calendario)
                </label>
              </div>

              {!useAdvancedRecurrence ? (
                /* Legacy simple frequency */
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia</label>
                    <select
                      value={form.frequency || 'monthly'}
                      onChange={(e) => setForm({ ...form, frequency: e.target.value as ExpenseFrequency })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="weekly">Semanal</option>
                      <option value="biweekly">Quincenal</option>
                      <option value="monthly">Mensual</option>
                      <option value="quarterly">Trimestral</option>
                      <option value="yearly">Anual</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dia del Mes</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={form.day_of_month || 1}
                      onChange={(e) => setForm({ ...form, day_of_month: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ) : (
                /* Advanced recurrence system */
                <div className="space-y-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia Base</label>
                      <select
                        value={form.recurrence_frequency || 'monthly'}
                        onChange={(e) => setForm({
                          ...form,
                          recurrence_frequency: e.target.value as any,
                          recurrence_weekdays: [],
                          recurrence_month_days: [],
                        })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="daily">Diario</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensual</option>
                        <option value="yearly">Anual</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cada</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={form.recurrence_interval || 1}
                          onChange={(e) => setForm({ ...form, recurrence_interval: parseInt(e.target.value) || 1 })}
                          className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <span className="text-sm text-gray-600">
                          {form.recurrence_frequency === 'daily' ? 'dia(s)' :
                           form.recurrence_frequency === 'weekly' ? 'semana(s)' :
                           form.recurrence_frequency === 'monthly' ? 'mes(es)' : 'anio(s)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Weekly: Day selection */}
                  {form.recurrence_frequency === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Dias de la Semana</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'monday', label: 'Lun' },
                          { value: 'tuesday', label: 'Mar' },
                          { value: 'wednesday', label: 'Mie' },
                          { value: 'thursday', label: 'Jue' },
                          { value: 'friday', label: 'Vie' },
                          { value: 'saturday', label: 'Sab' },
                          { value: 'sunday', label: 'Dom' },
                        ].map(day => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => {
                              const current = form.recurrence_weekdays || [];
                              const updated = current.includes(day.value as any)
                                ? current.filter(d => d !== day.value)
                                : [...current, day.value as any];
                              setForm({ ...form, recurrence_weekdays: updated });
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              (form.recurrence_weekdays || []).includes(day.value as any)
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Monthly: Day of month selection */}
                  {form.recurrence_frequency === 'monthly' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Dia</label>
                        <select
                          value={form.recurrence_month_day_type || 'specific'}
                          onChange={(e) => setForm({
                            ...form,
                            recurrence_month_day_type: e.target.value === 'specific' ? undefined : e.target.value as any,
                            recurrence_month_days: e.target.value === 'specific' ? [1] : [],
                          })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="specific">Dia especifico</option>
                          <option value="last_day">Ultimo dia del mes</option>
                          <option value="first_weekday">Primer dia habil</option>
                          <option value="last_weekday">Ultimo dia habil</option>
                        </select>
                      </div>

                      {(!form.recurrence_month_day_type || form.recurrence_month_day_type === 'specific') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Dias del Mes (click para seleccionar)</label>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  const current = form.recurrence_month_days || [];
                                  const updated = current.includes(day)
                                    ? current.filter(d => d !== day)
                                    : [...current, day].sort((a, b) => a - b);
                                  setForm({ ...form, recurrence_month_days: updated });
                                }}
                                className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                                  (form.recurrence_month_days || []).includes(day)
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Seleccionados: {(form.recurrence_month_days || []).join(', ') || 'Ninguno'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <textarea
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Descripcion adicional..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_generate"
                  checked={form.auto_generate ?? true}
                  onChange={(e) => setForm({ ...form, auto_generate: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="auto_generate" className="text-sm text-gray-700">
                  Generar gastos automaticamente
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingExpense(null);
                  setModalError(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !form.name || !form.amount}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingExpense ? 'Guardar Cambios' : 'Crear Gasto Fijo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FixedExpensesPanel;
