/**
 * Payroll Page - Employee and Payroll Management
 */
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import {
  Users, DollarSign, Plus, Loader2, AlertCircle, X, Calendar,
  Pencil, Trash2, Check, Ban, UserPlus, Receipt, Clock,
  CreditCard, Link2, Link2Off, CalendarClock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import DatePicker, { formatDateSpanish } from '../components/DatePicker';
import CurrencyInput from '../components/CurrencyInput';
import { useUserRole } from '../hooks/useUserRole';
import { getColombiaDateString } from '../utils/formatting';
import {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeBonuses,
  createEmployeeBonus,
  deleteEmployeeBonus,
  getPaymentFrequencyLabel,
  getBonusTypeLabel,
  type EmployeeListItem,
  type EmployeeCreate,
  type EmployeeUpdate,
  type EmployeeResponse,
  type EmployeeBonusResponse,
  type EmployeeBonusCreate,
  type PaymentFrequency,
  type BonusType
} from '../services/employeeService';
import {
  getPayrollSummary,
  getPayrollRuns,
  getPayrollRun,
  createPayrollRun,
  approvePayrollRun,
  payPayrollRun,
  cancelPayrollRun,
  payPayrollItem,
  getPayrollStatusLabel,
  getPayrollStatusColor,
  formatPeriodRange,
  type PayrollSummary,
  type PayrollRunListItem,
  type PayrollRunDetailResponse,
  type PayrollRunCreate,
  type PayrollStatus
} from '../services/payrollService';
import { userService, type User } from '../services/userService';
import { formatCurrency } from '../utils/formatting';

// Tabs
type TabType = 'employees' | 'payroll';

// Helper to extract error message
const getErrorMessage = (err: any, defaultMsg: string): string => {
  const detail = err.response?.data?.detail;
  if (!detail) return defaultMsg;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ');
  }
  if (typeof detail === 'object' && detail.msg) return detail.msg;
  return defaultMsg;
};

