/**
 * PayrollCreateModal - Create a new payroll run with employee selection and preview.
 * Manages its own form state, loading, and error display.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, DollarSign } from 'lucide-react';
import DatePicker from '../../components/DatePicker';
import { formatCurrency } from '../../utils/formatting';
import {
  getEmployees,
  getPaymentFrequencyLabel,
  type EmployeeListItem,
} from '../../services/employeeService';
import {
  createPayrollRun,
  type PayrollRunCreate,
} from '../../services/payrollService';
import { getErrorMessage, type PayrollFormData, type PayrollPreview } from './types';

interface PayrollCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const PayrollCreateModal: React.FC<PayrollCreateModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [form, setForm] = useState<PayrollFormData>({
    period_start: '',
    period_end: '',
    payment_date: '',
    notes: '',
    employee_ids: [],
  });
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);

    // Set default period to current month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setForm({
      period_start: firstDay.toISOString().split('T')[0],
      period_end: lastDay.toISOString().split('T')[0],
      payment_date: '',
      notes: '',
      employee_ids: [],
    });

    // Load active employees
    const loadEmployees = async () => {
      try {
        setLoadingEmployees(true);
        const emps = await getEmployees({ is_active: true });
        setEmployees(emps);
        setSelectedIds(emps.map(e => e.id));
      } catch (err) {
        console.error('Error loading employees for payroll:', err);
      } finally {
        setLoadingEmployees(false);
      }
    };

    loadEmployees();
  }, [isOpen]);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.period_start || !form.period_end) return;
    if (selectedIds.length === 0) {
      setError('Debe seleccionar al menos un empleado');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const payload: PayrollRunCreate = {
        period_start: form.period_start,
        period_end: form.period_end,
        employee_ids: selectedIds,
        notes: form.notes || undefined,
        payment_date: form.payment_date || undefined,
      };
      await createPayrollRun(payload);
      handleClose();
      onCreated();
    } catch (err: any) {
      console.error('Error creating payroll:', err);
      setError(getErrorMessage(err, 'Error al crear liquidacion'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === employees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(employees.map(e => e.id));
    }
  };

  const toggleEmployee = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(eid => eid !== id));
    }
  };

  // Calculate preview
  const preview: PayrollPreview | null = useMemo(() => {
    if (selectedIds.length === 0 || !form.period_start || !form.period_end) return null;

    const selected = employees.filter(emp => selectedIds.includes(emp.id));

    let periodDays = 0;
    const start = new Date(form.period_start);
    const end = new Date(form.period_end);
    periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const breakdown: PayrollPreview['breakdown'] = [];

    for (const emp of selected) {
      let calculated = 0;
      if (emp.payment_frequency === 'daily') {
        const estimatedDays = Math.max(Math.floor(periodDays * 6 / 7), 1);
        calculated = emp.base_salary * estimatedDays;
      } else if (emp.payment_frequency === 'weekly') {
        const weeks = periodDays / 7;
        calculated = emp.base_salary * weeks;
      } else if (emp.payment_frequency === 'biweekly') {
        const biweeks = periodDays / 14;
        calculated = emp.base_salary * biweeks;
      } else {
        if (periodDays < 28) {
          calculated = emp.base_salary * (periodDays / 30);
        } else {
          calculated = emp.base_salary;
        }
      }
      breakdown.push({
        name: emp.full_name,
        salary: emp.base_salary,
        frequency: emp.payment_frequency,
        calculated,
      });
    }

    const totalBase = breakdown.reduce((sum, item) => sum + item.calculated, 0);

    return { totalBase, periodDays, breakdown, count: selected.length };
  }, [selectedIds, employees, form.period_start, form.period_end]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">Nueva Liquidacion de Nomina</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio *</label>
              <DatePicker
                value={form.period_start || ''}
                onChange={(date) => setForm({ ...form, period_start: date })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin *</label>
              <DatePicker
                value={form.period_end || ''}
                onChange={(date) => setForm({ ...form, period_end: date })}
                className="w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Pago</label>
            <DatePicker
              value={form.payment_date || ''}
              onChange={(date) => setForm({ ...form, payment_date: date })}
              className="w-full"
            />
          </div>

          {/* Employee Selection */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Empleados a Liquidar ({selectedIds.length} de {employees.length})
              </label>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {selectedIds.length === employees.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>
            <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
              {loadingEmployees ? (
                <div className="p-4 text-center text-gray-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cargando empleados...
                </div>
              ) : employees.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No hay empleados activos
                </div>
              ) : (
                employees.map(emp => (
                  <label
                    key={emp.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(emp.id)}
                      onChange={(e) => toggleEmployee(emp.id, e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{emp.full_name}</p>
                      <p className="text-xs text-gray-500">{emp.position}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-700">{formatCurrency(emp.base_salary)}</p>
                      <p className="text-xs text-gray-500">{getPaymentFrequencyLabel(emp.payment_frequency)}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Preview Summary */}
          {preview && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Vista Previa de Liquidacion
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-xs text-gray-500">Empleados</p>
                    <p className="text-lg font-bold text-blue-600">{preview.count}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-xs text-gray-500">Dias</p>
                    <p className="text-lg font-bold text-blue-600">{preview.periodDays}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-xs text-gray-500">Total Est.</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(preview.totalBase)}</p>
                  </div>
                </div>

                {/* Mini breakdown */}
                <div className="text-xs text-blue-700 max-h-24 overflow-y-auto">
                  <table className="w-full">
                    <tbody>
                      {preview.breakdown.map((item, idx) => (
                        <tr key={idx} className="border-b border-blue-100 last:border-0">
                          <td className="py-1 truncate max-w-[120px]">{item.name}</td>
                          <td className="py-1 text-center text-blue-500">
                            {getPaymentFrequencyLabel(item.frequency as any)}
                          </td>
                          <td className="py-1 text-right font-medium">
                            {formatCurrency(item.calculated)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-blue-600 italic">
                  * Estimacion basada en dias laborales. El total final puede variar segun registros de asistencia y deducciones.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 sticky bottom-0">
          <button onClick={handleClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !form.period_start || !form.period_end || selectedIds.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear Liquidacion ({selectedIds.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PayrollCreateModal);
