'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  DollarSign,
  CreditCard,
  Wallet,
  Building2,
  Receipt,
  ArrowRightLeft,
  Users,
  FileText,
  AlertCircle,
  Lock,
} from 'lucide-react';
import accountingService, { type CashBalances } from '@/lib/services/accountingService';
import ExpensesSection from '@/components/accounting/ExpensesSection';
import { usePermissions } from '@/lib/hooks/usePermissions';

type AccountingTab = 'summary' | 'expenses' | 'receivables' | 'payables' | 'transfers';

interface TabConfig {
  id: AccountingTab;
  label: string;
  icon: typeof Receipt;
  permission: boolean;
}

export default function AccountingPage() {
  const permissions = usePermissions();

  const [cashBalances, setCashBalances] = useState<CashBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AccountingTab>('summary');

  // Build available tabs based on permissions
  const availableTabs = useMemo<TabConfig[]>(() => {
    const tabs: TabConfig[] = [];

    // Summary tab - requires any cash view permission
    if (permissions.canViewCash || permissions.canViewBank || permissions.canViewCajaMenor) {
      tabs.push({
        id: 'summary',
        label: 'Resumen',
        icon: Wallet,
        permission: true,
      });
    }

    // Expenses tab
    if (permissions.canViewExpenses) {
      tabs.push({
        id: 'expenses',
        label: 'Gastos',
        icon: Receipt,
        permission: true,
      });
    }

    // Receivables tab (CxC)
    if (permissions.canViewReceivables) {
      tabs.push({
        id: 'receivables',
        label: 'CxC',
        icon: Users,
        permission: true,
      });
    }

    // Payables tab (CxP)
    if (permissions.canViewPayables) {
      tabs.push({
        id: 'payables',
        label: 'CxP',
        icon: FileText,
        permission: true,
      });
    }

    // Transfers tab
    if (permissions.canViewTransfers) {
      tabs.push({
        id: 'transfers',
        label: 'Transferencias',
        icon: ArrowRightLeft,
        permission: true,
      });
    }

    return tabs;
  }, [permissions]);

  // Set default tab to first available
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
      setActiveTab(availableTabs[0].id);
    }
  }, [availableTabs, activeTab]);

  const loadCashBalances = async () => {
    if (!permissions.canViewCash && !permissions.canViewBank && !permissions.canViewCajaMenor) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const balances = await accountingService.getCashBalances();
      setCashBalances(balances);
    } catch (err) {
      console.error('Error loading cash balances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCashBalances();
  }, [permissions.canViewCash, permissions.canViewBank, permissions.canViewCajaMenor]);

  const formatCurrency = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(numValue || 0);
  };

  // No access to accounting
  if (!permissions.canAccessAccounting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="p-4 bg-red-100 rounded-full mb-4">
          <Lock className="w-12 h-12 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Acceso Denegado
        </h2>
        <p className="text-slate-600 text-center max-w-md">
          No tienes permisos para acceder a la sección de contabilidad.
          Contacta a un administrador si necesitas acceso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            Contabilidad
          </h1>
          <p className="text-slate-600 mt-1">
            Gestión financiera del negocio
          </p>
        </div>
        <button
          onClick={loadCashBalances}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Tabs Navigation */}
      {availableTabs.length > 1 && (
        <div className="border-b border-slate-200">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {availableTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                    ${isActive
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'summary' && (
        <>
          {/* Cash Balances Cards */}
          {cashBalances && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {permissions.canViewCajaMenor && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Wallet className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Caja Menor</p>
                      <p className="text-lg font-bold text-slate-900">
                        {formatCurrency(cashBalances.caja_menor?.balance || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {permissions.canViewCash && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Caja Mayor</p>
                      <p className="text-lg font-bold text-slate-900">
                        {formatCurrency(cashBalances.caja_mayor?.balance || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {permissions.canViewCash && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <CreditCard className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Nequi</p>
                      <p className="text-lg font-bold text-slate-900">
                        {formatCurrency(cashBalances.nequi?.balance || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {permissions.canViewBank && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Building2 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Banco</p>
                      <p className="text-lg font-bold text-slate-900">
                        {formatCurrency(cashBalances.banco?.balance || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Stats Summary */}
          {!loading && !cashBalances && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <p className="text-amber-800">
                  No se pudieron cargar los saldos. Intenta actualizar la página.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'expenses' && permissions.canViewExpenses && (
        <ExpensesSection
          cashBalances={cashBalances}
          onDataChange={loadCashBalances}
          canCreate={permissions.canCreateExpense}
          canPay={permissions.canPayExpense}
        />
      )}

      {activeTab === 'receivables' && permissions.canViewReceivables && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">
              Cuentas por Cobrar (CxC)
            </h2>
          </div>
          <div className="text-center py-12 text-slate-500">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p>Sección de CxC en desarrollo</p>
            <p className="text-sm mt-1">
              Gestiona los créditos y pagos pendientes de clientes
            </p>
          </div>
        </div>
      )}

      {activeTab === 'payables' && permissions.canViewPayables && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-slate-900">
              Cuentas por Pagar (CxP)
            </h2>
          </div>
          <div className="text-center py-12 text-slate-500">
            <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p>Sección de CxP en desarrollo</p>
            <p className="text-sm mt-1">
              Gestiona los pagos pendientes a proveedores
            </p>
          </div>
        </div>
      )}

      {activeTab === 'transfers' && permissions.canViewTransfers && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <ArrowRightLeft className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">
              Transferencias entre Cuentas
            </h2>
          </div>
          <div className="text-center py-12 text-slate-500">
            <ArrowRightLeft className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p>Sección de transferencias en desarrollo</p>
            <p className="text-sm mt-1">
              Historial de movimientos entre cuentas
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
