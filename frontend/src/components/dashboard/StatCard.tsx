/**
 * StatCard - Statistics card with trend indicator
 */
import { type LucideIcon, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface TrendData {
  direction: 'up' | 'down' | 'neutral';
  percent: number;
  label?: string;
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  color?: string;
  bgColor?: string;
  trend?: TrendData;
  link?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'text-brand-600',
  bgColor = 'bg-brand-50',
  trend,
  link,
  onClick,
}: StatCardProps) {
  const isClickable = link || onClick;

  const getTrendIcon = () => {
    if (!trend) return null;
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="w-3.5 h-3.5" />;
      case 'down':
        return <TrendingDown className="w-3.5 h-3.5" />;
      default:
        return <Minus className="w-3.5 h-3.5" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return '';
    switch (trend.direction) {
      case 'up':
        return 'text-green-600 bg-green-50';
      case 'down':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-slate-500 bg-slate-50';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border border-surface-200 p-4 md:p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group ${
        isClickable ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className={`p-2 md:p-3 rounded-xl ${bgColor} ${color} group-hover:bg-brand-600 group-hover:text-white transition-colors duration-300`}>
          <Icon className="w-5 h-5 md:w-6 md:h-6" />
        </div>
        <div className="flex items-center gap-2">
          {trend && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>{Math.abs(trend.percent)}%</span>
            </div>
          )}
          {isClickable && (
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-600 transition-colors" />
          )}
        </div>
      </div>
      <h3 className="text-xl md:text-3xl font-bold font-display text-primary tracking-tight">{value}</h3>
      <p className="text-xs md:text-sm text-slate-500 mt-1 font-medium">{title}</p>
      {subtitle && (
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      )}
      {trend?.label && (
        <p className="text-xs text-slate-400 mt-0.5">{trend.label}</p>
      )}
    </div>
  );
}

export default StatCard;
