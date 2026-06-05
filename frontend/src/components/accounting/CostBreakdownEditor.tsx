import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Loader2, Save, Zap, AlertCircle, CheckCircle,
  BarChart3, Clock, StickyNote, X,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import { extractErrorMessage } from '../../utils/api-client';
import * as costService from '../../services/costComponentService';
import type { CostComponentTemplate, ProductCostBreakdown } from '../../services/costComponentService';
import type { Product } from '../../types/api';
import CostApplyAllModal from './CostApplyAllModal';
import CostChangeHistoryModal from './CostChangeHistoryModal';
import { usePermissions } from '../../hooks/usePermissions';

interface CostBreakdownEditorProps {
  schoolId: string;
  garmentTypeId: string;
  garmentTypeName: string;
  isGlobal?: boolean;
  onCostsSaved?: () => void;
}

interface ProductRow {
  productId: string;
  code: string;
  name: string | null;
  size: string;
  price: number;
  components: Record<string, { amount: number; notes: string | null }>;
  originalComponents: Record<string, { amount: number; notes: string | null }>;
  isEdited: boolean;
}

const CostBreakdownEditor: React.FC<CostBreakdownEditorProps> = ({
  schoolId,
  garmentTypeId,
  garmentTypeName: _garmentTypeName,
  isGlobal = false,
  onCostsSaved,
}) => {
  const [templates, setTemplates] = useState<CostComponentTemplate[]>([]);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [applyAllModal, setApplyAllModal] = useState<{ open: boolean; template: CostComponentTemplate | null }>({
    open: false, template: null
  });
  const [historyTarget, setHistoryTarget] = useState<ProductRow | null>(null);
  const [notesPopover, setNotesPopover] = useState<{
    productId: string;
    templateId: string;
    top: number;
    left: number;
  } | null>(null);

  const { canEditCosts, hasPermission } = usePermissions();
  const canViewHistory = hasPermission('inventory.view_cost');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tmpl = await costService.getTemplates(garmentTypeId, schoolId, isGlobal);
      setTemplates(tmpl);

      const productsResp = await import('../../services/productService').then(m => {
        if (isGlobal) {
          return m.productService.getGlobalProducts(false, 500);
        }
        return m.productService.getAllProducts({ school_id: schoolId, garment_type_id: garmentTypeId, active_only: true, limit: 500 });
      });

      const products: Product[] = isGlobal
        ? productsResp.items.filter((p) => p.garment_type_id === garmentTypeId)
        : productsResp.items;

      // Cargar los breakdowns en paralelo (antes era N+1 secuencial)
      const breakdowns = await Promise.all(
        products.map((p) =>
          costService.getBreakdown(p.id, schoolId, isGlobal).catch(() => null)
        )
      );

      const productRows: ProductRow[] = products.map((p, i) => {
        const breakdown: ProductCostBreakdown | null = breakdowns[i];
        const components: Record<string, { amount: number; notes: string | null }> = {};
        if (breakdown) {
          for (const comp of breakdown.components) {
            components[comp.template_id] = { amount: comp.amount, notes: comp.notes };
          }
        }
        return {
          productId: p.id,
          code: p.code,
          name: p.name,
          size: p.size,
          price: p.price,
          components: { ...components },
          originalComponents: JSON.parse(JSON.stringify(components)),
          isEdited: false,
        };
      });

      productRows.sort((a, b) => {
        const sizeOrder = ['4', '6', '8', '10', '12', '14', '16', '18', '20', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
        return sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size);
      });

      setRows(productRows);
    } catch (e: unknown) {
      setError(extractErrorMessage(e) || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [garmentTypeId, schoolId, isGlobal]);

  useEffect(() => { loadData(); }, [loadData]);

  const updateComponentValue = (productId: string, templateId: string, value: number) => {
    setRows(prev => prev.map(row => {
      if (row.productId !== productId) return row;
      const updated = {
        ...row,
        components: {
          ...row.components,
          [templateId]: { amount: value, notes: row.components[templateId]?.notes || null }
        },
      };
      updated.isEdited = JSON.stringify(updated.components) !== JSON.stringify(row.originalComponents);
      return updated;
    }));
  };

  const updateComponentNotes = (productId: string, templateId: string, notes: string) => {
    setRows(prev => prev.map(row => {
      if (row.productId !== productId) return row;
      const current = row.components[templateId];
      const updated = {
        ...row,
        components: {
          ...row.components,
          [templateId]: {
            amount: current?.amount || 0,
            notes: notes.trim() ? notes : null,
          },
        },
      };
      updated.isEdited = JSON.stringify(updated.components) !== JSON.stringify(row.originalComponents);
      return updated;
    }));
  };

  const openNotesPopover = (
    productId: string,
    templateId: string,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setNotesPopover({
      productId, templateId,
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX - 240,  // alinea a la izquierda del botón
    });
  };

  const popoverRow = notesPopover ? rows.find(r => r.productId === notesPopover.productId) : null;
  const popoverNotes = popoverRow && notesPopover
    ? (popoverRow.components[notesPopover.templateId]?.notes || '')
    : '';

  const handleApplyAll = async (template: CostComponentTemplate, amount: number, sizeDeltas: Array<{ sizes: string[]; delta: number }>) => {
    setSaving(true);
    setError(null);
    try {
      await costService.bulkApplyComponent(
        garmentTypeId, template.code, amount, sizeDeltas, null, schoolId, isGlobal
      );
      setSuccess(`${template.name} aplicado a todos los productos`);
      await loadData();
      onCostsSaved?.();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Error al aplicar');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const editedRows = rows.filter(r => r.isEdited);
    if (editedRows.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      let savedCount = 0;
      for (const row of editedRows) {
        // Preservar también componentes con solo notas (amount=0 pero notes set).
        const components = Object.entries(row.components)
          .filter(([_, v]) => (v.amount || 0) > 0 || (v.notes && v.notes.trim()))
          .map(([templateId, v]) => ({
            template_id: templateId,
            amount: v.amount || 0,
            notes: v.notes,
          }));

        if (components.length > 0) {
          await costService.upsertBreakdown(row.productId, components, schoolId, isGlobal);
          savedCount++;
        }
      }

      setSuccess(`${savedCount} productos actualizados`);
      await loadData();
      onCostsSaved?.();
    } catch (e: unknown) {
      setError(extractErrorMessage(e) || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // Solo cuenta components cuyo template está activo. Defensa frontend
  // contra backends sin reiniciar y consistencia con la regla "desactivado
  // preserva data pero no suma".
  const activeTemplateIds = useMemo(() => new Set(templates.map(t => t.id)), [templates]);

  const totalCost = (row: ProductRow) =>
    Object.entries(row.components).reduce(
      (sum, [tid, c]) => sum + (activeTemplateIds.has(tid) ? (c.amount || 0) : 0),
      0,
    );

  // null when the product has no valid price — distinct from a real 0% margin,
  // so the UI can flag "sin precio" instead of painting a misleading 0.0%.
  const marginPercent = (row: ProductRow): number | null => {
    const cost = totalCost(row);
    if (row.price <= 0) return null;
    return ((row.price - cost) / row.price) * 100;
  };

  const coverage = useMemo(() => {
    const total = rows.length;
    const countFilled = (r: ProductRow) =>
      Object.entries(r.components).filter(
        ([tid, c]) => activeTemplateIds.has(tid) && (c.amount || 0) > 0,
      ).length;
    const withFull = rows.filter(r => {
      const filled = countFilled(r);
      return filled >= templates.length && templates.length > 0;
    }).length;
    const withPartial = rows.filter(r => {
      const filled = countFilled(r);
      return filled > 0 && filled < templates.length;
    }).length;
    return { total, withFull, withPartial, without: total - withFull - withPartial };
  }, [rows, templates, activeTemplateIds]);

  const availableSizes = useMemo(() => {
    const sizes = [...new Set(rows.map(r => r.size))];
    const order = ['4', '6', '8', '10', '12', '14', '16', '18', '20', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
    return sizes.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [rows]);

  const hasEdits = rows.some(r => r.isEdited);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        <span className="ml-2 text-stone-500">Cargando desglose de costos...</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-stone-500">
        No hay productos activos para este tipo de prenda.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Coverage bar */}
      <div className="flex items-center gap-3 px-1">
        <BarChart3 className="w-4 h-4 text-stone-400" />
        <div className="flex-1 bg-stone-100 rounded-full h-2.5 overflow-hidden">
          <div className="h-full flex">
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${(coverage.withFull / Math.max(coverage.total, 1)) * 100}%` }}
            />
            <div
              className="bg-amber-400 transition-all"
              style={{ width: `${(coverage.withPartial / Math.max(coverage.total, 1)) * 100}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-stone-500 whitespace-nowrap">
          {coverage.withFull}/{coverage.total} completos
        </span>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 text-sm rounded-lg">
          <CheckCircle className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border border-stone-200 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="px-3 py-2.5 text-left text-xs font-medium text-stone-500 uppercase sticky left-0 bg-stone-50 z-10">
                Producto
              </th>
              <th className="px-2 py-2.5 text-left text-xs font-medium text-stone-500 uppercase w-16">
                Talla
              </th>
              {templates.map(t => (
                <th key={t.id} className="px-2 py-2.5 text-center text-xs font-medium text-stone-500 uppercase min-w-[100px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{t.name}{t.is_variable ? ' *' : ''}</span>
                    {canEditCosts && (
                      <button
                        onClick={() => setApplyAllModal({ open: true, template: t })}
                        className="text-amber-500 hover:text-amber-600 flex items-center gap-0.5 text-[10px] font-normal normal-case"
                      >
                        <Zap className="w-3 h-3" /> Aplicar a todos
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-2 py-2.5 text-right text-xs font-medium text-stone-500 uppercase w-24">
                Total
              </th>
              <th className="px-2 py-2.5 text-right text-xs font-medium text-stone-500 uppercase w-24">
                Precio
              </th>
              <th className="px-2 py-2.5 text-right text-xs font-medium text-stone-500 uppercase w-20">
                Margen
              </th>
              {canViewHistory && (
                <th className="px-1 py-2.5 text-center text-xs font-medium text-stone-500 uppercase w-12">
                  Hist.
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map(row => {
              const cost = totalCost(row);
              const margin = marginPercent(row);
              return (
                <tr key={row.productId} className={row.isEdited ? 'bg-amber-50/50' : ''}>
                  <td className="px-3 py-2 text-stone-900 font-medium sticky left-0 bg-white z-10">
                    <div className="text-xs">{row.code}</div>
                    {row.name && <div className="text-[11px] text-stone-400 truncate max-w-[140px]">{row.name}</div>}
                  </td>
                  <td className="px-2 py-2 text-stone-600 text-center">{row.size}</td>
                  {templates.map(t => {
                    const cell = row.components[t.id];
                    const hasNote = !!(cell?.notes && cell.notes.trim());
                    return (
                      <td key={t.id} className="px-1 py-1">
                        {canEditCosts ? (
                          <div className="relative">
                            <input
                              type="number"
                              value={cell?.amount || ''}
                              onChange={(e) => updateComponentValue(row.productId, t.id, Number(e.target.value) || 0)}
                              className="w-full pl-2 pr-7 py-1.5 text-sm text-right border border-stone-200 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                              placeholder="0"
                            />
                            <button
                              type="button"
                              onClick={(e) => openNotesPopover(row.productId, t.id, e)}
                              className={`absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-stone-100 ${
                                hasNote ? 'text-amber-600' : 'text-stone-300'
                              }`}
                              title={hasNote ? `Nota: ${cell?.notes}` : 'Agregar nota'}
                            >
                              <StickyNote className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-sm text-right block px-2">
                              {cell?.amount ? formatCurrency(cell.amount) : '-'}
                            </span>
                            {hasNote && (
                              <span title={cell?.notes || ''}>
                                <StickyNote className="w-3 h-3 text-amber-600" />
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-right font-medium text-stone-900">
                    {cost > 0 ? formatCurrency(cost) : <span className="text-stone-300">-</span>}
                  </td>
                  <td className="px-2 py-2 text-right text-stone-600">
                    {formatCurrency(row.price)}
                  </td>
                  <td className={`px-2 py-2 text-right font-medium ${
                    margin === null ? 'text-red-600' :
                    cost === 0 ? 'text-stone-300' :
                    margin > 30 ? 'text-green-600' :
                    margin > 15 ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                    {margin === null ? 'sin precio' : cost > 0 ? `${margin.toFixed(1)}%` : '-'}
                  </td>
                  {canViewHistory && (
                    <td className="px-1 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setHistoryTarget(row)}
                        className="p-1 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                        title="Ver historial de cambios"
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Variable indicator */}
      {templates.some(t => t.is_variable) && (
        <p className="text-xs text-stone-400 px-1">
          * Componentes variables (estimados). Los costos exactos pueden variar por talla y lote.
        </p>
      )}

      {/* Save button */}
      {canEditCosts && hasEdits && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2 font-medium"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar cambios
          </button>
        </div>
      )}

      {/* Apply All Modal */}
      {applyAllModal.template && (
        <CostApplyAllModal
          isOpen={applyAllModal.open}
          onClose={() => setApplyAllModal({ open: false, template: null })}
          componentName={applyAllModal.template.name}
          availableSizes={availableSizes}
          onApply={(amount, deltas) => handleApplyAll(applyAllModal.template!, amount, deltas)}
        />
      )}

      {/* Notas popover */}
      {notesPopover && popoverRow && (
        <>
          <div
            className="fixed inset-0 z-[75]"
            onClick={() => setNotesPopover(null)}
          />
          <div
            className="fixed z-[80] bg-white border border-stone-200 rounded-lg shadow-lg p-3 w-64"
            style={{ top: notesPopover.top, left: Math.max(notesPopover.left, 8) }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-stone-600">Nota del componente</span>
              <button
                onClick={() => setNotesPopover(null)}
                className="text-stone-400 hover:text-stone-600"
                aria-label="Cerrar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <textarea
              value={popoverNotes}
              onChange={(e) => updateComponentNotes(notesPopover.productId, notesPopover.templateId, e.target.value)}
              placeholder="¿Por qué este valor? Proveedor, lote, fecha del precio..."
              className="w-full h-20 text-sm border border-stone-200 rounded p-2 focus:ring-1 focus:ring-amber-500"
              autoFocus
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={() => setNotesPopover(null)}
                className="text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded"
              >
                Listo
              </button>
            </div>
          </div>
        </>
      )}

      {/* History Modal */}
      {historyTarget && (
        <CostChangeHistoryModal
          isOpen={true}
          onClose={() => setHistoryTarget(null)}
          productId={historyTarget.productId}
          productName={historyTarget.name || historyTarget.code}
          productCode={historyTarget.code}
          productSize={historyTarget.size}
          schoolId={schoolId}
          isGlobalProduct={isGlobal}
        />
      )}
    </div>
  );
};

export default CostBreakdownEditor;
