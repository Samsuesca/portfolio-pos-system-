'use client';

/**
 * Inventory Adjustment Modal - Adjust stock for products
 * Supports both school-specific and global products
 */
import { useState, useEffect } from 'react';
import { X, Loader2, Package, Plus, Minus, RefreshCw } from 'lucide-react';
import productService from '@/lib/services/productService';
import type { Product, GlobalProduct } from '@/lib/api';

// Helper to extract error message from API responses (handles Pydantic validation errors)
function getErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Error desconocido';

  const axiosErr = err as { response?: { data?: { detail?: unknown } } };
  const detail = axiosErr.response?.data?.detail;

  if (!detail) return 'Error al ajustar inventario';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    // Pydantic validation errors
    return detail.map((e: { msg?: string }) => e.msg || 'Error de validación').join(', ');
  }
  return 'Error al ajustar inventario';
}

type AdjustmentType = 'add' | 'remove' | 'set';

interface InventoryAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: Product | GlobalProduct;
  isGlobal: boolean;
  schoolId?: string;
}

export default function InventoryAdjustmentModal({
  isOpen,
  onClose,
  onSuccess,
  product,
  isGlobal,
  schoolId,
}: InventoryAdjustmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  // Get current stock
  const currentStock = isGlobal
    ? (product as GlobalProduct).inventory_quantity ?? 0
    : (product as Product).stock ?? (product as Product).inventory_quantity ?? 0;

  useEffect(() => {
    if (isOpen) {
      setAdjustmentType('add');
      setQuantity('');
      setReason('');
      setError(null);
    }
  }, [isOpen]);

  const calculateNewStock = () => {
    const qty = parseInt(quantity) || 0;
    switch (adjustmentType) {
      case 'add':
        return currentStock + qty;
      case 'remove':
        return Math.max(0, currentStock - qty);
      case 'set':
        return qty;
      default:
        return currentStock;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 0) {
      setError('Ingresa una cantidad valida');
      return;
    }

    if (qty === 0 && adjustmentType !== 'set') {
      setError('La cantidad debe ser mayor a 0');
      return;
    }

    // Validate remove doesn't go negative
    if (adjustmentType === 'remove' && qty > currentStock) {
      setError(`No puedes remover mas de ${currentStock} unidades`);
      return;
    }

    setLoading(true);

    try {
      // Calculate the adjustment value based on type
      let adjustment: number;
      switch (adjustmentType) {
        case 'add':
          adjustment = qty;
          break;
        case 'remove':
          adjustment = -qty;
          break;
        case 'set':
          adjustment = qty - currentStock;
          break;
        default:
          adjustment = 0;
      }

      if (isGlobal) {
        // Global product
        await productService.adjustGlobalInventory(product.id, {
          adjustment,
          reason: reason.trim() || undefined,
        });
      } else {
        // School product
        if (!schoolId) {
          setError('School ID is required');
          setLoading(false);
          return;
        }

        await productService.adjustInventory(schoolId, product.id, {
          adjustment,
          reason: reason.trim() || undefined,
        });
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error adjusting inventory:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const newStock = calculateNewStock();
  const stockDiff = newStock - currentStock;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-slate-600" />
              <h3 className="text-lg font-semibold text-slate-800">
                Ajustar Inventario
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Product Info */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <p className="font-medium text-slate-800">{product.name}</p>
            <p className="text-sm text-slate-500">
              Talla: {product.size} {product.color && `| Color: ${product.color}`}
            </p>
            <p className="text-sm mt-1">
              Stock actual:{' '}
              <span className={`font-semibold ${currentStock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {currentStock} unidades
              </span>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Adjustment Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tipo de Ajuste
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustmentType('add')}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition ${
                    adjustmentType === 'add'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-xs font-medium">Agregar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('remove')}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition ${
                    adjustmentType === 'remove'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <Minus className="w-5 h-5" />
                  <span className="text-xs font-medium">Remover</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('set')}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition ${
                    adjustmentType === 'set'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <RefreshCw className="w-5 h-5" />
                  <span className="text-xs font-medium">Establecer</span>
                </button>
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cantidad
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="0"
                placeholder="0"
                autoFocus
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-lg font-semibold text-center"
              />
            </div>

            {/* New Stock Preview */}
            {quantity && (
              <div className={`p-3 rounded-lg ${
                stockDiff > 0
                  ? 'bg-green-50 border border-green-200'
                  : stockDiff < 0
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-blue-50 border border-blue-200'
              }`}>
                <p className="text-sm font-medium text-center">
                  Nuevo stock:{' '}
                  <span className={`text-lg ${
                    stockDiff > 0 ? 'text-green-700' : stockDiff < 0 ? 'text-red-700' : 'text-blue-700'
                  }`}>
                    {newStock} unidades
                  </span>
                </p>
                {stockDiff !== 0 && (
                  <p className="text-xs text-center mt-1 text-slate-500">
                    ({stockDiff > 0 ? '+' : ''}{stockDiff} del actual)
                  </p>
                )}
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Razon (opcional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: Conteo fisico, devolucion, venta..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !quantity}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center ${
                  adjustmentType === 'add'
                    ? 'bg-green-600 hover:bg-green-700'
                    : adjustmentType === 'remove'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Ajuste'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
