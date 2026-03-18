/**
 * DebtSchedulePanel - Debt payment schedule management
 */
import React, { useState } from 'react';
import {
  Plus, Loader2, Calendar, AlertTriangle,
  CheckCircle, Clock, Trash2, Download, RefreshCw, Percent, Landmark
} from 'lucide-react';
import type {
  DebtPayment,
  DebtPaymentCreate,
  DebtPaymentListResponse
} from '../../types/api';
import DebtPaymentModal from './modals/DebtPaymentModal';
import {
  importLiabilitiesToDebtSchedule,
  generatePendingInterest,
  type ImportLiabilitiesResponse,
  type GeneratePendingInterestResponse
} from '../../services/globalAccountingService';

interface DebtSchedulePanelProps {
  debtPayments: DebtPaymentListResponse | null;
  onCreateDebt: (data: DebtPaymentCreate) => Promise<void>;
  onMarkPaid: (id: string, amount: number, method: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => void;
  loading: boolean;
  submitting: boolean;
}

const formatCurrency = (value: number): string => {
  return value.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const getStatusBadge = (status: string, daysUntilDue: number | null) => {
  switch (status) {
    case 'paid':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle size={12} />
          Pagado
        </span>
      );
    case 'overdue':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <AlertTriangle size={12} />
          Vencido
        </span>
      );
    default:
      if (daysUntilDue !== null && daysUntilDue <= 7) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <Clock size={12} />
            Proximo
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-brand-100 text-brand-700">
          <Calendar size={12} />
          Pendiente
        </span>
      );
  }
};

