/**
 * DailyFinanceWidget - Shows daily financial summary (admin+)
 */
import { useNavigate } from 'react-router-dom';
import { Wallet, TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react';
import { DashboardWidget } from './DashboardWidget';
import type { DailyFlowResponse } from '../../services/globalAccountingService';
import { formatCurrency } from '../../utils/formatting';

interface DailyFinanceWidgetProps {
  data: DailyFlowResponse | null;
  loading?: boolean;
  error?: string;
}

export function DailyFinanceWidget({ data, loading = false, error }: DailyFinanceWidgetProps) {
  const navigate = useNavigate();

  const totals = data?.totals;
  const isPositiveDay = (totals?.net_flow ?? 0) >= 0;

  return (
    <DashboardWidget
      title="Finanzas del Dia"
      icon={Wallet}
      iconColor="text-emerald-600"
      headerAction={{
        label: 'Ver contabilidad',
        onClick: () => navigate('/accounting'),
      }}
      loading={loading}
      error={error}
      emptyState={
        totals
          ? undefined
          : {
              icon: Wallet,
              message: 'Sin datos financieros',
            }
      }
    >
      {totals && (
        <div className="space-y-4">
          {/* Main balance */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4">
            <div className="text-sm text-emerald-700 font-medium mb-1">Saldo Actual</div>
            <div className="text-2xl font-bold text-emerald-800">
              {formatCurrency(totals.closing_balance)}
            </div>
          </div>

          {/* Income and Expenses */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-700 font-medium">Ingresos Hoy</span>
              </div>
              <div className="text-lg font-semibold text-green-800">
                {formatCurrency(totals.total_income)}
              </div>
            </div>

            <div className="bg-red-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-xs text-red-700 font-medium">Gastos Hoy</span>
              </div>
              <div className="text-lg font-semibold text-red-800">
                {formatCurrency(totals.total_expenses)}
              </div>
            </div>
          </div>

          {/* Net flow */}
          <div
            className={`flex items-center justify-between p-3 rounded-lg ${
              isPositiveDay ? 'bg-blue-50' : 'bg-orange-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <ArrowRightLeft className={`w-4 h-4 ${isPositiveDay ? 'text-blue-600' : 'text-orange-600'}`} />
              <span className={`text-sm font-medium ${isPositiveDay ? 'text-blue-700' : 'text-orange-700'}`}>
                Balance Neto del Dia
              </span>
            </div>
            <span
              className={`text-lg font-bold ${
                isPositiveDay ? 'text-blue-800' : 'text-orange-800'
              }`}
            >
              {totals.net_flow >= 0 ? '+' : ''}{formatCurrency(totals.net_flow)}
            </span>
          </div>

          {/* Account breakdown - compact */}
          {data.accounts.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <div className="text-xs text-slate-500 font-medium mb-2">Por Cuenta</div>
              <div className="space-y-1.5">
                {data.accounts.slice(0, 3).map((account) => (
                  <div
                    key={account.account_id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-slate-600">{account.account_name}</span>
                    <span className="font-medium text-slate-800">
                      {formatCurrency(account.closing_balance)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardWidget>
  );
}

export default DailyFinanceWidget;
