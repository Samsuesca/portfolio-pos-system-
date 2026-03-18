/**
 * Payroll Page - Employee and Payroll Management
 *
 * Orchestrator component that composes tab sections and modals.
 * Each sub-component manages its own form/loading/error state;
 * this component only tracks which tab and modal are active.
 */
import { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import { Users, Loader2, AlertCircle } from 'lucide-react';
import { useUserRole } from '../../hooks/useUserRole';
import {
  getEmployees,
  deleteEmployee,
  type EmployeeListItem,
} from '../../services/employeeService';
import {
  getPayrollSummary,
  getPayrollRuns,
  type PayrollSummary,
  type PayrollRunListItem,
  type PayrollStatus,
} from '../../services/payrollService';

// Sub-components
import PayrollTabs from './PayrollTabs';
import PayrollEmployeesTab from './PayrollEmployeesTab';
import PayrollRunsTab from './PayrollRunsTab';

// Modals
import PayrollEmployeeModal from './PayrollEmployeeModal';
import PayrollBonusModal from './PayrollBonusModal';
import PayrollCreateModal from './PayrollCreateModal';
import PayrollDetailModal from './PayrollDetailModal';

import type { TabType, EmployeeFilterType } from './types';
import { getErrorMessage } from './types';

export default function Payroll() {
  const { canAccessAccounting, isSuperuser } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('employees');

  // Employee data
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilterType>('active');

  // Payroll data
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(null);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRunListItem[]>([]);
  const [payrollFilter, setPayrollFilter] = useState<PayrollStatus | 'all'>('all');

  // Modal targets (which modal is open and with what data)
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [employeeEditTarget, setEmployeeEditTarget] = useState<EmployeeListItem | null>(null);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusTarget, setBonusTarget] = useState<EmployeeListItem | null>(null);
  const [showPayrollCreateModal, setShowPayrollCreateModal] = useState(false);
  const [showPayrollDetailModal, setShowPayrollDetailModal] = useState(false);
  const [payrollDetailTarget, setPayrollDetailTarget] = useState<PayrollRunListItem | null>(null);

  // --- Data Loading ---

  const loadData = useCallback(async () => {
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
          getPayrollRuns({ status: payrollFilter === 'all' ? undefined : payrollFilter }),
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
  }, [activeTab, employeeFilter, payrollFilter]);

  useEffect(() => {
    if (canAccessAccounting || isSuperuser) {
      loadData();
    }
  }, [canAccessAccounting, isSuperuser, loadData]);

  // --- Employee Handlers ---

  const handleNewEmployee = useCallback(() => {
    setEmployeeEditTarget(null);
    setShowEmployeeModal(true);
  }, []);

  const handleEditEmployee = useCallback((emp: EmployeeListItem) => {
    setEmployeeEditTarget(emp);
    setShowEmployeeModal(true);
  }, []);

  const handleCloseEmployeeModal = useCallback(() => {
    setShowEmployeeModal(false);
    setEmployeeEditTarget(null);
  }, []);

  const handleEmployeeSaved = useCallback(() => {
    loadData();
  }, [loadData]);

  const handleDeleteEmployee = useCallback(async (id: string) => {
    if (!confirm('Estas seguro de que deseas desactivar este empleado?')) return;
    try {
      await deleteEmployee(id);
      await loadData();
    } catch (err: any) {
      console.error('Error deleting employee:', err);
      setError(getErrorMessage(err, 'Error al eliminar empleado'));
    }
  }, [loadData]);

  const handleManageBonuses = useCallback((emp: EmployeeListItem) => {
    setBonusTarget(emp);
    setShowBonusModal(true);
  }, []);

  const handleCloseBonusModal = useCallback(() => {
    setShowBonusModal(false);
    setBonusTarget(null);
  }, []);

  // --- Payroll Handlers ---

  const handleNewPayroll = useCallback(() => {
    setShowPayrollCreateModal(true);
  }, []);

  const handleClosePayrollCreateModal = useCallback(() => {
    setShowPayrollCreateModal(false);
  }, []);

  const handlePayrollCreated = useCallback(() => {
    loadData();
  }, [loadData]);

  const handleOpenPayrollDetail = useCallback((run: PayrollRunListItem) => {
    setPayrollDetailTarget(run);
    setShowPayrollDetailModal(true);
  }, []);

  const handleClosePayrollDetailModal = useCallback(() => {
    setShowPayrollDetailModal(false);
    setPayrollDetailTarget(null);
  }, []);

  const handlePayrollDataChanged = useCallback(() => {
    loadData();
  }, [loadData]);

  // --- Access Control / Loading / Error States ---

  if (!canAccessAccounting && !isSuperuser) {
    return (
      <Layout>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Acceso Restringido</h3>
              <p className="mt-1 text-sm text-yellow-700">
                No tienes permisos para acceder a la nomina.
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
          <span className="ml-3 text-gray-600">Cargando nomina...</span>
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
            Nomina
          </h1>
          <p className="text-gray-600 mt-1">Gestion de empleados y liquidaciones</p>
        </div>
      </div>

      {/* Tabs */}
      <PayrollTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      {activeTab === 'employees' && (
        <PayrollEmployeesTab
          employees={employees}
          filter={employeeFilter}
          onFilterChange={setEmployeeFilter}
          onNewEmployee={handleNewEmployee}
          onEditEmployee={handleEditEmployee}
          onManageBonuses={handleManageBonuses}
          onDeleteEmployee={handleDeleteEmployee}
        />
      )}
      {activeTab === 'payroll' && (
        <PayrollRunsTab
          summary={payrollSummary}
          runs={payrollRuns}
          filter={payrollFilter}
          onFilterChange={setPayrollFilter}
          onNewPayroll={handleNewPayroll}
          onOpenDetail={handleOpenPayrollDetail}
        />
      )}

      {/* ========== MODALS ========== */}
      <PayrollEmployeeModal
        isOpen={showEmployeeModal}
        onClose={handleCloseEmployeeModal}
        editTarget={employeeEditTarget}
        onSaved={handleEmployeeSaved}
      />
      <PayrollBonusModal
        isOpen={showBonusModal}
        onClose={handleCloseBonusModal}
        employee={bonusTarget}
      />
      <PayrollCreateModal
        isOpen={showPayrollCreateModal}
        onClose={handleClosePayrollCreateModal}
        onCreated={handlePayrollCreated}
      />
      <PayrollDetailModal
        isOpen={showPayrollDetailModal}
        onClose={handleClosePayrollDetailModal}
        payrollRun={payrollDetailTarget}
        onDataChanged={handlePayrollDataChanged}
      />
    </Layout>
  );
}
