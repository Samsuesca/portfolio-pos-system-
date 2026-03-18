/**
 * CashProjectionChart - Cash flow projection visualization
 */
import React, { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import type { CashProjectionResponse, CashProjectionParams } from '../../types/api';

interface CashProjectionChartProps {
  projection: CashProjectionResponse | null;
  onParamsChange: (params: CashProjectionParams) => void;
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

const CashProjectionChart: React.FC<CashProjectionChartProps> = ({
  projection,
  onParamsChange,
  loading
}) => {
  const [months, setMonths] = useState(6);

  const handleMonthsChange = (newMonths: number) => {
    setMonths(newMonths);
    onParamsChange({ months: newMonths });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-brand-500" size={32} />
        </div>
      </div>
    );
  }

  if (!projection || projection.projections.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full">
        <h3 className="text-lg font-semibold mb-4">Proyeccion de Flujo de Caja</h3>
        <div className="flex items-center justify-center h-48 text-gray-500">
          No hay datos suficientes para proyectar
        </div>
      </div>
    );
  }

  const maxValue = Math.max(
    ...projection.projections.map(p => Math.max(p.projected_income, p.projected_expenses)),
    1
  );
  const minBalance = Math.min(...projection.projections.map(p => p.closing_balance));
  const maxBalance = Math.max(...projection.projections.map(p => p.closing_balance));
  const balanceRange = maxBalance - minBalance || 1;

  // SVG dimensions
  const viewBoxWidth = 1000;
  const chartHeight = 180;
  const barWidth = viewBoxWidth / projection.projections.length;
  const barPadding = barWidth * 0.1;
  const actualBarWidth = (barWidth - barPadding * 3) / 2;

  // Generate balance line points
  const balancePoints = projection.projections.map((p, i) => {
    const x = i * barWidth + barWidth / 2;
    const y = chartHeight - ((p.closing_balance - minBalance) / balanceRange) * (chartHeight - 20);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Proyeccion de Flujo de Caja</h3>
        <div className="flex gap-1">
          {[3, 6, 12].map(m => (
            <button
              key={m}
              onClick={() => handleMonthsChange(m)}
              className={`px-3 py-1 text-sm rounded ${
                months === m
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {m} meses
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-2 mb-4 text-sm">
        <div className="bg-brand-50 rounded p-2">
          <p className="text-gray-500">Liquidez Actual</p>
          <p className="font-semibold text-brand-600">{formatCurrency(projection.current_liquidity)}</p>
        </div>
        <div className="bg-green-50 rounded p-2">
          <p className="text-gray-500">Ingresos Proy.</p>
          <p className="font-semibold text-green-600">{formatCurrency(projection.total_projected_income)}</p>
        </div>
        <div className="bg-red-50 rounded p-2">
          <p className="text-gray-500">Gastos Proy.</p>
          <p className="font-semibold text-red-600">{formatCurrency(projection.total_projected_expenses)}</p>
        </div>
        <div className={`rounded p-2 ${projection.projected_end_balance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="text-gray-500">Balance Final</p>
          <p className={`font-semibold ${projection.projected_end_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(projection.projected_end_balance)}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {projection.months_below_threshold.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 rounded p-2 mb-4">
          <AlertCircle size={16} />
          <span>
            Alerta: Liquidez baja proyectada en {projection.months_below_threshold.join(', ')}
          </span>
        </div>
      )}

      {/* Chart */}
      <div className="relative">
        <svg
          width="100%"
          height={chartHeight + 40}
          viewBox={`0 0 ${viewBoxWidth} ${chartHeight + 40}`}
          preserveAspectRatio="xMidYMid meet"
          className="overflow-visible"
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(percent => (
            <line
              key={percent}
              x1="0"
              y1={chartHeight - (percent / 100) * chartHeight}
              x2={viewBoxWidth}
              y2={chartHeight - (percent / 100) * chartHeight}
              stroke="#E5E7EB"
              strokeWidth="1"
              strokeDasharray={percent === 0 ? '0' : '4'}
            />
          ))}

          {/* Bars */}
          {projection.projections.map((p, i) => {
            const incomeHeight = (p.projected_income / maxValue) * chartHeight;
            const expenseHeight = (p.projected_expenses / maxValue) * chartHeight;
            const x = i * barWidth + barPadding;

            return (
              <g key={i}>
                {/* Income bar */}
                <rect
                  x={x}
                  y={chartHeight - incomeHeight}
                  width={actualBarWidth}
                  height={incomeHeight}
                  fill="#10B981"
                  rx="2"
                  className="transition-all duration-300 hover:opacity-80"
                />
                {/* Expense bar */}
                <rect
                  x={x + actualBarWidth + barPadding}
                  y={chartHeight - expenseHeight}
                  width={actualBarWidth}
                  height={expenseHeight}
                  fill="#EF4444"
                  rx="2"
                  className="transition-all duration-300 hover:opacity-80"
                />
                {/* Alert indicator */}
                {p.is_below_threshold && (
                  <circle
                    cx={x + actualBarWidth + barPadding / 2}
                    cy={10}
                    r="6"
                    fill="#F59E0B"
                  />
                )}
                {/* Month label */}
                <text
                  x={x + (actualBarWidth * 2 + barPadding) / 2}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  className="fill-gray-500 text-[24px]"
                >
                  {p.month_name.substring(0, 3)}
                </text>
              </g>
            );
          })}

          {/* Balance line */}
          <polyline
            fill="none"
            stroke="#3B82F6"
            strokeWidth="3"
            points={balancePoints}
          />
          {/* Balance dots */}
          {projection.projections.map((p, i) => {
            const x = i * barWidth + barWidth / 2;
            const y = chartHeight - ((p.closing_balance - minBalance) / balanceRange) * (chartHeight - 20);
            return (
              <circle
                key={`dot-${i}`}
                cx={x}
                cy={y}
                r="5"
                fill="#3B82F6"
                stroke="white"
                strokeWidth="2"
              />
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-gray-600">Ingresos</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span className="text-gray-600">Gastos</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-brand-500" />
          <span className="text-gray-600">Balance</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-gray-600">Alerta Liquidez</span>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 mt-2 text-center">
        {projection.disclaimer}
      </p>
    </div>
  );
};

export default CashProjectionChart;
