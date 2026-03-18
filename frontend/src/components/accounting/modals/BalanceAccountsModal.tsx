/**
 * BalanceAccountsModal - Modal for managing fixed assets and liabilities
 */
import React, { useState } from 'react';
import { X, Loader2, Plus, Pencil, Trash2, Package, Car, Clock, CreditCard, Sparkles } from 'lucide-react';
import DatePicker, { formatDateSpanish } from '../../DatePicker';
import { formatCurrency } from '../../../utils/formatting';
import type { GlobalBalanceAccountResponse, GlobalBalanceAccountCreate, BalanceAccountModalType } from '../types';

interface BalanceAccountsModalProps {
  isOpen: boolean;
  modalType: BalanceAccountModalType;
  accounts: GlobalBalanceAccountResponse[];
  loading: boolean;
  onClose: () => void;
  onCreate: (data: GlobalBalanceAccountCreate) => Promise<void>;
  onUpdate: (id: string, data: Partial<GlobalBalanceAccountCreate>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  submitting: boolean;
}

const BalanceAccountsModal: React.FC<BalanceAccountsModalProps> = ({
  isOpen,
  modalType,
  accounts,
  loading,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  submitting
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<GlobalBalanceAccountResponse | null>(null);
  const [form, setForm] = useState<Partial<GlobalBalanceAccountCreate>>({
    account_type: modalType,
    name: '',
    balance: 0
  });

  if (!isOpen) return null;

  const getModalTitle = () => {
    switch (modalType) {
      case 'asset_fixed':
        return 'Activos Fijos';
      case 'asset_intangible':
        return 'Activos Intangibles';
      case 'liability_current':
        return 'Pasivos Corrientes';
      case 'liability_long':
        return 'Pasivos a Largo Plazo';
      default:
        return 'Cuentas';
    }
  };

  const getIcon = () => {
    switch (modalType) {
      case 'asset_fixed':
        return <Car className="w-5 h-5 text-green-600" />;
      case 'asset_intangible':
        return <Sparkles className="w-5 h-5 text-violet-600" />;
      case 'liability_current':
        return <Clock className="w-5 h-5 text-orange-600" />;
      case 'liability_long':
        return <CreditCard className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const resetForm = () => {
    setForm({
      account_type: modalType,
      name: '',
      balance: 0,
      description: '',
      original_value: undefined,
      accumulated_depreciation: undefined,
      useful_life_years: undefined,
      creditor: undefined,
      interest_rate: undefined,
      due_date: undefined
    });
    setEditingAccount(null);
    setShowForm(false);
  };

  const startEdit = (account: GlobalBalanceAccountResponse) => {
    setEditingAccount(account);
    setForm({
      account_type: account.account_type,
      name: account.name,
      balance: account.balance,
      description: account.description || '',
      original_value: account.original_value,
      accumulated_depreciation: account.accumulated_depreciation,
      useful_life_years: account.useful_life_years,
      creditor: account.creditor,
      interest_rate: account.interest_rate,
      due_date: account.due_date
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name) return;

    const data: GlobalBalanceAccountCreate = {
      account_type: modalType,
      name: form.name!,
      balance: form.balance ?? 0,
      description: form.description,
      original_value: form.original_value,
      accumulated_depreciation: form.accumulated_depreciation,
      useful_life_years: form.useful_life_years,
      creditor: form.creditor,
      interest_rate: form.interest_rate,
      due_date: form.due_date
    };

    if (editingAccount) {
      await onUpdate(editingAccount.id, data);
    } else {
      await onCreate(data);
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Esta seguro de eliminar esta cuenta?')) return;
    await onDelete(id);
  };

  const isAsset = modalType === 'asset_fixed' || modalType === 'asset_intangible';
  const isIntangible = modalType === 'asset_intangible';
  const isLiability = modalType === 'liability_current' || modalType === 'liability_long';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {getIcon()}
            {getModalTitle()}
          </h3>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!showForm ? (
            <>
              {/* Add Button */}
              <div className="mb-4">
                <button
                  onClick={() => {
                    resetForm();
                    setShowForm(true);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                    isAsset
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Agregar {isAsset ? 'Activo Fijo' : 'Pasivo'}
                </button>
              </div>

              {/* Accounts List */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                  <span className="ml-2 text-gray-600">Cargando...</span>
                </div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No hay {isAsset ? 'activos fijos' : 'pasivos'} registrados</p>
                  <p className="text-sm mt-1">Haz clic en "Agregar" para crear uno nuevo</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-mono">{account.code}</span>
                            <h4 className="font-medium text-gray-800">{account.name}</h4>
                          </div>
                          {account.description && (
                            <p className="text-sm text-gray-500 mt-1">{account.description}</p>
                          )}
                          <div className="flex gap-4 mt-2 text-sm">
                            <span className={`font-semibold ${isAsset ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(account.balance)}
                            </span>
                            {isAsset && account.original_value && (
                              <span className="text-gray-500">
                                Valor original: {formatCurrency(account.original_value)}
                              </span>
                            )}
                            {isLiability && account.creditor && (
                              <span className="text-gray-500">
                                Acreedor: {account.creditor}
                              </span>
                            )}
                            {account.due_date && (
                              <span className="text-gray-500">
                                Vence: {formatDateSpanish(account.due_date)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEdit(account)}
                            className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(account.id)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* New/Edit Account Form */
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700">
                {editingAccount ? 'Editar' : 'Nuevo'} {getModalTitle()}
              </h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.name || ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder={isIntangible ? 'Ej: Software, Licencia, Patente, Marca registrada' : isAsset ? 'Ej: Vehiculo, Maquinaria, Equipo de computo' : 'Ej: Prestamo bancario, Deuda con proveedor X'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <textarea
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  rows={2}
                  placeholder="Descripcion adicional..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isAsset ? 'Valor Actual' : 'Monto de la Deuda'} *
                  </label>
                  <input
                    type="number"
                    value={form.balance ?? ''}
                    onChange={(e) => setForm({ ...form, balance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    min="0"
                  />
                </div>

                {isAsset && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor Original</label>
                    <input
                      type="number"
                      value={form.original_value ?? ''}
                      onChange={(e) => setForm({ ...form, original_value: parseFloat(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      min="0"
                      placeholder="Costo de adquisicion"
                    />
                  </div>
                )}

                {isLiability && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Acreedor</label>
                    <input
                      type="text"
                      value={form.creditor || ''}
                      onChange={(e) => setForm({ ...form, creditor: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      placeholder="Ej: Banco X, Proveedor Y"
                    />
                  </div>
                )}
              </div>

              {isAsset && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{isIntangible ? 'Amortizacion Acumulada' : 'Depreciacion Acumulada'}</label>
                    <input
                      type="number"
                      value={form.accumulated_depreciation ?? ''}
                      onChange={(e) => setForm({ ...form, accumulated_depreciation: parseFloat(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vida Util (anios)</label>
                    <input
                      type="number"
                      value={form.useful_life_years ?? ''}
                      onChange={(e) => setForm({ ...form, useful_life_years: parseInt(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      min="1"
                    />
                  </div>
                </div>
              )}

              {isLiability && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tasa de Interes (%)</label>
                    <input
                      type="number"
                      value={form.interest_rate ?? ''}
                      onChange={(e) => setForm({ ...form, interest_rate: parseFloat(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Vencimiento</label>
                    <DatePicker
                      value={form.due_date || ''}
                      onChange={(value) => setForm({ ...form, due_date: value || undefined })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          {showForm ? (
            <>
              <button
                onClick={resetForm}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !form.name}
                className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                  isAsset
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingAccount ? 'Guardar Cambios' : 'Crear'}
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BalanceAccountsModal;
