/**
 * DebtPaymentModal - Create/Edit scheduled debt payment modal
 */
import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import CurrencyInput from '../../CurrencyInput';
import type { DebtPayment, DebtPaymentCreate } from '../../../types/api';

interface DebtPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DebtPaymentCreate) => Promise<void>;
  editingDebt?: DebtPayment | null;
  submitting: boolean;
}

const DEBT_CATEGORIES = [
  { value: 'loan', label: 'Prestamo' },
  { value: 'supplier', label: 'Proveedor' },
  { value: 'tax', label: 'Impuestos' },
  { value: 'rent', label: 'Arriendo' },
  { value: 'services', label: 'Servicios' },
  { value: 'credit_card', label: 'Tarjeta de Credito' },
  { value: 'other', label: 'Otro' },
];

const DebtPaymentModal: React.FC<DebtPaymentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingDebt,
  submitting
}) => {
  const [form, setForm] = useState<DebtPaymentCreate>({
    description: '',
    creditor: '',
    amount: 0,
    due_date: '',
    is_recurring: false,
    recurrence_day: 1,
    category: 'other',
    notes: ''
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingDebt) {
      setForm({
        description: editingDebt.description,
        creditor: editingDebt.creditor || '',
        amount: editingDebt.amount,
        due_date: editingDebt.due_date.split('T')[0],
        is_recurring: editingDebt.is_recurring,
        recurrence_day: editingDebt.recurrence_day || 1,
        category: editingDebt.category || 'other',
        notes: editingDebt.notes || ''
      });
    } else {
      // Default to next month's first day
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      const defaultDate = nextMonth.toISOString().split('T')[0];

      setForm({
        description: '',
        creditor: '',
        amount: 0,
        due_date: defaultDate,
        is_recurring: false,
        recurrence_day: 1,
        category: 'other',
        notes: ''
      });
    }
    setError(null);
  }, [editingDebt, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!form.description.trim()) {
      setError('La descripcion es requerida');
      return;
    }
    if (form.amount <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    if (!form.due_date) {
      setError('La fecha de vencimiento es requerida');
      return;
    }

    try {
      await onSubmit({
        ...form,
        creditor: form.creditor || undefined,
        notes: form.notes || undefined,
        category: form.category || undefined
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {editingDebt ? 'Editar Pago Programado' : 'Nuevo Pago Programado'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 text-red-600 px-3 py-2 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripcion *
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
                placeholder="Ej: Cuota prestamo bancario"
              />
            </div>

            {/* Creditor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Acreedor
              </label>
              <input
                type="text"
                value={form.creditor}
                onChange={(e) => setForm({ ...form, creditor: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
                placeholder="Ej: Banco de Bogota"
              />
            </div>

            {/* Amount and Category Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto *
                </label>
                <CurrencyInput
                  value={form.amount}
                  onChange={(value) => setForm({ ...form, amount: value })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
                >
                  {DEBT_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Vencimiento *
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
              />
            </div>

            {/* Recurring */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_recurring"
                checked={form.is_recurring}
                onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })}
                className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
              />
              <label htmlFor="is_recurring" className="text-sm text-gray-700">
                Es un pago recurrente
              </label>
            </div>

            {/* Recurrence Day */}
            {form.is_recurring && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dia del mes para el pago
                </label>
                <select
                  value={form.recurrence_day}
                  onChange={(e) => setForm({ ...form, recurrence_day: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
                >
                  {[...Array(28)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>Dia {i + 1}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
                placeholder="Notas adicionales..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {editingDebt ? 'Guardar Cambios' : 'Crear Pago'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DebtPaymentModal;
