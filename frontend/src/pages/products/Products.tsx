/**
 * Products Page - Orchestrator component
 *
 * Thin wrapper that composes sub-components and modals.
 * All data-fetching and filtering logic lives in useProductsData.
 * Each modal manages its own internal state.
 */
import { useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import ProductModal from '../../components/ProductModal';
import GlobalProductModal from '../../components/GlobalProductModal';
import GarmentTypeModal from '../../components/GarmentTypeModal';
import SaleModal from '../../components/SaleModal';
import OrderModal from '../../components/OrderModal';
import InventoryHistoryModal from '../../components/InventoryHistoryModal';
import ProductCostManager from '../../components/accounting/ProductCostManager';
import { Loader2, AlertCircle } from 'lucide-react';

// Sub-components
import ProductsHeader from './ProductsHeader';
import ProductsStatsCards from './ProductsStatsCards';
import ProductsTabs from './ProductsTabs';
import ProductsFilters from './ProductsFilters';
import ProductsTable from './ProductsTable';
import GarmentTypesTab from './GarmentTypesTab';
import InventoryAdjustmentModal from './InventoryAdjustmentModal';
import ProductsEmptyState from './ProductsEmptyState';

// Hook & types
import { useProductsData } from './useProductsData';
import type {
  InventoryAdjustment,
  HistoryProductInfo,
  Product,
  GlobalProduct,
  GarmentType,
  GlobalGarmentType,
} from './types';

export default function Products() {
  const data = useProductsData();

  // Modal state - orchestrator only tracks which modal is open
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inventoryModal, setInventoryModal] = useState<InventoryAdjustment | null>(null);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [initialProduct, setInitialProduct] = useState<Product | null>(null);
  const [globalProductModalOpen, setGlobalProductModalOpen] = useState(false);
  const [selectedGlobalProduct, setSelectedGlobalProduct] = useState<GlobalProduct | null>(null);
  const [garmentTypeModalOpen, setGarmentTypeModalOpen] = useState(false);
  const [selectedGarmentType, setSelectedGarmentType] = useState<GarmentType | GlobalGarmentType | null>(null);
  const [isGlobalGarmentType, setIsGlobalGarmentType] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<HistoryProductInfo | null>(null);
  const [costManagerOpen, setCostManagerOpen] = useState(false);

  // --- Product Modal handlers ---
  const handleOpenModal = useCallback((product?: Product) => {
    setSelectedProduct(product || null);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  }, []);

  const handleProductSuccess = useCallback(() => {
    data.loadProducts();
  }, [data.loadProducts]);

  // --- Inventory Adjustment handlers ---
  const handleOpenInventoryModal = useCallback((product: Product) => {
    setInventoryModal({
      productId: product.id,
      productCode: product.code,
      productName: product.name || product.code,
      currentStock: product.stock ?? product.inventory_quantity ?? 0,
      isGlobal: false,
      schoolId: (product as any).school_id || data.currentSchool?.id,
    });
  }, [data.currentSchool]);

  const handleOpenGlobalInventoryModal = useCallback((product: GlobalProduct) => {
    setInventoryModal({
      productId: product.id,
      productCode: product.code,
      productName: product.name || product.code,
      currentStock: product.inventory_quantity ?? 0,
      isGlobal: true,
    });
  }, []);

  const handleCloseInventoryModal = useCallback(() => {
    setInventoryModal(null);
  }, []);

  const handleInventorySuccess = useCallback(() => {
    setInventoryModal(null);
    if (inventoryModal?.isGlobal) {
      data.loadGlobalProducts();
    } else {
      data.loadProducts();
    }
  }, [inventoryModal, data.loadProducts, data.loadGlobalProducts]);

  // --- Sale / Order handlers ---
  const handleStartSale = useCallback((product: Product) => {
    const stock = product.stock ?? product.inventory_quantity ?? 0;
    setInitialProduct(product);
    if (stock > 0) {
      setSaleModalOpen(true);
    } else {
      setOrderModalOpen(true);
    }
  }, []);

  const handleCloseSale = useCallback(() => {
    setSaleModalOpen(false);
    setInitialProduct(null);
  }, []);

  const handleSaleSuccess = useCallback(() => {
    setSaleModalOpen(false);
    setInitialProduct(null);
    data.loadProducts();
  }, [data.loadProducts]);

  const handleCloseOrder = useCallback(() => {
    setOrderModalOpen(false);
    setInitialProduct(null);
  }, []);

  const handleOrderSuccess = useCallback(() => {
    setOrderModalOpen(false);
    setInitialProduct(null);
    data.loadProducts();
  }, [data.loadProducts]);

  // --- Global Product Modal handlers ---
  const handleOpenGlobalProductModal = useCallback((product?: GlobalProduct) => {
    setSelectedGlobalProduct(product || null);
    setGlobalProductModalOpen(true);
  }, []);

  const handleCloseGlobalProductModal = useCallback(() => {
    setGlobalProductModalOpen(false);
    setSelectedGlobalProduct(null);
  }, []);

  const handleGlobalProductSuccess = useCallback(() => {
    data.loadGlobalProducts();
    setGlobalProductModalOpen(false);
    setSelectedGlobalProduct(null);
  }, [data.loadGlobalProducts]);

  // --- Garment Type Modal handlers ---
  const handleOpenGarmentTypeModal = useCallback((garmentType?: GarmentType | GlobalGarmentType, isGlobal: boolean = false) => {
    setSelectedGarmentType(garmentType || null);
    setIsGlobalGarmentType(isGlobal);
    setGarmentTypeModalOpen(true);
  }, []);

  const handleCloseGarmentTypeModal = useCallback(() => {
    setGarmentTypeModalOpen(false);
    setSelectedGarmentType(null);
    setIsGlobalGarmentType(false);
  }, []);

  const handleGarmentTypeSuccess = useCallback(() => {
    // Reload both lists so counts update
    data.loadProducts();
    data.loadGlobalProducts();
    setGarmentTypeModalOpen(false);
    setSelectedGarmentType(null);
    setIsGlobalGarmentType(false);
  }, [data.loadProducts, data.loadGlobalProducts]);

  // --- Inventory History handlers ---
  const handleOpenHistoryModal = useCallback((product: Product) => {
    const schoolId = (product as any).school_id || data.currentSchool?.id || '';
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
  }, [data.currentSchool]);

  const handleOpenGlobalHistoryModal = useCallback((product: GlobalProduct) => {
    setHistoryProduct({
      productId: product.id,
      productName: product.name || product.code,
      productCode: product.code,
      productSize: product.size,
      currentStock: product.inventory_quantity ?? 0,
      schoolId: '',
      isGlobalProduct: true,
    });
    setHistoryModalOpen(true);
  }, []);

  const handleCloseHistoryModal = useCallback(() => {
    setHistoryModalOpen(false);
    setHistoryProduct(null);
  }, []);

  // --- Header button callbacks ---
  const handleOpenCostManager = useCallback(() => setCostManagerOpen(true), []);
  const handleOpenNewProduct = useCallback(() => handleOpenModal(), [handleOpenModal]);
  const handleOpenNewGlobalProduct = useCallback(() => handleOpenGlobalProductModal(), [handleOpenGlobalProductModal]);
  const handleOpenNewGarmentType = useCallback((isGlobal: boolean) => {
    handleOpenGarmentTypeModal(undefined, isGlobal);
  }, [handleOpenGarmentTypeModal]);

  // Load more
  const handleLoadMore = useCallback(() => data.loadProducts(true), [data.loadProducts]);

  return (
    <Layout>
      {/* Header with title and action buttons */}
      <ProductsHeader
        activeTab={data.activeTab}
        isLoading={data.isLoading}
        currentProductsCount={data.currentProducts.length}
        garmentTypesDisplayCount={(data.showGlobalTypes ? data.globalGarmentTypes : data.garmentTypes).length}
        schoolFilter={data.schoolFilter}
        availableSchoolsCount={data.availableSchools.length}
        isSuperuser={data.isSuperuser}
        canManageGarmentTypes={data.canManageGarmentTypes}
        showGlobalTypes={data.showGlobalTypes}
        onOpenCostManager={handleOpenCostManager}
        onOpenProductModal={handleOpenNewProduct}
        onOpenGlobalProductModal={handleOpenNewGlobalProduct}
        onOpenGarmentTypeModal={handleOpenNewGarmentType}
      />

      {/* Statistics Cards */}
      <ProductsStatsCards
        stats={data.stats}
        onStockFilterChange={data.setStockFilter}
      />

      {/* Tabs */}
      <ProductsTabs
        activeTab={data.activeTab}
        onTabChange={data.handleTabChange}
        productsCount={data.products.length}
        globalProductsCount={data.globalProducts.length}
        garmentTypesCount={data.garmentTypes.length}
        globalGarmentTypesCount={data.globalGarmentTypes.length}
        canManageGarmentTypes={data.canManageGarmentTypes}
        currentSchoolName={data.currentSchool?.name || 'este colegio'}
      />

      {/* Search and Filters */}
      <ProductsFilters
        activeTab={data.activeTab}
        searchTerm={data.searchTerm}
        onSearchChange={data.setSearchTerm}
        stockFilter={data.stockFilter}
        onStockFilterChange={data.setStockFilter}
        sizeFilter={data.sizeFilter}
        onSizeFilterChange={data.setSizeFilter}
        schoolFilter={data.schoolFilter}
        onSchoolFilterChange={data.setSchoolFilter}
        garmentTypeFilter={data.garmentTypeFilter}
        onGarmentTypeFilterChange={data.setGarmentTypeFilter}
        availableSchools={data.availableSchools}
        garmentTypes={data.garmentTypes}
        uniqueSizes={data.uniqueSizes}
        hasActiveFilters={data.hasActiveFilters}
        onClearFilters={data.clearFilters}
      />

      {/* Loading State */}
      {data.isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Cargando productos...</span>
        </div>
      )}

      {/* Error State */}
      {data.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{data.error}</p>
              <button
                onClick={() => { data.setError(null); data.activeTab === 'school' ? data.loadProducts() : data.loadGlobalProducts(); }}
                className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products Table */}
      {!data.isLoading && !data.error && data.activeTab !== 'garment-types' && data.currentProducts.length > 0 && (
        <ProductsTable
          activeTab={data.activeTab}
          sortConfig={data.sortConfig}
          onSort={data.handleSort}
          schoolProducts={data.filteredAndSortedProducts}
          globalProducts={data.filteredGlobalProducts}
          availableSchools={data.availableSchools}
          isSuperuser={data.isSuperuser}
          canAdjustGlobalInventory={data.canAdjustGlobalInventory}
          hasMoreProducts={data.hasMoreProducts}
          loadingMore={data.loadingMore}
          productsCount={data.products.length}
          onLoadMore={handleLoadMore}
          onStartSale={handleStartSale}
          onOpenHistoryModal={handleOpenHistoryModal}
          onOpenGlobalHistoryModal={handleOpenGlobalHistoryModal}
          onEditProduct={handleOpenModal}
          onAdjustInventory={handleOpenInventoryModal}
          onEditGlobalProduct={handleOpenGlobalProductModal}
          onAdjustGlobalInventory={handleOpenGlobalInventoryModal}
        />
      )}

      {/* Garment Types Table */}
      {data.activeTab === 'garment-types' && data.canManageGarmentTypes && !data.isLoading && !data.error && (
        <GarmentTypesTab
          garmentTypes={data.garmentTypes}
          globalGarmentTypes={data.globalGarmentTypes}
          showGlobalTypes={data.showGlobalTypes}
          onToggleGlobalTypes={data.setShowGlobalTypes}
          availableSchools={data.availableSchools}
          isSuperuser={data.isSuperuser}
          canManageGarmentTypes={data.canManageGarmentTypes}
          onOpenGarmentTypeModal={handleOpenGarmentTypeModal}
          getImageUrl={data.getImageUrl}
        />
      )}

      {/* Empty State */}
      {!data.isLoading && !data.error && data.activeTab !== 'garment-types' && data.currentProducts.length === 0 && (
        <ProductsEmptyState
          activeTab={data.activeTab}
          hasActiveFilters={data.hasActiveFilters}
          onClearFilters={data.clearFilters}
          onAddProduct={handleOpenNewProduct}
        />
      )}

      {/* ========== MODALS ========== */}

      {/* Product Modal (school products) */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleProductSuccess}
        schoolId={data.schoolIdForCreate}
        schoolName={
          selectedProduct?.school_name
          || data.availableSchools.find(s => s.id === data.schoolIdForCreate)?.name
        }
        product={selectedProduct}
      />

      {/* Inventory Adjustment Modal */}
      {inventoryModal && (
        <InventoryAdjustmentModal
          inventoryModal={inventoryModal}
          onClose={handleCloseInventoryModal}
          onSuccess={handleInventorySuccess}
        />
      )}

      {/* Sale Modal */}
      <SaleModal
        isOpen={saleModalOpen}
        onClose={handleCloseSale}
        onSuccess={handleSaleSuccess}
        initialProduct={initialProduct || undefined}
        initialQuantity={1}
      />

      {/* Order Modal */}
      <OrderModal
        isOpen={orderModalOpen}
        onClose={handleCloseOrder}
        onSuccess={handleOrderSuccess}
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
        schoolId={(selectedGarmentType as GarmentType)?.school_id || data.schoolIdForCreate}
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
        onSaved={() => data.loadProducts()}
        initialMode="all"
      />
    </Layout>
  );
}
