/**
 * Shared CashChangeTracker - Shows amount received input and calculates change.
 * Used when payment method is 'cash' in SaleModal, OrderModal, etc.
 */
import { DollarSign } from 'lucide-react';

interface CashChangeTrackerProps {
  amountDue: number;
  amountReceived: number | undefined;
  onAmountReceivedChange: (value: number) => void;
  disabled?: boolean;
}

export default function CashChangeTracker({
  amountDue,
  amountReceived,
  onAmountReceivedChange,
  disabled = false,
}: CashChangeTrackerProps) {
  const hasReceived = amountReceived !== undefined && amountReceived > 0;
  const changeGiven = hasReceived && amountReceived >= amountDue
    ? amountReceived - amountDue
    : 0;
  const isInsufficient = hasReceived && amountReceived < amountDue;

  return (
    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-amber-800 mb-1">
            Monto Recibido del Cliente
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-600" />
            <input
              type="number"
              value={amountReceived || ''}
              onChange={(e) => onAmountReceivedChange(Number(e.target.value) || 0)}
              placeholder={`Min: $${amountDue.toLocaleString()}`}
              disabled={disabled}
              className="w-full pl-9 pr-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none bg-white"
            />
          </div>
        </div>

        {changeGiven > 0 && (
          <div className="text-right min-w-[100px]">
            <span className="text-xs text-amber-700">Devueltas:</span>
            <p className="text-xl font-bold text-amber-800">
              ${changeGiven.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {isInsufficient && (
        <p className="text-xs text-red-600 mt-2">
          Monto insuficiente. Minimo: ${amountDue.toLocaleString()}
        </p>
      )}
    </div>
  );
}
