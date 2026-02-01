/**
 * ProductSelectorModal - Professional product selection component
 * Features: Search, filters, grid/list view, stock indicators
 */
import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Package,
  Grid3x3,
  List,
  ChevronDown,
  Check,
  AlertTriangle,
  Plus,
  Loader2,
} from 'lucide-react';
import { productService } from '../services/productService';
import type { Product, GlobalProduct, GarmentType, GlobalGarmentType } from '../types/api';

interface ProductSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: Product | GlobalProduct, quantity?: number) => void;
  schoolId: string;

  // Filtering configuration
  filterByStock?: 'with_stock' | 'without_stock' | 'all';
  allowGlobalProducts?: boolean;
  excludeProductIds?: string[];
  excludeGarmentTypeIds?: string[]; // Exclude products from these garment types
  includeProductIds?: string[]; // If provided, only show these products

  // UI customization
  title?: string;
  emptyMessage?: string;
}

export default function ProductSelectorModal({
  isOpen,
  onClose,
  onSelect,
  schoolId,
  filterByStock = 'all',
  allowGlobalProducts = false,
  excludeProductIds = [],
  excludeGarmentTypeIds = [],
  includeProductIds,
  title = 'Seleccionar Producto',
  emptyMessage = 'No se encontraron productos',
}: ProductSelectorModalProps) {
  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [productSource, setProductSource] = useState<'school' | 'global'>('school');
  const [showFilters, setShowFilters] = useState(false);

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [garmentTypeFilter, setGarmentTypeFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [globalProducts, setGlobalProducts] = useState<GlobalProduct[]>([]);
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [globalGarmentTypes, setGlobalGarmentTypes] = useState<GlobalGarmentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quantity tracking for quick add
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Load data when modal opens
  useEffect(() => {
    if (isOpen && schoolId) {
      loadData();
    }
  }, [isOpen, schoolId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load school products, global products (if allowed), and garment types in parallel
      const promises: Promise<any>[] = [
        productService.getProducts(schoolId, true), // with inventory
        productService.getGarmentTypes(schoolId),
      ];

      if (allowGlobalProducts) {
        promises.push(productService.getGlobalProducts(true)); // with inventory
        promises.push(productService.getGlobalGarmentTypes()); // global garment types
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

  // Get garment type name for a product (checks both school and global types)
  const getGarmentTypeName = (garmentTypeId: string, isGlobal: boolean = false): string => {
    if (isGlobal) {
      return globalGarmentTypes.find(gt => gt.id === garmentTypeId)?.name || 'Sin tipo';
    }
    return garmentTypes.find(gt => gt.id === garmentTypeId)?.name || 'Sin tipo';
  };

  // Get current garment types based on product source
  const currentGarmentTypes = useMemo(() => {
    return productSource === 'school' ? garmentTypes : globalGarmentTypes;
  }, [productSource, garmentTypes, globalGarmentTypes]);

  // Filtered products based on all filters
  const filteredProducts = useMemo(() => {
    let filtered: (Product | GlobalProduct)[] =
      productSource === 'school' ? products : globalProducts;

    // Include only specific products (if provided) - takes precedence
    if (includeProductIds && includeProductIds.length > 0) {
      filtered = filtered.filter(p => includeProductIds.includes(p.id));
    }

    // Stock filter (based on prop)
    if (filterByStock === 'with_stock') {
      filtered = filtered.filter(p => (p.stock ?? p.inventory_quantity ?? 0) > 0);
    } else if (filterByStock === 'without_stock') {
      filtered = filtered.filter(p => (p.stock ?? p.inventory_quantity ?? 0) === 0);
    }

    // Exclude already selected products
    if (excludeProductIds.length > 0) {
      filtered = filtered.filter(p => !excludeProductIds.includes(p.id));
    }

    // Exclude products from specific garment types (e.g., yombers)
    if (excludeGarmentTypeIds.length > 0) {
      filtered = filtered.filter(p => !excludeGarmentTypeIds.includes(p.garment_type_id));
    }

    // Search query (fuzzy)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const isGlobal = productSource === 'global';
      filtered = filtered.filter(
        p =>
          p.code.toLowerCase().includes(query) ||
          (p.name && p.name.toLowerCase().includes(query)) ||
          p.size.toLowerCase().includes(query) ||
          (p.color && p.color.toLowerCase().includes(query)) ||
          getGarmentTypeName(p.garment_type_id, isGlobal).toLowerCase().includes(query)
      );
    }

    // Garment type filter
    if (garmentTypeFilter) {
      filtered = filtered.filter(p => p.garment_type_id === garmentTypeFilter);
    }

    // Size filter
    if (sizeFilter) {
      filtered = filtered.filter(p => p.size === sizeFilter);
    }

    // Color filter
    if (colorFilter) {
      filtered = filtered.filter(p => p.color === colorFilter);
    }

    return filtered;
  }, [
    products,
    globalProducts,
    productSource,
    filterByStock,
    excludeProductIds,
    excludeGarmentTypeIds,
    includeProductIds,
    searchQuery,
    garmentTypeFilter,
    sizeFilter,
    colorFilter,
    garmentTypes,
  ]);

  // Get available sizes dynamically
  const availableSizes = useMemo(() => {
    const sizes = new Set<string>();
    (productSource === 'school' ? products : globalProducts).forEach(p => {
      if (p.size) sizes.add(p.size);
    });
    return Array.from(sizes).sort();
  }, [products, globalProducts, productSource]);

  // Get available colors dynamically
  const availableColors = useMemo(() => {
    const colors = new Set<string>();
    (productSource === 'school' ? products : globalProducts).forEach(p => {
      if (p.color) colors.add(p.color);
    });
    return Array.from(colors).sort();
  }, [products, globalProducts, productSource]);

  const handleSelect = (product: Product | GlobalProduct) => {
    const quantity = quantities[product.id] || 1;
    onSelect(product, quantity);
  };

  const handleSetQuantity = (productId: string, quantity: number) => {
    setQuantities(prev => ({ ...prev, [productId]: Math.max(1, quantity) }));
  };

  const handleClose = () => {
    // Reset state
    setSearchQuery('');
    setGarmentTypeFilter('');
    setSizeFilter('');
    setColorFilter('');
    setQuantities({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleClose} />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[85vh] flex flex-col">
          {/* Header - Sticky */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <Package className="w-6 h-6 mr-2 text-blue-600" />
              {title}
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Search and View Toggle */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por código, nombre, talla, color..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition ${
                    viewMode === 'grid'
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Vista Grid"
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded transition ${
                    viewMode === 'list'
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Vista Lista"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Filters Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition flex items-center gap-2"
              >
                Filtros
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-3 gap-3">
                {/* Garment Type Filter */}
                <select
                  value={garmentTypeFilter}
                  onChange={e => setGarmentTypeFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="">Todos los tipos</option>
                  {currentGarmentTypes.map(gt => (
                    <option key={gt.id} value={gt.id}>
                      {gt.name}
                    </option>
                  ))}
                </select>

                {/* Size Filter */}
                <select
                  value={sizeFilter}
                  onChange={e => setSizeFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="">Todas las tallas</option>
                  {availableSizes.map(size => (
                    <option key={size} value={size}>
                      Talla: {size}
                    </option>
                  ))}
                </select>

                {/* Color Filter */}
                <select
                  value={colorFilter}
                  onChange={e => setColorFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="">Todos los colores</option>
                  {availableColors.map(color => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Tabs - Product Source */}
          {allowGlobalProducts && (
            <div className="flex border-b border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setProductSource('school');
                  setGarmentTypeFilter(''); // Reset filter when changing tabs
                }}
                className={`flex-1 px-6 py-3 text-sm font-medium transition ${
                  productSource === 'school'
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                📦 Productos del Colegio ({products.length})
              </button>
              <button
                onClick={() => {
                  setProductSource('global');
                  setGarmentTypeFilter(''); // Reset filter when changing tabs
                }}
                className={`flex-1 px-6 py-3 text-sm font-medium transition ${
                  productSource === 'global'
                    ? 'border-b-2 border-purple-600 text-purple-600 bg-white'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                🌐 Productos Globales ({globalProducts.length})
              </button>
            </div>
          )}

          {/* Content Area - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
                <p className="text-gray-600">Cargando productos...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="w-12 h-12 text-red-600 mb-3" />
                <p className="text-red-700 font-medium">{error}</p>
                <button
                  onClick={loadData}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Reintentar
                </button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Package className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-600 font-medium">{emptyMessage}</p>
                {(searchQuery || garmentTypeFilter || sizeFilter || colorFilter) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setGarmentTypeFilter('');
                      setSizeFilter('');
                      setColorFilter('');
                    }}
                    className="mt-4 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map(product => (
                  <ProductCardGrid
                    key={product.id}
                    product={product}
                    garmentTypeName={getGarmentTypeName(product.garment_type_id, productSource === 'global')}
                    quantity={quantities[product.id] || 1}
                    onSetQuantity={handleSetQuantity}
                    onSelect={handleSelect}
                    isGlobal={productSource === 'global'}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProducts.map(product => (
                  <ProductCardList
                    key={product.id}
                    product={product}
                    garmentTypeName={getGarmentTypeName(product.garment_type_id, productSource === 'global')}
                    quantity={quantities[product.id] || 1}
                    onSetQuantity={handleSetQuantity}
                    onSelect={handleSelect}
                    isGlobal={productSource === 'global'}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 text-sm text-gray-600 text-center">
            Mostrando {filteredProducts.length} producto{filteredProducts.length !== 1 && 's'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== GRID VIEW CARD =====
interface ProductCardProps {
  product: Product | GlobalProduct;
  garmentTypeName: string;
  quantity: number;
  onSetQuantity: (productId: string, quantity: number) => void;
  onSelect: (product: Product | GlobalProduct) => void;
  isGlobal: boolean;
}

function ProductCardGrid({
  product,
  garmentTypeName,
  quantity,
  onSetQuantity,
  onSelect,
  isGlobal: _isGlobal,
}: ProductCardProps) {
  const stock = product.stock ?? product.inventory_quantity ?? 0;
  const minStock = (product as any).min_stock ?? (product as any).inventory_min_stock ?? 5;

  return (
    <div className="group relative bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer">
      {/* Image Placeholder */}
      <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden flex items-center justify-center">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.code}
            className="w-full h-full object-cover"
          />
        ) : (
          <Package className="w-12 h-12 text-gray-300" />
        )}
      </div>

      {/* Code */}
      <p className="text-xs font-mono text-gray-500 mb-1">{product.code}</p>

      {/* Name/Type */}
      <p className="font-semibold text-gray-900 text-sm mb-2 truncate" title={product.name || garmentTypeName}>
        {product.name || garmentTypeName}
      </p>

      {/* Attributes */}
      <div className="flex flex-wrap gap-1 mb-2">
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
          Talla: {product.size}
        </span>
        {product.color && (
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
            {product.color}
          </span>
        )}
      </div>

      {/* Price */}
      <p className="text-lg font-bold text-green-600 mb-2">
        ${Number(product.price).toLocaleString()}
      </p>

      {/* Stock indicator */}
      <div className="flex items-center gap-1 text-sm mb-2">
        {stock > minStock ? (
          <>
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-green-600">{stock} uds</span>
          </>
        ) : stock > 0 ? (
          <>
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <span className="text-yellow-600">{stock} uds</span>
          </>
        ) : (
          <>
            <X className="w-4 h-4 text-red-600" />
            <span className="text-red-600">Sin stock</span>
          </>
        )}
      </div>

      {/* Hover overlay with quantity selector */}
      <div className="absolute inset-0 bg-blue-600 bg-opacity-95 rounded-lg p-4 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <label htmlFor={`qty-${product.id}`} className="text-white text-sm mb-2">Cantidad:</label>
        <input
          id={`qty-${product.id}`}
          type="number"
          min="1"
          value={quantity}
          onChange={e => onSetQuantity(product.id, parseInt(e.target.value) || 1)}
          onClick={e => e.stopPropagation()}
          onFocus={e => e.target.select()}
          className="w-20 px-2 py-1 text-center border rounded mb-3 focus:ring-2 focus:ring-white focus:border-transparent outline-none"
        />
        <button
          onClick={e => {
            e.stopPropagation();
            onSelect(product);
          }}
          className="w-full px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-gray-100 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Agregar
        </button>
      </div>
    </div>
  );
}

// ===== LIST VIEW CARD =====
function ProductCardList({
  product,
  garmentTypeName,
  quantity,
  onSetQuantity,
  onSelect,
  isGlobal: _isGlobal,
}: ProductCardProps) {
  const stock = product.stock ?? product.inventory_quantity ?? 0;
  const minStock = (product as any).min_stock ?? (product as any).inventory_min_stock ?? 5;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all flex items-center gap-4">
      {/* Image Placeholder */}
      <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.code} className="w-full h-full object-cover" />
        ) : (
          <Package className="w-8 h-8 text-gray-300" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs font-mono text-gray-500">{product.code}</p>
            <p className="font-semibold text-gray-900 truncate">{product.name || garmentTypeName}</p>
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="text-xs text-gray-600">Talla: {product.size}</span>
              {product.color && <span className="text-xs text-gray-600">• {product.color}</span>}
            </div>
          </div>

          {/* Price and Stock */}
          <div className="text-right">
            <p className="text-lg font-bold text-green-600">${Number(product.price).toLocaleString()}</p>
            <div className="flex items-center justify-end gap-1 mt-1">
              {stock > minStock ? (
                <>
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600">{stock} uds</span>
                </>
              ) : stock > 0 ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-600">{stock} uds</span>
                </>
              ) : (
                <>
                  <X className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-600">Sin stock</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={e => onSetQuantity(product.id, parseInt(e.target.value) || 1)}
          className="w-16 px-2 py-1 text-center border border-gray-300 rounded"
        />
        <button
          onClick={() => onSelect(product)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Agregar
        </button>
      </div>
    </div>
  );
}
