/**
 * ProductGroupSelector - Modal for selecting products grouped by garment type
 *
 * Replaces the old ProductSelectorModal with a cleaner UI that groups products
 * Similar to the web portal's product selection experience
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, Loader2, Package, Filter, Building2, Globe, CheckCircle } from 'lucide-react';
import Fuse from 'fuse.js';
import { productService } from '../services/productService';
import type { Product, GarmentType } from '../types/api';
import { groupProductsByGarmentType, groupGlobalProductsByGarmentType, type ProductVariant, type ProductGroup } from '../utils/productGrouping';
import ProductGroupCard from './ProductGroupCard';
import { expandQueryWithSynonyms } from '../utils/productSynonyms';

interface ProductGroupSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: Product, quantity: number, isGlobal?: boolean) => void;
  schoolId: string;

  // Filtering options
  filterByStock?: 'with_stock' | 'without_stock' | 'all';
  allowGlobalProducts?: boolean;
  initialProductSource?: 'school' | 'global';
  excludeProductIds?: string[];
  excludeGarmentTypeIds?: string[];
  includeGarmentTypeIds?: string[]; // Only show these garment types (for Yomber filtering)

  // Stock validation - map of productId -> quantity already selected in sale
  selectedQuantities?: Map<string, number>;
  isHistoricalSale?: boolean; // Skip stock validation for historical sales
  enforceStockLimit?: boolean; // Block quantity from exceeding available stock in ProductGroupCard

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
  enforceStockLimit = false,
  title = 'Seleccionar Producto',
  emptyMessage = 'No se encontraron productos',
}: ProductGroupSelectorProps) {
  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [globalProducts, setGlobalProducts] = useState<Product[]>([]);
  const [globalGarmentTypes, setGlobalGarmentTypes] = useState<GarmentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [productSource, setProductSource] = useState<'school' | 'global'>(initialProductSource);

  // Multi-select tracking state
  const [addedProducts, setAddedProducts] = useState<Map<string, number>>(new Map());

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setProductSource(initialProductSource);
      setCategoryFilter(''); // Reset category when source changes
      setAddedProducts(new Map()); // Reset added products counter
      setTimeout(() => searchInputRef.current?.focus(), 100);
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

      // Build list of promises
      const promises: Promise<any>[] = [
        productService.getProducts(schoolId, true), // with inventory
        productService.getGarmentTypes(schoolId),
      ];

      // Also load global products if enabled
      if (allowGlobalProducts) {
        promises.push(productService.getGlobalProducts(true));
        promises.push(productService.getGlobalGarmentTypes());
      }

      const results = await Promise.all(promises);

      setProducts(results[0] || []);
      setGarmentTypes(results[1] || []);

      if (allowGlobalProducts) {
        const gp = results[2];
        const ggt = results[3];
        setGlobalProducts(Array.isArray(gp) ? gp : gp?.items || []);
        setGlobalGarmentTypes(Array.isArray(ggt) ? ggt : ggt?.items || []);
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
    let types = productSource === 'global' ? globalGarmentTypes : garmentTypes;

    // Apply include filter (if set, ONLY show these types)
    if (includeGarmentTypeIds && includeGarmentTypeIds.length > 0) {
      types = types.filter(gt => includeGarmentTypeIds.includes(gt.id));
    }

    // Apply exclude filter
    types = types.filter(gt => !excludeGarmentTypeIds.includes(gt.id));

    return types;
  }, [productSource, garmentTypes, globalGarmentTypes, excludeGarmentTypeIds, includeGarmentTypeIds]);

  // Group products by garment type
  const productGroups = useMemo(() => {
    // Helper to check if garment type should be included
    const shouldIncludeGarmentType = (garmentTypeId: string) => {
      // If includeGarmentTypeIds is set, ONLY include those
      if (includeGarmentTypeIds && includeGarmentTypeIds.length > 0) {
        if (!includeGarmentTypeIds.includes(garmentTypeId)) return false;
      }
      // Apply exclude filter
      if (excludeGarmentTypeIds.includes(garmentTypeId)) return false;
      return true;
    };

    if (productSource === 'global') {
      // Group global products
      const filteredGlobalProducts = globalProducts.filter(p =>
        shouldIncludeGarmentType(p.garment_type_id)
      );
      return groupGlobalProductsByGarmentType(filteredGlobalProducts, globalGarmentTypes);
    }

    // Group school products
    const filteredGarmentTypes = garmentTypes.filter(gt =>
      shouldIncludeGarmentType(gt.id)
    );

    // Filter products by garment type rules
    const filteredProducts = products.filter(p =>
      shouldIncludeGarmentType(p.garment_type_id)
    );

    return groupProductsByGarmentType(filteredProducts, filteredGarmentTypes);
  }, [productSource, products, garmentTypes, globalProducts, globalGarmentTypes, excludeGarmentTypeIds, includeGarmentTypeIds]);

  // Fuse.js index for fuzzy search
  const fuseIndex = useMemo(() => {
    const flatItems = productGroups.map(group => ({
      garmentTypeName: group.garmentTypeName,
      garmentTypeId: group.garmentTypeId,
      variantText: group.variants.map(v => [v.productCode, v.color].filter(Boolean).join(' ')).join(' '),
    }));
    return new Fuse(flatItems, {
      keys: ['garmentTypeName', 'variantText'],
      threshold: 0.4,
      ignoreLocation: true,
    });
  }, [productGroups]);

  // Apply search and category filters
  const filteredGroups = useMemo(() => {
    let filtered = productGroups;

    // Fuzzy search with synonym expansion
    if (searchQuery.trim()) {
      const expandedTerms = expandQueryWithSynonyms(searchQuery);
      const matchedIds = new Set<string>();

      for (const term of expandedTerms) {
        const results = fuseIndex.search(term);
        results.forEach(r => matchedIds.add(r.item.garmentTypeId));
      }

      // Also keep exact substring matches as fallback (product codes, etc.)
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(group =>
        matchedIds.has(group.garmentTypeId) ||
        group.garmentTypeName.toLowerCase().includes(lowerQuery) ||
        group.variants.some(v =>
          v.productCode.toLowerCase().includes(lowerQuery) ||
          (v.color && v.color.toLowerCase().includes(lowerQuery))
        )
      );
    }

    // Category filter
    if (categoryFilter) {
      filtered = filtered.filter(group => group.garmentTypeId === categoryFilter);
    }

    // Stock filter - remove groups with no matching variants
    if (filterByStock === 'with_stock') {
      filtered = filtered.filter(group =>
        group.variants.some(v => v.stock > 0 && !excludeProductIds.includes(v.productId))
      );
    } else if (filterByStock === 'without_stock') {
      filtered = filtered.filter(group =>
        group.variants.some(v => v.stock === 0 && !excludeProductIds.includes(v.productId))
      );
    }

    return filtered;
  }, [productGroups, searchQuery, categoryFilter, filterByStock, excludeProductIds, fuseIndex]);

  // Handle variant selection
  const handleVariantSelect = (variant: ProductVariant, quantity: number) => {
    // Update added products counter for visual feedback
    setAddedProducts(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(variant.productId) || 0;
      newMap.set(variant.productId, current + quantity);
      return newMap;
    });

    if (productSource === 'global') {
      // Find the global product object
      const globalProduct = globalProducts.find(p => p.id === variant.productId);
      if (globalProduct) {
        onSelect(globalProduct, quantity, true);
      }
    } else {
      // Find the school product object
      const product = products.find(p => p.id === variant.productId);
      if (product) {
        onSelect(product, quantity, false);
      }
    }
  };

  // Calculate total items added in this session
  const totalAddedCount = useMemo(() => {
    let total = 0;
    addedProducts.forEach(qty => total += qty);
    return total;
  }, [addedProducts]);

  // Get added quantity for a specific group (sum of all variants in that group)
  const getGroupAddedQuantity = (group: ProductGroup): number => {
    let total = 0;
    group.variants.forEach(v => {
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
          <div className="flex items-center justify-between p-5 border-b border-stone-200 flex-shrink-0">
            <h2 className="text-xl font-bold text-stone-800 flex items-center">
              <Package className="w-6 h-6 mr-2 text-brand-600" />
              {title}
            </h2>
            <button
              onClick={handleClose}
              className="text-stone-400 hover:text-stone-600 transition p-1 hover:bg-stone-100 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Product Source Tabs (only if global products enabled) */}
          {allowGlobalProducts && (
            <div className="flex border-b border-stone-200 flex-shrink-0">
              <button
                onClick={() => {
                  setProductSource('school');
                  setCategoryFilter('');
                }}
                className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  productSource === 'school'
                    ? 'text-brand-600 border-b-2 border-brand-500 bg-brand-50'
                    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
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
                    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
                }`}
              >
                <Globe className="w-4 h-4" />
                Productos Globales ({globalProducts.length})
              </button>
            </div>
          )}

          {/* Search & Filters */}
          <div className="p-4 border-b border-stone-200 bg-stone-50 flex-shrink-0">
            <div className="flex gap-3">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar por nombre, codigo, color..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
                />
              </div>

              {/* Category Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="pl-9 pr-8 py-2.5 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 outline-none appearance-none bg-white min-w-[180px]"
                >
                  <option value="">Todas las categorias</option>
                  {currentGarmentTypes.map(gt => (
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
                <Loader2 className="w-10 h-10 animate-spin text-brand-600 mb-4" />
                <p className="text-stone-600">Cargando productos...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-red-50 text-red-700 ring-1 ring-red-200 px-6 py-4 rounded-lg">
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
                <Package className="w-16 h-16 text-stone-300 mb-4" />
                <p className="text-stone-600 font-medium text-lg">{emptyMessage}</p>
                {(searchQuery || categoryFilter) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('');
                    }}
                    className="mt-4 px-4 py-2 text-brand-600 hover:bg-brand-50 rounded-lg transition"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGroups.map(group => (
                  <ProductGroupCard
                    key={group.garmentTypeId}
                    group={group}
                    onSelect={handleVariantSelect}
                    excludeProductIds={excludeProductIds}
                    filterByStock={filterByStock}
                    addedQuantity={getGroupAddedQuantity(group)}
                    enforceStockLimit={enforceStockLimit}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer with counter and "Listo" button */}
          <div className="p-4 border-t border-stone-200 bg-white flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                {totalAddedCount > 0 ? (
                  <span className="text-green-600 font-medium flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    {totalAddedCount} producto{totalAddedCount !== 1 && 's'} agregado{totalAddedCount !== 1 && 's'}
                  </span>
                ) : (
                  <span className="text-stone-500">
                    {filteredGroups.length} tipo{filteredGroups.length !== 1 && 's'} de producto
                    {searchQuery || categoryFilter ? ' (filtrado)' : ''}
                  </span>
                )}
              </div>
              <button
                onClick={handleClose}
                className={`px-5 py-2 rounded-lg font-medium transition-colors ${
                  totalAddedCount > 0
                    ? 'bg-brand-500 text-white hover:bg-brand-600'
                    : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
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
