'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  DollarSign,
  Plus,
  Loader2,
  AlertCircle,
  X,
  Calendar,
  Pencil,
  Trash2,
  Check,
  Ban,
  UserPlus,
  Receipt,
  Clock,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { useAdminAuth } from '@/lib/adminAuth';
import employeeService, {
  EmployeeListItem,
  EmployeeResponse,
  EmployeeCreate,
  EmployeeUpdate,
  EmployeeBonusResponse,
  EmployeeBonusCreate,
  PaymentFrequency,
  BonusType,
  PAYMENT_FREQUENCY_LABELS,
  BONUS_TYPE_LABELS,
} from '@/lib/services/employeeService';
import payrollService, {
  PayrollStatus,
  PayrollSummary,
  PayrollRunListItem,
  PayrollRunDetailResponse,
  PayrollRunCreate,
  PAYROLL_STATUS_LABELS,
  PAYROLL_STATUS_COLORS,
  formatPeriodRange,
} from '@/lib/services/payrollService';
import DatePicker from '@/components/ui/DatePicker';
import CurrencyInput from '@/components/ui/CurrencyInput';

// Tabs
type TabType = 'employees' | 'payroll';

// Helper to format currency
const formatCurrency = (amount: number | string | null | undefined) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(num);
};

// Helper to format date
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

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

