/**
 * PayrollDetailModal - View payroll run details with items, approve/pay/cancel actions.
 * Manages its own loading, error, and action state.
 */
import React, { useState, useEffect } from 'react';
import { X, Loader2, Check, Ban, CreditCard } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import {
  getPayrollRun,
  approvePayrollRun,
  payPayrollRun,
  cancelPayrollRun,
  payPayrollItem,
  getPayrollStatusLabel,
  getPayrollStatusColor,
  formatPeriodRange,
  type PayrollRunDetailResponse,
  type PayrollRunListItem,
} from '../../services/payrollService';
import { getErrorMessage } from './types';

interface PayrollDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The payroll run to display, or null */
  payrollRun: PayrollRunListItem | null;
  onDataChanged: () => void;
}

const PayrollDetailModal: React.FC<PayrollDetailModalProps> = ({
  isOpen,
  onClose,
  payrollRun,
  onDataChanged,
}) => {
  const [detail, setDetail] = useState<PayrollRunDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !payrollRun) return;

    setError(null);
    const loadDetail = async () => {
      try {
        setLoading(true);
        const data = await getPayrollRun(payrollRun.id);
        setDetail(data);
      } catch (err: any) {
        setError(getErrorMessage(err, 'Error al cargar liquidacion'));
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [isOpen, payrollRun]);

  const handleClose = () => {
    setDetail(null);
    setError(null);
    onClose();
  };

  const refreshDetail = async () => {
    if (!detail) return;
    try {
      const updated = await getPayrollRun(detail.id);
      setDetail(updated);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al refrescar datos'));
    }
  };

  const handleApprove = async () => {
    if (!detail) return;
    try {
      setSubmitting(true);
      setError(null);
      await approvePayrollRun(detail.id);
      await refreshDetail();
      onDataChanged();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al aprobar liquidacion'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayAll = async () => {
    if (!detail) return;
    try {
      setSubmitting(true);
      setError(null);
      await payPayrollRun(detail.id);
      await refreshDetail();
      onDataChanged();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al pagar liquidacion'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!detail || !confirm('Estas seguro de cancelar esta liquidacion?')) return;
    try {
      setSubmitting(true);
      setError(null);
      await cancelPayrollRun(detail.id);
      handleClose();
      onDataChanged();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cancelar liquidacion'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayItem = async (itemId: string) => {
    if (!detail) return;
    try {
      setError(null);
      await payPayrollItem(detail.id, itemId, { payment_method: 'cash' });
      await refreshDetail();
      onDataChanged();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al pagar empleado'));
    }
  };

  if (!isOpen || !payrollRun) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-3 text-gray-600">Cargando liquidacion...</p>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-semibold">
              Liquidacion {formatPeriodRange(detail.period_start, detail.period_end)}
            </h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${getPayrollStatusColor(detail.status)}`}>
              {getPayrollStatusLabel(detail.status)}
            </span>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="p-6">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Salario Base</p>
              <p className="text-lg font-semibold">{formatCurrency(detail.total_base_salary)}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Bonificaciones</p>
              <p className="text-lg font-semibold text-green-600">+{formatCurrency(detail.total_bonuses)}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Deducciones</p>
              <p className="text-lg font-semibold text-red-600">-{formatCurrency(detail.total_deductions)}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Total Neto</p>
              <p className="text-lg font-semibold text-blue-600">{formatCurrency(detail.total_net)}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empleado</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Base</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bonos</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deducciones</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Neto</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                  {detail.status === 'approved' && (
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Accion</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {detail.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      <div>{item.employee_name}</div>
                      {item.worked_days !== null && item.daily_rate !== null && (
                        <div className="text-xs text-gray-500">
                          {item.worked_days} dias x {formatCurrency(item.daily_rate)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.base_salary)}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600">+{formatCurrency(item.total_bonuses)}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">-{formatCurrency(item.total_deductions)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(item.net_amount)}</td>
                    <td className="px-4 py-3 text-center">
                      {item.is_paid ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">
                          <Check className="w-3 h-3 mr-1" /> Pagado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">
                          Pendiente
                        </span>
                      )}
                    </td>
                    {detail.status === 'approved' && (
                      <td className="px-4 py-3 text-center">
                        {!item.is_paid && (
                          <button
                            onClick={() => handlePayItem(item.id)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Pagar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-between px-6 py-4 border-t bg-gray-50 sticky bottom-0">
          <div>
            {detail.status === 'draft' && (
              <button
                onClick={handleCancel}
                disabled={submitting}
                className="px-4 py-2 text-red-600 hover:text-red-800 flex items-center gap-2"
              >
                <Ban className="w-4 h-4" />
                Cancelar
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={handleClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
              Cerrar
            </button>
            {detail.status === 'draft' && (
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <Check className="w-4 h-4" />
                Aprobar
              </button>
            )}
            {detail.status === 'approved' && (
              <button
                onClick={handlePayAll}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <CreditCard className="w-4 h-4" />
                Pagar Todo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PayrollDetailModal);
