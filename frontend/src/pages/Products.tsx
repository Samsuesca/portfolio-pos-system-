/**
 * Products Page - List and manage products with inventory
 * Includes both school-specific products and global products
 * Enhanced with advanced filtering, sorting, and order tracking
 */
import { useEffect, useState, useMemo } from 'react';
import Layout from '../components/Layout';
import ProductModal from '../components/ProductModal';
import GlobalProductModal from '../components/GlobalProductModal';
import GarmentTypeModal from '../components/GarmentTypeModal';
import SaleModal from '../components/SaleModal';
import OrderModal from '../components/OrderModal';
import { RequirePermission } from '../components/RequirePermission';
import {
  Package, Plus, Search, AlertCircle, Loader2, Edit2, PackagePlus, X, Save,
  Globe, Building2, ArrowUpDown, ArrowUp, ArrowDown, Filter, ShoppingCart,
  AlertTriangle, PackageX, TrendingUp, BarChart3, ChevronDown, Tag, Image as ImageIcon,
  History, DollarSign
} from 'lucide-react';
import InventoryHistoryModal from '../components/InventoryHistoryModal';
import ProductCostManager from '../components/accounting/ProductCostManager';
import { productService } from '../services/productService';
import { extractErrorMessage } from '../utils/api-client';
import { useSchoolStore } from '../stores/schoolStore';
import { useAuthStore } from '../stores/authStore';
import { useConfigStore } from '../stores/configStore';
import { usePermissions } from '../hooks/usePermissions';
import apiClient from '../utils/api-client';
import type { Product, GlobalProduct, GarmentType, GlobalGarmentType } from '../types/api';

interface InventoryAdjustment {
  productId: string;
  productCode: string;
  productName: string;
  currentStock: number;
  isGlobal: boolean;
  schoolId?: string;
}

