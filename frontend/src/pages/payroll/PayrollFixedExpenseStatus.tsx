/**
 * PayrollFixedExpenseStatus - Banner showing integration status
 * between payroll and fixed expenses in accounting.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Link2, Link2Off, CalendarClock } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import type { PayrollSummary } from '../../services/payrollService';

interface PayrollFixedExpenseStatusProps {
  integration: PayrollSummary['fixed_expense_integration'];
}

const PayrollFixedExpenseStatus: React.FC<PayrollFixedExpenseStatusProps> = ({ integration }) => {
  const isSynced = integration?.is_synced;
  const hasIntegration = !!integration;

  const colorScheme = isSynced
    ? { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600', title: 'text-green-800', sub: 'text-green-600', btn: 'bg-green-600 hover:bg-green-700' }
    : hasIntegration
      ? { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', title: 'text-amber-800', sub: 'text-amber-600', btn: 'bg-amber-600 hover:bg-amber-700' }
      : { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', title: 'text-blue-800', sub: 'text-blue-600', btn: 'bg-blue-600 hover:bg-blue-700' };

  const IconComponent = isSynced ? Link2 : hasIntegration ? Link2Off : CalendarClock;

  const titleText = isSynced
    ? 'Nomina sincronizada con Gastos Fijos'
    : hasIntegration
      ? 'Gasto fijo de nomina requiere actualizacion'
      : 'Nomina aun no integrada con Gastos Fijos';

  const subtitleText = hasIntegration
    ? `Gasto fijo actual: ${formatCurrency(integration!.amount)}`
    : 'Aprueba una liquidacion para crear el gasto fijo consolidado';

  return (
    <div className={`mb-8 p-4 rounded-lg border ${colorScheme.bg} ${colorScheme.border}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconComponent className={`w-5 h-5 ${colorScheme.icon}`} />
          <div>
            <p className={`font-medium ${colorScheme.title}`}>{titleText}</p>
            <p className={`text-sm ${colorScheme.sub}`}>{subtitleText}</p>
          </div>
        </div>
        <Link
          to="/accounting"
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${colorScheme.btn} text-white`}
        >
          Ver en Contabilidad
        </Link>
      </div>
    </div>
  );
};

export default React.memo(PayrollFixedExpenseStatus);
