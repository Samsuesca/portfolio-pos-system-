/**
 * SalesSeasonalityChart - Sales seasonality analysis visualization
 */
import React, { useMemo } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import type { SalesSeasonalityResponse } from '../../types/api';

interface SalesSeasonalityChartProps {
  data: SalesSeasonalityResponse | null;
  onYearRangeChange: (startYear: number, endYear: number) => void;
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

const formatCompact = (value: number): string => {
  if (Math.abs(value) >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  }
  if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(0) + 'K';
  }
  return value.toFixed(0);
};

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const YEAR_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const getSeasonBadgeColor = (behavior: 'ALTA' | 'MEDIA' | 'BAJA'): string => {
  switch (behavior) {
    case 'ALTA': return 'bg-green-100 text-green-700';
    case 'MEDIA': return 'bg-yellow-100 text-yellow-700';
    case 'BAJA': return 'bg-red-100 text-red-700';
  }
};

const SalesSeasonalityChart: React.FC<SalesSeasonalityChartProps> = ({
  data,
  onYearRangeChange: _onYearRangeChange,
  loading
}) => {
  // _onYearRangeChange can be used for year selector in future
  // Group data by year
  const dataByYear = useMemo(() => {
    if (!data) return {};
    const grouped: Record<number, Record<number, number>> = {};
    data.monthly_data.forEach(d => {
      if (!grouped[d.year]) grouped[d.year] = {};
      grouped[d.year][d.month] = d.total_sales;
    });
    return grouped;
  }, [data]);

  const years = Object.keys(dataByYear).map(Number).sort();

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-brand-500" size={32} />
        </div>
      </div>
    );
  }

  if (!data || data.monthly_data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full">
        <h3 className="text-lg font-semibold mb-4">Analisis de Estacionalidad</h3>
        <div className="flex items-center justify-center h-48 text-gray-500">
          No hay datos historicos suficientes
        </div>
      </div>
    );
  }

  // Calculate max value for scaling
  const maxValue = Math.max(...data.monthly_data.map(d => d.total_sales), 1);

  // SVG dimensions
  const viewBoxWidth = 1000;
  const chartHeight = 180;
  const padding = { left: 60, right: 20 };
  const chartWidth = viewBoxWidth - padding.left - padding.right;
  const monthWidth = chartWidth / 12;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Analisis de Estacionalidad</h3>
        <div className="flex gap-2">
          {years.map((year, idx) => (
            <div key={year} className="flex items-center gap-1 text-xs">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: YEAR_COLORS[idx % YEAR_COLORS.length] }}
              />
              <span className="text-gray-600">{year}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Seasonality Patterns */}
      {data.patterns.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {data.patterns.map((pattern, idx) => (
            <span
              key={idx}
              className={`px-2 py-1 rounded-full text-xs font-medium ${getSeasonBadgeColor(pattern.behavior)}`}
            >
              {pattern.period}: {pattern.behavior} ({pattern.percentage.toFixed(0)}%)
            </span>
          ))}
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
          {/* Y-axis labels */}
          {[0, 25, 50, 75, 100].map(percent => {
            const y = chartHeight - (percent / 100) * chartHeight;
            const value = (percent / 100) * maxValue;
            return (
              <g key={percent}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={viewBoxWidth - padding.right}
                  y2={y}
                  stroke="#E5E7EB"
                  strokeWidth="1"
                  strokeDasharray={percent === 0 ? '0' : '4'}
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-gray-400 text-[20px]"
                >
                  {formatCompact(value)}
                </text>
              </g>
            );
          })}

          {/* Month labels */}
          {MONTH_NAMES.map((month, idx) => (
            <text
              key={month}
              x={padding.left + idx * monthWidth + monthWidth / 2}
              y={chartHeight + 25}
              textAnchor="middle"
              className="fill-gray-500 text-[22px]"
            >
              {month}
            </text>
          ))}

          {/* Lines for each year */}
          {years.map((year, yearIdx) => {
            const yearData = dataByYear[year];
            const points: string[] = [];

            for (let month = 1; month <= 12; month++) {
              const value = yearData[month] || 0;
              const x = padding.left + (month - 1) * monthWidth + monthWidth / 2;
              const y = chartHeight - (value / maxValue) * chartHeight;
              points.push(`${x},${y}`);
            }

            const color = YEAR_COLORS[yearIdx % YEAR_COLORS.length];

            return (
              <g key={year}>
                {/* Line */}
                <polyline
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  points={points.join(' ')}
                  opacity="0.8"
                />
                {/* Dots */}
                {points.map((point, idx) => {
                  const [x, y] = point.split(',').map(Number);
                  const value = yearData[idx + 1] || 0;
                  if (value === 0) return null;
                  return (
                    <circle
                      key={`${year}-${idx}`}
                      cx={x}
                      cy={y}
                      r="5"
                      fill={color}
                      stroke="white"
                      strokeWidth="2"
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Growth Rates */}
      {Object.keys(data.growth_rates).length > 0 && (
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <span className="text-gray-500 font-medium">Crecimiento:</span>
          {Object.entries(data.growth_rates).map(([period, rate]) => {
            const isPositive = rate >= 0;
            return (
              <div key={period} className="flex items-center gap-1">
                {isPositive ? (
                  <TrendingUp size={14} className="text-green-500" />
                ) : (
                  <TrendingDown size={14} className="text-red-500" />
                )}
                <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
                  {period}: {rate >= 0 ? '+' : ''}{rate.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Yearly Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4 text-sm">
        {Object.entries(data.yearly_totals).map(([year, total]) => (
          <div key={year} className="bg-gray-50 rounded p-2">
            <span className="text-gray-500">{year}:</span>
            <span className="font-semibold ml-1">{formatCurrency(total)}</span>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 mt-2 text-center">
        {data.disclaimer}
      </p>
    </div>
  );
};

export default SalesSeasonalityChart;
