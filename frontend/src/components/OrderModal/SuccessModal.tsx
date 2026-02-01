/**
 * SuccessModal - Order creation success dialog
 */
import { CheckCircle, Building2, Loader2, Printer } from 'lucide-react';
import thermalPrinterService from '../../services/thermalPrinterService';
import type { SuccessModalProps } from './types';

export default function SuccessModal({
  isOpen,
  orderResults,
  isPrinting,
  onPrintReceipts,
  onClose,
}: SuccessModalProps) {
  if (!isOpen || orderResults.length === 0) {
    return null;
  }

  const grandTotal = orderResults.reduce((sum, r) => sum + r.total, 0);
  const isPrinterConfigured = thermalPrinterService.isPrinterConfigured();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Success Header */}
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">
            {orderResults.length === 1
              ? 'Encargo Creado Exitosamente'
              : `${orderResults.length} Encargos Creados Exitosamente`}
          </h3>
        </div>

        {/* Order Results */}
        <div className="space-y-3 mb-6">
          {orderResults.map((result, index) => (
            <div
              key={index}
              className="bg-gray-50 rounded-lg p-4 border border-gray-200"
            >
              {orderResults.length > 1 && (
                <div className="flex items-center text-sm text-blue-600 mb-2">
                  <Building2 className="w-4 h-4 mr-1" />
                  {result.schoolName}
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-mono text-lg font-bold text-gray-900">
                  {result.orderCode}
                </span>
                <span className="text-lg font-semibold text-green-600">
                  ${result.total.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Total Summary */}
        {orderResults.length > 1 && (
          <div className="border-t border-gray-200 pt-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-700">Total General:</span>
              <span className="text-xl font-bold text-blue-600">
                ${grandTotal.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {isPrinterConfigured && (
            <button
              type="button"
              onClick={onPrintReceipts}
              disabled={isPrinting}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              {isPrinting ? 'Imprimiendo...' : 'Imprimir Comprobante'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
