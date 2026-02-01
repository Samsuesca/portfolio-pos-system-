/**
 * AlterationsSummaryWidget - Shows alterations summary (admin+)
 */
import { useNavigate } from 'react-router-dom';
import { Scissors, Clock, CheckCircle, Package, DollarSign } from 'lucide-react';
import { DashboardWidget } from './DashboardWidget';
import type { AlterationsSummary } from '../../types/api';
import { formatCurrency } from '../../utils/formatting';

interface AlterationsSummaryWidgetProps {
  data: AlterationsSummary | null;
  loading?: boolean;
  error?: string;
}

export function AlterationsSummaryWidget({
  data,
  loading = false,
  error,
}: AlterationsSummaryWidgetProps) {
  const navigate = useNavigate();

  return (
    <DashboardWidget
      title="Arreglos"
      icon={Scissors}
      iconColor="text-pink-600"
      headerAction={{
        label: 'Ver todos',
        onClick: () => navigate('/alterations'),
      }}
      loading={loading}
      error={error}
      emptyState={
        data
          ? undefined
          : {
              icon: Scissors,
              message: 'Sin datos de arreglos',
            }
      }
    >
      {data && (
        <div className="space-y-4">
          {/* Status counts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-xs text-amber-700 font-medium">Pendientes</span>
              </div>
              <div className="text-xl font-bold text-amber-800">{data.pending_count}</div>
            </div>

            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-blue-700 font-medium">En Proceso</span>
              </div>
              <div className="text-xl font-bold text-blue-800">{data.in_progress_count}</div>
            </div>

            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-700 font-medium">Listos</span>
              </div>
              <div className="text-xl font-bold text-green-800">{data.ready_count}</div>
            </div>

            <div className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-slate-500" />
                <span className="text-xs text-slate-600 font-medium">Entregados</span>
              </div>
              <div className="text-xl font-bold text-slate-700">{data.delivered_count}</div>
            </div>
          </div>

          {/* Today's activity */}
          <div className="border-t border-slate-100 pt-3">
            <div className="text-xs text-slate-500 font-medium mb-2">Actividad de Hoy</div>
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-slate-600">Recibidos:</span>
                <span className="font-medium text-slate-800">{data.today_received}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-slate-600">Entregados:</span>
                <span className="font-medium text-slate-800">{data.today_delivered}</span>
              </div>
            </div>
          </div>

          {/* Financial summary */}
          <div className="border-t border-slate-100 pt-3">
            <div className="text-xs text-slate-500 font-medium mb-2">Resumen Financiero</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <span>Ingresos totales</span>
                </div>
                <span className="font-medium text-green-700">{formatCurrency(data.total_revenue)}</span>
              </div>
              {data.total_pending_payment > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <DollarSign className="w-4 h-4 text-amber-500" />
                    <span>Por cobrar</span>
                  </div>
                  <span className="font-medium text-amber-700">
                    {formatCurrency(data.total_pending_payment)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardWidget>
  );
}

export default AlterationsSummaryWidget;