const DebtSchedulePanel: React.FC<DebtSchedulePanelProps> = ({
  debtPayments,
  onCreateDebt,
  onMarkPaid,
  onDelete,
  onRefresh,
  loading,
  submitting
}) => {
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'overdue' | 'paid'>('pending');
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportLiabilitiesResponse | null>(null);
  const [generatingInterest, setGeneratingInterest] = useState(false);
  const [interestResult, setInterestResult] = useState<GeneratePendingInterestResponse | null>(null);

  const handleGenerateInterest = async () => {
    setGeneratingInterest(true);
    setInterestResult(null);
    try {
      const result = await generatePendingInterest();
      setInterestResult(result);
      if (result.total_generated > 0) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error generating interest:', error);
      alert('Error al generar intereses');
    } finally {
      setGeneratingInterest(false);
    }
  };

  const handleImportLiabilities = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importLiabilitiesToDebtSchedule();
      setImportResult(result);
      if (result.total_imported > 0) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error importing liabilities:', error);
      alert('Error al importar pasivos');
    } finally {
      setImporting(false);
    }
  };

  const handleMarkPaid = async (debt: DebtPayment) => {
    setMarkingPaidId(debt.id);
    try {
      await onMarkPaid(debt.id, debt.amount, paymentMethod);
      setMarkingPaidId(null);
    } catch {
      setMarkingPaidId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Esta seguro de eliminar este pago programado?')) return;
    await onDelete(id);
  };

  const filteredItems = debtPayments?.items.filter(debt => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return debt.status === 'pending';
    if (statusFilter === 'overdue') return debt.status === 'overdue';
    if (statusFilter === 'paid') return debt.status === 'paid';
    return true;
  }) || [];

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-brand-500" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Cronograma de Deudas</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateInterest}
            disabled={generatingInterest}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700 disabled:opacity-50"
            title="Generar pagos de intereses pendientes para pasivos activos"
          >
            {generatingInterest ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Generar Intereses
          </button>
          <button
            onClick={handleImportLiabilities}
            disabled={importing}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-md text-sm hover:bg-amber-700 disabled:opacity-50"
            title="Importar pasivos de largo plazo al cronograma"
          >
            {importing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Importar Pasivos
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-brand-500 text-white rounded-md text-sm hover:bg-brand-600"
          >
            <Plus size={16} />
            Nueva Deuda
          </button>
        </div>
      </div>

      {/* Import Result Message */}
      {importResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          importResult.total_imported > 0
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-brand-50 border border-brand-200 text-brand-800'
        }`}>
          <p className="font-medium">{importResult.message}</p>
          {importResult.total_imported > 0 && (
            <ul className="mt-2 space-y-1">
              {importResult.imported.map((item, i) => (
                <li key={i} className="text-xs">
                  + {item.name}: Capital {formatCurrency(item.capital)}
                  {item.interest_rate ? ` | ${item.interest_rate}% anual` : ''}
                  {' '}- {item.payments_generated} pagos generados
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setImportResult(null)}
            className="mt-2 text-xs underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Generate Interest Result */}
      {interestResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          interestResult.total_generated > 0
            ? 'bg-purple-50 border border-purple-200 text-purple-800'
            : 'bg-brand-50 border border-brand-200 text-brand-800'
        }`}>
          <p className="font-medium">{interestResult.message}</p>
          {interestResult.total_generated > 0 && (
            <ul className="mt-2 space-y-1">
              {interestResult.generated.map((item, i) => (
                <li key={i} className="text-xs">
                  + {item.description}: {formatCurrency(item.amount)} - Vence: {formatDate(item.due_date)}
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setInterestResult(null)}
            className="mt-2 text-xs underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {debtPayments && (
        <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
          <div className="bg-brand-50 rounded p-2">
            <p className="text-gray-500">Pendiente</p>
            <p className="font-semibold text-brand-600">{formatCurrency(debtPayments.pending_total)}</p>
          </div>
          <div className="bg-red-50 rounded p-2">
            <p className="text-gray-500">Vencido</p>
            <p className="font-semibold text-red-600">{formatCurrency(debtPayments.overdue_total)}</p>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <p className="text-gray-500">Total Deudas</p>
            <p className="font-semibold text-gray-700">{debtPayments.total}</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-4">
        {[
          { value: 'pending', label: 'Pendientes' },
          { value: 'overdue', label: 'Vencidas' },
          { value: 'paid', label: 'Pagadas' },
          { value: 'all', label: 'Todas' },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value as typeof statusFilter)}
            className={`px-3 py-1 text-sm rounded ${
              statusFilter === tab.value
                ? 'bg-brand-100 text-brand-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredItems.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No hay deudas {statusFilter !== 'all' ? 'en este estado' : ''}
          </div>
        ) : (
          filteredItems.map(debt => (
            <div
              key={debt.id}
              className={`border rounded-lg p-3 transition-all ${
                debt.status === 'overdue'
                  ? 'border-red-300 bg-red-50 animate-pulse shadow-md shadow-red-100'
                  : debt.status === 'paid'
                    ? 'border-green-200 bg-green-50'
                    : debt.days_until_due !== null && debt.days_until_due <= 7
                      ? 'border-yellow-300 bg-yellow-50 shadow-sm shadow-yellow-100'
                      : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">
                      {debt.description}
                    </p>
                    {debt.category === 'interest' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
                        <Percent size={10} />
                        Interes
                      </span>
                    )}
                    {debt.category === 'loan_principal' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700">
                        <Landmark size={10} />
                        Capital
                      </span>
                    )}
                    {getStatusBadge(debt.status, debt.days_until_due)}
                  </div>
                  {debt.creditor && (
                    <p className="text-sm text-gray-500">{debt.creditor}</p>
                  )}
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {formatDate(debt.due_date)}
                    </span>
                    {debt.is_recurring && (
                      <span className="text-brand-600">Recurrente (dia {debt.recurrence_day})</span>
                    )}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(debt.amount)}
                  </p>
                  {debt.days_until_due !== null && debt.status !== 'paid' && (
                    <p className={`text-xs ${
                      debt.days_until_due < 0
                        ? 'text-red-600'
                        : debt.days_until_due <= 7
                          ? 'text-yellow-600'
                          : 'text-gray-500'
                    }`}>
                      {debt.days_until_due < 0
                        ? `Vencio hace ${Math.abs(debt.days_until_due)} dias`
                        : debt.days_until_due === 0
                          ? 'Vence hoy'
                          : `En ${debt.days_until_due} dias`
                      }
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              {debt.status !== 'paid' && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="flex-1 text-sm px-2 py-1 border border-gray-300 rounded"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                    <option value="nequi">Nequi</option>
                  </select>
                  <button
                    onClick={() => handleMarkPaid(debt)}
                    disabled={submitting || markingPaidId === debt.id}
                    className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    {markingPaidId === debt.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle size={14} />
                    )}
                    Marcar Pagada
                  </button>
                  <button
                    onClick={() => handleDelete(debt.id)}
                    disabled={submitting}
                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}

              {/* Paid info */}
              {debt.status === 'paid' && debt.paid_date && (
                <div className="mt-2 pt-2 border-t border-gray-200 text-sm text-gray-500">
                  Pagado el {formatDate(debt.paid_date)}
                  {debt.payment_method && ` via ${debt.payment_method}`}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Next Due Alert - Enhanced urgency */}
      {debtPayments?.next_due && debtPayments.next_due.status !== 'paid' && (
        <div className={`mt-4 p-3 rounded-lg border ${
          debtPayments.next_due.status === 'overdue' || (debtPayments.next_due.days_until_due !== null && debtPayments.next_due.days_until_due < 0)
            ? 'bg-red-100 border-red-300 animate-pulse'
            : debtPayments.next_due.days_until_due !== null && debtPayments.next_due.days_until_due <= 3
              ? 'bg-orange-100 border-orange-300'
              : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle size={16} className={
              debtPayments.next_due.status === 'overdue' || (debtPayments.next_due.days_until_due !== null && debtPayments.next_due.days_until_due < 0)
                ? 'text-red-600'
                : debtPayments.next_due.days_until_due !== null && debtPayments.next_due.days_until_due <= 3
                  ? 'text-orange-600'
                  : 'text-yellow-600'
            } />
            <span className={`font-medium ${
              debtPayments.next_due.status === 'overdue' || (debtPayments.next_due.days_until_due !== null && debtPayments.next_due.days_until_due < 0)
                ? 'text-red-800'
                : 'text-yellow-800'
            }`}>
              {debtPayments.next_due.status === 'overdue' || (debtPayments.next_due.days_until_due !== null && debtPayments.next_due.days_until_due < 0)
                ? '⚠️ PAGO VENCIDO:'
                : 'Proximo pago:'}
            </span>
            <span className={
              debtPayments.next_due.status === 'overdue' || (debtPayments.next_due.days_until_due !== null && debtPayments.next_due.days_until_due < 0)
                ? 'text-red-700 font-semibold'
                : 'text-yellow-700'
            }>
              {debtPayments.next_due.description} - {formatCurrency(debtPayments.next_due.amount)}
            </span>
            <span className={`font-medium ${
              debtPayments.next_due.status === 'overdue' || (debtPayments.next_due.days_until_due !== null && debtPayments.next_due.days_until_due < 0)
                ? 'text-red-600'
                : debtPayments.next_due.days_until_due !== null && debtPayments.next_due.days_until_due <= 3
                  ? 'text-orange-600'
                  : 'text-yellow-600'
            }`}>
              ({debtPayments.next_due.days_until_due !== null && debtPayments.next_due.days_until_due >= 0
                ? debtPayments.next_due.days_until_due === 0
                  ? '¡HOY!'
                  : debtPayments.next_due.days_until_due === 1
                    ? '¡MAÑANA!'
                    : `en ${debtPayments.next_due.days_until_due} dias`
                : `¡VENCIDO hace ${Math.abs(debtPayments.next_due.days_until_due || 0)} dias!`
              })
            </span>
          </div>
        </div>
      )}

      {/* Modal */}
      <DebtPaymentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={onCreateDebt}
        submitting={submitting}
      />
    </div>
  );
};

export default DebtSchedulePanel;