type TabType = 'school' | 'global' | 'garment-types';
type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'with_orders';
type SortField = 'code' | 'name' | 'size' | 'price' | 'stock' | 'pending_orders';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export default function Products() {
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

  // Garment types for filtering
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [globalGarmentTypes, setGlobalGarmentTypes] = useState<GlobalGarmentType[]>([]);

  // Common state
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [garmentTypeFilter, setGarmentTypeFilter] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'code', direction: 'asc' });

  // Inventory adjustment modal state
  const [inventoryModal, setInventoryModal] = useState<InventoryAdjustment | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove' | 'set'>('add');
  const [submitting, setSubmitting] = useState(false);

  // Sale modal state
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [initialProduct, setInitialProduct] = useState<Product | null>(null);

  // Order modal state
  const [orderModalOpen, setOrderModalOpen] = useState(false);

  // Global Product Modal state
  const [globalProductModalOpen, setGlobalProductModalOpen] = useState(false);
  const [selectedGlobalProduct, setSelectedGlobalProduct] = useState<GlobalProduct | null>(null);

  // Garment Type Modal state
  const [garmentTypeModalOpen, setGarmentTypeModalOpen] = useState(false);
  const [selectedGarmentType, setSelectedGarmentType] = useState<GarmentType | GlobalGarmentType | null>(null);
  const [isGlobalGarmentType, setIsGlobalGarmentType] = useState(false);

  // Garment types tab state
  const [showGlobalTypes, setShowGlobalTypes] = useState(false);

  // Inventory history modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<{
    productId: string;
    productName: string;
    productCode: string;
    productSize?: string;
    currentStock?: number;
    schoolId: string;
    isGlobalProduct: boolean;
  } | null>(null);

  // Cost manager modal state
  const [costManagerOpen, setCostManagerOpen] = useState(false);

  // For creating new products, use school filter or current school
  const schoolIdForCreate = schoolFilter || currentSchool?.id || availableSchools[0]?.id || '';
  const isSuperuser = user?.is_superuser || false;
  // Check permissions for global inventory management
  const canAdjustGlobalInventory = isSuperuser || hasPermission('global_inventory.adjust');
  // Check if user can manage garment types (via permission system, not just system roles)
  const canManageGarmentTypes = isSuperuser || hasPermission('settings.manage_garment_types') || canManageProducts;

  useEffect(() => {
    if (availableSchools.length === 0) {
      loadSchools();
    }
    loadProducts();
    loadGlobalProducts();
    loadGarmentTypes();
    loadGlobalGarmentTypes();
  }, []);

  useEffect(() => {
    loadProducts();
    loadGarmentTypes();
  }, [schoolFilter]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await productService.getAllProducts({
        school_id: schoolFilter || undefined,
        with_stock: true,
        limit: 500
      });
      setProducts(data);
    } catch (err: unknown) {
      console.error('Error loading products:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadGlobalProducts = async () => {
    try {
      setLoadingGlobal(true);
      const data = await productService.getGlobalProducts();
      setGlobalProducts(data);
    } catch (err: any) {
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
    } catch (err: any) {
      console.error('Error loading garment types:', err);
    }
  };

  const loadGlobalGarmentTypes = async () => {
    try {
      const data = await productService.getGlobalGarmentTypes();
      setGlobalGarmentTypes(data);
    } catch (err: any) {
      console.error('Error loading global garment types:', err);
    }
  };

  const handleOpenModal = (product?: Product) => {
    setSelectedProduct(product || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const handleSuccess = () => {
    loadProducts();
  };

  const handleOpenInventoryModal = (product: Product) => {
    setInventoryModal({
      productId: product.id,
      productCode: product.code,
      productName: product.name || product.code,
      currentStock: product.stock ?? product.inventory_quantity ?? 0,
      isGlobal: false,
      schoolId: (product as any).school_id || currentSchool?.id,
    });
    setAdjustmentAmount('');
    setAdjustmentReason('');
    setAdjustmentType('add');
  };

  const handleStartSale = (product: Product) => {
    const stock = product.stock ?? product.inventory_quantity ?? 0;

    if (stock > 0) {
      // Has stock: open SaleModal with pre-loaded product
      setInitialProduct(product);
      setSaleModalOpen(true);
    } else {
      // No stock: open OrderModal for creating an order
      setInitialProduct(product);
      setOrderModalOpen(true);
    }
  };

  const handleOpenGlobalInventoryModal = (product: GlobalProduct) => {
    setInventoryModal({
      productId: product.id,
      productCode: product.code,
      productName: product.name || product.code,
      currentStock: product.inventory_quantity ?? 0,
      isGlobal: true,
    });
    setAdjustmentAmount('');
    setAdjustmentReason('');
    setAdjustmentType('add');
  };

  const handleCloseInventoryModal = () => {
    setInventoryModal(null);
    setAdjustmentAmount('');
    setAdjustmentReason('');
  };

  const handleAdjustInventory = async () => {
    if (!inventoryModal || !adjustmentAmount) return;

    const amount = parseInt(adjustmentAmount);
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
        await loadGlobalProducts();
      } else {
        await apiClient.post(`/schools/${inventoryModal.schoolId}/inventory/product/${inventoryModal.productId}/adjust`, {
          adjustment,
          reason: adjustmentReason || `Ajuste manual: ${adjustmentType === 'add' ? 'Agregar' : adjustmentType === 'remove' ? 'Remover' : 'Establecer'} ${amount} unidades`,
        });
        await loadProducts();
      }

      handleCloseInventoryModal();
    } catch (err: unknown) {
      console.error('Error adjusting inventory:', err);
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Global Product handlers
  const handleOpenGlobalProductModal = (product?: GlobalProduct) => {
    setSelectedGlobalProduct(product || null);
    setGlobalProductModalOpen(true);
  };

  const handleCloseGlobalProductModal = () => {
    setGlobalProductModalOpen(false);
    setSelectedGlobalProduct(null);
  };

  const handleGlobalProductSuccess = () => {
    loadGlobalProducts();
    handleCloseGlobalProductModal();
  };

  // Garment Type handlers
  const handleOpenGarmentTypeModal = (garmentType?: GarmentType | GlobalGarmentType, isGlobal: boolean = false) => {
    setSelectedGarmentType(garmentType || null);
    setIsGlobalGarmentType(isGlobal);
    setGarmentTypeModalOpen(true);
  };

  const handleCloseGarmentTypeModal = () => {
    setGarmentTypeModalOpen(false);
    setSelectedGarmentType(null);
    setIsGlobalGarmentType(false);
  };

  const handleGarmentTypeSuccess = () => {
    loadGarmentTypes();
    loadGlobalGarmentTypes();
    handleCloseGarmentTypeModal();
  };

  // Inventory history handlers
  const handleOpenHistoryModal = (product: Product) => {
    const schoolId = (product as any).school_id || currentSchool?.id || '';
    setHistoryProduct({
      productId: product.id,
      productName: product.name || product.code,
      productCode: product.code,
      productSize: product.size,
      currentStock: product.stock ?? product.inventory_quantity ?? 0,
      schoolId,
      isGlobalProduct: false,
    });
    setHistoryModalOpen(true);
  };

  const handleOpenGlobalHistoryModal = (product: GlobalProduct) => {
    setHistoryProduct({
      productId: product.id,
      productName: product.name || product.code,
      productCode: product.code,
      productSize: product.size,
      currentStock: product.inventory_quantity ?? 0,
      schoolId: '', // Not needed for global products
      isGlobalProduct: true,
    });
    setHistoryModalOpen(true);
  };

  const handleCloseHistoryModal = () => {
    setHistoryModalOpen(false);
    setHistoryProduct(null);
  };

  // Sorting function
  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-4 h-4 text-blue-600" />
      : <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  // Filter and sort school products
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products.filter(product => {
      const stock = product.stock ?? product.inventory_quantity ?? 0;
      const minStock = product.min_stock ?? product.inventory_min_stock ?? 5;
      const pendingOrders = product.pending_orders_qty ?? 0;

      // Search filter
      const matchesSearch = searchTerm === '' ||
        product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.size.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product as any).school_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product as any).garment_type_name?.toLowerCase().includes(searchTerm.toLowerCase());

      // Size filter
      const matchesSize = sizeFilter === '' || product.size === sizeFilter;

      // Garment type filter
      const matchesGarmentType = garmentTypeFilter === '' || product.garment_type_id === garmentTypeFilter;

      // Stock filter
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

      return matchesSearch && matchesSize && matchesGarmentType && matchesStock;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;

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
  }, [products, searchTerm, sizeFilter, garmentTypeFilter, stockFilter, sortConfig]);

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

  // Get unique sizes for filter
  const allProducts = activeTab === 'school' ? products : globalProducts;
  const uniqueSizes = Array.from(new Set(allProducts.map(p => p.size))).sort();

  // Calculate statistics
  const stats = useMemo(() => {
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

  const clearFilters = () => {
    setSearchTerm('');
    setSizeFilter('');
    setGarmentTypeFilter('');
    setStockFilter('all');
  };

  const hasActiveFilters = searchTerm || sizeFilter || garmentTypeFilter || stockFilter !== 'all';

  // Helper to get full image URL
  const getImageUrl = (imageUrl: string | undefined | null) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${apiUrl}${imageUrl}`;
  };

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Productos</h1>
          <p className="text-gray-600 mt-1">
            {isLoading ? 'Cargando...' :
              activeTab === 'garment-types'
                ? `${(showGlobalTypes ? globalGarmentTypes : garmentTypes).length} tipos de prenda`
                : `${currentProducts.length} productos encontrados`
            }
            {activeTab === 'school' && schoolFilter && availableSchools.length > 1 && (
              <span className="ml-2 text-blue-600">
                - Filtrado por colegio
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <RequirePermission permission="products.set_cost">
            <button
              onClick={() => setCostManagerOpen(true)}
              className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-4 py-2 rounded-lg flex items-center transition"
            >
              <DollarSign className="w-5 h-5 mr-2" />
              Gestionar Costos
            </button>
          </RequirePermission>
          {activeTab === 'school' && (
            <RequirePermission permission="products.create">
              <button
                onClick={() => handleOpenModal()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition"
              >
                <Plus className="w-5 h-5 mr-2" />
                Nuevo Producto
              </button>
            </RequirePermission>
          )}
          {activeTab === 'global' && isSuperuser && (
            <button
              onClick={() => handleOpenGlobalProductModal()}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center transition"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nuevo Producto Global
            </button>
          )}
          {activeTab === 'garment-types' && (
            <>
              {!showGlobalTypes && canManageGarmentTypes && (
                <button
                  onClick={() => handleOpenGarmentTypeModal(undefined, false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Nuevo Tipo del Colegio
                </button>
              )}
              {showGlobalTypes && isSuperuser && (
                <button
                  onClick={() => handleOpenGarmentTypeModal(undefined, true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center transition"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Nuevo Tipo Global
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <Package className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Total Productos</p>
              <p className="text-xl font-bold text-gray-800">{stats.totalProducts}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <BarChart3 className="w-8 h-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Stock Total</p>
              <p className="text-xl font-bold text-gray-800">{stats.totalStock.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div
          className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:bg-yellow-50 transition"
          onClick={() => setStockFilter('low_stock')}
        >
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-yellow-600 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Stock Bajo</p>
              <p className="text-xl font-bold text-yellow-600">{stats.lowStockCount}</p>
            </div>
          </div>
        </div>
        <div
          className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:bg-red-50 transition"
          onClick={() => setStockFilter('out_of_stock')}
        >
          <div className="flex items-center">
            <PackageX className="w-8 h-8 text-red-600 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Sin Stock</p>
              <p className="text-xl font-bold text-red-600">{stats.outOfStockCount}</p>
            </div>
          </div>
        </div>
        <div
          className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:bg-purple-50 transition"
          onClick={() => setStockFilter('with_orders')}
        >
          <div className="flex items-center">
            <ShoppingCart className="w-8 h-8 text-purple-600 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Con Encargos</p>
              <p className="text-xl font-bold text-purple-600">{stats.withOrdersCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <TrendingUp className="w-8 h-8 text-indigo-600 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Uds. en Encargos</p>
              <p className="text-xl font-bold text-indigo-600">{stats.totalPendingOrders}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setActiveTab('school'); setSizeFilter(''); setStockFilter('all'); }}
            className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition ${
              activeTab === 'school'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building2 className="w-5 h-5 mr-2" />
            Productos del Colegio
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
              {products.length}
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('global'); setSizeFilter(''); setStockFilter('all'); }}
            className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition ${
              activeTab === 'global'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Globe className="w-5 h-5 mr-2" />
            Productos Compartidos
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
              {globalProducts.length}
            </span>
          </button>
          {/* Tipos de Prenda - Visible para usuarios con permisos de gestión */}
          {canManageGarmentTypes && (
            <button
              onClick={() => { setActiveTab('garment-types'); setSizeFilter(''); setStockFilter('all'); }}
              className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition ${
                activeTab === 'garment-types'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Tag className="w-5 h-5 mr-2" />
              Tipos de Prenda
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
                {garmentTypes.length + globalGarmentTypes.length}
              </span>
            </button>
          )}
        </div>

        {/* Tab description */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          {activeTab === 'school' ? (
            <p className="text-sm text-gray-600">
              Uniformes especificos de <strong>{currentSchool?.name || 'este colegio'}</strong> (camisetas, pantalones, etc.)
            </p>
          ) : activeTab === 'global' ? (
            <p className="text-sm text-gray-600">
              Productos compartidos entre todos los colegios: <strong>Tennis, Zapatos, Medias, Jean, Blusa</strong>
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              Gestiona los <strong>tipos de prenda</strong> (Camisa, Pantalón, Zapatos, etc.) que se pueden usar para crear productos
            </p>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por codigo, nombre, talla, tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Quick Stock Filter Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-3 py-2 text-sm rounded-lg border transition ${
                stockFilter === 'all'
                  ? 'bg-blue-100 border-blue-500 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStockFilter('in_stock')}
              className={`px-3 py-2 text-sm rounded-lg border transition ${
                stockFilter === 'in_stock'
                  ? 'bg-green-100 border-green-500 text-green-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              En Stock
            </button>
            <button
              onClick={() => setStockFilter('low_stock')}
              className={`px-3 py-2 text-sm rounded-lg border transition ${
                stockFilter === 'low_stock'
                  ? 'bg-yellow-100 border-yellow-500 text-yellow-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Stock Bajo
            </button>
            <button
              onClick={() => setStockFilter('out_of_stock')}
              className={`px-3 py-2 text-sm rounded-lg border transition ${
                stockFilter === 'out_of_stock'
                  ? 'bg-red-100 border-red-500 text-red-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Sin Stock
            </button>
            {activeTab === 'school' && (
              <button
                onClick={() => setStockFilter('with_orders')}
                className={`px-3 py-2 text-sm rounded-lg border transition ${
                  stockFilter === 'with_orders'
                    ? 'bg-purple-100 border-purple-500 text-purple-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Con Encargos
              </button>
            )}
          </div>

          {/* Toggle More Filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 text-sm rounded-lg border transition flex items-center gap-2 ${
              showFilters || hasActiveFilters
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-blue-600" />
            )}
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap items-center gap-4">
            {/* School Filter */}
            {activeTab === 'school' && availableSchools.length > 1 && (
              <div className="flex flex-col">
                <label className="text-xs text-gray-500 mb-1">Colegio</label>
                <select
                  value={schoolFilter}
                  onChange={(e) => setSchoolFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="">Todos los colegios</option>
                  {availableSchools.map(school => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Garment Type Filter */}
            {activeTab === 'school' && garmentTypes.length > 0 && (
              <div className="flex flex-col">
                <label className="text-xs text-gray-500 mb-1">Tipo de Prenda</label>
                <select
                  value={garmentTypeFilter}
                  onChange={(e) => setGarmentTypeFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="">Todos los tipos</option>
                  {garmentTypes.map(gt => (
                    <option key={gt.id} value={gt.id}>
                      {gt.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Size Filter */}
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">Talla</label>
              <select
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                <option value="">Todas las tallas</option>
                {uniqueSizes.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Cargando productos...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                onClick={() => { setError(null); activeTab === 'school' ? loadProducts() : loadGlobalProducts(); }}
                className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products Table */}
      {!isLoading && !error && activeTab !== 'garment-types' && currentProducts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className={activeTab === 'global' ? 'bg-green-50' : 'bg-gray-50'}>
              <tr>
                <th
                  className="w-28 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('code')}
                >
                  <div className="flex items-center gap-1">
                    Codigo
                    {getSortIcon('code')}
                  </div>
                </th>
                {activeTab === 'school' && availableSchools.length > 1 && (
                  <th className="w-48 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Colegio
                  </th>
                )}
                <th
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Nombre / Tipo
                    {getSortIcon('name')}
                  </div>
                </th>
                <th
                  className="w-20 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('size')}
                >
                  <div className="flex items-center gap-1">
                    Talla
                    {getSortIcon('size')}
                  </div>
                </th>
                <th className="w-24 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Color
                </th>
                <th
                  className="w-24 px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('price')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Precio
                    {getSortIcon('price')}
                  </div>
                </th>
                <th
                  className="w-20 px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('stock')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Stock
                    {getSortIcon('stock')}
                  </div>
                </th>
                {activeTab === 'school' && (
                  <th
                    className="w-24 px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('pending_orders')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Encargos
                      {getSortIcon('pending_orders')}
                    </div>
                  </th>
                )}
                <th className="w-20 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="w-24 px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeTab === 'school' ? (
                // School products
                filteredAndSortedProducts.map((product) => {
                  const stock = product.stock ?? product.inventory_quantity ?? 0;
                  const minStock = product.min_stock ?? product.inventory_min_stock ?? 5;
                  const isLowStock = stock <= minStock && stock > 0;
                  const isOutOfStock = stock === 0;
                  const schoolName = (product as any).school_name;
                  const garmentTypeName = (product as any).garment_type_name;
                  const pendingOrdersQty = product.pending_orders_qty ?? 0;
                  const pendingOrdersCount = product.pending_orders_count ?? 0;

                  return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="w-28 px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.code}
                      </td>
                      {availableSchools.length > 1 && (
                        <td className="w-48 px-3 py-2 text-sm text-gray-900">
                          <div className="flex items-center">
                            <Building2 className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                            <span className="truncate" title={schoolName || ''}>
                              {schoolName || 'Sin colegio'}
                            </span>
                          </div>
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div>
                          <div className="text-sm font-medium text-gray-900 truncate">{product.name || '-'}</div>
                          {garmentTypeName && (
                            <div className="text-xs text-gray-500 truncate">{garmentTypeName}</div>
                          )}
                        </div>
                      </td>
                      <td className="w-20 px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-700 font-medium text-xs">
                          {product.size}
                        </span>
                      </td>
                      <td className="w-24 px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {product.color || '-'}
                      </td>
                      <td className="w-24 px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                        ${Number(product.price).toLocaleString()}
                      </td>
                      <td className="w-20 px-3 py-2 whitespace-nowrap text-sm text-right">
                        <div className="flex flex-col items-end">
                          <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            isOutOfStock
                              ? 'bg-red-100 text-red-800'
                              : isLowStock
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {stock}
                          </span>
                          <span className="text-xs text-gray-400">min:{minStock}</span>
                        </div>
                      </td>
                      <td className="w-24 px-3 py-2 whitespace-nowrap text-center">
                        {pendingOrdersQty > 0 ? (
                          <div className="flex flex-col items-center">
                            <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                              {pendingOrdersQty} uds
                            </span>
                            <span className="text-xs text-gray-400">
                              {pendingOrdersCount} enc.
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="w-20 px-3 py-2 whitespace-nowrap">
                        <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          product.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {product.is_active ? 'Activo' : 'Inact.'}
                        </span>
                      </td>
                      <td className="w-24 px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleStartSale(product)}
                            className="text-purple-600 hover:text-purple-800 p-1 rounded hover:bg-purple-50"
                            title={(product.stock ?? product.inventory_quantity ?? 0) > 0 ? "Iniciar venta con este producto" : "Crear encargo (sin stock)"}
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenHistoryModal(product)}
                            className="text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-50"
                            title="Ver historial de movimientos"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <RequirePermission permission="products.edit">
                            <button
                              onClick={() => handleOpenModal(product)}
                              className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                              title="Editar producto"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </RequirePermission>
                          <RequirePermission permission="inventory.adjust">
                            <button
                              onClick={() => handleOpenInventoryModal(product)}
                              className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50"
                              title="Ajustar inventario"
                            >
                              <PackagePlus className="w-4 h-4" />
                            </button>
                          </RequirePermission>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                // Global products
                filteredGlobalProducts.map((product) => {
                  const stock = product.inventory_quantity ?? 0;
                  const minStock = product.inventory_min_stock ?? 5;
                  const isLowStock = stock <= minStock && stock > 0;
                  const isOutOfStock = stock === 0;

                  return (
                    <tr key={product.id} className="hover:bg-green-50">
                      <td className="w-28 px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center">
                          <Globe className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
                          {product.code}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900">
                        {product.name || '-'}
                      </td>
                      <td className="w-20 px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-700 font-medium text-xs">
                          {product.size}
                        </span>
                      </td>
                      <td className="w-24 px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {product.color || '-'}
                      </td>
                      <td className="w-24 px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                        ${Number(product.price).toLocaleString()}
                      </td>
                      <td className="w-20 px-3 py-2 whitespace-nowrap text-sm text-right">
                        <div className="flex flex-col items-end">
                          <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            isOutOfStock
                              ? 'bg-red-100 text-red-800'
                              : isLowStock
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {stock}
                          </span>
                          <span className="text-xs text-gray-400">min:{minStock}</span>
                        </div>
                      </td>
                      <td className="w-20 px-3 py-2 whitespace-nowrap">
                        <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          product.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {product.is_active ? 'Activo' : 'Inact.'}
                        </span>
                      </td>
                      <td className="w-24 px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenGlobalHistoryModal(product)}
                            className="text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-50"
                            title="Ver historial de movimientos"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          {isSuperuser && (
                            <button
                              onClick={() => handleOpenGlobalProductModal(product)}
                              className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                              title="Editar producto global"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canAdjustGlobalInventory && (
                            <button
                              onClick={() => handleOpenGlobalInventoryModal(product)}
                              className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50"
                              title="Ajustar inventario global"
                            >
                              <PackagePlus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Garment Types Table - Visible para usuarios con permisos de gestión */}
      {activeTab === 'garment-types' && canManageGarmentTypes && !isLoading && !error && (
        <div className="bg-white rounded-lg shadow-sm mb-6">
          {/* Toggle between School and Global Types */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setShowGlobalTypes(false)}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition ${
                !showGlobalTypes
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Building2 className="w-4 h-4 inline mr-2" />
              Tipos del Colegio ({garmentTypes.length})
            </button>
            <button
              onClick={() => setShowGlobalTypes(true)}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition ${
                showGlobalTypes
                  ? 'border-purple-600 text-purple-600 bg-purple-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Globe className="w-4 h-4 inline mr-2" />
              Tipos Globales ({globalGarmentTypes.length})
            </button>
          </div>

          {/* Garment Types Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className={showGlobalTypes ? 'bg-purple-50' : 'bg-blue-50'}>
                <tr>
                  {!showGlobalTypes && (
                    <th className="w-16 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Imagen
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  {!showGlobalTypes && availableSchools.length > 1 && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Colegio
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoría
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Req. Bordado
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Medidas Custom
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(showGlobalTypes ? globalGarmentTypes : garmentTypes).map((type) => {
                  // Get school name for school-specific types
                  const schoolName = !showGlobalTypes && 'school_id' in type
                    ? availableSchools.find(s => s.id === (type as GarmentType).school_id)?.name
                    : null;

                  // Get primary image for school-specific types
                  const primaryImage = !showGlobalTypes && 'images' in type && Array.isArray((type as any).images)
                    ? (type as any).images.find((img: any) => img.is_primary)?.image_url ||
                      (type as any).images[0]?.image_url
                    : (type as any).primary_image_url;

                  return (
                    <tr key={type.id} className="hover:bg-gray-50">
                      {!showGlobalTypes && (
                        <td className="w-16 px-3 py-2">
                          {primaryImage ? (
                            <img
                              src={getImageUrl(primaryImage) || ''}
                              alt={type.name}
                              className="w-12 h-12 rounded object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {showGlobalTypes && <Globe className="w-4 h-4 text-purple-600 mr-2" />}
                          <span className="text-sm font-medium text-gray-900">{type.name}</span>
                        </div>
                      </td>
                      {!showGlobalTypes && availableSchools.length > 1 && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Building2 className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                            <span className="text-sm text-gray-900">{schoolName || 'Sin colegio'}</span>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{type.description || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {type.category ? (
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            type.category === 'uniforme_diario'
                              ? 'bg-blue-100 text-blue-800'
                              : type.category === 'uniforme_deportivo'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {type.category === 'uniforme_diario'
                              ? 'Diario'
                              : type.category === 'uniforme_deportivo'
                              ? 'Deportivo'
                              : 'Accesorios'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {type.requires_embroidery ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {type.has_custom_measurements ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          type.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {type.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {(showGlobalTypes ? isSuperuser : canManageGarmentTypes) && (
                          <button
                            onClick={() => handleOpenGarmentTypeModal(type, showGlobalTypes)}
                            className={`${
                              showGlobalTypes
                                ? 'text-purple-600 hover:text-purple-800 hover:bg-purple-50'
                                : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                            } p-1 rounded transition`}
                            title="Editar tipo de prenda"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Empty state for garment types */}
          {(showGlobalTypes ? globalGarmentTypes : garmentTypes).length === 0 && (
            <div className="text-center py-12">
              <Tag className={`w-12 h-12 mx-auto mb-3 ${showGlobalTypes ? 'text-purple-400' : 'text-blue-400'}`} />
              <p className="text-gray-600">
                {showGlobalTypes
                  ? 'No hay tipos de prenda globales'
                  : 'No hay tipos de prenda para este colegio'}
              </p>
              {(showGlobalTypes ? isSuperuser : canManageGarmentTypes) && (
                <button
                  onClick={() => handleOpenGarmentTypeModal(undefined, showGlobalTypes)}
                  className={`mt-4 ${
                    showGlobalTypes
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  } text-white px-4 py-2 rounded-lg inline-flex items-center transition`}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Primer Tipo
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && activeTab !== 'garment-types' && currentProducts.length === 0 && (
        <div className={`border rounded-lg p-12 text-center ${
          activeTab === 'global' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
        }`}>
          <Package className={`w-16 h-16 mx-auto mb-4 ${
            activeTab === 'global' ? 'text-green-400' : 'text-blue-400'
          }`} />
          <h3 className={`text-lg font-medium mb-2 ${
            activeTab === 'global' ? 'text-green-900' : 'text-blue-900'
          }`}>
            {hasActiveFilters ? 'No se encontraron productos' : 'No hay productos'}
          </h3>
          <p className={activeTab === 'global' ? 'text-green-700 mb-4' : 'text-blue-700 mb-4'}>
            {hasActiveFilters
              ? 'Intenta ajustar los filtros de busqueda'
              : activeTab === 'global'
              ? 'Los productos globales son configurados por el administrador'
              : 'Comienza agregando tu primer producto al catalogo'
            }
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-blue-600 hover:text-blue-700 underline mr-4"
            >
              Limpiar filtros
            </button>
          )}
          {!hasActiveFilters && activeTab === 'school' && (
            <RequirePermission permission="products.create">
              <button
                onClick={() => handleOpenModal()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg inline-flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Agregar Producto
              </button>
            </RequirePermission>
          )}
        </div>
      )}

      {/* Product Modal (only for school products) */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        schoolId={schoolIdForCreate}
        schoolName={
          selectedProduct?.school_name
          || availableSchools.find(s => s.id === schoolIdForCreate)?.name
        }
        product={selectedProduct}
      />

      {/* Inventory Adjustment Modal */}
      {inventoryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCloseInventoryModal}
          />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
              {/* Header */}
              <div className={`flex items-center justify-between p-6 border-b border-gray-200 ${
                inventoryModal.isGlobal ? 'bg-green-50' : ''
              }`}>
                <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                  {inventoryModal.isGlobal && <Globe className="w-5 h-5 text-green-600 mr-2" />}
                  Ajustar Inventario {inventoryModal.isGlobal ? 'Global' : ''}
                </h2>
                <button
                  onClick={handleCloseInventoryModal}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Product Info */}
                <div className={`rounded-lg p-4 ${inventoryModal.isGlobal ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <p className="text-sm text-gray-600">Producto:</p>
                  <p className="font-medium text-gray-900">{inventoryModal.productCode}</p>
                  <p className="text-sm text-gray-700">{inventoryModal.productName}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-gray-600">Stock actual:</span>
                    <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${
                      inventoryModal.isGlobal ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {inventoryModal.currentStock} unidades
                    </span>
                  </div>
                </div>

                {/* Adjustment Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de ajuste
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustmentType('add')}
                      className={`flex-1 py-2 px-4 rounded-lg border transition ${
                        adjustmentType === 'add'
                          ? 'bg-green-100 border-green-500 text-green-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
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
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      - Remover
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustmentType('set')}
                      className={`flex-1 py-2 px-4 rounded-lg border transition ${
                        adjustmentType === 'set'
                          ? 'bg-blue-100 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      = Establecer
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {adjustmentType === 'set' ? 'Nuevo stock' : 'Cantidad'} *
                  </label>
                  <input
                    type="number"
                    value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(e.target.value)}
                    min="0"
                    placeholder={adjustmentType === 'set' ? 'Ej: 50' : 'Ej: 10'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  {adjustmentType !== 'set' && adjustmentAmount && (
                    <p className="mt-1 text-sm text-gray-500">
                      Nuevo stock: {
                        adjustmentType === 'add'
                          ? inventoryModal.currentStock + parseInt(adjustmentAmount || '0')
                          : Math.max(0, inventoryModal.currentStock - parseInt(adjustmentAmount || '0'))
                      } unidades
                    </p>
                  )}
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Razon (opcional)
                  </label>
                  <input
                    type="text"
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    placeholder="Ej: Reposicion de inventario, Correccion de conteo..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                <button
                  type="button"
                  onClick={handleCloseInventoryModal}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAdjustInventory}
                  disabled={submitting || !adjustmentAmount}
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
      )}

      {/* Sale Modal */}
      <SaleModal
        isOpen={saleModalOpen}
        onClose={() => {
          setSaleModalOpen(false);
          setInitialProduct(null);
        }}
        onSuccess={() => {
          setSaleModalOpen(false);
          setInitialProduct(null);
          loadProducts(); // Refresh stock after sale
        }}
        initialProduct={initialProduct || undefined}
        initialQuantity={1}
      />

      {/* Order Modal */}
      <OrderModal
        isOpen={orderModalOpen}
        onClose={() => {
          setOrderModalOpen(false);
          setInitialProduct(null);
        }}
        onSuccess={() => {
          setOrderModalOpen(false);
          setInitialProduct(null);
          loadProducts(); // Refresh after order
        }}
        initialSchoolId={initialProduct?.school_id}
        initialProduct={initialProduct || undefined}
      />

      {/* Global Product Modal */}
      <GlobalProductModal
        isOpen={globalProductModalOpen}
        onClose={handleCloseGlobalProductModal}
        onSuccess={handleGlobalProductSuccess}
        product={selectedGlobalProduct}
      />

      {/* Garment Type Modal */}
      <GarmentTypeModal
        isOpen={garmentTypeModalOpen}
        onClose={handleCloseGarmentTypeModal}
        onSuccess={handleGarmentTypeSuccess}
        garmentType={selectedGarmentType}
        isGlobal={isGlobalGarmentType}
        schoolId={(selectedGarmentType as GarmentType)?.school_id || schoolIdForCreate}
      />

      {/* Inventory History Modal */}
      {historyProduct && (
        <InventoryHistoryModal
          isOpen={historyModalOpen}
          onClose={handleCloseHistoryModal}
          productId={historyProduct.productId}
          productName={historyProduct.productName}
          productCode={historyProduct.productCode}
          productSize={historyProduct.productSize}
          currentStock={historyProduct.currentStock}
          schoolId={historyProduct.schoolId}
          isGlobalProduct={historyProduct.isGlobalProduct}
        />
      )}

      {/* Product Cost Manager Modal */}
      <ProductCostManager
        isOpen={costManagerOpen}
        onClose={() => setCostManagerOpen(false)}
        onSaved={() => loadProducts()}
        initialMode="all"
      />
    </Layout>
  );
}
