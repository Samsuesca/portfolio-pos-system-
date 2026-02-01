/**
 * BarChart Component - Simple SVG-based bar chart for trend visualization
 */
import React from 'react';

export interface BarChartData {
  label: string;
  value: number;
  secondaryValue?: number;
}

interface BarChartProps {
  data: BarChartData[];
  height?: number;
  barColor?: string;
  secondaryColor?: string;
  showValues?: boolean;
  formatValue?: (value: number) => string;
  className?: string;
}

const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 200,
  barColor = '#3B82F6',
  secondaryColor = '#10B981',
  showValues = true,
  formatValue = (v) => v.toLocaleString('es-CO'),
  className = '',
}) => {
  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-[${height}px] text-gray-500 ${className}`}>
        Sin datos para mostrar
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;
  const barPadding = barWidth * 0.15;
  const actualBarWidth = barWidth - barPadding * 2;

  // Reserve space for labels
  const chartHeight = height - 40;
  const labelOffset = 25;

  // Use fixed viewBox width for absolute coordinates (polyline doesn't support %)
  const viewBoxWidth = 1000;

  return (
    <div className={`relative ${className}`}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${viewBoxWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="overflow-visible"
      >
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((percent) => (
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
        {data.map((d, i) => {
          const barHeight = (d.value / maxValue) * chartHeight;
          const x = (i * barWidth + barPadding) * viewBoxWidth / 100;
          const width = actualBarWidth * viewBoxWidth / 100;
          const y = chartHeight - barHeight;

          return (
            <g key={i}>
              {/* Main bar */}
              <rect
                x={x}
                y={y}
                width={width}
                height={barHeight}
                fill={barColor}
                rx="4"
                className="transition-all duration-300 hover:opacity-80"
              />

              {/* Value label on top of bar */}
              {showValues && d.value > 0 && (
                <text
                  x={x + width / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="fill-gray-600 text-[10px] font-medium"
                >
                  {formatValue(d.value)}
                </text>
              )}

              {/* X-axis label */}
              <text
                x={x + width / 2}
                y={chartHeight + labelOffset}
                textAnchor="middle"
                className="fill-gray-500 text-[10px]"
              >
                {d.label}
              </text>
            </g>
          );
        })}

        {/* Secondary line (optional - for showing count trend) */}
        {data.some((d) => d.secondaryValue !== undefined) && (
          <>
            {/* Line path */}
            <polyline
              fill="none"
              stroke={secondaryColor}
              strokeWidth="2"
              points={data
                .map((d, i) => {
                  const maxSecondary = Math.max(
                    ...data.map((item) => item.secondaryValue || 0),
                    1
                  );
                  const x = (i * barWidth + barPadding + actualBarWidth / 2) * viewBoxWidth / 100;
                  const y =
                    chartHeight -
                    ((d.secondaryValue || 0) / maxSecondary) * chartHeight;
                  return `${x},${y}`;
                })
                .join(' ')}
            />
            {/* Dots */}
            {data.map((d, i) => {
              if (d.secondaryValue === undefined) return null;
              const maxSecondary = Math.max(
                ...data.map((item) => item.secondaryValue || 0),
                1
              );
              const x = (i * barWidth + barPadding + actualBarWidth / 2) * viewBoxWidth / 100;
              const y =
                chartHeight - (d.secondaryValue / maxSecondary) * chartHeight;
              return (
                <circle
                  key={`dot-${i}`}
                  cx={x}
                  cy={y}
                  r="4"
                  fill={secondaryColor}
                />
              );
            })}
          </>
        )}
      </svg>

      {/* Legend */}
      {data.some((d) => d.secondaryValue !== undefined) && (
        <div className="flex justify-center gap-4 mt-2 text-xs">
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: barColor }}
            />
            <span className="text-gray-600">Ingresos</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: secondaryColor }}
            />
            <span className="text-gray-600">Ventas</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarChart;
