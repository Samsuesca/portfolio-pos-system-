/**
 * PayrollBonusModal - View and manage employee bonuses.
 * Manages its own form state, loading, and error display.
 */
import React, { useState, useEffect } from 'react';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import CurrencyInput from '../../components/CurrencyInput';
import { getColombiaDateString, formatCurrency } from '../../utils/formatting';
import {
  getEmployee,
  getEmployeeBonuses,
  createEmployeeBonus,
  deleteEmployeeBonus,
  getBonusTypeLabel,
  type EmployeeResponse,
  type EmployeeBonusResponse,
  type EmployeeBonusCreate,
  type EmployeeListItem,
  type BonusType,
} from '../../services/employeeService';
import { getErrorMessage, type BonusFormData } from './types';

interface PayrollBonusModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The employee to manage bonuses for */
  employee: EmployeeListItem | null;
}

const INITIAL_BONUS_FORM: BonusFormData = {
  name: '',
  bonus_type: 'fixed',
  amount: 0,
  is_recurring: true,
  start_date: getColombiaDateString(),
};

const PayrollBonusModal: React.FC<PayrollBonusModalProps> = ({
  isOpen,
  onClose,
  employee,
}) => {
  const [fullEmployee, setFullEmployee] = useState<EmployeeResponse | null>(null);
  const [bonuses, setBonuses] = useState<EmployeeBonusResponse[]>([]);
  const [form, setForm] = useState<BonusFormData>({ ...INITIAL_BONUS_FORM });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !employee) return;

    setError(null);
    setForm({ ...INITIAL_BONUS_FORM, start_date: getColombiaDateString() });

    const loadData = async () => {
      try {
        setLoading(true);
        const [emp, empBonuses] = await Promise.all([
          getEmployee(employee.id),
          getEmployeeBonuses(employee.id),
        ]);
        setFullEmployee(emp);
        setBonuses(empBonuses);
      } catch (err: any) {
        setError(getErrorMessage(err, 'Error al cargar bonos'));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, employee]);

  const handleClose = () => {
    setFullEmployee(null);
    setBonuses([]);
    setError(null);
    onClose();
  };

  const handleCreateBonus = async () => {
    if (!fullEmployee || !form.name || !form.amount) return;
    try {
      setSubmitting(true);
      setError(null);
      await createEmployeeBonus(fullEmployee.id, form as EmployeeBonusCreate);
      const updatedBonuses = await getEmployeeBonuses(fullEmployee.id);
      setBonuses(updatedBonuses);
      setForm({ ...INITIAL_BONUS_FORM, start_date: getColombiaDateString() });
    } catch (err: any) {
      console.error('Error creating bonus:', err);
      setError(getErrorMessage(err, 'Error al crear bono'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBonus = async (bonusId: string) => {
    if (!fullEmployee) return;
    try {
      setError(null);
      await deleteEmployeeBonus(bonusId);
      const updatedBonuses = await getEmployeeBonuses(fullEmployee.id);
      setBonuses(updatedBonuses);
    } catch (err: any) {
      console.error('Error deleting bonus:', err);
      setError(getErrorMessage(err, 'Error al eliminar bono'));
    }
  };

  if (!isOpen || !employee) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-3 text-gray-600">Cargando bonos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">
            Bonos de {fullEmployee?.full_name || employee.full_name}
          </h3>
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
          {/* Existing bonuses */}
          {bonuses.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Bonos Actuales</h4>
              <div className="space-y-2">
                {bonuses.map((bonus) => (
                  <div key={bonus.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{bonus.name}</p>
                      <p className="text-sm text-gray-500">
                        {getBonusTypeLabel(bonus.bonus_type)} - {formatCurrency(bonus.amount)}
                        {bonus.is_recurring && ' (Recurrente)'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteBonus(bonus.id)}
                      className="text-red-600 hover:text-red-800 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add new bonus */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Agregar Bono</h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nombre del bono"
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.bonus_type || 'fixed'}
                  onChange={(e) => setForm({ ...form, bonus_type: e.target.value as BonusType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="fixed">Fijo</option>
                  <option value="variable">Variable</option>
                  <option value="one_time">Unico</option>
                </select>
                <CurrencyInput
                  value={form.amount || 0}
                  onChange={(value) => setForm({ ...form, amount: value })}
                  className="w-full"
                />
              </div>
              <button
                onClick={handleCreateBonus}
                disabled={submitting || !form.name || !form.amount}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <Plus className="w-4 h-4" />
                Agregar Bono
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end px-6 py-4 border-t bg-gray-50">
          <button onClick={handleClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PayrollBonusModal);
