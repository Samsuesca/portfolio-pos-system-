/**
 * Payment Accounts Management Page
 *
 * Admin page to configure payment methods (bank accounts, Nequi, QR codes)
 * that will be displayed to customers in the web portal.
 */
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import PaymentAccountModal from '../components/PaymentAccountModal';
import {
  CreditCard, Plus, Edit, Trash2, Eye, EyeOff, Loader2,
  AlertCircle, CheckCircle, Building2, Smartphone, QrCode
} from 'lucide-react';
import { paymentAccountService, type PaymentAccount } from '../services/paymentAccountService';

const METHOD_TYPE_LABELS: Record<string, string> = {
  nequi: 'Nequi',
  bank_account: 'Cuenta Bancaria',
  daviplata: 'Daviplata',
  other: 'Otro'
};

const METHOD_TYPE_ICONS: Record<string, typeof Smartphone> = {
  nequi: Smartphone,
  bank_account: Building2,
  daviplata: Smartphone,
  other: CreditCard
};

export default function PaymentAccounts() {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PaymentAccount | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await paymentAccountService.getAll();
      // Sort by display_order
      setAccounts(data.sort((a, b) => a.display_order - b.display_order));
    } catch (err: any) {
      console.error('Error loading payment accounts:', err);
      setError(err.response?.data?.detail || 'Error al cargar cuentas de pago');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAccount(null);
    setIsModalOpen(true);
  };

  const handleEdit = (account: PaymentAccount) => {
    setEditingAccount(account);
    setIsModalOpen(true);
  };

  const handleDelete = async (account: PaymentAccount) => {
    if (!confirm(`¿Eliminar la cuenta "${account.account_name}"?`)) {
      return;
    }

    try {
      await paymentAccountService.delete(account.id);
      setSuccess('Cuenta eliminada correctamente');
      loadAccounts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setError(err.response?.data?.detail || 'Error al eliminar cuenta');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleToggleActive = async (account: PaymentAccount) => {
    try {
      await paymentAccountService.update(account.id, {
        is_active: !account.is_active
      });
      setSuccess(account.is_active ? 'Cuenta desactivada' : 'Cuenta activada');
      loadAccounts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error toggling account:', err);
      setError(err.response?.data?.detail || 'Error al actualizar cuenta');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
  };

  const handleModalSuccess = () => {
    setSuccess(editingAccount ? 'Cuenta actualizada' : 'Cuenta creada correctamente');
    loadAccounts();
    handleModalClose();
    setTimeout(() => setSuccess(null), 3000);
  };

  const Icon = (methodType: string) => METHOD_TYPE_ICONS[methodType] || CreditCard;

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-8 h-8 text-green-600" />
              Cuentas de Pago
            </h1>
            <p className="text-gray-600 mt-1">
              Configura las cuentas bancarias y métodos de pago para el portal web
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Plus className="w-5 h-5" />
            Nueva Cuenta
          </button>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
          </div>
        )}

        {/* Accounts Grid */}
        {!loading && accounts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <CreditCard className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">No hay cuentas de pago configuradas</p>
            <p className="text-gray-400 text-sm mt-2">
              Crea tu primera cuenta para que los clientes puedan realizar pagos
            </p>
          </div>
        )}

        {!loading && accounts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((account) => {
              const MethodIcon = Icon(account.method_type);

              return (
                <div
                  key={account.id}
                  className={`bg-white rounded-lg border-2 p-6 transition ${
                    account.is_active
                      ? 'border-green-200 hover:border-green-300'
                      : 'border-gray-200 opacity-60'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${
                        account.is_active ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <MethodIcon className={`w-6 h-6 ${
                          account.is_active ? 'text-green-600' : 'text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {account.account_name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {METHOD_TYPE_LABELS[account.method_type]}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        account.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {account.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Titular</p>
                      <p className="text-sm font-medium text-gray-900">
                        {account.account_holder}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Número de Cuenta</p>
                      <p className="text-sm font-medium text-gray-900">
                        {account.account_number}
                      </p>
                    </div>

                    {account.bank_name && (
                      <div>
                        <p className="text-xs text-gray-500">Banco</p>
                        <p className="text-sm font-medium text-gray-900">
                          {account.bank_name}
                        </p>
                      </div>
                    )}

                    {account.account_type && (
                      <div>
                        <p className="text-xs text-gray-500">Tipo</p>
                        <p className="text-sm font-medium text-gray-900">
                          {account.account_type}
                        </p>
                      </div>
                    )}

                    {account.qr_code_url && (
                      <div className="flex items-center gap-2 text-sm text-blue-600">
                        <QrCode className="w-4 h-4" />
                        <span>Código QR configurado</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => handleToggleActive(account)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition"
                    >
                      {account.is_active ? (
                        <>
                          <EyeOff className="w-4 h-4" />
                          Desactivar
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          Activar
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleEdit(account)}
                      className="flex items-center justify-center gap-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                    >
                      <Edit className="w-4 h-4" />
                      Editar
                    </button>

                    <button
                      onClick={() => handleDelete(account)}
                      className="flex items-center justify-center p-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Display Order Badge */}
                  <div className="mt-3 text-center">
                    <span className="text-xs text-gray-400">
                      Orden de visualización: {account.display_order}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal */}
        {isModalOpen && (
          <PaymentAccountModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            onSuccess={handleModalSuccess}
            account={editingAccount}
          />
        )}
      </div>
    </Layout>
  );
}
