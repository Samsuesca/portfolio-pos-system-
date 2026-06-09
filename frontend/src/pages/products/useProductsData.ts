/**
 * Custom hook that encapsulates all data-fetching and filtering logic
 * for the Products page.
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { productService } from '../../services/productService';
import type { ProductStats } from '../../services/productService';
import { extractErrorMessage } from '../../utils/api-client';
import { useSchoolStore } from '../../stores/schoolStore';
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import { usePermissions } from '../../hooks/usePermissions';
import type { CatalogOrderEntry } from '../../types/api';
import type {
  TabType,
  ViewMode,
  StockFilter,
  SortConfig,
  SortField,
  ProductsStats,
  Product,
  GarmentType,
} from './types';

const PRODUCTS_LIMIT = 100;

export function useProductsData() {
  const { currentSchool, availableSchools, loadSchools } = useSchoolStore();
  const { user } = useAuthStore();
  const { apiUrl } = useConfigStore();
  const { hasPermission, canManageProducts, canViewCosts, canEditCosts } = usePermissions();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('school');

  // View mode: dense table vs catalog grid (mirrors the web storefront).
  // Grid loads the FULL catalog (every page) with images so the garment-type
  // groups are complete — a capped page would silently drop whole groups.
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // School products state
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Global products state
  const [globalProducts, setGlobalProducts] = useState<Product[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(true);

  // Server-aggregated catalog stats (replaces client-side reduce over
  // paginated products which produced wrong counts beyond the page limit).
  // One set per tab so the cards mirror the catalog the user is viewing:
  // global products (school_id IS NULL) vs school-specific products.
  const [serverStats, setServerStats] = useState<ProductStats | null>(null);
  const [schoolStats, setSchoolStats] = useState<ProductStats | null>(null);

  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [globalGarmentTypes, setGlobalGarmentTypes] = useState<GarmentType[]>([]);

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
  const [totalProductsCount, setTotalProductsCount] = useState(0);

  // Sorting
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'code', direction: 'asc' });

  // Per-school catalog order (garment-type card order, issue #8)
  const [catalogOrder, setCatalogOrder] = useState<CatalogOrderEntry[]>([]);

  // The displayed school's visible (non-excluded) global types, loaded for the
  // single-school grid so globals (Tennis/Jean/Medias) can be reordered alongside
  // the school's own garments and positioned on the public web (issue #8).
  const [schoolVisibleGlobals, setSchoolVisibleGlobals] = useState<Product[]>([]);

  // Derived values
  const schoolIdForCreate = schoolFilter || currentSchool?.id || availableSchools[0]?.id || '';
  const isSuperuser = user?.is_superuser || false;
  const canAdjustGlobalInventory = isSuperuser || hasPermission('global_inventory.adjust');
  const canEditGlobalProduct = isSuperuser || hasPermission('products.edit_global');
  const canManageGlobalGarmentTypes = isSuperuser || hasPermission('garment_types.manage_global');
  const canManageGarmentTypes = isSuperuser || hasPermission('settings.manage_garment_types') || canManageProducts;
  const canReorderCatalog = isSuperuser || hasPermission('catalog.reorder');

  // The school whose catalog is actually on screen — the one whose order we load
  // and save. A concrete school filter wins; otherwise, only if every loaded
  // product belongs to a single school. Null when several schools are shown, which
  // disables reorder. This is what prevents saving the order to the wrong school
  // (schoolIdForCreate's fallback chain could point at a different school).
  const reorderSchoolId = useMemo<string | null>(() => {
    if (schoolFilter) return schoolFilter;
    const ids = new Set(products.map((p) => p.school_id).filter(Boolean) as string[]);
    return ids.size === 1 ? [...ids][0] : null;
  }, [schoolFilter, products]);

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

  // Reload products from the server when the sort or view mode changes (sort
  // applies over the FULL catalog; grid mode refetches with images + higher
  // limit). Skip the first render — the mount/filter effects already load.
  const reloadInitialized = useRef(false);
  useEffect(() => {
    if (!reloadInitialized.current) {
      reloadInitialized.current = true;
      return;
    }
    loadProducts();
  }, [sortConfig, viewMode]);

  // Global products carry garment-type images only when fetched with_images.
  // Reload them with images when the global catalog is shown as a grid so the
  // cards display photos (the initial mount load fetches them without images).
  useEffect(() => {
    if (activeTab === 'global' && viewMode === 'grid') {
      loadGlobalProducts(true);
    }
  }, [activeTab, viewMode]);

  // School-scoped stats track school/garment filters (the /stats endpoint
  // has no text search, so debouncedSearch is intentionally excluded).
  useEffect(() => {
    loadSchoolStats();
  }, [schoolFilter, garmentTypeFilter]);

  const loadProducts = useCallback(async (append = false) => {
    // Grid mode loads the whole catalog at once (no "load more"), with images
    // so the per-garment-type groups are complete and show their photo.
    const isGrid = viewMode === 'grid';
    const effectiveAppend = append && !isGrid;
    try {
      if (effectiveAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      if (isGrid) {
        // The catalog grid groups by garment type, so it needs the COMPLETE
        // catalog — a capped/sorted page would silently drop whole groups
        // (e.g. types whose variants sort past the cap). Product order is
        // deliberately NOT applied here: the grid orders cards by garment type
        // and the persisted catalog order, so per-product sorting is irrelevant.
        const items = await productService.getAllProductsComplete({
          school_id: schoolFilter || undefined,
          search: debouncedSearch || undefined,
          garment_type_id: garmentTypeFilter || undefined,
          with_stock: true,
          with_images: true,
        });
        setProducts(items);
        setTotalProductsCount(items.length);
        setHasMoreProducts(false);
        return;
      }

      const skip = effectiveAppend ? products.length : 0;
      const data = await productService.getAllProducts({
        school_id: schoolFilter || undefined,
        search: debouncedSearch || undefined,
        garment_type_id: garmentTypeFilter || undefined,
        with_stock: true,
        skip,
        limit: PRODUCTS_LIMIT,
        // Server-side sort over the full catalog. `pending_orders` is derived
        // and not SQL-sortable, so it's left to the client fallback below.
        sort_by: sortConfig.field === 'pending_orders' ? undefined : sortConfig.field,
        order: sortConfig.direction,
      });
      if (effectiveAppend) {
        setProducts(prev => [...prev, ...data.items]);
      } else {
        setProducts(data.items);
        setTotalProductsCount(data.total);
      }
      setHasMoreProducts(data.has_more);
    } catch (err: unknown) {
      console.error('Error loading products:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [schoolFilter, debouncedSearch, garmentTypeFilter, products.length, sortConfig, viewMode]);

  const loadGlobalProducts = async (withImages = false) => {
    try {
      setLoadingGlobal(true);
      const [items, statsResult] = await Promise.all([
        // The global tab (grid & table) needs the complete catalog so grouping
        // and stock are correct regardless of size. Grid mode also needs images.
        productService.getGlobalProductsComplete(withImages),
        productService.getGlobalProductsStats().catch(err => {
          console.error('Error loading global products stats:', err);
          return null;
        }),
      ]);
      setGlobalProducts(items);
      if (statsResult) setServerStats(statsResult);
    } catch (err: unknown) {
      console.error('Error loading global products:', err);
    } finally {
      setLoadingGlobal(false);
    }
  };

  const loadSchoolStats = useCallback(async () => {
    try {
      const stats = await productService.getGlobalProductsStats({
        // A specific school filter wins; otherwise aggregate every
        // school-specific product (school_id IS NOT NULL).
        scope: schoolFilter ? undefined : 'school',
        school_id: schoolFilter || undefined,
        garment_type_id: garmentTypeFilter || undefined,
      });
      setSchoolStats(stats);
    } catch (err: unknown) {
      console.error('Error loading school products stats:', err);
      setSchoolStats(null);
    }
  }, [schoolFilter, garmentTypeFilter]);

  const loadGarmentTypes = useCallback(async () => {
    try {
      // Load EVERY type (all pages): the grid grouping drops any product whose
      // garment type isn't present, and the tree/filter dropdown need them all.
      const items = await productService.getAllGarmentTypesComplete({
        school_id: schoolFilter || undefined,
        // The catalog tree is a management surface — load inactive types too so
        // the status filter is meaningful, with stats for the tree rows.
        active_only: false,
        with_stats: true,
      });
      setGarmentTypes(items);
    } catch (err: unknown) {
      console.error('Error loading garment types:', err);
    }
  }, [schoolFilter]);

  const loadGlobalGarmentTypes = useCallback(async () => {
    try {
      const items = await productService.getGlobalGarmentTypesComplete(false);
      setGlobalGarmentTypes(items);
    } catch (err: unknown) {
      console.error('Error loading global garment types:', err);
    }
  }, []);

  // Per-school catalog order (issue #8). Loaded for the school in context so the
  // grid can sort garment-type cards by it and the reorder UI starts from it.
  const loadCatalogOrder = useCallback(async (schoolId: string | null) => {
    if (!schoolId) {
      setCatalogOrder([]);
      return;
    }
    try {
      setCatalogOrder(await productService.getCatalogOrder(schoolId));
    } catch (err: unknown) {
      console.error('Error loading catalog order:', err);
      setCatalogOrder([]);
    }
  }, []);

  // Persist a new garment-type card order for the displayed school (optimistic).
  // Re-throws on failure so the grid can reset its local order and show inline
  // feedback instead of silently snapping back.
  const reorderCatalog = useCallback(async (garmentTypeIds: string[]) => {
    if (!reorderSchoolId) return;
    const previous = catalogOrder;
    setCatalogOrder(garmentTypeIds.map((id, i) => ({ garment_type_id: id, display_order: i })));
    try {
      const saved = await productService.reorderCatalog(reorderSchoolId, garmentTypeIds);
      setCatalogOrder(saved);
    } catch (err: unknown) {
      console.error('Error saving catalog order:', err);
      setCatalogOrder(previous);
      throw err; // the grid surfaces this inline; avoid a duplicate global banner
    }
  }, [reorderSchoolId, catalogOrder]);

  // Reload the catalog order whenever the displayed school changes.
  useEffect(() => {
    loadCatalogOrder(reorderSchoolId);
  }, [reorderSchoolId, loadCatalogOrder]);

  // Load the displayed school's visible globals (with images) for the grid only —
  // they become reorderable cards there. Cleared when not in a single-school grid.
  useEffect(() => {
    if (activeTab !== 'school' || viewMode !== 'grid' || !reorderSchoolId) {
      setSchoolVisibleGlobals([]);
      return;
    }
    let cancelled = false;
    productService
      .getGlobalProductsComplete(true, reorderSchoolId)
      .then((items) => { if (!cancelled) setSchoolVisibleGlobals(items); })
      .catch((err: unknown) => {
        console.error('Error loading school-visible globals:', err);
        if (!cancelled) setSchoolVisibleGlobals([]);
      });
    return () => { cancelled = true; };
  }, [activeTab, viewMode, reorderSchoolId]);

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

    // The server already orders by code/name/size/price/stock over the full
    // catalog. Only `pending_orders` (a derived field the backend can't sort)
    // is ordered client-side here, over the loaded set.
    if (sortConfig.field === 'pending_orders') {
      filtered.sort((a, b) => {
        const aVal = a.pending_orders_qty ?? 0;
        const bVal = b.pending_orders_qty ?? 0;
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    return filtered;
  }, [products, sizeFilter, stockFilter, sortConfig]);

  // Filter + sort global products. Unlike school products these are loaded in
  // full (not server-paginated), so client-side sort here is correct.
  const filteredGlobalProducts = useMemo(() => {
    const term = debouncedSearch.toLowerCase();
    const filtered = globalProducts.filter(product => {
      const matchesSearch = term === '' ||
        product.code.toLowerCase().includes(term) ||
        product.name?.toLowerCase().includes(term) ||
        product.size.toLowerCase().includes(term);

      const matchesSize = sizeFilter === '' || product.size === sizeFilter;
      const matchesGarmentType = garmentTypeFilter === '' || product.garment_type_id === garmentTypeFilter;

      return matchesSearch && matchesSize && matchesGarmentType;
    });

    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      switch (sortConfig.field) {
        case 'price':
          return (Number(a.price) - Number(b.price)) * dir;
        case 'stock':
          return ((a.stock ?? a.inventory_quantity ?? 0) - (b.stock ?? b.inventory_quantity ?? 0)) * dir;
        case 'name':
          return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()) * dir;
        case 'size':
          return a.size.toLowerCase().localeCompare(b.size.toLowerCase()) * dir;
        case 'code':
        default:
          return a.code.toLowerCase().localeCompare(b.code.toLowerCase()) * dir;
      }
    });

    return filtered;
  }, [globalProducts, debouncedSearch, sizeFilter, garmentTypeFilter, sortConfig]);

  // Unique sizes for filter
  const allProducts = activeTab === 'school' ? products : globalProducts;
  const uniqueSizes = Array.from(new Set(allProducts.map(p => p.size))).sort();

  // Statistics — prefer server-aggregated values (cover full catalog),
  // fall back to client-side reduce over loaded products if the stats
  // endpoint failed.
  const stats: ProductsStats = useMemo(() => {
    const activeStats = activeTab === 'global' ? serverStats : schoolStats;
    if (activeStats) {
      return {
        totalProducts: activeStats.total_products,
        totalStock: activeStats.total_stock,
        lowStockCount: activeStats.low_stock_count,
        outOfStockCount: activeStats.out_of_stock_count,
        withOrdersCount: activeStats.with_orders_count,
        totalPendingOrders: activeStats.total_pending_orders,
      };
    }

    const prods = activeTab === 'school' ? products : globalProducts;
    let totalProducts = activeTab === 'school' ? (totalProductsCount || prods.length) : prods.length;
    let totalStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let withOrdersCount = 0;
    let totalPendingOrders = 0;

    prods.forEach(p => {
      const stock = p.stock ?? p.inventory_quantity ?? 0;
      const minStock = p.min_stock ?? p.inventory_min_stock ?? 5;
      const pendingOrders = p.pending_orders_qty ?? 0;

      totalStock += stock;
      if (stock === 0) outOfStockCount++;
      else if (stock <= minStock) lowStockCount++;
      if (pendingOrders > 0) {
        withOrdersCount++;
        totalPendingOrders += pendingOrders;
      }
    });

    return { totalProducts, totalStock, lowStockCount, outOfStockCount, withOrdersCount, totalPendingOrders };
  }, [serverStats, schoolStats, products, globalProducts, activeTab, totalProductsCount]);

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

  // Tab switch handler. Resets every filter — a garment_type_id from the
  // school catalog has no match in the global one, so a lingering filter
  // would silently empty the new tab.
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setSizeFilter('');
    setStockFilter('all');
    setSchoolFilter('');
    setGarmentTypeFilter('');
  }, []);

  return {
    // State
    activeTab,
    viewMode,
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
    totalProductsCount,
    currentProducts,
    filteredAndSortedProducts,
    filteredGlobalProducts,
    uniqueSizes,
    stats,
    hasActiveFilters,
    catalogOrder,
    schoolVisibleGlobals,

    // Derived permissions / values
    schoolIdForCreate,
    isSuperuser,
    canAdjustGlobalInventory,
    canEditGlobalProduct,
    canManageGlobalGarmentTypes,
    canManageGarmentTypes,
    canReorderCatalog,
    reorderSchoolId,
    canViewCosts,
    canEditCosts,
    currentSchool,
    availableSchools,
    user,
    apiUrl,

    // Setters
    setViewMode,
    setSearchTerm,
    setSizeFilter,
    setSchoolFilter,
    setGarmentTypeFilter,
    setStockFilter,
    setError,

    // Actions
    handleTabChange,
    handleSort,
    clearFilters,
    loadProducts,
    loadGlobalProducts,
    loadGarmentTypes,
    loadGlobalGarmentTypes,
    reorderCatalog,
    getImageUrl,
  };
}
