/**
 * AccountsPayable - Accounts payable (CxP) management component
 */
import React from 'react';
import { Plus, Building2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import { formatDateSpanish } from '../DatePicker';
import type { ReceivablesPayablesSummary, AccountsPayableListItem } from './types';

interface AccountsPayableProps {
  summary: ReceivablesPayablesSummary | null;
  payablesList: AccountsPayableListItem[];
  onCreatePayable: () => void;
  onPayPayable: (payable: AccountsPayableListItem) => void;
}

const AccountsPayable: React.FC<AccountsPayableProps> = ({
  summary,
  payablesList,
  onCreatePayable,
  onPayPayable
}) => {
  const formatDate = (dateStr: string) => formatDateSpanish(dateStr);

  return (
    <>
      {/* Summary Cards - 2 columns for side-by-side view */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500">Total por Pagar</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(summary.total_payables)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500">Pendientes</p>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(summary.payables_pending)}</p>
            <p className="text-xs text-gray-400">{summary.payables_count} cuenta(s)</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500">Vencidas</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(summary.payables_overdue)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500">Posicion Neta</p>
            <p className={`text-xl font-bold ${summary.net_position >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.net_position)}
            </p>
            <p className="text-xs text-gray-400">Por cobrar - Por pagar</p>
          </div>
        </div>
      )}

      {/* Payables List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Cuentas por Pagar</h3>
          <button
            onClick={onCreatePayable}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Nueva Cuenta
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {payablesList.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>No hay cuentas por pagar pendientes</p>
            </div>
          ) : (
            payablesList.map((item) => (
              <div key={item.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${
                      item.is_paid ? 'bg-green-500' : item.is_overdue ? 'bg-red-500' : 'bg-orange-500'
                    }`} />
                    <div>
                      <p className="font-medium text-gray-800">{item.description}</p>
                      <p className="text-sm text-gray-500">
                        {item.vendor}
                        {item.invoice_number && ` - Fact: ${item.invoice_number}`}
                        {item.due_date && ` - Vence: ${formatDate(item.due_date)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-gray-800">{formatCurrency(item.amount)}</p>
                      {item.amount_paid > 0 && (
                        <p className="text-xs text-gray-500">Pagado: {formatCurrency(item.amount_paid)}</p>
                      )}
                      {item.balance > 0 && (
                        <p className="text-sm font-medium text-red-600">Saldo: {formatCurrency(item.balance)}</p>
                      )}
                    </div>
                    {!item.is_paid && (
                      <button
                        onClick={() => onPayPayable(item)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200 transition-colors"
                      >
                        Pagar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default AccountsPayable;
