/**
 * PayrollRunsTab - Payroll runs table with summary and fixed expense status.
 */
import React from 'react';
import { Plus } from 'lucide-react';
import { formatDateSpanish } from '../../components/DatePicker';
import { formatCurrency } from '../../utils/formatting';
import {
  getPayrollStatusLabel,
  getPayrollStatusColor,
  formatPeriodRange,
  type PayrollSummary,
  type PayrollRunListItem,
  type PayrollStatus,
} from '../../services/payrollService';
import PayrollSummaryCards from './PayrollSummaryCards';
import PayrollFixedExpenseStatus from './PayrollFixedExpenseStatus';

interface PayrollRunsTabProps {
  summary: PayrollSummary | null;
  runs: PayrollRunListItem[];
  filter: PayrollStatus | 'all';
  onFilterChange: (filter: PayrollStatus | 'all') => void;
  onNewPayroll: () => void;
  onOpenDetail: (run: PayrollRunListItem) => void;
}

const PayrollRunsTab: React.FC<PayrollRunsTabProps> = ({
  summary,
  runs,
  filter,
  onFilterChange,
  onNewPayroll,
  onOpenDetail,
}) => {
  return (
    <>
      {/* Summary Cards */}
      {summary && (
        <>
          <PayrollSummaryCards summary={summary} />
          <PayrollFixedExpenseStatus integration={summary.fixed_expense_integration} />
        </>
      )}

      {/* Action Bar */}
      <div className="flex justify-between items-center mb-6">
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as PayrollStatus | 'all')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">Todos</option>
          <option value="draft">Borradores</option>
          <option value="approved">Aprobados</option>
          <option value="paid">Pagados</option>
          <option value="cancelled">Cancelados</option>
        </select>
        <button
          onClick={onNewPayroll}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nueva Liquidacion
        </button>
      </div>

      {/* Payroll Runs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empleados</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Neto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Creado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {runs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No hay liquidaciones registradas
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr key={run.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onOpenDetail(run)}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatPeriodRange(run.period_start, run.period_end)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {run.employee_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(run.total_net)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPayrollStatusColor(run.status)}`}>
                      {getPayrollStatusLabel(run.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDateSpanish(run.created_at.split('T')[0])}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetail(run);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default React.memo(PayrollRunsTab);