export default function PayrollPage() {
  const { user } = useAdminAuth();
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

  // Form states
  const [employeeForm, setEmployeeForm] = useState<Partial<EmployeeCreate>>({
    full_name: '',
    document_type: 'CC',
    document_id: '',
    email: '',
    phone: '',
    position: '',
    hire_date: new Date().toISOString().split('T')[0],
    base_salary: 0,
    payment_frequency: 'monthly',
    payment_method: 'cash',
    health_deduction: 0,
    pension_deduction: 0,
    other_deductions: 0,
  });

  const [bonusForm, setBonusForm] = useState<Partial<EmployeeBonusCreate>>({
    name: '',
    bonus_type: 'fixed',
    amount: 0,
    is_recurring: true,
    start_date: new Date().toISOString().split('T')[0],
  });

  const [payrollForm, setPayrollForm] = useState<Partial<PayrollRunCreate>>({
    period_start: '',
    period_end: '',
    payment_date: '',
    notes: '',
  });

  // Check access
  const canAccess = user?.is_superuser || user?.school_roles?.some(r =>
    r.role === 'admin' || r.role === 'owner'
  );

  useEffect(() => {
    if (canAccess) {
      loadData();
    }
  }, [canAccess, activeTab, employeeFilter, payrollFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'employees') {
        const isActiveFilter = employeeFilter === 'active' ? true :
                               employeeFilter === 'inactive' ? false : undefined;
        const data = await employeeService.list({ is_active: isActiveFilter });
        setEmployees(data);
      } else {
        const [summary, runs] = await Promise.all([
          payrollService.getSummary(),
          payrollService.list({ status: payrollFilter === 'all' ? undefined : payrollFilter }),
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
      hire_date: new Date().toISOString().split('T')[0],
      base_salary: 0,
      payment_frequency: 'monthly',
      payment_method: 'cash',
      health_deduction: 0,
      pension_deduction: 0,
      other_deductions: 0,
    });
    setEditingEmployee(null);
  };

  const handleCreateEmployee = async () => {
    if (!employeeForm.full_name || !employeeForm.document_id || !employeeForm.position) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await employeeService.create(employeeForm as EmployeeCreate);
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
      setModalError(null);
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
      };
      await employeeService.update(editingEmployee.id, updateData);
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
    if (!window.confirm('¿Estás seguro de que deseas desactivar este empleado?')) return;
    try {
      await employeeService.delete(id);
      await loadData();
    } catch (err: any) {
      console.error('Error deleting employee:', err);
      setError(getErrorMessage(err, 'Error al eliminar empleado'));
    }
  };

  const openEditEmployee = async (emp: EmployeeListItem) => {
    try {
      const fullEmployee = await employeeService.getById(emp.id);
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
      });
      setModalError(null);
      setShowEmployeeModal(true);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cargar empleado'));
    }
  };

  const openEmployeeBonuses = async (emp: EmployeeListItem) => {
    try {
      const fullEmployee = await employeeService.getById(emp.id);
      const bonuses = await employeeService.getBonuses(emp.id);
      setSelectedEmployee(fullEmployee);
      setEmployeeBonuses(bonuses);
      setModalError(null);
      setShowBonusModal(true);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cargar bonos'));
    }
  };

  const handleCreateBonus = async () => {
    if (!selectedEmployee || !bonusForm.name || !bonusForm.amount) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await employeeService.createBonus(selectedEmployee.id, bonusForm as EmployeeBonusCreate);
      const bonuses = await employeeService.getBonuses(selectedEmployee.id);
      setEmployeeBonuses(bonuses);
      setBonusForm({
        name: '',
        bonus_type: 'fixed',
        amount: 0,
        is_recurring: true,
        start_date: new Date().toISOString().split('T')[0],
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
      await employeeService.deleteBonus(bonusId);
      const bonuses = await employeeService.getBonuses(selectedEmployee.id);
      setEmployeeBonuses(bonuses);
    } catch (err: any) {
      console.error('Error deleting bonus:', err);
      setModalError(getErrorMessage(err, 'Error al eliminar bono'));
    }
  };

  // ===================== PAYROLL FUNCTIONS =====================

  const resetPayrollForm = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setPayrollForm({
      period_start: firstDay.toISOString().split('T')[0],
      period_end: lastDay.toISOString().split('T')[0],
      payment_date: '',
      notes: '',
    });
  };

  const handleCreatePayroll = async () => {
    if (!payrollForm.period_start || !payrollForm.period_end) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await payrollService.create(payrollForm as PayrollRunCreate);
      setShowPayrollModal(false);
      resetPayrollForm();
      await loadData();
    } catch (err: any) {
      console.error('Error creating payroll:', err);
      setModalError(getErrorMessage(err, 'Error al crear liquidación'));
    } finally {
      setSubmitting(false);
    }
  };

  const openPayrollDetail = async (payroll: PayrollRunListItem) => {
    try {
      const detail = await payrollService.getById(payroll.id);
      setSelectedPayroll(detail);
      setModalError(null);
      setShowPayrollDetailModal(true);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cargar liquidación'));
    }
  };

  const handleApprovePayroll = async () => {
    if (!selectedPayroll) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await payrollService.approve(selectedPayroll.id);
      const detail = await payrollService.getById(selectedPayroll.id);
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
      setModalError(null);
      await payrollService.pay(selectedPayroll.id);
      const detail = await payrollService.getById(selectedPayroll.id);
      setSelectedPayroll(detail);
      await loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, 'Error al pagar liquidación'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPayroll = async () => {
    if (!selectedPayroll || !window.confirm('¿Estás seguro de cancelar esta liquidación?')) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await payrollService.cancel(selectedPayroll.id);
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
      await payrollService.payItem(selectedPayroll.id, itemId, { payment_method: 'cash' });
      const detail = await payrollService.getById(selectedPayroll.id);
      setSelectedPayroll(detail);
      await loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, 'Error al pagar empleado'));
    }
  };

  // ===================== RENDER =====================

  // Access check
  if (!canAccess) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
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
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-7 h-7 text-brand-500" />
            Nómina
          </h1>
          <p className="text-slate-500 mt-1">Gestión de empleados y liquidaciones de nómina</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'employees', label: 'Empleados', icon: Users },
            { id: 'payroll', label: 'Liquidaciones', icon: Receipt },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
          <button onClick={loadData} className="ml-auto text-sm underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      )}

      {/* ===================== EMPLOYEES TAB ===================== */}
      {!loading && activeTab === 'employees' && (
        <>
          {/* Action Bar */}
          <div className="flex justify-between items-center">
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value as 'active' | 'inactive' | 'all')}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
            >
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="all">Todos</option>
            </select>
            <button
              onClick={() => {
                resetEmployeeForm();
                setModalError(null);
                setShowEmployeeModal(true);
              }}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              Nuevo Empleado
            </button>
          </div>

          {/* Employees Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Nombre</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Documento</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Cargo</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Salario Base</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Frecuencia</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Estado</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p>No hay empleados registrados</p>
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800">{emp.full_name}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{emp.document_id}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{emp.position}</td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-800 text-right">
                          {formatCurrency(emp.base_salary)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {PAYMENT_FREQUENCY_LABELS[emp.payment_frequency]}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              emp.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {emp.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEmployeeBonuses(emp)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"
                              title="Gestionar Bonos"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditEmployee(emp)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {emp.is_active && (
                              <button
                                onClick={() => handleDeleteEmployee(emp.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
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
          </div>
        </>
      )}

      {/* ===================== PAYROLL TAB ===================== */}
      {!loading && activeTab === 'payroll' && (
        <>
          {/* Summary Cards */}
          {payrollSummary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Empleados Activos</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">
                      {payrollSummary.active_employees}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Nómina Mensual Est.</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                      {formatCurrency(payrollSummary.total_monthly_payroll)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Liquidaciones Pendientes</p>
                    <p className="text-2xl font-bold text-orange-600 mt-1">
                      {payrollSummary.pending_payroll_runs}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Clock className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Última Nómina</p>
                    <p className="text-lg font-bold text-slate-700 mt-1">
                      {payrollSummary.last_payroll_date
                        ? formatDate(payrollSummary.last_payroll_date)
                        : 'Sin registros'}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-slate-600" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex justify-between items-center">
            <select
              value={payrollFilter}
              onChange={(e) => setPayrollFilter(e.target.value as PayrollStatus | 'all')}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
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
                setModalError(null);
                setShowPayrollModal(true);
              }}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nueva Liquidación
            </button>
          </div>

          {/* Payroll Runs Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Período</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Empleados</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Total Neto</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Estado</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Creado</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payrollRuns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p>No hay liquidaciones registradas</p>
                      </td>
                    </tr>
                  ) : (
                    payrollRuns.map((run) => (
                      <tr
                        key={run.id}
                        className="hover:bg-slate-50 transition cursor-pointer"
                        onClick={() => openPayrollDetail(run)}
                      >
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800">
                            {formatPeriodRange(run.period_start, run.period_end)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 text-center">
                          {run.employee_count}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-800 text-right">
                          {formatCurrency(run.total_net)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PAYROLL_STATUS_COLORS[run.status]}`}
                          >
                            {PAYROLL_STATUS_LABELS[run.status]}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {formatDate(run.created_at.split('T')[0])}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openPayrollDetail(run);
                            }}
                            className="text-brand-600 hover:text-brand-800 text-sm font-medium"
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
          </div>
        </>
      )}

      {/* ===================== MODALS ===================== */}

      {/* Employee Modal */}
      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowEmployeeModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
              </h3>
              <button
                onClick={() => {
                  setShowEmployeeModal(false);
                  resetEmployeeForm();
                  setModalError(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  value={employeeForm.full_name || ''}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo Doc.</label>
                  <select
                    value={employeeForm.document_type || 'CC'}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, document_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  >
                    <option value="CC">CC</option>
                    <option value="CE">CE</option>
                    <option value="NIT">NIT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Número Doc. *</label>
                  <input
                    type="text"
                    value={employeeForm.document_id || ''}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, document_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cargo *</label>
                <input
                  type="text"
                  value={employeeForm.position || ''}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, position: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={employeeForm.email || ''}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={employeeForm.phone || ''}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Salario Base *</label>
                <CurrencyInput
                  value={employeeForm.base_salary || 0}
                  onChange={(value) => setEmployeeForm({ ...employeeForm, base_salary: value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Frecuencia de Pago</label>
                  <select
                    value={employeeForm.payment_frequency || 'monthly'}
                    onChange={(e) =>
                      setEmployeeForm({ ...employeeForm, payment_frequency: e.target.value as PaymentFrequency })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  >
                    <option value="daily">Diario</option>
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quincenal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Método de Pago</label>
                  <select
                    value={employeeForm.payment_method || 'cash'}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="nequi">Nequi</option>
                  </select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Deducciones Mensuales</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Salud</label>
                    <CurrencyInput
                      value={employeeForm.health_deduction || 0}
                      onChange={(value) => setEmployeeForm({ ...employeeForm, health_deduction: value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Pensión</label>
                    <CurrencyInput
                      value={employeeForm.pension_deduction || 0}
                      onChange={(value) => setEmployeeForm({ ...employeeForm, pension_deduction: value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Otras</label>
                    <CurrencyInput
                      value={employeeForm.other_deductions || 0}
                      onChange={(value) => setEmployeeForm({ ...employeeForm, other_deductions: value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-50 flex justify-end gap-3 px-6 py-4 border-t">
              <button
                onClick={() => {
                  setShowEmployeeModal(false);
                  resetEmployeeForm();
                  setModalError(null);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={editingEmployee ? handleUpdateEmployee : handleCreateEmployee}
                disabled={submitting || !employeeForm.full_name || !employeeForm.document_id || !employeeForm.position}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowBonusModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-slate-800">
                Bonos de {selectedEmployee.full_name}
              </h3>
              <button
                onClick={() => {
                  setShowBonusModal(false);
                  setSelectedEmployee(null);
                  setModalError(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
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
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Bonos Actuales</h4>
                  <div className="space-y-2">
                    {employeeBonuses.map((bonus) => (
                      <div key={bonus.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium text-slate-800">{bonus.name}</p>
                          <p className="text-sm text-slate-500">
                            {BONUS_TYPE_LABELS[bonus.bonus_type]} - {formatCurrency(bonus.amount)}
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
                <h4 className="text-sm font-medium text-slate-700 mb-3">Agregar Bono</h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nombre del bono"
                    value={bonusForm.name || ''}
                    onChange={(e) => setBonusForm({ ...bonusForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={bonusForm.bonus_type || 'fixed'}
                      onChange={(e) => setBonusForm({ ...bonusForm, bonus_type: e.target.value as BonusType })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                    >
                      <option value="fixed">Fijo</option>
                      <option value="variable">Variable</option>
                      <option value="one_time">Único</option>
                    </select>
                    <CurrencyInput
                      value={bonusForm.amount || 0}
                      onChange={(value) => setBonusForm({ ...bonusForm, amount: value })}
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

            <div className="sticky bottom-0 bg-slate-50 flex justify-end px-6 py-4 border-t">
              <button
                onClick={() => {
                  setShowBonusModal(false);
                  setSelectedEmployee(null);
                  setModalError(null);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Create Modal */}
      {showPayrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowPayrollModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-slate-800">Nueva Liquidación de Nómina</h3>
              <button
                onClick={() => {
                  setShowPayrollModal(false);
                  setModalError(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Inicio *</label>
                  <DatePicker
                    value={payrollForm.period_start || ''}
                    onChange={(date) => setPayrollForm({ ...payrollForm, period_start: date })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Fin *</label>
                  <DatePicker
                    value={payrollForm.period_end || ''}
                    onChange={(date) => setPayrollForm({ ...payrollForm, period_end: date })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Pago</label>
                <DatePicker
                  value={payrollForm.payment_date || ''}
                  onChange={(date) => setPayrollForm({ ...payrollForm, payment_date: date })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                <textarea
                  value={payrollForm.notes || ''}
                  onChange={(e) => setPayrollForm({ ...payrollForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
              <button
                onClick={() => {
                  setShowPayrollModal(false);
                  setModalError(null);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreatePayroll}
                disabled={submitting || !payrollForm.period_start || !payrollForm.period_end}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Crear Liquidación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Detail Modal */}
      {showPayrollDetailModal && selectedPayroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowPayrollDetailModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  Liquidación {formatPeriodRange(selectedPayroll.period_start, selectedPayroll.period_end)}
                </h3>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${PAYROLL_STATUS_COLORS[selectedPayroll.status]}`}
                >
                  {PAYROLL_STATUS_LABELS[selectedPayroll.status]}
                </span>
              </div>
              <button
                onClick={() => {
                  setShowPayrollDetailModal(false);
                  setSelectedPayroll(null);
                  setModalError(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
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
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500">Salario Base</p>
                  <p className="text-lg font-semibold">{formatCurrency(selectedPayroll.total_base_salary)}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500">Bonificaciones</p>
                  <p className="text-lg font-semibold text-green-600">
                    +{formatCurrency(selectedPayroll.total_bonuses)}
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500">Deducciones</p>
                  <p className="text-lg font-semibold text-red-600">
                    -{formatCurrency(selectedPayroll.total_deductions)}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500">Total Neto</p>
                  <p className="text-lg font-semibold text-blue-600">{formatCurrency(selectedPayroll.total_net)}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Empleado</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Base</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Bonos</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Deducciones</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Neto</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Estado</th>
                      {selectedPayroll.status === 'approved' && (
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Acción</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPayroll.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">{item.employee_name}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.base_salary)}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600">
                          +{formatCurrency(item.total_bonuses)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-red-600">
                          -{formatCurrency(item.total_deductions)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(item.net_amount)}</td>
                        <td className="px-4 py-3 text-center">
                          {item.is_paid ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                              <Check className="w-3 h-3 mr-1" /> Pagado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">
                              Pendiente
                            </span>
                          )}
                        </td>
                        {selectedPayroll.status === 'approved' && (
                          <td className="px-4 py-3 text-center">
                            {!item.is_paid && (
                              <button
                                onClick={() => handlePayItem(item.id)}
                                className="text-xs text-brand-600 hover:text-brand-800 font-medium"
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

            <div className="sticky bottom-0 bg-slate-50 flex justify-between px-6 py-4 border-t">
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
                <button
                  onClick={() => {
                    setShowPayrollDetailModal(false);
                    setSelectedPayroll(null);
                    setModalError(null);
                  }}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                >
                  Cerrar
                </button>
                {selectedPayroll.status === 'draft' && (
                  <button
                    onClick={handleApprovePayroll}
                    disabled={submitting}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
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
    </div>
  );
}
