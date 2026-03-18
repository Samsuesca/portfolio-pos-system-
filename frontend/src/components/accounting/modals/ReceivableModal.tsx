/**
 * ReceivableModal - Modal for creating accounts receivable
 */
import React from 'react';
import { X, Loader2 } from 'lucide-react';
import DatePicker from '../../DatePicker';
import type { AccountsReceivableCreate } from '../types';

interface ReceivableModalProps {
  isOpen: boolean;
  form: Partial<AccountsReceivableCreate>;
  onFormChange: (form: Partial<AccountsReceivableCreate>) => void;
  onSubmit: () => void;
  onClose: () => void;
  submitting: boolean;
}

const ReceivableModal: React.FC<ReceivableModalProps> = ({
  isOpen,
  form,
  onFormChange,
  onSubmit,
  onClose,
  submitting
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Nueva Cuenta por Cobrar</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion *</label>
            <input
              type="text"
              value={form.description || ''}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="Ej: Venta a credito a Juan Perez"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
              <input
                type="number"
                value={form.amount || ''}
                onChange={(e) => onFormChange({ ...form, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha factura *</label>
              <DatePicker
                value={form.invoice_date || ''}
                onChange={(value) => onFormChange({ ...form, invoice_date: value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha vencimiento</label>
            <DatePicker
              value={form.due_date || ''}
              onChange={(value) => onFormChange({ ...form, due_date: value })}
              minDate={form.invoice_date}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              value={form.notes || ''}
              onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              rows={2}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || !form.description || !form.amount}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear Cuenta
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceivableModal;
