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

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            onClick={() => navigate(action.link)}
            className={`flex items-center justify-center gap-2 py-3 px-4 ${action.bgColor} border ${action.borderColor} rounded-xl ${action.color} font-medium text-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
              action.highlight ? 'ring-2 ring-offset-2 ring-current' : ''
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default QuickActionsGrid;