export default function Payroll() {
  const { canAccessAccounting, isSuperuser } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('employees');

  // Employee data
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeResponse | null>(null);
  const [employeeBonuses, setEmployeeBonuses] = useState<EmployeeBonusResponse[]>([]);

  // Payroll data
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(null);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRunListItem[]>([]);
  const [payrollFilter, setPayrollFilter] = useState<PayrollStatus | 'all'>('all');
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRunDetailResponse | null>(null);

  // Modal states
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeResponse | null>(null);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showPayrollDetailModal, setShowPayrollDetailModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Users for linking to employees
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Form states
  const [employeeForm, setEmployeeForm] = useState<Partial<EmployeeCreate & { user_id?: string }>>({
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
    user_id: undefined
  });

  const [bonusForm, setBonusForm] = useState<Partial<EmployeeBonusCreate>>({
    name: '',
    bonus_type: 'fixed',
    amount: 0,
    is_recurring: true,
    start_date: getColombiaDateString()
  });

  const [payrollForm, setPayrollForm] = useState<Partial<PayrollRunCreate>>({
    period_start: '',
    period_end: '',
    payment_date: '',
    notes: '',
    employee_ids: []
  });

  // Employee selection for payroll
  const [payrollEmployees, setPayrollEmployees] = useState<EmployeeListItem[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [loadingPayrollEmployees, setLoadingPayrollEmployees] = useState(false);

  useEffect(() => {
    if (canAccessAccounting || isSuperuser) {
      loadData();
    }
  }, [canAccessAccounting, isSuperuser, activeTab, employeeFilter, payrollFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'employees') {
        const isActiveFilter = employeeFilter === 'active' ? true :
                               employeeFilter === 'inactive' ? false : undefined;
        const data = await getEmployees({ is_active: isActiveFilter });
        setEmployees(data);
      } else {
        const [summary, runs] = await Promise.all([
          getPayrollSummary(),
          getPayrollRuns({ status: payrollFilter === 'all' ? undefined : payrollFilter })
        ]);
        setPayrollSummary(summary);
        setPayrollRuns(runs);
      }
    } catch (err: any) {
      console.error('Error loading payroll data:', err);
      setError(getErrorMessage(err, 'Error al cargar datos'));
    } finally {
      setLoading(false);
    }
  };

  // ===================== EMPLOYEE FUNCTIONS =====================

  const resetEmployeeForm = () => {
    setEmployeeForm({
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
      user_id: undefined
    });
    setEditingEmployee(null);
  };

  // Load available users when employee modal opens
  const loadAvailableUsers = async () => {
    try {
      setLoadingUsers(true);
      const users = await userService.getUsers();
      // Only show active users
      setAvailableUsers(users.filter(u => u.is_active));
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateEmployee = async () => {
    if (!employeeForm.full_name || !employeeForm.document_id || !employeeForm.position) return;
    try {
      setSubmitting(true);
      await createEmployee(employeeForm as EmployeeCreate);
      setShowEmployeeModal(false);
      resetEmployeeForm();
      await loadData();
    } catch (err: any) {
      console.error('Error creating employee:', err);
      setModalError(getErrorMessage(err, 'Error al crear empleado'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return;
    try {
      setSubmitting(true);
      const updateData: EmployeeUpdate = {
        full_name: employeeForm.full_name,
        document_type: employeeForm.document_type,
        document_id: employeeForm.document_id,
        email: employeeForm.email,
        phone: employeeForm.phone,
        position: employeeForm.position,
        base_salary: employeeForm.base_salary,
        payment_frequency: employeeForm.payment_frequency,
        payment_method: employeeForm.payment_method,
        health_deduction: employeeForm.health_deduction,
        pension_deduction: employeeForm.pension_deduction,
        other_deductions: employeeForm.other_deductions,
        user_id: employeeForm.user_id || null  // Pass null to unlink, or the user_id to link
      };
      await updateEmployee(editingEmployee.id, updateData);
      setShowEmployeeModal(false);
      resetEmployeeForm();
      await loadData();
    } catch (err: any) {
      console.error('Error updating employee:', err);
      setModalError(getErrorMessage(err, 'Error al actualizar empleado'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas desactivar este empleado?')) return;
    try {
      await deleteEmployee(id);
      await loadData();
    } catch (err: any) {
      console.error('Error deleting employee:', err);
      setError(getErrorMessage(err, 'Error al eliminar empleado'));
    }
  };

  const openEditEmployee = async (emp: EmployeeListItem) => {
    try {
      const fullEmployee = await getEmployee(emp.id);
      setEditingEmployee(fullEmployee);
      setEmployeeForm({
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
        user_id: fullEmployee.user_id || undefined
      });
      await loadAvailableUsers();
      setShowEmployeeModal(true);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cargar empleado'));
    }
  };

  const openEmployeeBonuses = async (emp: EmployeeListItem) => {
    try {
      const fullEmployee = await getEmployee(emp.id);
      const bonuses = await getEmployeeBonuses(emp.id);
      setSelectedEmployee(fullEmployee);
      setEmployeeBonuses(bonuses);
      setShowBonusModal(true);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cargar bonos'));
    }
  };

  const handleCreateBonus = async () => {
    if (!selectedEmployee || !bonusForm.name || !bonusForm.amount) return;
    try {
      setSubmitting(true);
      await createEmployeeBonus(selectedEmployee.id, bonusForm as EmployeeBonusCreate);
      const bonuses = await getEmployeeBonuses(selectedEmployee.id);
      setEmployeeBonuses(bonuses);
      setBonusForm({
        name: '',
        bonus_type: 'fixed',
        amount: 0,
        is_recurring: true,
        start_date: getColombiaDateString()
      });
    } catch (err: any) {
      console.error('Error creating bonus:', err);
      setModalError(getErrorMessage(err, 'Error al crear bono'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBonus = async (bonusId: string) => {
    if (!selectedEmployee) return;
    try {
      await deleteEmployeeBonus(bonusId);
      const bonuses = await getEmployeeBonuses(selectedEmployee.id);
      setEmployeeBonuses(bonuses);
    } catch (err: any) {
      console.error('Error deleting bonus:', err);
      setModalError(getErrorMessage(err, 'Error al eliminar bono'));
    }
  };

  // ===================== PAYROLL FUNCTIONS =====================

  const resetPayrollForm = async () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setPayrollForm({
      period_start: firstDay.toISOString().split('T')[0],
      period_end: lastDay.toISOString().split('T')[0],
      payment_date: '',
      notes: '',
      employee_ids: []
    });

    // Load active employees for selection
    try {
      setLoadingPayrollEmployees(true);
      const emps = await getEmployees({ is_active: true });
      setPayrollEmployees(emps);
      // Pre-select all employees by default
      const allIds = emps.map(e => e.id);
      setSelectedEmployeeIds(allIds);
    } catch (err) {
      console.error('Error loading employees for payroll:', err);
    } finally {
      setLoadingPayrollEmployees(false);
    }
  };

  const handleCreatePayroll = async () => {
    if (!payrollForm.period_start || !payrollForm.period_end) return;
    if (selectedEmployeeIds.length === 0) {
      setModalError('Debe seleccionar al menos un empleado');
      return;
    }
    try {
      setSubmitting(true);
      // Build payload, omitting empty payment_date
      const payload: PayrollRunCreate = {
        period_start: payrollForm.period_start,
        period_end: payrollForm.period_end,
        employee_ids: selectedEmployeeIds,
        notes: payrollForm.notes || undefined,
        payment_date: payrollForm.payment_date || undefined // Don't send empty string
      };
      await createPayrollRun(payload);
      setShowPayrollModal(false);
      await loadData();
    } catch (err: any) {
      console.error('Error creating payroll:', err);
      setModalError(getErrorMessage(err, 'Error al crear liquidación'));
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate preview totals for selected employees
  const getPayrollPreview = () => {
    const selected = payrollEmployees.filter(emp => selectedEmployeeIds.includes(emp.id));

    // Calculate period days
    let periodDays = 0;
    if (payrollForm.period_start && payrollForm.period_end) {
      const start = new Date(payrollForm.period_start);
      const end = new Date(payrollForm.period_end);
      periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    const breakdown: { name: string; salary: number; frequency: string; calculated: number }[] = [];

    for (const emp of selected) {
      let calculated = 0;
      if (emp.payment_frequency === 'daily') {
        // Estimate 6 working days per week
        const estimatedDays = Math.max(Math.floor(periodDays * 6 / 7), 1);
        calculated = emp.base_salary * estimatedDays;
      } else if (emp.payment_frequency === 'weekly') {
        const weeks = periodDays / 7;
        calculated = emp.base_salary * weeks;
      } else if (emp.payment_frequency === 'biweekly') {
        const biweeks = periodDays / 14;
        calculated = emp.base_salary * biweeks;
      } else {
        // Monthly - prorate if less than 28 days
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
        calculated
      });
    }

    // Calculate total from breakdown to ensure consistency
    const totalBase = breakdown.reduce((sum, item) => sum + item.calculated, 0);

    return { totalBase, periodDays, breakdown, count: selected.length };
  };

  const openPayrollDetail = async (payroll: PayrollRunListItem) => {
    try {
      const detail = await getPayrollRun(payroll.id);
      setSelectedPayroll(detail);
      setShowPayrollDetailModal(true);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cargar liquidación'));
    }
  };

  const handleApprovePayroll = async () => {
    if (!selectedPayroll) return;
    try {
      setSubmitting(true);
      await approvePayrollRun(selectedPayroll.id);
      const detail = await getPayrollRun(selectedPayroll.id);
      setSelectedPayroll(detail);
      await loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, 'Error al aprobar liquidación'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayPayroll = async () => {
    if (!selectedPayroll) return;
    try {
      setSubmitting(true);
      await payPayrollRun(selectedPayroll.id);
      const detail = await getPayrollRun(selectedPayroll.id);
      setSelectedPayroll(detail);
      await loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, 'Error al pagar liquidación'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPayroll = async () => {
    if (!selectedPayroll || !confirm('¿Estás seguro de cancelar esta liquidación?')) return;
    try {
      setSubmitting(true);
      await cancelPayrollRun(selectedPayroll.id);
      setShowPayrollDetailModal(false);
      await loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, 'Error al cancelar liquidación'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayItem = async (itemId: string) => {
    if (!selectedPayroll) return;
    try {
      await payPayrollItem(selectedPayroll.id, itemId, { payment_method: 'cash' });
      const detail = await getPayrollRun(selectedPayroll.id);
      setSelectedPayroll(detail);
      await loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, 'Error al pagar empleado'));
    }
  };

  // ===================== RENDER FUNCTIONS =====================

  const renderTabs = () => (
    <div className="border-b border-gray-200 mb-6">
      <nav className="-mb-px flex space-x-8">
        {[
          { id: 'employees', label: 'Empleados', icon: Users },
          { id: 'payroll', label: 'Liquidaciones', icon: Receipt }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );

  const renderEmployeesTab = () => (
    <>
      {/* Action Bar */}
      <div className="flex justify-between items-center mb-6">
        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value as 'active' | 'inactive' | 'all')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="all">Todos</option>
        </select>
        <button
          onClick={async () => {
            resetEmployeeForm();
            await loadAvailableUsers();
            setShowEmployeeModal(true);
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Nuevo Empleado
        </button>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cargo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salario Base</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frecuencia</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No hay empleados registrados
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{emp.full_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {emp.document_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {emp.position}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(emp.base_salary)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {getPaymentFrequencyLabel(emp.payment_frequency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      emp.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {emp.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEmployeeBonuses(emp)}
                        className="text-green-600 hover:text-green-800 p-1"
                        title="Gestionar Bonos"
                      >
                        <DollarSign className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditEmployee(emp)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {emp.is_active && (
                        <button
                          onClick={() => handleDeleteEmployee(emp.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Desactivar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderPayrollTab = () => (
    <>
      {/* Summary Cards */}
      {payrollSummary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Empleados Activos</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    {payrollSummary.active_employees}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Nomina Mensual Est.</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {formatCurrency(payrollSummary.total_monthly_payroll)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Liquidaciones Pendientes</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">
                    {payrollSummary.pending_payroll_runs}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Ultima Nomina</p>
                  <p className="text-lg font-bold text-gray-700 mt-1">
                    {payrollSummary.last_payroll_date
                      ? formatDateSpanish(payrollSummary.last_payroll_date)
                      : 'Sin registros'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Expense Integration Status */}
          <div className={`mb-8 p-4 rounded-lg border ${
            payrollSummary.fixed_expense_integration?.is_synced
              ? 'bg-green-50 border-green-200'
              : payrollSummary.fixed_expense_integration
                ? 'bg-amber-50 border-amber-200'
                : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {payrollSummary.fixed_expense_integration?.is_synced ? (
                  <Link2 className="w-5 h-5 text-green-600" />
                ) : payrollSummary.fixed_expense_integration ? (
                  <Link2Off className="w-5 h-5 text-amber-600" />
                ) : (
                  <CalendarClock className="w-5 h-5 text-blue-600" />
                )}
                <div>
                  <p className={`font-medium ${
                    payrollSummary.fixed_expense_integration?.is_synced
                      ? 'text-green-800'
                      : payrollSummary.fixed_expense_integration
                        ? 'text-amber-800'
                        : 'text-blue-800'
                  }`}>
                    {payrollSummary.fixed_expense_integration?.is_synced
                      ? 'Nomina sincronizada con Gastos Fijos'
                      : payrollSummary.fixed_expense_integration
                        ? 'Gasto fijo de nomina requiere actualizacion'
                        : 'Nomina aun no integrada con Gastos Fijos'
                    }
                  </p>
                  <p className={`text-sm ${
                    payrollSummary.fixed_expense_integration?.is_synced
                      ? 'text-green-600'
                      : payrollSummary.fixed_expense_integration
                        ? 'text-amber-600'
                        : 'text-blue-600'
                  }`}>
                    {payrollSummary.fixed_expense_integration
                      ? `Gasto fijo actual: ${formatCurrency(payrollSummary.fixed_expense_integration.amount)}`
                      : 'Aprueba una liquidacion para crear el gasto fijo consolidado'
                    }
                  </p>
                </div>
              </div>
              <Link
                to="/accounting"
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  payrollSummary.fixed_expense_integration?.is_synced
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : payrollSummary.fixed_expense_integration
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                Ver en Contabilidad
              </Link>
            </div>
          </div>
        </>
      )}

      {/* Action Bar */}
      <div className="flex justify-between items-center mb-6">
        <select
          value={payrollFilter}
          onChange={(e) => setPayrollFilter(e.target.value as PayrollStatus | 'all')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">Todos</option>
          <option value="draft">Borradores</option>
          <option value="approved">Aprobados</option>
          <option value="paid">Pagados</option>
          <option value="cancelled">Cancelados</option>
        </select>
        <button
          onClick={() => {
            resetPayrollForm();
            setShowPayrollModal(true);
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nueva Liquidación
        </button>
      </div>

      {/* Payroll Runs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empleados</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Neto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Creado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payrollRuns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No hay liquidaciones registradas
                </td>
              </tr>
            ) : (
              payrollRuns.map((run) => (
                <tr key={run.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openPayrollDetail(run)}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatPeriodRange(run.period_start, run.period_end)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {run.employee_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(run.total_net)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPayrollStatusColor(run.status)}`}>
                      {getPayrollStatusLabel(run.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDateSpanish(run.created_at.split('T')[0])}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openPayrollDetail(run);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  // ===================== MAIN RENDER =====================

  if (!canAccessAccounting && !isSuperuser) {
    return (
      <Layout>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Acceso Restringido</h3>
              <p className="mt-1 text-sm text-yellow-700">
                No tienes permisos para acceder a la nómina.
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Cargando nómina...</span>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button onClick={loadData} className="mt-3 text-sm text-red-700 hover:text-red-800 underline">
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Users className="w-8 h-8 mr-3 text-blue-600" />
            Nómina
          </h1>
          <p className="text-gray-600 mt-1">Gestión de empleados y liquidaciones</p>
        </div>
      </div>

      {/* Tabs */}
      {renderTabs()}

      {/* Tab Content */}
      {activeTab === 'employees' && renderEmployeesTab()}
      {activeTab === 'payroll' && renderPayrollTab()}

      {/* ===================== MODALS ===================== */}

      {/* Employee Modal */}
      {showEmployeeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">
                {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
              </h3>
              <button onClick={() => { setShowEmployeeModal(false); resetEmployeeForm(); setModalError(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {modalError}
              </div>
            )}

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  value={employeeForm.full_name || ''}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Doc.</label>
                  <select
                    value={employeeForm.document_type || 'CC'}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, document_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CC">CC</option>
                    <option value="CE">CE</option>
                    <option value="NIT">NIT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número Doc. *</label>
                  <input
                    type="text"
                    value={employeeForm.document_id || ''}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, document_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo *</label>
                <input
                  type="text"
                  value={employeeForm.position || ''}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, position: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="flex items-center gap-2">
                    {employeeForm.user_id ? <Link2 className="w-4 h-4 text-green-600" /> : <Link2Off className="w-4 h-4 text-gray-400" />}
                    Usuario Vinculado
                  </span>
                </label>
                <select
                  value={employeeForm.user_id || ''}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, user_id: e.target.value || undefined })}
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
                  Vincular permite al empleado acceder a "Mi Perfil" y ver su información laboral
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={employeeForm.email || ''}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={employeeForm.phone || ''}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Salario Base *</label>
                <CurrencyInput
                  value={employeeForm.base_salary || 0}
                  onChange={(value) => setEmployeeForm({ ...employeeForm, base_salary: value })}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia de Pago</label>
                  <select
                    value={employeeForm.payment_frequency || 'monthly'}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, payment_frequency: e.target.value as PaymentFrequency })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="daily">Diario</option>
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quincenal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                  <select
                    value={employeeForm.payment_method || 'cash'}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, payment_method: e.target.value })}
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
                      value={employeeForm.health_deduction || 0}
                      onChange={(value) => setEmployeeForm({ ...employeeForm, health_deduction: value })}
                      className="w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Pensión</label>
                    <CurrencyInput
                      value={employeeForm.pension_deduction || 0}
                      onChange={(value) => setEmployeeForm({ ...employeeForm, pension_deduction: value })}
                      className="w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Otras</label>
                    <CurrencyInput
                      value={employeeForm.other_deductions || 0}
                      onChange={(value) => setEmployeeForm({ ...employeeForm, other_deductions: value })}
                      className="w-full text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 sticky bottom-0">
              <button onClick={() => { setShowEmployeeModal(false); resetEmployeeForm(); setModalError(null); }} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                Cancelar
              </button>
              <button
                onClick={editingEmployee ? handleUpdateEmployee : handleCreateEmployee}
                disabled={submitting || !employeeForm.full_name || !employeeForm.document_id || !employeeForm.position}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingEmployee ? 'Guardar Cambios' : 'Crear Empleado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bonus Modal */}
      {showBonusModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">
                Bonos de {selectedEmployee.full_name}
              </h3>
              <button onClick={() => { setShowBonusModal(false); setSelectedEmployee(null); setModalError(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {modalError}
              </div>
            )}

            <div className="p-6">
              {/* Existing bonuses */}
              {employeeBonuses.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Bonos Actuales</h4>
                  <div className="space-y-2">
                    {employeeBonuses.map((bonus) => (
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
                    value={bonusForm.name || ''}
                    onChange={(e) => setBonusForm({ ...bonusForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={bonusForm.bonus_type || 'fixed'}
                      onChange={(e) => setBonusForm({ ...bonusForm, bonus_type: e.target.value as BonusType })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="fixed">Fijo</option>
                      <option value="variable">Variable</option>
                      <option value="one_time">Único</option>
                    </select>
                    <CurrencyInput
                      value={bonusForm.amount || 0}
                      onChange={(value) => setBonusForm({ ...bonusForm, amount: value })}
                      className="w-full"
                    />
                  </div>
                  <button
                    onClick={handleCreateBonus}
                    disabled={submitting || !bonusForm.name || !bonusForm.amount}
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
              <button onClick={() => { setShowBonusModal(false); setSelectedEmployee(null); setModalError(null); }} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Create Modal */}
      {showPayrollModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">Nueva Liquidación de Nómina</h3>
              <button onClick={() => { setShowPayrollModal(false); setModalError(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {modalError}
              </div>
            )}

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio *</label>
                  <DatePicker
                    value={payrollForm.period_start || ''}
                    onChange={(date) => setPayrollForm({ ...payrollForm, period_start: date })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin *</label>
                  <DatePicker
                    value={payrollForm.period_end || ''}
                    onChange={(date) => setPayrollForm({ ...payrollForm, period_end: date })}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Pago</label>
                <DatePicker
                  value={payrollForm.payment_date || ''}
                  onChange={(date) => setPayrollForm({ ...payrollForm, payment_date: date })}
                  className="w-full"
                />
              </div>

              {/* Employee Selection */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Empleados a Liquidar ({selectedEmployeeIds.length} de {payrollEmployees.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedEmployeeIds.length === payrollEmployees.length) {
                        setSelectedEmployeeIds([]);
                      } else {
                        setSelectedEmployeeIds(payrollEmployees.map(e => e.id));
                      }
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {selectedEmployeeIds.length === payrollEmployees.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                </div>
                <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                  {loadingPayrollEmployees ? (
                    <div className="p-4 text-center text-gray-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cargando empleados...
                    </div>
                  ) : payrollEmployees.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      No hay empleados activos
                    </div>
                  ) : (
                    payrollEmployees.map(emp => (
                      <label
                        key={emp.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEmployeeIds.includes(emp.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEmployeeIds([...selectedEmployeeIds, emp.id]);
                            } else {
                              setSelectedEmployeeIds(selectedEmployeeIds.filter(id => id !== emp.id));
                            }
                          }}
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
              {selectedEmployeeIds.length > 0 && payrollForm.period_start && payrollForm.period_end && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Vista Previa de Liquidación
                  </h4>
                  {(() => {
                    const preview = getPayrollPreview();
                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-xs text-gray-500">Empleados</p>
                            <p className="text-lg font-bold text-blue-600">{preview.count}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-xs text-gray-500">Días</p>
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
                          * Estimación basada en días laborales. El total final puede variar según registros de asistencia y deducciones.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={payrollForm.notes || ''}
                  onChange={(e) => setPayrollForm({ ...payrollForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 sticky bottom-0">
              <button onClick={() => { setShowPayrollModal(false); setModalError(null); }} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                Cancelar
              </button>
              <button
                onClick={handleCreatePayroll}
                disabled={submitting || !payrollForm.period_start || !payrollForm.period_end || selectedEmployeeIds.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Crear Liquidación ({selectedEmployeeIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Detail Modal */}
      {showPayrollDetailModal && selectedPayroll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <div>
                <h3 className="text-lg font-semibold">
                  Liquidación {formatPeriodRange(selectedPayroll.period_start, selectedPayroll.period_end)}
                </h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${getPayrollStatusColor(selectedPayroll.status)}`}>
                  {getPayrollStatusLabel(selectedPayroll.status)}
                </span>
              </div>
              <button onClick={() => { setShowPayrollDetailModal(false); setSelectedPayroll(null); setModalError(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {modalError}
              </div>
            )}

            <div className="p-6">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Salario Base</p>
                  <p className="text-lg font-semibold">{formatCurrency(selectedPayroll.total_base_salary)}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Bonificaciones</p>
                  <p className="text-lg font-semibold text-green-600">+{formatCurrency(selectedPayroll.total_bonuses)}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Deducciones</p>
                  <p className="text-lg font-semibold text-red-600">-{formatCurrency(selectedPayroll.total_deductions)}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Total Neto</p>
                  <p className="text-lg font-semibold text-blue-600">{formatCurrency(selectedPayroll.total_net)}</p>
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
                      {selectedPayroll.status === 'approved' && (
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acción</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedPayroll.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          <div>{item.employee_name}</div>
                          {item.worked_days !== null && item.daily_rate !== null && (
                            <div className="text-xs text-gray-500">
                              {item.worked_days} días × {formatCurrency(item.daily_rate)}
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
                        {selectedPayroll.status === 'approved' && (
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
                {selectedPayroll.status === 'draft' && (
                  <button
                    onClick={handleCancelPayroll}
                    disabled={submitting}
                    className="px-4 py-2 text-red-600 hover:text-red-800 flex items-center gap-2"
                  >
                    <Ban className="w-4 h-4" />
                    Cancelar
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowPayrollDetailModal(false); setSelectedPayroll(null); setModalError(null); }} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                  Cerrar
                </button>
                {selectedPayroll.status === 'draft' && (
                  <button
                    onClick={handleApprovePayroll}
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <Check className="w-4 h-4" />
                    Aprobar
                  </button>
                )}
                {selectedPayroll.status === 'approved' && (
                  <button
                    onClick={handlePayPayroll}
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
      )}
    </Layout>
  );
}
