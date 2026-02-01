/**
 * PlanningDashboardSummary - Planning tab summary cards
 */
import React from 'react';
import {
  Wallet, CalendarClock, TrendingUp, Clock, AlertTriangle
} from 'lucide-react';
import type { PlanningDashboard } from '../../types/api';

interface PlanningDashboardSummaryProps {
  dashboard: PlanningDashboard | null;
  loading: boolean;
}

const formatCurrency = (value: number): string => {
  return value.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
};

const getSeasonColor = (season: 'ALTA' | 'MEDIA' | 'BAJA'): string => {
  switch (season) {
    case 'ALTA': return 'text-green-600 bg-green-100';
    case 'MEDIA': return 'text-yellow-600 bg-yellow-100';
    case 'BAJA': return 'text-red-600 bg-red-100';
    default: return 'text-gray-600 bg-gray-100';
  }
};

const getSeasonLabel = (season: 'ALTA' | 'MEDIA' | 'BAJA'): string => {
  switch (season) {
    case 'ALTA': return 'Temporada Alta';
    case 'MEDIA': return 'Temporada Media';
    case 'BAJA': return 'Temporada Baja';
    default: return 'Sin datos';
  }
};

const PlanningDashboardSummary: React.FC<PlanningDashboardSummaryProps> = ({
  dashboard,
  loading
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
            <div className="h-6 bg-gray-200 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const daysUntilNextPayment = dashboard.next_debt_payment?.days_until_due ?? null;
  const isPaymentUrgent = daysUntilNextPayment !== null && daysUntilNextPayment <= 7;
  const isPaymentOverdue = daysUntilNextPayment !== null && daysUntilNextPayment < 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {/* Liquidez Actual */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
          <Wallet size={16} />
          <span>Liquidez Actual</span>
        </div>
        <p className={`text-xl font-bold ${dashboard.current_liquidity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(dashboard.current_liquidity)}
        </p>
      </div>

      {/* Gastos Fijos Mensuales */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
          <CalendarClock size={16} />
          <span>Gastos Fijos/Mes</span>
        </div>
        <p className="text-xl font-bold text-gray-900">
          {formatCurrency(dashboard.fixed_expenses_monthly)}
        </p>
      </div>

      {/* Total Deudas Pendientes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
          <AlertTriangle size={16} />
          <span>Deudas Pendientes</span>
        </div>
        <p className={`text-xl font-bold ${dashboard.pending_debt_total > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
          {formatCurrency(dashboard.pending_debt_total)}
        </p>
      </div>

      {/* Proximo Pago */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
          <Clock size={16} />
          <span>Proximo Pago</span>
        </div>
        {dashboard.next_debt_payment ? (
          <div>
            <p className={`text-lg font-bold ${isPaymentOverdue ? 'text-red-600' : isPaymentUrgent ? 'text-orange-600' : 'text-gray-900'}`}>
              {formatCurrency(dashboard.next_debt_payment.amount)}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {isPaymentOverdue
                ? `Vencido hace ${Math.abs(daysUntilNextPayment!)} dias`
                : daysUntilNextPayment === 0
                  ? 'Vence hoy'
                  : `En ${daysUntilNextPayment} dias`
              }
            </p>
          </div>
        ) : (
          <p className="text-lg font-bold text-gray-400">Sin pagos</p>
        )}
      </div>

      {/* Temporada Actual */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
          <TrendingUp size={16} />
          <span>Temporada</span>
        </div>
        <div className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-medium ${getSeasonColor(dashboard.current_season)}`}>
          {getSeasonLabel(dashboard.current_season)}
        </div>
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
          {dashboard.season_message}
        </p>
      </div>
    </div>
  );
};

export default PlanningDashboardSummary;
