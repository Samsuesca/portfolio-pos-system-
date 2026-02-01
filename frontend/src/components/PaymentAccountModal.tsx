/**
 * Payment Account Modal - Create/Edit payment accounts
 *
 * Form to configure bank accounts, Nequi, and other payment methods.
 */
import { useState, useEffect } from 'react';
import { X, Save, Loader2, AlertCircle, Building2, Smartphone, CreditCard } from 'lucide-react';
import {
  paymentAccountService,
  type PaymentAccount,
  type PaymentAccountCreate
} from '../services/paymentAccountService';

interface PaymentAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  account?: PaymentAccount | null;
}

const METHOD_TYPES = [
  { value: 'nequi', label: 'Nequi', icon: Smartphone },
  { value: 'daviplata', label: 'Daviplata', icon: Smartphone },
  { value: 'bank_account', label: 'Cuenta Bancaria', icon: Building2 },
  { value: 'other', label: 'Otro', icon: CreditCard }
];

const ACCOUNT_TYPES = [
  { value: 'Ahorros', label: 'Ahorros' },
  { value: 'Corriente', label: 'Corriente' }
];

export default function PaymentAccountModal({
  isOpen,
  onClose,
  onSuccess,
  account
}: PaymentAccountModalProps) {
  const [formData, setFormData] = useState<PaymentAccountCreate>({
    method_type: 'nequi',
    account_name: '',
    account_number: '',
    account_holder: '',
    bank_name: '',
    account_type: '',
    qr_code_url: '',
    instructions: '',
    display_order: 0,
    is_active: true
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (account) {
      setFormData({
        method_type: account.method_type,
        account_name: account.account_name,
        account_number: account.account_number,
        account_holder: account.account_holder,
        bank_name: account.bank_name || '',
        account_type: account.account_type || '',
        qr_code_url: account.qr_code_url || '',
        instructions: account.instructions || '',
        display_order: account.display_order,
        is_active: account.is_active
      });
    } else {
      // Reset form for new account
      setFormData({
        method_type: 'nequi',
        account_name: '',
        account_number: '',
        account_holder: '',
        bank_name: '',
        account_type: '',
        qr_code_url: '',
        instructions: '',
        display_order: 0,
        is_active: true
      });
    }
    setError(null);
  }, [account, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.account_name.trim()) {
      setError('El nombre de la cuenta es requerido');
      return;
    }
    if (!formData.account_number.trim()) {
      setError('El número de cuenta es requerido');
      return;
    }
    if (!formData.account_holder.trim()) {
      setError('El titular es requerido');
      return;
    }

    try {
      setSaving(true);

      const dataToSend = {
        ...formData,
        bank_name: formData.bank_name || undefined,
        account_type: formData.account_type || undefined,
        qr_code_url: formData.qr_code_url || undefined,
        instructions: formData.instructions || undefined
      };

      if (account) {
        await paymentAccountService.update(account.id, dataToSend);
      } else {
        await paymentAccountService.create(dataToSend);
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error saving payment account:', err);
      setError(err.response?.data?.detail || 'Error al guardar cuenta de pago');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof PaymentAccountCreate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isBankAccount = formData.method_type === 'bank_account';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {account ? 'Editar Cuenta de Pago' : 'Nueva Cuenta de Pago'}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-green-800 rounded-lg p-2 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Method Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Método de Pago *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {METHOD_TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleChange('method_type', value)}
                    className={`flex items-center gap-2 px-4 py-3 border-2 rounded-lg transition ${
                      formData.method_type === value
                        ? 'border-green-600 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Account Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la Cuenta * <span className="text-gray-500 font-normal">(ej: "Nequi Consuelo")</span>
              </label>
              <input
                type="text"
                value={formData.account_name}
                onChange={(e) => handleChange('account_name', e.target.value)}
                placeholder="Nombre descriptivo"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            {/* Account Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número de Cuenta / Teléfono *
              </label>
              <input
                type="text"
                value={formData.account_number}
                onChange={(e) => handleChange('account_number', e.target.value)}
                placeholder={isBankAccount ? "1234567890" : "3001234567"}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            {/* Account Holder */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Titular de la Cuenta *
              </label>
              <input
                type="text"
                value={formData.account_holder}
                onChange={(e) => handleChange('account_holder', e.target.value)}
                placeholder="Nombre completo del titular"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            {/* Bank Name (conditional) */}
            {isBankAccount && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Banco
                </label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => handleChange('bank_name', e.target.value)}
                  placeholder="Bancolombia, Davivienda, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            )}

            {/* Account Type (conditional) */}
            {isBankAccount && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Cuenta
                </label>
                <select
                  value={formData.account_type}
                  onChange={(e) => handleChange('account_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Seleccionar...</option>
                  {ACCOUNT_TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* QR Code URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL del Código QR <span className="text-gray-500 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={formData.qr_code_url}
                onChange={(e) => handleChange('qr_code_url', e.target.value)}
                placeholder="/uploads/qr/nequi.png"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ruta de la imagen del QR (subir archivo manualmente al servidor)
              </p>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instrucciones Adicionales <span className="text-gray-500 font-normal">(opcional)</span>
              </label>
              <textarea
                value={formData.instructions}
                onChange={(e) => handleChange('instructions', e.target.value)}
                rows={3}
                placeholder="Ej: Enviar comprobante por WhatsApp al..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Display Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Orden de Visualización
              </label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) => handleChange('display_order', parseInt(e.target.value) || 0)}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Menor número = aparece primero en el portal web
              </p>
            </div>

            {/* Is Active */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => handleChange('is_active', e.target.checked)}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">
                Cuenta activa (visible en portal web)
              </label>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {account ? 'Actualizar' : 'Crear'} Cuenta
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
