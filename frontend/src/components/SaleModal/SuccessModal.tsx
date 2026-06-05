/**
 * Sale Success Modal
 * Shows results for completed sale(s) with print option
 */
import { useState } from 'react';
import { CheckCircle, Building2, Printer, Loader2, Eye } from 'lucide-react';
import thermalPrinterService from '../../services/thermalPrinterService';
import type { SaleResult } from './types';
import type { School } from '../../services/schoolService';

interface SuccessModalProps {
  isOpen: boolean;
  results: SaleResult[];
  availableSchools: School[];
  onClose: () => void;
  onNavigateToSale?: (saleId: string) => void;
}

export default function SuccessModal({
  isOpen,
  results,
  availableSchools,
  onClose,
  onNavigateToSale,
}: SuccessModalProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen || results.length === 0) return null;

  const handlePrintReceipts = async () => {
    setIsPrinting(true);
    try {
      for (const result of results) {
        // Find the school for this sale
        const school = availableSchools.find(s => s.name === result.schoolName);
        if (school) {
          // Print receipt and open drawer if cash payment
          await thermalPrinterService.printSaleReceiptWithDrawer(
            school.id,
            result.saleId,
            result.paymentMethod
          );
        }
      }
    } catch (error) {
      console.error('Error printing receipts:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  const totalGeneral = results.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Success Header */}
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-stone-900">
            {results.length === 1
              ? 'Venta Creada Exitosamente'
              : `${results.length} Ventas Creadas Exitosamente`}
          </h3>
        </div>

        {/* Sales Results */}
        <div className="space-y-3 mb-6">
          {results.map((result, index) => (
            <div
              key={index}
              className="bg-stone-50 rounded-lg p-4 border border-stone-200"
            >
              {results.length > 1 && (
                <div className="flex items-center text-sm text-brand-600 mb-2">
                  <Building2 className="w-4 h-4 mr-1" />
                  {result.schoolName}
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-mono text-lg font-bold text-stone-900">
                  {result.saleCode}
                </span>
                <span className="text-lg font-semibold text-green-600">
                  ${result.total.toLocaleString()}
                </span>
              </div>
              {onNavigateToSale && (
                <button
                  type="button"
                  onClick={() => onNavigateToSale(result.saleId)}
                  className="mt-2 text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  Ver detalle y descargar PDF
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Total Summary */}
        {results.length > 1 && (
          <div className="border-t border-stone-200 pt-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-stone-700">Total General:</span>
              <span className="text-xl font-bold text-brand-600">
                ${totalGeneral.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {thermalPrinterService.isPrinterConfigured() && (
            <button
              type="button"
              onClick={handlePrintReceipts}
              disabled={isPrinting}
              className="flex-1 px-4 py-2 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              {isPrinting ? 'Imprimiendo...' : 'Imprimir Recibo'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
