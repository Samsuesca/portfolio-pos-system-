'use client';

/**
 * ProductGroupSelector - Modal for selecting products grouped by garment type
 *
 * Shows products organized by category with size/color selection
 */

import { useState, useEffect, useMemo } from 'react';
import { X, Search, Loader2, Package, Filter, Building2, Globe, CheckCircle } from 'lucide-react';
import productService from '@/lib/services/productService';
import type { Product, GarmentType, GlobalProduct, GlobalGarmentType } from '@/lib/api';
import {
  groupProductsByGarmentType,
  groupGlobalProductsByGarmentType,
  type ProductVariant,
  type ProductGroup,
} from '@/lib/utils/productGrouping';
import ProductGroupCard from './ProductGroupCard';

interface ProductGroupSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: Product | GlobalProduct, quantity: number, isGlobal?: boolean) => void;
  schoolId: string;

  // Filtering options
  filterByStock?: 'with_stock' | 'without_stock' | 'all';
  allowGlobalProducts?: boolean;
  initialProductSource?: 'school' | 'global';
  excludeProductIds?: string[];
  excludeGarmentTypeIds?: string[];
  includeGarmentTypeIds?: string[];

  // UI customization
  title?: string;
  emptyMessage?: string;
}

export default function ProductGroupSelector({
  isOpen,
  onClose,
  onSelect,
  schoolId,
  filterByStock = 'all',
  allowGlobalProducts = false,
  initialProductSource = 'school',
  excludeProductIds = [],
  excludeGarmentTypeIds = [],
  includeGarmentTypeIds,
  title = 'Seleccionar Producto',
  emptyMessage = 'No se encontraron productos',
}: ProductGroupSelectorProps) {
  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [globalProducts, setGlobalProducts] = useState<GlobalProduct[]>([]);
  const [globalGarmentTypes, setGlobalGarmentTypes] = useState<GlobalGarmentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [productSource, setProductSource] = useState<'school' | 'global'>(initialProductSource);

  // Multi-select tracking state
  const [addedProducts, setAddedProducts] = useState<Map<string, number>>(new Map());

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setProductSource(initialProductSource);
      setCategoryFilter('');
      setAddedProducts(new Map());
    }
  }, [isOpen, initialProductSource]);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen && schoolId) {
      loadData();
    }
  }, [isOpen, schoolId, allowGlobalProducts]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const promises: Promise<any>[] = [
        productService.getProducts(schoolId, true),
        productService.getGarmentTypes(schoolId),
      ];

      if (allowGlobalProducts) {
        promises.push(productService.getGlobalProducts(true));
        promises.push(productService.getGlobalGarmentTypes());
      }

      const results = await Promise.all(promises);

      setProducts(results[0] || []);
      setGarmentTypes(results[1] || []);

      if (allowGlobalProducts) {
        setGlobalProducts(results[2] || []);
        setGlobalGarmentTypes(results[3] || []);
      }
    } catch (err: any) {
      console.error('Error loading products:', err);
      setError('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  // Current garment types based on product source
  const currentGarmentTypes = useMemo(() => {
    let types: (GarmentType | GlobalGarmentType)[] =
      productSource === 'global' ? globalGarmentTypes : garmentTypes;

    if (includeGarmentTypeIds && includeGarmentTypeIds.length > 0) {
      types = types.filter((gt) => includeGarmentTypeIds.includes(gt.id));
    }

    types = types.filter((gt) => !excludeGarmentTypeIds.includes(gt.id));

    return types;
  }, [
    productSource,
    garmentTypes,
    globalGarmentTypes,
    excludeGarmentTypeIds,
    includeGarmentTypeIds,
  ]);

  // Group products by garment type
  const productGroups = useMemo(() => {
    const shouldIncludeGarmentType = (garmentTypeId: string) => {
      if (includeGarmentTypeIds && includeGarmentTypeIds.length > 0) {
        if (!includeGarmentTypeIds.includes(garmentTypeId)) return false;
      }
      if (excludeGarmentTypeIds.includes(garmentTypeId)) return false;
      return true;
    };

    if (productSource === 'global') {
      const filteredGlobalProducts = globalProducts.filter((p) =>
        shouldIncludeGarmentType(p.garment_type_id)
      );
      return groupGlobalProductsByGarmentType(filteredGlobalProducts, globalGarmentTypes);
    }

    const filteredGarmentTypes = garmentTypes.filter((gt) => shouldIncludeGarmentType(gt.id));

    const filteredProducts = products.filter((p) => shouldIncludeGarmentType(p.garment_type_id));

    return groupProductsByGarmentType(filteredProducts, filteredGarmentTypes);
  }, [
    productSource,
    products,
    garmentTypes,
    globalProducts,
    globalGarmentTypes,
    excludeGarmentTypeIds,
    includeGarmentTypeIds,
  ]);

  // Apply search and category filters
  const filteredGroups = useMemo(() => {
    let filtered = productGroups;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (group) =>
          group.garmentTypeName.toLowerCase().includes(query) ||
          group.variants.some(
            (v) =>
              v.productCode.toLowerCase().includes(query) ||
              (v.color && v.color.toLowerCase().includes(query))
          )
      );
    }

    if (categoryFilter) {
      filtered = filtered.filter((group) => group.garmentTypeId === categoryFilter);
    }

    if (filterByStock === 'with_stock') {
      filtered = filtered.filter((group) =>
        group.variants.some((v) => v.stock > 0 && !excludeProductIds.includes(v.productId))
      );
    } else if (filterByStock === 'without_stock') {
      filtered = filtered.filter((group) =>
        group.variants.some((v) => v.stock === 0 && !excludeProductIds.includes(v.productId))
      );
    }

    return filtered;
  }, [productGroups, searchQuery, categoryFilter, filterByStock, excludeProductIds]);

  // Handle variant selection
  const handleVariantSelect = (variant: ProductVariant, quantity: number) => {
    setAddedProducts((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(variant.productId) || 0;
      newMap.set(variant.productId, current + quantity);
      return newMap;
    });

    if (productSource === 'global') {
      const globalProduct = globalProducts.find((p) => p.id === variant.productId);
      if (globalProduct) {
        onSelect(globalProduct, quantity, true);
      }
    } else {
      const product = products.find((p) => p.id === variant.productId);
      if (product) {
        onSelect(product, quantity, false);
      }
    }
  };

  // Calculate total items added in this session
  const totalAddedCount = useMemo(() => {
    let total = 0;
    addedProducts.forEach((qty) => (total += qty));
    return total;
  }, [addedProducts]);

  // Get added quantity for a specific group
  const getGroupAddedQuantity = (group: ProductGroup): number => {
    let total = 0;
    group.variants.forEach((v) => {
      const qty = addedProducts.get(v.productId);
      if (qty) total += qty;
    });
    return total;
  };

  const handleClose = () => {
    setSearchQuery('');
    setCategoryFilter('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <Package className="w-6 h-6 mr-2 text-blue-600" />
              {title}
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition p-1 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Product Source Tabs */}
          {allowGlobalProducts && (
            <div className="flex border-b border-gray-200 flex-shrink-0">
              <button
                onClick={() => {
                  setProductSource('school');
                  setCategoryFilter('');
                }}
                className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  productSource === 'school'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Productos del Colegio ({products.length})
              </button>
              <button
                onClick={() => {
                  setProductSource('global');
                  setCategoryFilter('');
                }}
                className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  productSource === 'global'
                    ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Globe className="w-4 h-4" />
                Productos Globales ({globalProducts.length})
              </button>
            </div>
          )}

          {/* Search & Filters */}
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, codigo, color..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="pl-9 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white min-w-[180px]"
                >
                  <option value="">Todas las categorias</option>
                  {currentGarmentTypes.map((gt) => (
                    <option key={gt.id} value={gt.id}>
                      {gt.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
                <p className="text-gray-600">Cargando productos...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-red-100 text-red-700 px-6 py-4 rounded-lg">
                  <p className="font-medium">{error}</p>
                  <button
                    onClick={loadData}
                    className="mt-3 text-sm underline hover:no-underline"
                  >
                    Reintentar
                  </button>
                </div>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Package className="w-16 h-16 text-gray-300 mb-4" />
                <p className="text-gray-600 font-medium text-lg">{emptyMessage}</p>
                {(searchQuery || categoryFilter) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('');
                    }}
                    className="mt-4 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGroups.map((group) => (
                  <ProductGroupCard
                    key={group.garmentTypeId}
                    group={group}
                    onSelect={handleVariantSelect}
                    excludeProductIds={excludeProductIds}
                    filterByStock={filterByStock}
                    addedQuantity={getGroupAddedQuantity(group)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                {totalAddedCount > 0 ? (
                  <span className="text-green-600 font-medium flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    {totalAddedCount} producto{totalAddedCount !== 1 && 's'} agregado
                    {totalAddedCount !== 1 && 's'}
                  </span>
                ) : (
                  <span className="text-gray-500">
                    {filteredGroups.length} tipo{filteredGroups.length !== 1 && 's'} de producto
                    {searchQuery || categoryFilter ? ' (filtrado)' : ''}
                  </span>
                )}
              </div>
              <button
                onClick={handleClose}
                className={`px-5 py-2 rounded-lg font-medium transition-colors ${
                  totalAddedCount > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {totalAddedCount > 0 ? 'Listo' : 'Cerrar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
