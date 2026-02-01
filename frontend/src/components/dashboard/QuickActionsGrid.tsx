/**
 * QuickActionsGrid - Dynamic quick actions based on user role and context
 */
import { useNavigate } from 'react-router-dom';
import type { QuickAction } from '../../hooks/useDashboardConfig';

interface QuickActionsGridProps {
  actions: QuickAction[];
}

export function QuickActionsGrid({ actions }: QuickActionsGridProps) {
  const navigate = useNavigate();

  if (actions.length === 0) {
    return null;
  }

  // Determine grid columns based on number of actions
  const gridCols =
    actions.length <= 2
      ? 'grid-cols-2'
      : actions.length <= 3
      ? 'grid-cols-3'
      : actions.length <= 4
      ? 'grid-cols-2 md:grid-cols-4'
      : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6';

  return (
    <div className={`grid ${gridCols} gap-4`}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            onClick={() => navigate(action.link)}
            className={`flex items-center justify-center gap-2 p-4 ${action.bgColor} border ${action.borderColor} rounded-xl ${action.color} font-medium transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
              action.highlight ? 'ring-2 ring-offset-2 ring-current animate-pulse' : ''
            }`}
          >
            <Icon className="w-5 h-5" />
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default QuickActionsGrid;
