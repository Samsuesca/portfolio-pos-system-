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
import CostBreakdownModal from '../../components/accounting/CostBreakdownModal';
import { Loader2, AlertCircle } from 'lucide-react';

// Sub-components
import ProductsHeader from './ProductsHeader';
import ProductsStatsCards from './ProductsStatsCards';
import ProductsTabs from './ProductsTabs';
import ProductsFilters from './ProductsFilters';
import ProductsTable from './ProductsTable';
import ProductsGrid from './ProductsGrid';
import SchoolCatalogTab from './SchoolCatalogTab';
import CostInsightsTab from './CostInsightsTab';
import InventoryAdjustmentModal from './InventoryAdjustmentModal';
import ProductsEmptyState from './ProductsEmptyState';

// Hook & types
import { useProductsData } from './useProductsData';
import type {
  InventoryAdjustment,
  HistoryProductInfo,
  Product,
  GarmentType,
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
  const [selectedGlobalProduct, setSelectedGlobalProduct] = useState<Product | null>(null);
  const [garmentTypeModalOpen, setGarmentTypeModalOpen] = useState(false);
  const [selectedGarmentType, setSelectedGarmentType] = useState<GarmentType | null>(null);
  const [isGlobalGarmentType, setIsGlobalGarmentType] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<HistoryProductInfo | null>(null);
  const [costManagerOpen, setCostManagerOpen] = useState(false);
  const [costBreakdownTarget, setCostBreakdownTarget] = useState<{
    schoolId: string;
    garmentTypeId: string;
    garmentTypeName: string;
    isGlobal: boolean;
  } | null>(null);
  // "+ Variante" from the catalog tree: pre-selects a garment type (and school)
  // for the create-product modal. Null on every other open path.
  const [addVariantContext, setAddVariantContext] = useState<{
    typeId: string;
    schoolId?: string;
    isGlobal: boolean;
  } | null>(null);
  // Bumped after a catalog mutation so the tree collapses and refetches fresh
  // variants/stats on next expand.
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);

  const handleOpenCostBreakdown = useCallback((garmentType: GarmentType, isGlobal: boolean) => {
    setCostBreakdownTarget({
      schoolId: garmentType.school_id || '',
      garmentTypeId: garmentType.id,
      garmentTypeName: garmentType.name,
      isGlobal,
    });
  }, []);

  // --- Product Modal handlers ---
  const handleOpenModal = useCallback((product?: Product) => {
    setAddVariantContext(null);
    setSelectedProduct(product || null);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    setAddVariantContext(null);
  }, []);

  const handleProductSuccess = useCallback(() => {
    data.loadProducts();
    data.loadGarmentTypes();   // refresh tree stats (variant count, stock, price range)
    setCatalogRefreshKey(k => k + 1);
  }, [data.loadProducts, data.loadGarmentTypes]);

  // --- Inventory Adjustment handlers ---
  const handleOpenInventoryModal = useCallback((product: Product) => {
    setInventoryModal({
      productId: product.id,
      productCode: product.code,
      productName: product.name || product.code,
      currentStock: product.stock ?? product.inventory_quantity ?? 0,
      isGlobal: false,
      schoolId: product.school_id || data.currentSchool?.id,
    });
  }, [data.currentSchool]);

  const handleOpenGlobalInventoryModal = useCallback((product: Product) => {
    setInventoryModal({
      productId: product.id,
      productCode: product.code,
      productName: product.name || product.code,
      currentStock: product.inventory_quantity ?? product.stock ?? 0,
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
      data.loadGarmentTypes();   // total_stock per type changed
    }
    setCatalogRefreshKey(k => k + 1);
  }, [inventoryModal, data.loadProducts, data.loadGlobalProducts, data.loadGarmentTypes]);

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
  const handleOpenGlobalProductModal = useCallback((product?: Product) => {
    setAddVariantContext(null);
    setSelectedGlobalProduct(product || null);
    setGlobalProductModalOpen(true);
  }, []);

  const handleCloseGlobalProductModal = useCallback(() => {
    setGlobalProductModalOpen(false);
    setSelectedGlobalProduct(null);
    setAddVariantContext(null);
  }, []);

  const handleGlobalProductSuccess = useCallback(() => {
    data.loadGlobalProducts();   // global type stats derive from this list
    setGlobalProductModalOpen(false);
    setSelectedGlobalProduct(null);
    setAddVariantContext(null);
    setCatalogRefreshKey(k => k + 1);
  }, [data.loadGlobalProducts]);

  // --- Garment Type Modal handlers ---
  const handleOpenGarmentTypeModal = useCallback((garmentType?: GarmentType, isGlobal: boolean = false) => {
    setSelectedGarmentType(garmentType || null);
    setIsGlobalGarmentType(isGlobal);
    setGarmentTypeModalOpen(true);
  }, []);

  const handleCloseGarmentTypeModal = useCallback(() => {
    setGarmentTypeModalOpen(false);
    setSelectedGarmentType(null);
    setIsGlobalGarmentType(false);
  }, []);

  // Refresh catalog thumbnails/stats after live image edits in the type modal
  // (uploads hit the API immediately, before any form submit).
  const handleGarmentTypeImagesChanged = useCallback(() => {
    data.loadProducts();
    data.loadGlobalProducts();
    setCatalogRefreshKey(k => k + 1);
  }, [data.loadProducts, data.loadGlobalProducts]);

  const handleGarmentTypeSuccess = useCallback(() => {
    // Reload products + the type lists so the tree rows and counts update.
    data.loadProducts();
    data.loadGlobalProducts();
    data.loadGarmentTypes();
    data.loadGlobalGarmentTypes();
    setGarmentTypeModalOpen(false);
    setSelectedGarmentType(null);
    setIsGlobalGarmentType(false);
    setCatalogRefreshKey(k => k + 1);
  }, [data.loadProducts, data.loadGlobalProducts, data.loadGarmentTypes, data.loadGlobalGarmentTypes]);

  // --- Inventory History handlers ---
  const handleOpenHistoryModal = useCallback((product: Product) => {
    const schoolId = product.school_id || data.currentSchool?.id || '';
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

  const handleOpenGlobalHistoryModal = useCallback((product: Product) => {
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

  // Load more
  const handleLoadMore = useCallback(() => data.loadProducts(true), [data.loadProducts]);

  // --- Catalog grid handlers ---
  const handleManageGroup = useCallback((garmentTypeId: string) => {
    // Resolve across both lists so a global card injected into the school grid
    // still opens its (global) garment-type modal, not a no-op.
    const schoolType = data.garmentTypes.find(t => t.id === garmentTypeId);
    if (schoolType) { handleOpenGarmentTypeModal(schoolType, false); return; }
    const globalType = data.globalGarmentTypes.find(t => t.id === garmentTypeId);
    if (globalType) handleOpenGarmentTypeModal(globalType, true);
  }, [data.garmentTypes, data.globalGarmentTypes, handleOpenGarmentTypeModal]);

  const handleViewVariants = useCallback((garmentTypeId: string) => {
    if (data.activeTab === 'school') {
      // A global card injected into the school grid: its variants live in the global
      // tab, so jump there and filter — filtering the school table by a global type
      // id would show an empty table.
      if (data.globalGarmentTypes.some(t => t.id === garmentTypeId)) {
        data.handleTabChange('global');
      }
      data.setGarmentTypeFilter(garmentTypeId);
    }
    data.setViewMode('table');
  }, [data.activeTab, data.globalGarmentTypes, data.handleTabChange, data.setGarmentTypeFilter, data.setViewMode]);

  // --- Catalog tree handlers (garment type -> variants) ---
  // "+ Variante": open the create-product modal with the type pre-selected.
  const handleAddVariant = useCallback((garmentType: GarmentType, isGlobal: boolean) => {
    setAddVariantContext({ typeId: garmentType.id, schoolId: garmentType.school_id || undefined, isGlobal });
    if (isGlobal) {
      setSelectedGlobalProduct(null);
      setGlobalProductModalOpen(true);
    } else {
      setSelectedProduct(null);
      setIsModalOpen(true);
    }
  }, []);

  // Variant actions branch on whether the product is global (school_id IS NULL).
  const handleEditVariant = useCallback((product: Product) => {
    if (product.school_id) handleOpenModal(product);
    else handleOpenGlobalProductModal(product);
  }, [handleOpenModal, handleOpenGlobalProductModal]);

  const handleAdjustVariantInventory = useCallback((product: Product) => {
    if (product.school_id) handleOpenInventoryModal(product);
    else handleOpenGlobalInventoryModal(product);
  }, [handleOpenInventoryModal, handleOpenGlobalInventoryModal]);

  const handleVariantHistory = useCallback((product: Product) => {
    if (product.school_id) handleOpenHistoryModal(product);
    else handleOpenGlobalHistoryModal(product);
  }, [handleOpenHistoryModal, handleOpenGlobalHistoryModal]);

  return (
    <Layout>
      {/* Header with title and action buttons */}
      <ProductsHeader
        activeTab={data.activeTab}
        isLoading={data.isLoading}
        currentProductsCount={data.currentProducts.length}
        schoolFilter={data.schoolFilter}
        availableSchoolsCount={data.availableSchools.length}
        onOpenCostManager={handleOpenCostManager}
        onOpenProductModal={handleOpenNewProduct}
        onOpenGlobalProductModal={handleOpenNewGlobalProduct}
      />

      {/* Statistics Cards (oculto en tab Análisis de costos) */}
      {data.activeTab !== 'cost-insights' && (
        <ProductsStatsCards
          stats={data.stats}
          onStockFilterChange={data.setStockFilter}
        />
      )}

      {/* Tabs */}
      <ProductsTabs
        activeTab={data.activeTab}
        onTabChange={data.handleTabChange}
        productsCount={data.totalProductsCount || data.products.length}
        globalProductsCount={data.globalProducts.length}
        canViewCosts={data.canViewCosts}
      />

      {/* Flat search & filters — hidden in cost-insights and in the tree view
          (the tree has its own type-level filters). */}
      {data.activeTab !== 'cost-insights' && data.viewMode !== 'tree' && (
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
          garmentTypes={data.activeTab === 'global' ? data.globalGarmentTypes : data.garmentTypes}
          uniqueSizes={data.uniqueSizes}
          hasActiveFilters={data.hasActiveFilters}
          onClearFilters={data.clearFilters}
        />
      )}

      {/* Loading State (flat views only — the tree loads its own data) */}
      {data.isLoading && data.viewMode !== 'tree' && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <span className="ml-3 text-stone-600">Cargando productos...</span>
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

      {/* View mode toggle (school & global product tabs) */}
      {!data.error && (data.activeTab === 'school' || data.activeTab === 'global') && (
        <div className="flex items-center justify-end mb-3">
          <div className="inline-flex p-0.5 bg-stone-100 rounded-lg text-sm" role="tablist" aria-label="Modo de vista">
            <button
              onClick={() => data.setViewMode('tree')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                data.viewMode === 'tree' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              Árbol
            </button>
            <button
              onClick={() => data.setViewMode('table')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                data.viewMode === 'table' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              Tabla
            </button>
            <button
              onClick={() => data.setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                data.viewMode === 'grid' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              Cuadrícula
            </button>
          </div>
        </div>
      )}

      {/* Tree view: garment types -> variants (school or global scope by tab) */}
      {!data.error && (data.activeTab === 'school' || data.activeTab === 'global') && data.viewMode === 'tree' && (
        <SchoolCatalogTab
          isGlobal={data.activeTab === 'global'}
          garmentTypes={data.garmentTypes}
          globalGarmentTypes={data.globalGarmentTypes}
          globalProducts={data.globalProducts}
          schoolFilter={data.schoolFilter}
          canManageGarmentTypes={data.canManageGarmentTypes}
          canManageGlobalGarmentTypes={data.canManageGlobalGarmentTypes}
          canViewCosts={data.canViewCosts}
          getImageUrl={data.getImageUrl}
          refreshKey={catalogRefreshKey}
          onOpenGarmentTypeModal={handleOpenGarmentTypeModal}
          onOpenCostBreakdown={handleOpenCostBreakdown}
          onAddVariant={handleAddVariant}
          onEditVariant={handleEditVariant}
          onAdjustInventory={handleAdjustVariantInventory}
          onOpenHistory={handleVariantHistory}
        />
      )}

      {/* Flat Table/Grid views */}
      {!data.isLoading && !data.error && (data.activeTab === 'school' || data.activeTab === 'global') && data.viewMode !== 'tree' && data.currentProducts.length > 0 && (
        data.viewMode === 'grid' ? (
          <ProductsGrid
            rawProducts={data.activeTab === 'global' ? data.filteredGlobalProducts : data.filteredAndSortedProducts}
            garmentTypes={data.activeTab === 'global' ? data.globalGarmentTypes : data.garmentTypes}
            isGlobal={data.activeTab === 'global'}
            canViewCosts={data.canViewCosts}
            schools={data.availableSchools}
            onManageGroup={handleManageGroup}
            onViewVariants={handleViewVariants}
            catalogOrder={data.catalogOrder}
            canReorder={data.activeTab === 'school' && data.canReorderCatalog && !!data.reorderSchoolId}
            onReorder={data.reorderCatalog}
            globalProductsForSchool={data.schoolVisibleGlobals}
            globalGarmentTypes={data.globalGarmentTypes}
          />
        ) : (
          <ProductsTable
            activeTab={data.activeTab}
            sortConfig={data.sortConfig}
            onSort={data.handleSort}
            schoolProducts={data.filteredAndSortedProducts}
            globalProducts={data.filteredGlobalProducts}
            availableSchools={data.availableSchools}
            canAdjustGlobalInventory={data.canAdjustGlobalInventory}
            canEditGlobalProduct={data.canEditGlobalProduct}
            canViewCosts={data.canViewCosts}
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
        )
      )}

      {/* Cost Insights Tab */}
      {data.activeTab === 'cost-insights' && data.canViewCosts && (
        <CostInsightsTab />
      )}

      {/* Empty State (flat views only — the tree renders its own empty state) */}
      {!data.isLoading && !data.error && data.activeTab !== 'cost-insights' && data.viewMode !== 'tree' && data.currentProducts.length === 0 && (
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
        schoolId={(addVariantContext && !addVariantContext.isGlobal && addVariantContext.schoolId) || data.schoolIdForCreate}
        schoolName={
          selectedProduct?.school_name
          || data.availableSchools.find(s => s.id === ((addVariantContext && !addVariantContext.isGlobal && addVariantContext.schoolId) || data.schoolIdForCreate))?.name
        }
        product={selectedProduct}
        initialGarmentTypeId={addVariantContext && !addVariantContext.isGlobal ? addVariantContext.typeId : undefined}
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
        initialSchoolId={initialProduct?.school_id || undefined}
        initialProduct={initialProduct || undefined}
      />

      {/* Global Product Modal */}
      <GlobalProductModal
        isOpen={globalProductModalOpen}
        onClose={handleCloseGlobalProductModal}
        onSuccess={handleGlobalProductSuccess}
        product={selectedGlobalProduct}
        initialGarmentTypeId={addVariantContext?.isGlobal ? addVariantContext.typeId : undefined}
      />

      {/* Garment Type Modal */}
      <GarmentTypeModal
        isOpen={garmentTypeModalOpen}
        onClose={handleCloseGarmentTypeModal}
        onSuccess={handleGarmentTypeSuccess}
        onChanged={handleGarmentTypeImagesChanged}
        garmentType={selectedGarmentType}
        isGlobal={isGlobalGarmentType}
        schoolId={selectedGarmentType?.school_id || data.schoolIdForCreate}
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

      {/* Desglose de costos por componentes (desde Tipos de Prenda) */}
      {costBreakdownTarget && (
        <CostBreakdownModal
          isOpen={true}
          onClose={() => setCostBreakdownTarget(null)}
          schoolId={costBreakdownTarget.schoolId}
          garmentTypeId={costBreakdownTarget.garmentTypeId}
          garmentTypeName={costBreakdownTarget.garmentTypeName}
          isGlobal={costBreakdownTarget.isGlobal}
          onCostsSaved={() => { data.loadProducts(); data.loadGlobalProducts(); }}
        />
      )}
    </Layout>
  );
}
