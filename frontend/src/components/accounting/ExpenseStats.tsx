/**
 * ExpenseStats - Statistics cards for expenses dashboard
 */
import { DollarSign, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import { formatCurrency, type ExpenseStats as ExpenseStatsType } from '../../hooks/useExpenses';

interface ExpenseStatsProps {
  stats: ExpenseStatsType;
  activeFilter: 'all' | 'pending' | 'paid';
  onFilterClick: (filter: 'all' | 'pending' | 'paid') => void;
}

const StatCard: React.FC<{
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  isActive?: boolean;
  onClick?: () => void;
}> = ({ label, value, subValue, icon, bgColor, textColor, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`${bgColor} rounded-xl p-5 text-left w-full transition-all hover:shadow-md ${
      isActive ? 'ring-2 ring-blue-500 ring-offset-2' : ''
    } ${onClick ? 'cursor-pointer' : ''}`}
  >
    <div className={`flex items-center gap-2 ${textColor} mb-2`}>
      {icon}
      <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
    </div>
    <p className="text-2xl font-bold text-gray-900">{value}</p>
    {subValue && (
      <p className={`text-sm ${textColor} mt-1`}>{subValue}</p>
    )}
  </button>
);

const ExpenseStats: React.FC<ExpenseStatsProps> = ({
  stats,
  activeFilter,
  onFilterClick
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Gastos"
        value={formatCurrency(stats.totalAmount)}
        subValue={`${stats.totalCount} gastos`}
        icon={<DollarSign className="w-5 h-5" />}
        bgColor="bg-white border border-gray-200"
        textColor="text-gray-600"
        isActive={activeFilter === 'all'}
        onClick={() => onFilterClick('all')}
      />
      <StatCard
        label="Pendientes"
        value={formatCurrency(stats.pendingAmount)}
        subValue={`${stats.pendingCount} gastos`}
        icon={<Clock className="w-5 h-5" />}
        bgColor="bg-red-50 border border-red-200"
        textColor="text-red-600"
        isActive={activeFilter === 'pending'}
        onClick={() => onFilterClick('pending')}
      />
      <StatCard
        label="Pagados"
        value={formatCurrency(stats.paidAmount)}
        subValue={`${stats.paidCount} gastos`}
        icon={<CheckCircle className="w-5 h-5" />}
        bgColor="bg-green-50 border border-green-200"
        textColor="text-green-600"
        isActive={activeFilter === 'paid'}
        onClick={() => onFilterClick('paid')}
      />
      <StatCard
        label="Promedio"
        value={formatCurrency(stats.averageAmount)}
        subValue="por gasto"
        icon={<TrendingUp className="w-5 h-5" />}
        bgColor="bg-blue-50 border border-blue-200"
        textColor="text-blue-600"
      />
    </div>
  );
};

export default ExpenseStats;
