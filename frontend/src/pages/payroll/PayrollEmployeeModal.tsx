/**
 * PayrollEmployeeModal - Create or edit an employee.
 * Manages its own form state, loading, and error display.
 */
import React, { useState, useEffect } from 'react';
import { X, Loader2, Link2, Link2Off } from 'lucide-react';
import CurrencyInput from '../../components/CurrencyInput';
import { getColombiaDateString } from '../../utils/formatting';
import {
  createEmployee,
  updateEmployee,
  getEmployee,
  type EmployeeCreate,
  type EmployeeUpdate,
  type EmployeeResponse,
  type EmployeeListItem,
  type PaymentFrequency,
} from '../../services/employeeService';
import { userService, type User } from '../../services/userService';
import { getErrorMessage, type EmployeeFormData } from './types';

interface PayrollEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When set, the modal loads and edits this employee */
  editTarget: EmployeeListItem | null;
  onSaved: () => void;
}

const INITIAL_FORM: EmployeeFormData = {
  full_name: '',
  document_type: 'CC',
  document_id: '',
  email: '',
  phone: '',
  position: '',
  hire_date: getColombiaDateString(),
  base_salary: 0,
  payment_frequency: 'monthly',
  payment_method: 'cash',
  health_deduction: 0,
  pension_deduction: 0,
  other_deductions: 0,
  user_id: undefined,
};

const PayrollEmployeeModal: React.FC<PayrollEmployeeModalProps> = ({
  isOpen,
  onClose,
  editTarget,
  onSaved,
}) => {
  const [form, setForm] = useState<EmployeeFormData>({ ...INITIAL_FORM });
  const [editingEmployee, setEditingEmployee] = useState<EmployeeResponse | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setError(null);

    const loadUsers = async () => {
      try {
        setLoadingUsers(true);
        const users = await userService.getUsers();
        setAvailableUsers(users.filter(u => u.is_active));
      } catch (err) {
        console.error('Error loading users:', err);
      } finally {
        setLoadingUsers(false);
      }
    };

    if (editTarget) {
      // Load full employee data for editing
      const loadEmployee = async () => {
        try {
          setLoading(true);
          const fullEmployee = await getEmployee(editTarget.id);
          setEditingEmployee(fullEmployee);
          setForm({
            full_name: fullEmployee.full_name,
            document_type: fullEmployee.document_type,
            document_id: fullEmployee.document_id,
            email: fullEmployee.email || '',
            phone: fullEmployee.phone || '',
            position: fullEmployee.position,
            hire_date: fullEmployee.hire_date,
            base_salary: fullEmployee.base_salary,
            payment_frequency: fullEmployee.payment_frequency,
            payment_method: fullEmployee.payment_method,
            health_deduction: fullEmployee.health_deduction,
            pension_deduction: fullEmployee.pension_deduction,
            other_deductions: fullEmployee.other_deductions,
            user_id: fullEmployee.user_id || undefined,
          });
        } catch (err: any) {
          setError(getErrorMessage(err, 'Error al cargar empleado'));
        } finally {
          setLoading(false);
        }
      };
      loadEmployee();
    } else {
      setEditingEmployee(null);
      setForm({ ...INITIAL_FORM, hire_date: getColombiaDateString() });
    }

    loadUsers();
  }, [isOpen, editTarget]);

  const handleClose = () => {
    setForm({ ...INITIAL_FORM });
    setEditingEmployee(null);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.full_name || !form.document_id || !form.position) return;

    try {
      setSubmitting(true);
      setError(null);

      if (editingEmployee) {
        const updateData: EmployeeUpdate = {
          full_name: form.full_name,
          document_type: form.document_type,
          document_id: form.document_id,
          email: form.email,
          phone: form.phone,
          position: form.position,
          base_salary: form.base_salary,
          payment_frequency: form.payment_frequency,
          payment_method: form.payment_method,
          health_deduction: form.health_deduction,
          pension_deduction: form.pension_deduction,
          other_deductions: form.other_deductions,
          user_id: form.user_id || null,
        };
        await updateEmployee(editingEmployee.id, updateData);
      } else {
        await createEmployee(form as EmployeeCreate);
      }

      handleClose();
      onSaved();
    } catch (err: any) {
      console.error('Error saving employee:', err);
      setError(getErrorMessage(err, editingEmployee ? 'Error al actualizar empleado' : 'Error al crear empleado'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-3 text-gray-600">Cargando empleado...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">
            {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
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

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label>
            <input
              type="text"
              value={form.full_name || ''}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Doc.</label>
              <select
                value={form.document_type || 'CC'}
                onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="NIT">NIT</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numero Doc. *</label>
              <input
                type="text"
                value={form.document_id || ''}
                onChange={(e) => setForm({ ...form, document_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cargo *</label>
            <input
              type="text"
              value={form.position || ''}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-2">
                {form.user_id ? <Link2 className="w-4 h-4 text-green-600" /> : <Link2Off className="w-4 h-4 text-gray-400" />}
                Usuario Vinculado
              </span>
            </label>
            <select
              value={form.user_id || ''}
              onChange={(e) => setForm({ ...form, user_id: e.target.value || undefined })}
              disabled={loadingUsers}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">Sin vincular (empleado sin acceso al sistema)</option>
              {availableUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.username} ({user.email || 'sin email'})
                  {user.is_superuser ? ' [Superusuario]' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Vincular permite al empleado acceder a "Mi Perfil" y ver su informacion laboral
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
              <input
                type="text"
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salario Base *</label>
            <CurrencyInput
              value={form.base_salary || 0}
              onChange={(value) => setForm({ ...form, base_salary: value })}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia de Pago</label>
              <select
                value={form.payment_frequency || 'monthly'}
                onChange={(e) => setForm({ ...form, payment_frequency: e.target.value as PaymentFrequency })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Metodo de Pago</label>
              <select
                value={form.payment_method || 'cash'}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="nequi">Nequi</option>
              </select>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Deducciones Mensuales</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Salud</label>
                <CurrencyInput
                  value={form.health_deduction || 0}
                  onChange={(value) => setForm({ ...form, health_deduction: value })}
                  className="w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Pension</label>
                <CurrencyInput
                  value={form.pension_deduction || 0}
                  onChange={(value) => setForm({ ...form, pension_deduction: value })}
                  className="w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Otras</label>
                <CurrencyInput
                  value={form.other_deductions || 0}
                  onChange={(value) => setForm({ ...form, other_deductions: value })}
                  className="w-full text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 sticky bottom-0">
          <button onClick={handleClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !form.full_name || !form.document_id || !form.position}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {editingEmployee ? 'Guardar Cambios' : 'Crear Empleado'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PayrollEmployeeModal);
