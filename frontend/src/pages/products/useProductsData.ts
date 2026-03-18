/**
 * Custom hook that encapsulates all data-fetching and filtering logic
 * for the Products page.
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { productService } from '../../services/productService';
import { extractErrorMessage } from '../../utils/api-client';
import { useSchoolStore } from '../../stores/schoolStore';
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import { usePermissions } from '../../hooks/usePermissions';
import type {
  TabType,
  StockFilter,
  SortConfig,
  SortField,
  ProductsStats,
  Product,
  GlobalProduct,
  GarmentType,
  GlobalGarmentType,
} from './types';

const PRODUCTS_LIMIT = 100;

export function useProductsData() {
  const { currentSchool, availableSchools, loadSchools } = useSchoolStore();
  const { user } = useAuthStore();
  const { apiUrl } = useConfigStore();
  const { hasPermission, canManageProducts } = usePermissions();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('school');

  // School products state
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Global products state
  const [globalProducts, setGlobalProducts] = useState<GlobalProduct[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(true);

  // Garment types
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [globalGarmentTypes, setGlobalGarmentTypes] = useState<GlobalGarmentType[]>([]);

  // Common state
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [garmentTypeFilter, setGarmentTypeFilter] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Sorting
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'code', direction: 'asc' });

  // Garment types tab sub-tab state
  const [showGlobalTypes, setShowGlobalTypes] = useState(false);

  // Derived values
  const schoolIdForCreate = schoolFilter || currentSchool?.id || availableSchools[0]?.id || '';
  const isSuperuser = user?.is_superuser || false;
  const canAdjustGlobalInventory = isSuperuser || hasPermission('global_inventory.adjust');
  const canManageGarmentTypes = isSuperuser || hasPermission('settings.manage_garment_types') || canManageProducts;

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Initial load
  useEffect(() => {
    if (availableSchools.length === 0) {
      loadSchools();
    }
    loadProducts();
    loadGlobalProducts();
    loadGarmentTypes();
    loadGlobalGarmentTypes();
  }, []);

  // Reload on filter changes
  useEffect(() => {
    loadProducts();
    loadGarmentTypes();
  }, [schoolFilter, debouncedSearch, garmentTypeFilter]);

  const loadProducts = useCallback(async (append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const skip = append ? products.length : 0;
      const data = await productService.getAllProducts({
        school_id: schoolFilter || undefined,
        search: debouncedSearch || undefined,
        garment_type_id: garmentTypeFilter || undefined,
        with_stock: true,
        skip,
        limit: PRODUCTS_LIMIT,
      });
      if (append) {
        setProducts(prev => [...prev, ...data]);
      } else {
        setProducts(data);
      }
      setHasMoreProducts(data.length === PRODUCTS_LIMIT);
    } catch (err: unknown) {
      console.error('Error loading products:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [schoolFilter, debouncedSearch, garmentTypeFilter, products.length]);

  const loadGlobalProducts = async () => {
    try {
      setLoadingGlobal(true);
      const data = await productService.getGlobalProducts();
      setGlobalProducts(data);
    } catch (err: unknown) {
      console.error('Error loading global products:', err);
    } finally {
      setLoadingGlobal(false);
    }
  };

  const loadGarmentTypes = async () => {
    try {
      const data = await productService.getAllGarmentTypes({
        school_id: schoolFilter || undefined
      });
      setGarmentTypes(data);
    } catch (err: unknown) {
      console.error('Error loading garment types:', err);
    }
  };

  const loadGlobalGarmentTypes = async () => {
    try {
      const data = await productService.getGlobalGarmentTypes();
      setGlobalGarmentTypes(data);
    } catch (err: unknown) {
      console.error('Error loading global garment types:', err);
    }
  };

  // Sorting handler
  const handleSort = useCallback((field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // Filter and sort school products
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products.filter(product => {
      const stock = product.stock ?? product.inventory_quantity ?? 0;
      const minStock = product.min_stock ?? product.inventory_min_stock ?? 5;
      const pendingOrders = product.pending_orders_qty ?? 0;

      const matchesSize = sizeFilter === '' || product.size === sizeFilter;

      let matchesStock = true;
      if (stockFilter === 'in_stock') {
        matchesStock = stock > minStock;
      } else if (stockFilter === 'low_stock') {
        matchesStock = stock > 0 && stock <= minStock;
      } else if (stockFilter === 'out_of_stock') {
        matchesStock = stock === 0;
      } else if (stockFilter === 'with_orders') {
        matchesStock = pendingOrders > 0;
      }

      return matchesSize && matchesStock;
    });

    filtered.sort((a, b) => {
      let aVal: string | number, bVal: string | number;

      switch (sortConfig.field) {
        case 'code':
          aVal = a.code.toLowerCase();
          bVal = b.code.toLowerCase();
          break;
        case 'name':
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
          break;
        case 'size':
          aVal = a.size.toLowerCase();
          bVal = b.size.toLowerCase();
          break;
        case 'price':
          aVal = Number(a.price);
          bVal = Number(b.price);
          break;
        case 'stock':
          aVal = a.stock ?? a.inventory_quantity ?? 0;
          bVal = b.stock ?? b.inventory_quantity ?? 0;
          break;
        case 'pending_orders':
          aVal = a.pending_orders_qty ?? 0;
          bVal = b.pending_orders_qty ?? 0;
          break;
        default:
          aVal = a.code;
          bVal = b.code;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [products, sizeFilter, stockFilter, sortConfig]);

  // Filter global products
  const filteredGlobalProducts = useMemo(() => {
    return globalProducts.filter(product => {
      const matchesSearch = searchTerm === '' ||
        product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.size.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSize = sizeFilter === '' || product.size === sizeFilter;

      return matchesSearch && matchesSize;
    });
  }, [globalProducts, searchTerm, sizeFilter]);

  // Unique sizes for filter
  const allProducts = activeTab === 'school' ? products : globalProducts;
  const uniqueSizes = Array.from(new Set(allProducts.map(p => p.size))).sort();

  // Statistics
  const stats: ProductsStats = useMemo(() => {
    const prods = activeTab === 'school' ? products : globalProducts;
    let totalProducts = prods.length;
    let totalStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let withOrdersCount = 0;
    let totalPendingOrders = 0;

    prods.forEach(p => {
      const stock = (p as any).stock ?? (p as any).inventory_quantity ?? 0;
      const minStock = (p as any).min_stock ?? (p as any).inventory_min_stock ?? 5;
      const pendingOrders = (p as any).pending_orders_qty ?? 0;

      totalStock += stock;
      if (stock === 0) outOfStockCount++;
      else if (stock <= minStock) lowStockCount++;
      if (pendingOrders > 0) {
        withOrdersCount++;
        totalPendingOrders += pendingOrders;
      }
    });

    return { totalProducts, totalStock, lowStockCount, outOfStockCount, withOrdersCount, totalPendingOrders };
  }, [products, globalProducts, activeTab]);

  const isLoading = activeTab === 'school' ? loading : loadingGlobal;
  const currentProducts = activeTab === 'school' ? filteredAndSortedProducts : filteredGlobalProducts;

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setSizeFilter('');
    setGarmentTypeFilter('');
    setStockFilter('all');
  }, []);

  const hasActiveFilters = !!(searchTerm || sizeFilter || garmentTypeFilter || stockFilter !== 'all');

  // Helper to get full image URL
  const getImageUrl = useCallback((imageUrl: string | undefined | null) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${apiUrl}${imageUrl}`;
  }, [apiUrl]);

  // Tab switch handler
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setSizeFilter('');
    setStockFilter('all');
  }, []);

  return {
    // State
    activeTab,
    products,
    globalProducts,
    garmentTypes,
    globalGarmentTypes,
    loading,
    loadingGlobal,
    isLoading,
    error,
    searchTerm,
    sizeFilter,
    schoolFilter,
    garmentTypeFilter,
    stockFilter,
    sortConfig,
    hasMoreProducts,
    loadingMore,
    showGlobalTypes,
    currentProducts,
    filteredAndSortedProducts,
    filteredGlobalProducts,
    uniqueSizes,
    stats,
    hasActiveFilters,

    // Derived permissions / values
    schoolIdForCreate,
    isSuperuser,
    canAdjustGlobalInventory,
    canManageGarmentTypes,
    currentSchool,
    availableSchools,
    user,
    apiUrl,

    // Setters
    setSearchTerm,
    setSizeFilter,
    setSchoolFilter,
    setGarmentTypeFilter,
    setStockFilter,
    setError,
    setShowGlobalTypes,

    // Actions
    handleTabChange,
    handleSort,
    clearFilters,
    loadProducts,
    loadGlobalProducts,
    getImageUrl,
  };
}
