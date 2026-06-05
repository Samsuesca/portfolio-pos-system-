/**
 * OrdersReport Component — Encargos tab del modulo Reportes.
 *
 * Mirrors the depth of SalesReport but for Orders (Encargos):
 *   - 6 KPIs en grid: total, ingresos entregados, ingresos cobrados,
 *     ticket promedio, saldo por cobrar, % cumplimiento
 *   - Embudo de estados (pending -> in_production -> ready -> delivered)
 *   - Cumplimiento de entregas (a tiempo / atrasados / lead time / oldest_pending)
 *   - Top productos pedidos + Top clientes en 2 columnas
 *
 * Two revenue numbers shown side-by-side because they answer different
 * questions:
 *   - "Ingresos entregados" (accrual): what we earned (P&L view)
 *   - "Ingresos cobrados" (cash): what landed in caja (cash flow view)
 * The frontend exposes both so the user can spot disconnects (high
 * delivered + low paid signals a CxC pileup).
 */
import React from 'react';
import {
  TrendingUp, Building2, ShoppingCart, Users, AlertTriangle,
  DollarSign, Receipt, Hammer, PackageCheck, AlertCircle, Loader2
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import type {
  School,
  OrdersSummary,
  OrdersStatusFunnel,
  OrdersFunnelStep,
  OrdersOnTimeDelivery,
  OrdersTopProduct,
  OrdersTopClient,
} from './types';

interface OrdersReportProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;

  summary: OrdersSummary | null;
  funnel: OrdersStatusFunnel | null;
  onTime: OrdersOnTimeDelivery | null;
  topProducts: OrdersTopProduct[];
  topClients: OrdersTopClient[];

  schoolFilter: string;
  onSchoolFilterChange: (schoolId: string) => void;
  allSchools: School[];
  dateRangeLabel: string;
}

const FUNNEL_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200',
  in_production: 'bg-brand-100 text-brand-700 ring-1 ring-brand-200',
  ready: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  delivered: 'bg-stone-100 text-stone-600 ring-1 ring-stone-200',
  cancelled: 'bg-red-50 text-red-600 ring-1 ring-red-200',
};

