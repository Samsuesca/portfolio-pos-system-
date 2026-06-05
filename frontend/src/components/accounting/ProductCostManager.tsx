/**
 * ProductCostManager - Gestion de costos de productos.
 *
 * Hub de costos: para productos MANUFACTURADOS el costo es la suma de su
 * desglose por componentes (fuente de verdad) — se edita via "Ver desglose"
 * (CostBreakdownModal). Para productos COMPRADOS (zapatos, medias, jeans) que
 * no tienen componentes, se mantiene la entrada manual de costo.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Search, Save, Loader2, AlertTriangle,
  CheckCircle, X, Building2, List, AlertCircle, Layers
} from 'lucide-react';
import { productService, type ProductCostUpdate } from '../../services/productService';
import { formatCurrency } from '../../utils/formatting';
import { usePermissions } from '../../hooks/usePermissions';
import CostBreakdownModal from './CostBreakdownModal';

type ViewMode = 'missing_cost' | 'all';

interface ProductCostManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialMode?: ViewMode;
}

interface ManagerRow {
  id: string;
  code: string;
  name: string | null;
  price: number;
  cost: number | null;
  school_id?: string;
  school_name?: string;
  garment_type_id: string;
  garment_type_name: string | null;
  cost_type: 'manufactured' | 'purchased' | null;
  isGlobal: boolean;
  newCost: number | null;
  isEdited: boolean;
}

interface BreakdownTarget {
  schoolId: string;
  garmentTypeId: string;
  garmentTypeName: string;
  isGlobal: boolean;
}

// Productos comprados (sin desglose por componentes) usan costo manual.
const isPurchased = (costType: ManagerRow['cost_type']) => costType === 'purchased';

const ProductCostManager: React.FC<ProductCostManagerProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialMode = 'missing_cost'
}) => {
  const { canEditCosts, hasPermission } = usePermissions();
  const canViewBreakdown = hasPermission('inventory.view_cost');

  const [products, setProducts] = useState<ManagerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [breakdownTarget, setBreakdownTarget] = useState<BreakdownTarget | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, viewMode]);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      // Mapa de tipos de prenda globales para enriquecer cost_type/nombre
      // (los productos globales no traen esos campos en su payload).
      const globalGtResp = await productService.getGlobalGarmentTypes(true);
      const globalGtMap = new Map<string, { name: string; cost_type: 'manufactured' | 'purchased' }>();
      for (const gt of globalGtResp.items) {
        globalGtMap.set(gt.id, {
          name: gt.name,
          cost_type: (gt.cost_type as 'manufactured' | 'purchased') ?? 'manufactured',
        });
      }

      const mapSchool = (p: any): ManagerRow => ({
        id: p.id,
        code: p.code,
        name: p.name,
        price: p.price,
        cost: p.cost ?? null,
        school_id: p.school_id || undefined,
        school_name: p.school_name,
        garment_type_id: p.garment_type_id,
        garment_type_name: p.garment_type_name ?? null,
        cost_type: (p.cost_type as 'manufactured' | 'purchased') ?? null,
        isGlobal: false,
        newCost: null,
        isEdited: false,
      });

      const mapGlobal = (p: any): ManagerRow => {
        const gt = globalGtMap.get(p.garment_type_id);
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          price: p.price,
          cost: p.cost ?? null,
          school_id: undefined,
          school_name: 'Global',
          garment_type_id: p.garment_type_id,
          garment_type_name: gt?.name ?? null,
          cost_type: gt?.cost_type ?? null,
          isGlobal: true,
          newCost: null,
          isEdited: false,
        };
      };

      if (viewMode === 'missing_cost') {
        const [schoolData, globalData] = await Promise.all([
          productService.getProductsWithoutCost(),
          productService.getGlobalProducts(false, 500),
        ]);
        const globalWithoutCost = globalData.items.filter(p => !p.cost || p.cost <= 0);
        setProducts([
          ...schoolData.map(mapSchool),
          ...globalWithoutCost.map(mapGlobal),
        ]);
      } else {
        const [schoolData, globalData] = await Promise.all([
          productService.getAllProducts({ active_only: true, limit: 500 }),
          productService.getGlobalProducts(false, 500),
        ]);
        setProducts([
          ...schoolData.items.map(mapSchool),
          ...globalData.items.map(mapGlobal),
        ]);
      }
    } catch (e) {
      setError('Error al cargar productos');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const schools = useMemo(() => {
    const schoolMap = new Map<string, string>();
    products.forEach(p => {
      if (p.school_id && p.school_name) {
        schoolMap.set(p.school_id, p.school_name);
      }
    });
    return Array.from(schoolMap.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !searchTerm ||
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSchool = selectedSchool === 'all' ||
        (selectedSchool === 'global' ? p.isGlobal : p.school_id === selectedSchool);
      return matchesSearch && matchesSchool;
    });
  }, [products, searchTerm, selectedSchool]);

  const editedCount = products.filter(p => p.isEdited).length;

  const handleCostChange = (productId: string, value: string) => {
    const numValue = parseFloat(value);
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          newCost: isNaN(numValue) ? null : numValue,
          isEdited: !isNaN(numValue) && numValue > 0
        };
      }
      return p;
    }));
  };

  const openBreakdown = (row: ManagerRow) => {
    setBreakdownTarget({
      schoolId: row.school_id || '',
      garmentTypeId: row.garment_type_id,
      garmentTypeName: row.garment_type_name || row.name || 'Prenda',
      isGlobal: row.isGlobal,
    });
  };

  // Solo se guardan manualmente los productos COMPRADOS (los manufacturados
  // se editan via desglose, que persiste y recalcula product.cost en backend).
  const handleSave = async () => {
    const editedProducts = products.filter(p => p.isEdited && p.newCost !== null && p.newCost > 0);

    if (editedProducts.length === 0) {
      setError('No hay cambios para guardar');
      return;
    }

    const schoolEdits = editedProducts.filter(p => !p.isGlobal);
    const globalEdits = editedProducts.filter(p => p.isGlobal);

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let schoolUpdated = 0;
      let schoolFailed = 0;
      let globalUpdated = 0;
      let globalFailed = 0;

      if (schoolEdits.length > 0) {
        const updates: ProductCostUpdate[] = schoolEdits.map(p => ({
          product_id: p.id,
          cost: p.newCost as number,
        }));
        const result = await productService.bulkUpdateCosts(updates);
        schoolUpdated = result.updated;
        schoolFailed = result.failed;
        if (result.errors.length > 0) {
          console.warn('Bulk update errors:', result.errors);
        }
      }

      if (globalEdits.length > 0) {
        const results = await Promise.allSettled(
          globalEdits.map(p => productService.updateGlobalProduct(p.id, { cost: p.newCost as number }))
        );
        results.forEach(r => {
          if (r.status === 'fulfilled') globalUpdated++;
          else globalFailed++;
        });
      }

      const totalUpdated = schoolUpdated + globalUpdated;
      const totalFailed = schoolFailed + globalFailed;
      setSuccess(`${totalUpdated} productos actualizados${totalFailed > 0 ? `, ${totalFailed} fallidos` : ''}`);

      if (totalUpdated > 0) {
        const updatedIds = new Set(editedProducts.map(p => p.id));
        if (viewMode === 'missing_cost') {
          setProducts(prev => prev.filter(p => !updatedIds.has(p.id) || !p.isEdited));
        } else {
          setProducts(prev => prev.map(p => {
            if (updatedIds.has(p.id) && p.isEdited) {
              return { ...p, cost: p.newCost!, newCost: null, isEdited: false };
            }
            return p;
          }));
        }
        onSaved?.();
      }
    } catch (e) {
      setError('Error al guardar cambios');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleBreakdownSaved = () => {
    loadProducts();
    onSaved?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-900">
                Gestionar Costos de Productos
              </h2>
              <p className="text-sm text-stone-500">
                {viewMode === 'missing_cost'
                  ? `${products.length} productos sin costo definido`
                  : `${products.length} productos activos (${products.filter(p => !p.cost).length} sin costo)`
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View mode toggle */}
        <div className="px-6 py-2 border-b border-stone-100 flex gap-1">
          <button
            onClick={() => setViewMode('missing_cost')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
              viewMode === 'missing_cost'
                ? 'bg-amber-100 text-amber-800'
                : 'text-stone-500 hover:bg-stone-100'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            Sin costo
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
              viewMode === 'all'
                ? 'bg-brand-100 text-brand-700'
                : 'text-stone-500 hover:bg-stone-100'
            }`}
          >
            <List className="w-4 h-4" />
            Todos los productos
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-stone-100 bg-stone-50">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o codigo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-stone-400" />
              <select
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-400/30"
              >
                <option value="all">Todos los colegios</option>
                <option value="global">Productos Globales</option>
                {schools.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-stone-500">
              {products.length === 0
                ? 'Todos los productos tienen costo asignado'
                : 'No se encontraron productos con los filtros aplicados'
              }
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-stone-600">
                  Mostrando {filteredProducts.length} productos
                </span>
              </div>

              <div className="border border-stone-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-stone-600">Producto</th>
                      <th className="text-left px-4 py-3 font-medium text-stone-600">Colegio</th>
                      <th className="text-right px-4 py-3 font-medium text-stone-600">Precio</th>
                      <th className="text-right px-4 py-3 font-medium text-stone-600">Costo Actual</th>
                      <th className="text-right px-4 py-3 font-medium text-stone-600">Costo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredProducts.map(product => {
                      const purchased = isPurchased(product.cost_type);
                      return (
                        <tr
                          key={product.id}
                          className={product.isEdited ? 'bg-brand-50' : 'hover:bg-stone-50'}
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-stone-900">{product.name}</p>
                              <p className="text-xs text-stone-500">{product.code}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-stone-600">
                            {product.isGlobal ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                                Global
                              </span>
                            ) : (
                              product.school_name || '-'
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-stone-900">
                            {formatCurrency(product.price)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {product.cost ? (
                              <span className="text-stone-900">{formatCurrency(product.cost)}</span>
                            ) : (
                              <span className="text-amber-500 text-xs font-medium">Sin costo</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {purchased ? (
                              canEditCosts ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="100"
                                  value={product.newCost ?? ''}
                                  onChange={(e) => handleCostChange(product.id, e.target.value)}
                                  placeholder="0"
                                  className={`w-full text-right px-3 py-1.5 border rounded focus:ring-2 focus:ring-brand-400/30 ${
                                    product.isEdited
                                      ? 'border-brand-300 bg-brand-50'
                                      : 'border-stone-200'
                                  }`}
                                />
                              ) : (
                                <span className="block text-right text-stone-400 text-xs">Compra directa</span>
                              )
                            ) : (
                              <div className="flex justify-end">
                                <button
                                  onClick={() => openBreakdown(product)}
                                  disabled={!canViewBreakdown}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={canViewBreakdown ? 'Ver desglose de costos por componente' : 'Sin permiso para ver costos'}
                                >
                                  <Layers className="w-3.5 h-3.5" />
                                  Ver desglose
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="text-sm text-stone-600">
            {editedCount > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-brand-500" />
                {editedCount} producto(s) modificado(s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg"
            >
              Cancelar
            </button>
            {canEditCosts && (
              <button
                onClick={handleSave}
                disabled={saving || editedCount === 0}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Guardar Cambios
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Desglose por componentes (manufacturados) */}
      {breakdownTarget && (
        <CostBreakdownModal
          isOpen={true}
          onClose={() => setBreakdownTarget(null)}
          schoolId={breakdownTarget.schoolId}
          garmentTypeId={breakdownTarget.garmentTypeId}
          garmentTypeName={breakdownTarget.garmentTypeName}
          isGlobal={breakdownTarget.isGlobal}
          onCostsSaved={handleBreakdownSaved}
        />
      )}
    </div>
  );
};

export default ProductCostManager;
