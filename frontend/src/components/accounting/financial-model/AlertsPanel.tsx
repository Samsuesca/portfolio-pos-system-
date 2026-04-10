/**
 * Module 6: Financial Health Alerts
 */
import { AlertTriangle, AlertCircle, Info, CheckCircle, Shield } from 'lucide-react';
import type { HealthAlertsResponse, FinancialAlert } from '../../../services/financialModelService';

interface Props {
  data: HealthAlertsResponse | null;
}

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: AlertCircle,
    iconColor: 'text-red-600',
    titleColor: 'text-red-800',
    textColor: 'text-red-700',
    badge: 'bg-red-100 text-red-800',
    badgeLabel: 'Crítico',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: AlertTriangle,
    iconColor: 'text-yellow-600',
    titleColor: 'text-yellow-800',
    textColor: 'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-800',
    badgeLabel: 'Advertencia',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: Info,
    iconColor: 'text-blue-600',
    titleColor: 'text-blue-800',
    textColor: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-800',
    badgeLabel: 'Info',
  },
};

function AlertCard({ alert }: { alert: FinancialAlert }) {
  const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
  const Icon = style.icon;

  return (
    <div className={`${style.bg} ${style.border} border rounded-xl p-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${style.iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`font-semibold ${style.titleColor}`}>{alert.title}</h4>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.badge}`}>
              {style.badgeLabel}
            </span>
          </div>
          <p className={`text-sm ${style.textColor}`}>{alert.message}</p>
          <div className="flex items-center gap-4 mt-2 text-xs">
            <span className={style.textColor}>
              <strong>Valor:</strong> {alert.metric_value}
            </span>
            <span className={style.textColor}>
              <strong>Umbral:</strong> {alert.threshold}
            </span>
          </div>
          {alert.recommendation && (
            <p className={`text-xs mt-2 ${style.textColor} italic`}>
              💡 {alert.recommendation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AlertsPanel({ data }: Props) {
  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No se pudieron cargar las alertas</p>
      </div>
    );
  }

  if (data.alerts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-green-800">Salud Financiera Excelente</h3>
        <p className="text-green-600 mt-1">No se detectaron alertas financieras</p>
      </div>
    );
  }

  // Sort: critical first, then warning, then info
  const sorted = [...data.alerts].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Alertas de Salud Financiera</h3>
        <div className="flex items-center gap-3 text-sm">
          {data.critical_count > 0 && (
            <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full font-medium">
              {data.critical_count} crítica{data.critical_count !== 1 ? 's' : ''}
            </span>
          )}
          {data.warning_count > 0 && (
            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
              {data.warning_count} advertencia{data.warning_count !== 1 ? 's' : ''}
            </span>
          )}
          {data.info_count > 0 && (
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
              {data.info_count} info
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {sorted.map((alert, i) => (
          <AlertCard key={`${alert.alert_type}-${i}`} alert={alert} />
        ))}
      </div>
    </div>
  );
}