const OrdersReport: React.FC<OrdersReportProps> = ({
  loading,
  error,
  onRetry,
  summary,
  funnel,
  onTime,
  topProducts,
  topClients,
  schoolFilter,
  onSchoolFilterChange,
  allSchools,
  dateRangeLabel,
}) => {
  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        <span className="ml-3 text-stone-600">Cargando encargos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start">
          <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-red-800">
              Error al cargar reporte de encargos
            </h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              onClick={onRetry}
              className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Find the maximum count in the funnel to scale the bars proportionally.
  const funnelMax = funnel?.steps
    ? Math.max(...funnel.steps.map((s: OrdersFunnelStep) => s.count), 1)
    : 1;

  return (
    <>
      {/* School filter */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-medium text-stone-700">
              Filtrar por colegio:
            </span>
          </div>
          <select
            value={schoolFilter}
            onChange={(e) => onSchoolFilterChange(e.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500"
          >
            <option value="">Todos los colegios</option>
            {allSchools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
                {!school.is_active && ' (inactivo)'}
              </option>
            ))}
          </select>
          {summary && (
            <span className="text-sm text-stone-500">
              {summary.total_count} encargo{summary.total_count !== 1 ? 's' : ''} en el periodo
            </span>
          )}
        </div>
      </div>

      {/* KPI Grid — 6 cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <KpiCard
            icon={<ShoppingCart className="w-4 h-4" />}
            label="Encargos del periodo"
            value={summary.total_count.toLocaleString('es-CO')}
            tone="neutral"
          />
          <KpiCard
            icon={<DollarSign className="w-4 h-4" />}
            label="Ingresos entregados"
            value={formatCurrency(summary.revenue_delivered)}
            hint="Accrual (P&L)"
            tone="success"
          />
          <KpiCard
            icon={<DollarSign className="w-4 h-4" />}
            label="Ingresos cobrados"
            value={formatCurrency(summary.revenue_paid)}
            hint="Cash (caja)"
            tone="info"
          />
          <KpiCard
            icon={<Receipt className="w-4 h-4" />}
            label="Ticket promedio"
            value={
              summary.avg_ticket !== null
                ? formatCurrency(summary.avg_ticket)
                : '—'
            }
            tone="neutral"
          />
          <KpiCard
            icon={<Hammer className="w-4 h-4" />}
            label="En produccion"
            value={summary.by_status.in_production.toLocaleString('es-CO')}
            tone="warn"
          />
          <KpiCard
            icon={<AlertCircle className="w-4 h-4" />}
            label="Saldo por cobrar"
            value={formatCurrency(summary.balance_pending)}
            tone="danger"
          />
        </div>
      )}

      {/* Status Funnel + On-time Delivery — 2 col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Funnel */}
        {funnel && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-6 border-b border-stone-200">
              <h2 className="text-lg font-semibold text-stone-800 flex items-center">
                <PackageCheck className="w-5 h-5 mr-2 text-amber-600" />
                Embudo de estados
              </h2>
              <p className="text-sm text-stone-500 mt-1">
                {dateRangeLabel || 'Periodo seleccionado'}
              </p>
            </div>
            <div className="p-6 space-y-3">
              {funnel.steps.map((step: OrdersFunnelStep) => {
                const widthPct = (step.count / funnelMax) * 100;
                return (
                  <div key={step.status} className="flex items-center gap-3">
                    <span className="w-32 text-sm text-stone-600 flex-shrink-0">
                      {step.label}
                    </span>
                    <div className="flex-1 h-7 bg-stone-100 rounded overflow-hidden relative">
                      <div
                        className={`h-full ${FUNNEL_COLORS[step.status] || 'bg-stone-200'} rounded transition-all`}
                        style={{ width: `${Math.max(widthPct, step.count > 0 ? 4 : 0)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-stone-700">
                        {step.count.toLocaleString('es-CO')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* On-time delivery */}
        {onTime && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-6 border-b border-stone-200">
              <h2 className="text-lg font-semibold text-stone-800 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-emerald-600" />
                Cumplimiento de entregas
              </h2>
              <p className="text-sm text-stone-500 mt-1">
                {dateRangeLabel || 'Periodo seleccionado'}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 rounded-lg p-3">
                  <p className="text-xs text-emerald-700">A tiempo</p>
                  <p className="text-2xl font-bold text-emerald-700 mt-1">
                    {onTime.on_time_pct !== null
                      ? `${onTime.on_time_pct.toFixed(1)}%`
                      : '—'}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {onTime.on_time_count} de {onTime.delivered_count}
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-xs text-red-700">Atrasados</p>
                  <p className="text-2xl font-bold text-red-700 mt-1">
                    {onTime.late_count}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {onTime.delivered_count > 0
                      ? `${((onTime.late_count / onTime.delivered_count) * 100).toFixed(0)}% de entregas`
                      : 'Sin entregas'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-stone-50 rounded-lg p-3">
                  <p className="text-xs text-stone-600">Lead time promedio</p>
                  <p className="text-xl font-semibold text-stone-800 mt-1">
                    {onTime.avg_lead_time_days !== null
                      ? `${onTime.avg_lead_time_days.toFixed(1)} dias`
                      : '—'}
                  </p>
                </div>
                <div
                  className={`rounded-lg p-3 ${
                    onTime.oldest_pending_days > 0 ? 'bg-amber-50' : 'bg-stone-50'
                  }`}
                >
                  <p
                    className={`text-xs ${
                      onTime.oldest_pending_days > 0 ? 'text-amber-700' : 'text-stone-600'
                    }`}
                  >
                    Mas atrasado
                  </p>
                  <p
                    className={`text-xl font-semibold mt-1 flex items-center gap-1 ${
                      onTime.oldest_pending_days > 0 ? 'text-amber-700' : 'text-stone-800'
                    }`}
                  >
                    {onTime.oldest_pending_days > 0 && (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    {onTime.oldest_pending_days > 0
                      ? `${onTime.oldest_pending_days} dias`
                      : 'Al dia'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top Products + Top Clients — 2 col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Products */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-stone-200">
            <h2 className="text-lg font-semibold text-stone-800 flex items-center">
              <ShoppingCart className="w-5 h-5 mr-2 text-amber-600" />
              Productos mas pedidos
            </h2>
            <p className="text-sm text-stone-500 mt-1">
              {dateRangeLabel || 'Periodo seleccionado'}
            </p>
          </div>
          {topProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-100">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase">
                      Unidades
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase">
                      Ingresos
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-stone-100">
                  {topProducts.map((product, index) => (
                    <tr key={`${product.product_id ?? 'noid'}-${index}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <span className="w-6 h-6 flex items-center justify-center bg-amber-100 text-amber-600 rounded-full text-xs font-bold mr-3">
                            {index + 1}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-stone-900">
                              {product.product_name}
                            </div>
                            <div className="text-xs text-stone-500">
                              {product.product_code ?? '(sin codigo)'}
                              {product.product_size ? ` — ${product.product_size}` : ''}
                              {!schoolFilter && product.school_name && (
                                <span className="ml-1 text-amber-600">
                                  ({product.school_name})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-stone-900">
                        {product.units_ordered}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-emerald-600">
                        {formatCurrency(product.total_revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-stone-500">
              No hay encargos para el periodo seleccionado
            </div>
          )}
        </div>

        {/* Top Clients */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-stone-200">
            <h2 className="text-lg font-semibold text-stone-800 flex items-center">
              <Users className="w-5 h-5 mr-2 text-amber-600" />
              Clientes con mas encargos
            </h2>
            <p className="text-sm text-stone-500 mt-1">
              {dateRangeLabel || 'Periodo seleccionado'}
            </p>
          </div>
          {topClients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-100">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase">
                      Encargos
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase">
                      Total
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-stone-100">
                  {topClients.map((client, index) => (
                    <tr key={client.client_id}>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <span className="w-6 h-6 flex items-center justify-center bg-amber-100 text-amber-600 rounded-full text-xs font-bold mr-3">
                            {index + 1}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-stone-900">
                              {client.client_name}
                            </div>
                            <div className="text-xs text-stone-500">
                              {client.client_phone || client.client_code}
                              {!schoolFilter && client.school_name && (
                                <span className="ml-1 text-amber-600">
                                  ({client.school_name})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-stone-900">
                        {client.total_orders}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-emerald-600">
                        {formatCurrency(client.total_spent)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm">
                        {client.total_pending > 0 ? (
                          <span className="font-medium text-red-600">
                            {formatCurrency(client.total_pending)}
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-stone-500">
              No hay encargos para el periodo seleccionado
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ---------- Helpers ----------

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'info';
}

const TONE_BG: Record<NonNullable<KpiCardProps['tone']>, string> = {
  neutral: 'bg-white border-stone-100',
  success: 'bg-emerald-50 border-emerald-100',
  warn: 'bg-amber-50 border-amber-100',
  danger: 'bg-red-50 border-red-100',
  info: 'bg-brand-50 border-brand-100',
};

const TONE_TEXT: Record<NonNullable<KpiCardProps['tone']>, string> = {
  neutral: 'text-stone-900',
  success: 'text-emerald-800',
  warn: 'text-amber-800',
  danger: 'text-red-700',
  info: 'text-brand-800',
};

const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value, hint, tone = 'neutral' }) => (
  <div className={`rounded-lg p-3 shadow-sm border ${TONE_BG[tone]}`}>
    <div className="flex items-center gap-1 text-stone-500 text-xs mb-1">
      {icon}
      <span>{label}</span>
    </div>
    <p className={`text-xl font-semibold ${TONE_TEXT[tone]}`}>{value}</p>
    {hint && <p className="text-xs text-stone-400 mt-0.5">{hint}</p>}
  </div>
);

export default OrdersReport;
