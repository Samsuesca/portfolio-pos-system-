'use client';

import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, type CategoryChartData } from '@/lib/hooks/useExpenses';

interface ExpenseChartProps {
  data: CategoryChartData[];
  maxAmount: number;
  visible: boolean;
  onToggle: () => void;
}

const ExpenseChart: React.FC<ExpenseChartProps> = ({
  data,
  maxAmount,
  visible,
  onToggle
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-600" />
          <span className="font-semibold text-slate-800">Gastos por Categoria</span>
          <span className="text-sm text-slate-500">({data.length} categorias)</span>
        </div>
        {visible ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {visible && (
        <div className="px-5 pb-5">
          {data.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No hay datos para mostrar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.slice(0, 8).map(item => (
                <div key={item.category} className="flex items-center gap-4">
                  <span className="w-32 text-sm text-slate-700 font-medium truncate" title={item.label}>
                    {item.label}
                  </span>
                  <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full rounded-lg transition-all duration-500"
                      style={{
                        width: `${maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0}%`,
                        backgroundColor: item.color
                      }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-600">
                      {item.count} gasto{item.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="w-32 text-right font-bold text-slate-900">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
              {data.length > 8 && (
                <p className="text-sm text-slate-500 text-center pt-2">
                  +{data.length - 8} categorias mas
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpenseChart;
