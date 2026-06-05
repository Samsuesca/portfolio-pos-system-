/**
 * Modal for adjusting product inventory (add, remove, or set stock).
 * Works for both school-specific and global products.
 * Manages its own form state (amount, reason, type, submission).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, Globe, Loader2 } from 'lucide-react';
import { productService } from '../../services/productService';
import { extractErrorMessage } from '../../utils/api-client';
import apiClient from '../../utils/api-client';
import type { InventoryAdjustment, AdjustmentType } from './types';

interface InventoryAdjustmentModalProps {
  inventoryModal: InventoryAdjustment;
  onClose: () => void;
  onSuccess: () => void;
}

const InventoryAdjustmentModal: React.FC<InventoryAdjustmentModalProps> = ({
  inventoryModal,
  onClose,
  onSuccess,
}) => {
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('add');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when the targeted product changes (the parent may reuse this
  // component across products without unmounting it).
  useEffect(() => {
    setAdjustmentAmount('');
    setAdjustmentReason('');
    setAdjustmentType('add');
    setError(null);
  }, [inventoryModal.productId]);

  const handleAdjustInventory = useCallback(async () => {
    const trimmed = adjustmentAmount.trim();
    if (!trimmed) {
      setError('La cantidad es requerida');
      return;
    }

    const amount = parseInt(trimmed, 10);
    if (isNaN(amount) || amount <= 0) {
      setError('La cantidad debe ser un numero positivo');
      return;
    }

    let adjustment: number;
    if (adjustmentType === 'add') {
      adjustment = amount;
    } else if (adjustmentType === 'remove') {
      adjustment = -amount;
      if (inventoryModal.currentStock + adjustment < 0) {
        setError('No puede quedar stock negativo');
        return;
      }
    } else {
      adjustment = amount - inventoryModal.currentStock;
    }

    try {
      setSubmitting(true);
      setError(null);

      if (inventoryModal.isGlobal) {
        await productService.adjustGlobalInventory(
          inventoryModal.productId,
          adjustment,
          adjustmentReason || undefined
        );
      } else {
        await apiClient.post(`/schools/${inventoryModal.schoolId}/inventory/product/${inventoryModal.productId}/adjust`, {
          adjustment,
          reason: adjustmentReason || `Ajuste manual: ${adjustmentType === 'add' ? 'Agregar' : adjustmentType === 'remove' ? 'Remover' : 'Establecer'} ${amount} unidades`,
        });
      }

      onSuccess();
    } catch (err: unknown) {
      console.error('Error adjusting inventory:', err);
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }, [adjustmentAmount, adjustmentType, adjustmentReason, inventoryModal, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b border-stone-200 ${
            inventoryModal.isGlobal ? 'bg-green-50' : ''
          }`}>
            <h2 className="text-xl font-semibold text-stone-800 flex items-center">
              {inventoryModal.isGlobal && <Globe className="w-5 h-5 text-green-600 mr-2" />}
              Ajustar Inventario {inventoryModal.isGlobal ? 'Global' : ''}
            </h2>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Error display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Product Info */}
            <div className={`rounded-lg p-4 ${inventoryModal.isGlobal ? 'bg-green-50' : 'bg-stone-50'}`}>
              <p className="text-sm text-stone-600">Producto:</p>
              <p className="font-medium text-stone-900">{inventoryModal.productCode}</p>
              <p className="text-sm text-stone-700">{inventoryModal.productName}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-stone-600">Stock actual:</span>
                <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${
                  inventoryModal.isGlobal ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-brand-100 text-brand-700'
                }`}>
                  {inventoryModal.currentStock} unidades
                </span>
              </div>
            </div>

            {/* Adjustment Type */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Tipo de ajuste
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustmentType('add')}
                  className={`flex-1 py-2 px-4 rounded-lg border transition ${
                    adjustmentType === 'add'
                      ? 'bg-green-100 border-green-500 text-green-700'
                      : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  + Agregar
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('remove')}
                  className={`flex-1 py-2 px-4 rounded-lg border transition ${
                    adjustmentType === 'remove'
                      ? 'bg-red-100 border-red-500 text-red-700'
                      : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  - Remover
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('set')}
                  className={`flex-1 py-2 px-4 rounded-lg border transition ${
                    adjustmentType === 'set'
                      ? 'bg-brand-100 border-brand-500 text-brand-700'
                      : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  = Establecer
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                {adjustmentType === 'set' ? 'Nuevo stock' : 'Cantidad'} *
              </label>
              <input
                type="number"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
                min="0"
                placeholder={adjustmentType === 'set' ? 'Ej: 50' : 'Ej: 10'}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
              />
              {adjustmentType !== 'set' && (() => {
                const parsed = parseInt(adjustmentAmount.trim(), 10);
                if (isNaN(parsed) || parsed <= 0) return null;
                const next = adjustmentType === 'add'
                  ? inventoryModal.currentStock + parsed
                  : Math.max(0, inventoryModal.currentStock - parsed);
                return (
                  <p className="mt-1 text-sm text-stone-500">
                    Nuevo stock: {next} unidades
                  </p>
                );
              })()}
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Razon (opcional)
              </label>
              <input
                type="text"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="Ej: Reposicion de inventario, Correccion de conteo..."
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 border-t border-stone-200 bg-stone-50 rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2 border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-100 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdjustInventory}
              disabled={submitting || !adjustmentAmount.trim()}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Ajuste
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(InventoryAdjustmentModal);
