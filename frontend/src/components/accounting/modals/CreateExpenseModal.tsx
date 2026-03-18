/**
 * CreateExpenseModal - Modal for creating new expenses
 *
 * Uses dynamic expense categories from useExpenseCategories hook.
 */
import { useState } from 'react';
import {
  X, Loader2, Receipt, Calendar, DollarSign, User,
  FileText, Hash, StickyNote
} from 'lucide-react';
import DatePicker from '../../DatePicker';
import CurrencyInput from '../../CurrencyInput';
import { useExpenseCategories } from '../../../hooks/useExpenseCategories';
import { globalAccountingService } from '../../../services/globalAccountingService';
import { getColombiaDateString } from '../../../utils/formatting';
import type { ExpenseCreate, ExpenseCategory } from '../../../types/api';

interface CreateExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Form state type
interface ExpenseFormState {
  category: ExpenseCategory | '';
  description: string;
  amount: number;
  expense_date: string;
  due_date: string;
  vendor: string;
  receipt_number: string;
  notes: string;
}

// Initial form state - using function to get current Colombia date
const getInitialFormState = (): ExpenseFormState => ({
  category: '',
  description: '',
  amount: 0,
  expense_date: getColombiaDateString(),
  due_date: '',
  vendor: '',
  receipt_number: '',
  notes: ''
});

// Get error message helper
const getErrorMessage = (err: unknown, defaultMessage: string): string => {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  if (err instanceof Error) return err.message;
  return defaultMessage;
};

const CreateExpenseModal: React.FC<CreateExpenseModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  // Form state
  const [form, setForm] = useState<ExpenseFormState>(getInitialFormState());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load dynamic categories
  const {
    activeCategories,
    loading: loadingCategories,
    getCategoryColor
  } = useExpenseCategories();

  // Reset form
  const resetForm = () => {
    setForm(getInitialFormState());
    setError(null);
  };

  // Handle close
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!form.category) {
      setError('Selecciona una categoria');
      return;
    }
    if (!form.description.trim()) {
      setError('La descripcion es requerida');
      return;
    }
    if (form.amount <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    if (!form.expense_date) {
      setError('La fecha es requerida');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const expenseData: Omit<ExpenseCreate, 'school_id'> = {
        category: form.category as ExpenseCategory,
        description: form.description.trim(),
        amount: form.amount,
        expense_date: form.expense_date,
        ...(form.due_date && { due_date: form.due_date }),
        ...(form.vendor.trim() && { vendor: form.vendor.trim() }),
        ...(form.receipt_number.trim() && { receipt_number: form.receipt_number.trim() }),
        ...(form.notes.trim() && { notes: form.notes.trim() })
      };

      await globalAccountingService.createGlobalExpense(expenseData);

      // Success
      handleClose();
      onSuccess?.();
    } catch (err) {
      console.error('Error creating expense:', err);
      setError(getErrorMessage(err, 'Error al crear el gasto'));
    } finally {
      setSubmitting(false);
    }
  };

  // Update form field
  const updateField = <K extends keyof ExpenseFormState>(
    key: K,
    value: ExpenseFormState[K]
  ) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-violet-50 to-indigo-50">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-brand-600" />
            Nuevo Gasto
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-white/50 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Category */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <span className="text-red-500">*</span>
              Categoria
            </label>
            {loadingCategories ? (
              <div className="flex items-center gap-2 text-gray-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando categorias...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {activeCategories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => updateField('category', cat.code as ExpenseCategory)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                        form.category === cat.code
                          ? 'border-brand-500 ring-2 ring-brand-100'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      style={{
                        backgroundColor: form.category === cat.code
                          ? `${getCategoryColor(cat.code)}15`
                          : undefined,
                        borderColor: form.category === cat.code
                          ? getCategoryColor(cat.code)
                          : undefined
                      }}
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-2"
                        style={{ backgroundColor: getCategoryColor(cat.code) }}
                      />
                      {cat.name}
                    </button>
                  ))}
                </div>
                {form.category && (() => {
                  const selected = activeCategories.find(c => c.code === form.category);
                  return selected?.description ? (
                    <p className="mt-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                      {selected.description}
                    </p>
                  ) : null;
                })()}
              </>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-red-500">*</span>
              Descripcion
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Ej: Pago de arriendo local"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <span className="text-red-500">*</span>
              Monto
            </label>
            <CurrencyInput
              value={form.amount}
              onChange={(val) => updateField('amount', val)}
              placeholder="0"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-red-500">*</span>
                Fecha del Gasto
              </label>
              <DatePicker
                value={form.expense_date}
                onChange={(val) => updateField('expense_date', val)}
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                Fecha de Vencimiento
              </label>
              <DatePicker
                value={form.due_date}
                onChange={(val) => updateField('due_date', val)}
                placeholder="Opcional"
              />
            </div>
          </div>

          {/* Vendor */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 text-gray-400" />
              Proveedor / Vendedor
            </label>
            <input
              type="text"
              value={form.vendor}
              onChange={(e) => updateField('vendor', e.target.value)}
              placeholder="Ej: EPM, Propietario"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
            />
          </div>

          {/* Receipt Number */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Hash className="w-4 h-4 text-gray-400" />
              Numero de Factura / Recibo
            </label>
            <input
              type="text"
              value={form.receipt_number}
              onChange={(e) => updateField('receipt_number', e.target.value)}
              placeholder="Opcional"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <StickyNote className="w-4 h-4 text-gray-400" />
              Notas
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Notas adicionales (opcional)"
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-400 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || loadingCategories}
            className="px-6 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2 transition"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear Gasto
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateExpenseModal;
