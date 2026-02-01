'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  CreditCard,
  GripVertical,
} from 'lucide-react';
import paymentAccountService from '@/lib/services/paymentAccountService';
import type { PaymentAccount } from '@/lib/api';

const PAYMENT_METHODS = [
  { value: 'nequi', label: 'Nequi' },
  { value: 'bancolombia', label: 'Bancolombia' },
  { value: 'daviplata', label: 'Daviplata' },
  { value: 'davivienda', label: 'Davivienda' },
  { value: 'other', label: 'Otro' },
];

// Helper to extract error message from API response
const getErrorMessage = (err: any, fallback: string): string => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    // FastAPI validation error format
    return detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join(', ');
  }
  if (typeof detail === 'object' && detail !== null) {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return fallback;
};

export default function PaymentAccountsPage() {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PaymentAccount | null>(null);
  const [formData, setFormData] = useState({
    method_type: 'nequi',
    account_name: '',
    account_number: '',
    account_holder: '',
    bank_name: '',
    account_type: 'ahorros',
    qr_code_url: '',
    instructions: '',
    is_active: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await paymentAccountService.list();
      setAccounts(data.sort((a, b) => a.display_order - b.display_order));
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cargar cuentas'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const openCreateModal = () => {
    setEditingAccount(null);
    setFormData({
      method_type: 'nequi',
      account_name: '',
      account_number: '',
      account_holder: '',
      bank_name: '',
      account_type: 'ahorros',
      qr_code_url: '',
      instructions: '',
      is_active: true,
    });
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (account: PaymentAccount) => {
    setEditingAccount(account);
    setFormData({
      method_type: account.method_type,
      account_name: account.account_name,
      account_number: account.account_number,
      account_holder: account.account_holder || '',
      bank_name: account.bank_name || '',
      account_type: account.account_type || 'ahorros',
      qr_code_url: account.qr_code_url || '',
      instructions: account.instructions || '',
      is_active: account.is_active,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      if (editingAccount) {
        await paymentAccountService.update(editingAccount.id, formData);
      } else {
        await paymentAccountService.create(formData);
      }
      setShowModal(false);
      loadAccounts();
    } catch (err: any) {
      setFormError(getErrorMessage(err, 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (account: PaymentAccount) => {
    try {
      await paymentAccountService.update(account.id, {
        is_active: !account.is_active,
      });
      loadAccounts();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cambiar estado'));
    }
  };

  const handleDelete = async (account: PaymentAccount) => {
    if (!confirm(`¿Estás seguro de eliminar la cuenta ${account.account_name}?`))
      return;

    try {
      await paymentAccountService.delete(account.id);
      loadAccounts();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al eliminar'));
    }
  };

  const getMethodLabel = (method: string) => {
    return PAYMENT_METHODS.find((m) => m.value === method)?.label || method;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            Cuentas de Pago
          </h1>
          <p className="text-slate-600 mt-1">
            Configura los métodos de pago del portal web
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadAccounts}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={openCreateModal}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nueva Cuenta
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-brand-500"></div>
          </div>
        ) : accounts.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-xl border border-slate-200">
            <CreditCard className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="text-slate-500">No hay cuentas de pago configuradas</p>
          </div>
        ) : (
          accounts.map((account) => (
            <div
              key={account.id}
              className={`bg-white rounded-xl border p-6 ${
                account.is_active ? 'border-slate-200' : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span
                    className={`badge ${
                      account.is_active ? 'badge-success' : 'badge-error'
                    } mb-2`}
                  >
                    {account.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  <h3 className="font-bold text-lg text-slate-900">
                    {account.account_name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {getMethodLabel(account.method_type)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(account)}
                    className="p-2 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(account)}
                    className={`p-2 rounded-lg ${
                      account.is_active
                        ? 'text-orange-600 hover:bg-orange-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {account.is_active ? (
                      <PowerOff className="w-4 h-4" />
                    ) : (
                      <Power className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(account)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Número:</span>
                  <span className="font-mono font-medium">
                    {account.account_number}
                  </span>
                </div>
                {account.account_holder && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Titular:</span>
                    <span className="font-medium">{account.account_holder}</span>
                  </div>
                )}
                {account.bank_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Banco:</span>
                    <span className="font-medium">{account.bank_name}</span>
                  </div>
                )}
              </div>

              {account.instructions && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Instrucciones:</p>
                  <p className="text-sm text-slate-700">{account.instructions}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl my-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              {editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta de Pago'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="admin-label">Método *</label>
                  <select
                    value={formData.method_type}
                    onChange={(e) =>
                      setFormData({ ...formData, method_type: e.target.value })
                    }
                    className="admin-input"
                    required
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="admin-label">Tipo de Cuenta</label>
                  <select
                    value={formData.account_type}
                    onChange={(e) =>
                      setFormData({ ...formData, account_type: e.target.value })
                    }
                    className="admin-input"
                  >
                    <option value="ahorros">Ahorros</option>
                    <option value="corriente">Corriente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="admin-label">Nombre de la Cuenta *</label>
                <input
                  type="text"
                  value={formData.account_name}
                  onChange={(e) =>
                    setFormData({ ...formData, account_name: e.target.value })
                  }
                  className="admin-input"
                  required
                  placeholder="Ej: Nequi Principal"
                />
              </div>

              <div>
                <label className="admin-label">Número de Cuenta *</label>
                <input
                  type="text"
                  value={formData.account_number}
                  onChange={(e) =>
                    setFormData({ ...formData, account_number: e.target.value })
                  }
                  className="admin-input"
                  required
                  placeholder="3001234567"
                />
              </div>

              <div>
                <label className="admin-label">Titular *</label>
                <input
                  type="text"
                  value={formData.account_holder}
                  onChange={(e) =>
                    setFormData({ ...formData, account_holder: e.target.value })
                  }
                  className="admin-input"
                  required
                  placeholder="Nombre del titular"
                />
              </div>

              <div>
                <label className="admin-label">Banco</label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) =>
                    setFormData({ ...formData, bank_name: e.target.value })
                  }
                  className="admin-input"
                  placeholder="Nombre del banco"
                />
              </div>

              <div>
                <label className="admin-label">URL del Código QR</label>
                <input
                  type="url"
                  value={formData.qr_code_url}
                  onChange={(e) =>
                    setFormData({ ...formData, qr_code_url: e.target.value })
                  }
                  className="admin-input"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="admin-label">Instrucciones</label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) =>
                    setFormData({ ...formData, instructions: e.target.value })
                  }
                  className="admin-input"
                  rows={3}
                  placeholder="Instrucciones adicionales para el cliente..."
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                />
                <span className="text-sm text-slate-600">Cuenta activa</span>
              </label>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving
                    ? 'Guardando...'
                    : editingAccount
                    ? 'Guardar Cambios'
                    : 'Crear Cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
