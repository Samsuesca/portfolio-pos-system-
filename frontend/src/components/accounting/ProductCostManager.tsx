/**
 * ProductCostManager - Manage product costs for CFO visibility
 *
 * Allows viewing and bulk updating product costs to improve
 * accuracy in COGS and margin calculations.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Search, Save, Loader2, AlertTriangle,
  CheckCircle, X, Calculator, Building2, List, AlertCircle
} from 'lucide-react';
import { productService, type ProductCostUpdate } from '../../services/productService';
import { formatCurrency } from '../../utils/formatting';

type ViewMode = 'missing_cost' | 'all';

interface ProductCostManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialMode?: ViewMode;
}

interface ProductWithSuggestedCost {
  id: string;
  code: string;
  name: string | null;
  price: number;
  cost: number | null;
  school_id?: string;
  school_name?: string;
  isGlobal: boolean;
  suggestedCost: number;
  newCost: number | null;
  isEdited: boolean;
}

const DEFAULT_MARGIN = 0.25; // 25% margin -> cost = price * 0.75

const ProductCostManager: React.FC<ProductCostManagerProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialMode = 'missing_cost'
}) => {
  const [products, setProducts] = useState<ProductWithSuggestedCost[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [margin, setMargin] = useState(DEFAULT_MARGIN);
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);

  // Load products based on view mode
  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen, viewMode]);

  const mapToEnhanced = (p: { id: string; code: string; name: string | null; price: number; cost: number | null; school_id?: string; school_name?: string }, isGlobal: boolean): ProductWithSuggestedCost => ({
    id: p.id,
    code: p.code,
    name: p.name,
    price: p.price,
    cost: p.cost,
    school_id: p.school_id,
    school_name: isGlobal ? 'Global' : p.school_name,
    isGlobal,
    suggestedCost: Math.round(p.price * (1 - DEFAULT_MARGIN)),
    newCost: null,
    isEdited: false,
  });

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      if (viewMode === 'missing_cost') {
        const [schoolData, globalData] = await Promise.all([
          productService.getProductsWithoutCost(),
          productService.getGlobalProducts(false, 500),
        ]);
        const globalWithoutCost = globalData.filter(p => !p.cost || p.cost <= 0);
        setProducts([
          ...schoolData.map(p => mapToEnhanced(p, false)),
          ...globalWithoutCost.map(p => mapToEnhanced(p, true)),
        ]);
      } else {
        // Load both school products and global products
        const [schoolData, globalData] = await Promise.all([
          productService.getAllProducts({ active_only: true, limit: 500 }),
          productService.getGlobalProducts(false, 500),
        ]);
        const schoolEnhanced = schoolData.map(p => mapToEnhanced(p, false));
        const globalEnhanced = globalData.map(p => mapToEnhanced(p, true));
        setProducts([...schoolEnhanced, ...globalEnhanced]);
      }
    } catch (e) {
      setError('Error al cargar productos');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Get unique schools from products
  const schools = useMemo(() => {
    const schoolMap = new Map<string, string>();
    products.forEach(p => {
      if (p.school_id && p.school_name) {
        schoolMap.set(p.school_id, p.school_name);
      }
    });
    return Array.from(schoolMap.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  // Filtered products
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

  // Count of edited products
  const editedCount = products.filter(p => p.isEdited).length;

  // Update cost for a product
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

  // Apply suggested cost to a product
  const applySuggested = (productId: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          newCost: p.suggestedCost,
          isEdited: true
        };
      }
      return p;
    }));
  };

  // Apply suggested cost to all visible products
  const applyAllSuggested = () => {
    setProducts(prev => prev.map(p => {
      if (filteredProducts.some(fp => fp.id === p.id)) {
        return {
          ...p,
          newCost: p.suggestedCost,
          isEdited: true
        };
      }
      return p;
    }));
  };

  // Recalculate suggested costs based on new margin
  const recalculateSuggested = () => {
    setProducts(prev => prev.map(p => ({
      ...p,
      suggestedCost: Math.round(p.price * (1 - margin))
    })));
  };

  // Save changes
  const handleSave = async () => {
    const editedProducts = products.filter(p => p.isEdited && p.newCost !== null && p.newCost > 0);

    if (editedProducts.length === 0) {
      setError('No hay cambios para guardar');
      return;
    }

    // Separate school products from global products
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

      // Bulk update school products
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

      // Update global products individually
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Gestionar Costos de Productos
              </h2>
              <p className="text-sm text-gray-500">
                {viewMode === 'missing_cost'
                  ? `${products.length} productos sin costo definido`
                  : `${products.length} productos activos (${products.filter(p => !p.cost).length} sin costo)`
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View mode toggle */}
        <div className="px-6 py-2 border-b border-gray-100 flex gap-1">
          <button
            onClick={() => setViewMode('missing_cost')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
              viewMode === 'missing_cost'
                ? 'bg-amber-100 text-amber-800'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            Sin costo
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
              viewMode === 'all'
                ? 'bg-blue-100 text-blue-800'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <List className="w-4 h-4" />
            Todos los productos
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o codigo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* School filter */}
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <select
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos los colegios</option>
                <option value="global">Productos Globales</option>
                {schools.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Margin calculator */}
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">Margen:</span>
              <input
                type="number"
                min="0"
                max="100"
                value={margin * 100}
                onChange={(e) => setMargin(parseFloat(e.target.value) / 100 || 0)}
                className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center"
              />
              <span className="text-sm text-gray-600">%</span>
              <button
                onClick={recalculateSuggested}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Recalcular
              </button>
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
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {products.length === 0
                ? 'Todos los productos tienen costo asignado'
                : 'No se encontraron productos con los filtros aplicados'
              }
            </div>
          ) : (
            <>
              {/* Bulk action */}
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Mostrando {filteredProducts.length} productos
                </span>
                <button
                  onClick={applyAllSuggested}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Calculator className="w-4 h-4" />
                  Aplicar sugerido a todos
                </button>
              </div>

              {/* Products table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Producto</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Colegio</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Precio</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Costo Actual</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Sugerido</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Nuevo Costo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProducts.map(product => (
                      <tr
                        key={product.id}
                        className={product.isEdited ? 'bg-blue-50' : 'hover:bg-gray-50'}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{product.name}</p>
                            <p className="text-xs text-gray-500">{product.code}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {product.isGlobal ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Global
                            </span>
                          ) : (
                            product.school_name || '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {formatCurrency(product.price)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {product.cost ? (
                            <span className="text-gray-900">{formatCurrency(product.cost)}</span>
                          ) : (
                            <span className="text-amber-500 text-xs font-medium">Sin costo</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => applySuggested(product.id)}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                            title="Aplicar costo sugerido"
                          >
                            {formatCurrency(product.suggestedCost)}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={product.newCost ?? ''}
                            onChange={(e) => handleCostChange(product.id, e.target.value)}
                            placeholder="0"
                            className={`w-full text-right px-3 py-1.5 border rounded focus:ring-2 focus:ring-blue-500 ${
                              product.isEdited
                                ? 'border-blue-300 bg-blue-50'
                                : 'border-gray-300'
                            }`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {editedCount > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-blue-500" />
                {editedCount} producto(s) modificado(s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || editedCount === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCostManager;
