/**
 * PayrollSummaryCards - Four summary stat cards for the payroll tab
 */
import React from 'react';
import { Users, DollarSign, Clock, Calendar } from 'lucide-react';
import { formatDateSpanish } from '../../components/DatePicker';
import { formatCurrency } from '../../utils/formatting';
import type { PayrollSummary } from '../../services/payrollService';

interface PayrollSummaryCardsProps {
  summary: PayrollSummary;
}

const PayrollSummaryCards: React.FC<PayrollSummaryCardsProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Empleados Activos</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {summary.active_employees}
            </p>
          </div>
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Nomina Mensual Est.</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(summary.total_monthly_payroll)}
            </p>
          </div>
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Liquidaciones Pendientes</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">
              {summary.pending_payroll_runs}
            </p>
          </div>
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
            <Clock className="w-6 h-6 text-orange-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Ultima Nomina</p>
            <p className="text-lg font-bold text-gray-700 mt-1">
              {summary.last_payroll_date
                ? formatDateSpanish(summary.last_payroll_date)
                : 'Sin registros'}
            </p>
          </div>
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
            <Calendar className="w-6 h-6 text-gray-600" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PayrollSummaryCards);
