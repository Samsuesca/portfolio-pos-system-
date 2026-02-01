/**
 * CFO Dashboard - Executive financial health overview
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import {
  TrendingUp, AlertTriangle, Wallet, Users, Clock,
  Loader2, RefreshCw, ArrowRight, DollarSign, Gauge,
  Database, Calendar, Building2, AlertCircle, CheckCircle2,
  BarChart3
} from 'lucide-react';
import {
  getHealthMetrics,
  getAlertColorClass,
  getAlertIconClass,
  formatCFOCurrency,
  getDSCRStatus,
  getRunwayStatus,
  type CFODashboardMetrics
} from '../services/cfoDashboardService';
import { formatCurrency } from '../utils/formatting';
import { useUserRole } from '../hooks/useUserRole';

export default function CFODashboard() {
  const { canAccessAccounting, isSuperuser } = useUserRole();
  const [metrics, setMetrics] = useState<CFODashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getHealthMetrics();
      setMetrics(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error loading CFO metrics:', err);
      setError(err.response?.data?.detail || 'Error al cargar metricas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canAccessAccounting || isSuperuser) {
      loadMetrics();
    }
  }, [canAccessAccounting, isSuperuser]);

  if (!canAccessAccounting && !isSuperuser) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">No tienes acceso a esta seccion</p>
        </div>
      </Layout>
    );
  }

  if (loading && !metrics) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  if (error && !metrics) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      </Layout>
    );
  }

  if (!metrics) return null;

  const dscrStatus = getDSCRStatus(metrics.debt.debt_service_coverage_ratio);
  const runwayStatus = getRunwayStatus(metrics.operations.cash_runway_days);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-blue-600" />
              Panel CFO
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Vista ejecutiva de salud financiera
              {lastUpdated && (
                <span className="ml-2">
                  · Actualizado: {lastUpdated.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={loadMetrics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {/* Health Status Banner */}
        <div className={`rounded-xl p-6 ${
          metrics.health_status.color === 'green' ? 'bg-gradient-to-r from-green-500 to-green-600' :
          metrics.health_status.color === 'yellow' ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
          metrics.health_status.color === 'orange' ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
          'bg-gradient-to-r from-red-500 to-red-600'
        } text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Gauge className="w-8 h-8" />
              </div>
              <div>
                <p className="text-white/80 text-sm">Estado de Salud Financiera</p>
                <h2 className="text-3xl font-bold">{metrics.health_status.label}</h2>
                <p className="text-white/90 text-sm mt-1">
                  Puntuacion: {metrics.health_status.score}/100
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold">{metrics.health_status.score}</div>
              <p className="text-white/80 text-sm">puntos</p>
            </div>
          </div>

          {/* Health Breakdown */}
          <div className="mt-6 grid grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-white/70 text-xs">Deuda</p>
              <p className="text-lg font-semibold">{metrics.health_status.breakdown.debt_service}%</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-white/70 text-xs">Nomina</p>
              <p className="text-lg font-semibold">{metrics.health_status.breakdown.payroll}%</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-white/70 text-xs">Runway</p>
              <p className="text-lg font-semibold">{metrics.health_status.breakdown.runway}%</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-white/70 text-xs">Datos</p>
              <p className="text-lg font-semibold">{metrics.health_status.breakdown.data_quality}%</p>
            </div>
          </div>
        </div>

        {/* Alerts Section */}
        {metrics.alerts.items.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Alertas Urgentes
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({metrics.alerts.critical_count} criticas, {metrics.alerts.warning_count} advertencias)
              </span>
            </h3>
            <div className="space-y-3">
              {metrics.alerts.items.map((alert, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-4 rounded-lg border ${getAlertColorClass(alert.type)}`}
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className={`w-5 h-5 ${getAlertIconClass(alert.type)}`} />
                    <span className="font-medium">{alert.message}</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {alert.category === 'liquidity' ? `${alert.amount} dias` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Liquidity Card */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Wallet className="w-6 h-6 text-blue-600" />
              </div>
              <Link to="/accounting" className="text-blue-600 hover:text-blue-800">
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <p className="text-sm text-gray-500">Liquidez Disponible</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCFOCurrency(metrics.liquidity.total)}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {formatCurrency(metrics.liquidity.total)}
            </p>
          </div>

          {/* Debt Card */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Building2 className="w-6 h-6 text-red-600" />
              </div>
              <Link to="/accounting" className="text-red-600 hover:text-red-800">
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <p className="text-sm text-gray-500">Deuda Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCFOCurrency(metrics.debt.total)}
            </p>
            {metrics.debt.overdue > 0 && (
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Vencida: {formatCFOCurrency(metrics.debt.overdue)}
              </p>
            )}
            {metrics.debt.due_30_days > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Prox. 30 dias: {formatCFOCurrency(metrics.debt.due_30_days)}
              </p>
            )}
          </div>

          {/* Payroll Card */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <Link to="/payroll" className="text-green-600 hover:text-green-800">
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <p className="text-sm text-gray-500">Nomina Mensual</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCFOCurrency(metrics.payroll.monthly_estimate)}
            </p>
            <div className="flex items-center gap-2 mt-2">
              {metrics.payroll.can_cover ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="w-3 h-3" />
                  Cubierta
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-red-600">
                  <AlertTriangle className="w-3 h-3" />
                  Insuficiente
                </span>
              )}
              <span className="text-xs text-gray-400">
                · {metrics.payroll.employees} empleados
              </span>
            </div>
          </div>

          {/* Cash Runway Card */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                runwayStatus.color === 'green' ? 'bg-green-100' :
                runwayStatus.color === 'yellow' ? 'bg-yellow-100' :
                runwayStatus.color === 'orange' ? 'bg-orange-100' : 'bg-red-100'
              }`}>
                <Clock className={`w-6 h-6 ${
                  runwayStatus.color === 'green' ? 'text-green-600' :
                  runwayStatus.color === 'yellow' ? 'text-yellow-600' :
                  runwayStatus.color === 'orange' ? 'text-orange-600' : 'text-red-600'
                }`} />
              </div>
            </div>
            <p className="text-sm text-gray-500">Cash Runway</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {metrics.operations.cash_runway_days > 365 ? '+1 año' : `${metrics.operations.cash_runway_days} dias`}
            </p>
            <p className={`text-xs mt-2 ${
              runwayStatus.color === 'green' ? 'text-green-600' :
              runwayStatus.color === 'yellow' ? 'text-yellow-600' :
              runwayStatus.color === 'orange' ? 'text-orange-600' : 'text-red-600'
            }`}>
              Estado: {runwayStatus.status}
            </p>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* DSCR Card */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className={`w-5 h-5 ${
                dscrStatus.color === 'green' ? 'text-green-600' :
                dscrStatus.color === 'yellow' ? 'text-yellow-600' : 'text-red-600'
              }`} />
              <div>
                <h4 className="font-medium text-gray-900">Cobertura de Deuda (DSCR)</h4>
                <p className="text-xs text-gray-500">Debt Service Coverage Ratio</p>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {metrics.debt.debt_service_coverage_ratio >= 999
                    ? 'N/A'
                    : `${metrics.debt.debt_service_coverage_ratio}x`
                  }
                </p>
                <p className={`text-sm ${
                  dscrStatus.color === 'green' ? 'text-green-600' :
                  dscrStatus.color === 'yellow' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {dscrStatus.status}
                </p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>Liquidez / Deuda 30d</p>
                <p>{formatCFOCurrency(metrics.liquidity.total)} / {formatCFOCurrency(metrics.debt.due_30_days)}</p>
              </div>
            </div>
          </div>

          {/* Burn Rate Card */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-5 h-5 text-purple-600" />
              <div>
                <h4 className="font-medium text-gray-900">Burn Rate Mensual</h4>
                <p className="text-xs text-gray-500">Gastos fijos + Nomina</p>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {formatCFOCurrency(metrics.operations.monthly_burn_rate)}
                </p>
                <p className="text-sm text-gray-500">por mes</p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>Fijos: {formatCFOCurrency(metrics.operations.monthly_fixed_expenses)}</p>
                <p>Nomina: {formatCFOCurrency(metrics.payroll.monthly_estimate)}</p>
              </div>
            </div>
          </div>

          {/* Data Quality Card */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-4">
              <Database className={`w-5 h-5 ${
                metrics.data_quality.score >= 80 ? 'text-green-600' :
                metrics.data_quality.score >= 50 ? 'text-yellow-600' : 'text-red-600'
              }`} />
              <div>
                <h4 className="font-medium text-gray-900">Calidad de Datos</h4>
                <p className="text-xs text-gray-500">Productos con costo real</p>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {metrics.data_quality.score}%
                </p>
                <p className="text-sm text-gray-500">cobertura</p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p className="text-green-600">{metrics.data_quality.products_with_cost} con costo</p>
                <p className="text-amber-600">{metrics.data_quality.products_without_cost} estimados</p>
              </div>
            </div>
            {metrics.data_quality.products_without_cost > 0 && (
              <Link
                to="/accounting"
                className="mt-4 block text-center text-sm text-blue-600 hover:text-blue-800"
              >
                Asignar costos a productos
              </Link>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Accesos Rapidos</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/accounting"
              className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Wallet className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium">Contabilidad</span>
            </Link>
            <Link
              to="/payroll"
              className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Users className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">Nomina</span>
            </Link>
            <Link
              to="/reports"
              className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <BarChart3 className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium">Reportes</span>
            </Link>
            <Link
              to="/settings"
              className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Calendar className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium">Configuracion</span>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
