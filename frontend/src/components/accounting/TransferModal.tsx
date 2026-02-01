/**
 * TransferModal - Modal for transferring money between balance accounts
 *
 * Supports transfers between Caja Menor, Caja Mayor, Nequi, Banco, etc.
 * Uses globalAccountingService for fetching accounts and creating transfers.
 */
import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, ArrowRightLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  createAccountTransfer,
  getGlobalBalanceAccounts,
} from '../../services/globalAccountingService';
import type {
  AccountTransferCreate,
  AccountTransferResponse,
} from '../../services/globalAccountingService';
import type { BalanceAccountListItem } from '../../types/api';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransferComplete?: () => void;
  preselectedFromAccountId?: string;
}

const formatCurrency = (value: number): string =>
  `$${value.toLocaleString('es-CO')}`;

const getErrorMessage = (err: unknown, defaultMessage: string): string => {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  if (err instanceof Error) return err.message;
  return defaultMessage;
};

const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  onTransferComplete,
  preselectedFromAccountId,
}) => {
  // Accounts
  const [accounts, setAccounts] = useState<BalanceAccountListItem[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Form
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [amountInput, setAmountInput] = useState('');
  const [reason, setReason] = useState('');

  // State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<AccountTransferResponse | null>(null);

  // Derived
  const fromAccount = accounts.find((a) => a.id === fromAccountId) || null;
  const toAccount = accounts.find((a) => a.id === toAccountId) || null;
  const destinationAccounts = accounts.filter((a) => a.id !== fromAccountId);

  const isFormValid =
    fromAccountId &&
    toAccountId &&
    amount > 0 &&
    fromAccount &&
    amount <= fromAccount.balance &&
    reason.trim().length > 0;

  // Load accounts
  useEffect(() => {
    if (!isOpen) return;

    const loadAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const data = await getGlobalBalanceAccounts('asset_current', true);
        setAccounts(data);
      } catch (err) {
        console.error('Error loading accounts:', err);
        setError('Error al cargar las cuentas');
      } finally {
        setLoadingAccounts(false);
      }
    };

    loadAccounts();
  }, [isOpen]);

  // Pre-select source account
  useEffect(() => {
    if (preselectedFromAccountId && accounts.length > 0) {
      const exists = accounts.some((a) => a.id === preselectedFromAccountId);
      if (exists) {
        setFromAccountId(preselectedFromAccountId);
      }
    }
  }, [preselectedFromAccountId, accounts]);

  // Clear destination if it matches new source
  useEffect(() => {
    if (toAccountId && toAccountId === fromAccountId) {
      setToAccountId('');
    }
  }, [fromAccountId, toAccountId]);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        handleClose();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [submitting]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  // Reset state
  const resetForm = () => {
    setFromAccountId(preselectedFromAccountId || '');
    setToAccountId('');
    setAmount(0);
    setAmountInput('');
    setReason('');
    setError(null);
    setSuccessResult(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  // Amount input handling
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const numericValue = raw ? parseInt(raw, 10) : 0;
    setAmountInput(raw ? numericValue.toLocaleString('es-CO') : '');
    setAmount(numericValue);
  };

  // Submit transfer
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) return;

    if (!fromAccount || amount > fromAccount.balance) {
      setError('El monto excede el saldo disponible en la cuenta origen');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const transferData: AccountTransferCreate = {
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount,
        reason: reason.trim(),
      };

      const result = await createAccountTransfer(transferData);
      setSuccessResult(result);

      // Auto-close after 2 seconds
      setTimeout(() => {
        onTransferComplete?.();
        handleClose();
      }, 2000);
    } catch (err) {
      console.error('Error creating transfer:', err);
      setError(getErrorMessage(err, 'Error al realizar la transferencia'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Success view
  if (successResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Transferencia Exitosa</h3>
            <p className="text-gray-600">{successResult.message}</p>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Monto transferido</span>
                <span className="font-bold text-green-700">
                  {formatCurrency(successResult.amount)}
                </span>
              </div>
              <hr />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {successResult.from_account.name}
                </span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(successResult.from_account.new_balance)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {successResult.to_account.name}
                </span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(successResult.to_account.new_balance)}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Ref: {successResult.reference} | Se cerrara automaticamente...
            </p>

            <button
              onClick={() => {
                onTransferComplete?.();
                handleClose();
              }}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-emerald-600" />
            Transferir entre Cuentas
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
          {loadingAccounts ? (
            <div className="flex items-center justify-center gap-2 text-gray-500 py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
              Cargando cuentas...
            </div>
          ) : (
            <>
              {/* Source Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="text-red-500">*</span> Cuenta Origen
                </label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                >
                  <option value="">Seleccionar cuenta origen...</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} - {formatCurrency(account.balance)}
                    </option>
                  ))}
                </select>
                {fromAccount && (
                  <p className="mt-1 text-xs text-gray-500">
                    Saldo disponible: {formatCurrency(fromAccount.balance)}
                  </p>
                )}
              </div>

              {/* Destination Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="text-red-500">*</span> Cuenta Destino
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  disabled={!fromAccountId}
                >
                  <option value="">Seleccionar cuenta destino...</option>
                  {destinationAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} - {formatCurrency(account.balance)}
                    </option>
                  ))}
                </select>
                {!fromAccountId && (
                  <p className="mt-1 text-xs text-gray-400">
                    Primero selecciona la cuenta origen
                  </p>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="text-red-500">*</span> Monto
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amountInput}
                    onChange={handleAmountChange}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                {fromAccount && amount > 0 && (
                  <div className="mt-1">
                    {amount > fromAccount.balance ? (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        El monto excede el saldo disponible (
                        {formatCurrency(fromAccount.balance)})
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Saldo restante en origen:{' '}
                        {formatCurrency(fromAccount.balance - amount)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="text-red-500">*</span> Motivo
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej: Consignacion a banco, Retiro para gastos..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Preview */}
              {fromAccount && toAccount && amount > 0 && amount <= fromAccount.balance && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-emerald-800 mb-2">
                    Vista previa de la transferencia
                  </h4>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Origen: {fromAccount.name}</span>
                    <span className="text-gray-900">
                      {formatCurrency(fromAccount.balance)}{' '}
                      <span className="text-red-600 font-medium">
                        &rarr; {formatCurrency(Number(fromAccount.balance) - amount)}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Destino: {toAccount.name}</span>
                    <span className="text-gray-900">
                      {formatCurrency(toAccount.balance)}{' '}
                      <span className="text-green-600 font-medium">
                        &rarr; {formatCurrency(Number(toAccount.balance) + amount)}
                      </span>
                    </span>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || submitting || loadingAccounts}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Transferir
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferModal;
