/**
 * DashboardWidget - Reusable container for dashboard widgets
 */
import { type LucideIcon, Loader2, ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

interface DashboardWidgetProps {
  title: string;
  icon: LucideIcon;
  iconColor?: string;
  headerAction?: {
    label: string;
    onClick: () => void;
  };
  loading?: boolean;
  emptyState?: {
    icon: LucideIcon;
    message: string;
    submessage?: string;
  };
  error?: string;
  onRetry?: () => void;
  children: ReactNode;
  className?: string;
}

export function DashboardWidget({
  title,
  icon: Icon,
  iconColor = 'text-brand-600',
  headerAction,
  loading = false,
  emptyState,
  error,
  onRetry,
  children,
  className = '',
}: DashboardWidgetProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-surface-200 p-6 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <Icon className={`w-5 h-5 mr-2 ${iconColor}`} />
          {title}
        </h3>
        {headerAction && (
          <button
            onClick={headerAction.onClick}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
          >
            {headerAction.label}
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-red-600 text-sm">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-sm text-brand-600 hover:text-brand-700 underline"
            >
              Reintentar
            </button>
          )}
        </div>
      ) : emptyState && !children ? (
        <div className="text-center py-8 text-slate-500">
          <emptyState.icon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p>{emptyState.message}</p>
          {emptyState.submessage && (
            <p className="text-xs text-slate-400 mt-1">{emptyState.submessage}</p>
          )}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export default DashboardWidget;
