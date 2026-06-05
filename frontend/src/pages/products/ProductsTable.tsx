/**
 * Products table that renders either school products or global products
 * based on the active tab. Includes sortable column headers and a
 * "load more" button for paginated school products.
 */
import React from 'react';
import {
  ArrowUpDown, ArrowUp, ArrowDown, Globe, Building2,
  ShoppingCart, History, Edit2, PackagePlus, Loader2, ChevronDown,
} from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';
import type { TabType, SortConfig, SortField, Product } from './types';

interface School {
  id: string;
  name: string;
}

interface ProductsTableProps {
  activeTab: TabType;
  sortConfig: SortConfig;
  onSort: (field: SortField) => void;
  schoolProducts: Product[];
  globalProducts: Product[];
  availableSchools: School[];
  canAdjustGlobalInventory: boolean;
  canEditGlobalProduct: boolean;
  canViewCosts: boolean;
  hasMoreProducts: boolean;
  loadingMore: boolean;
  productsCount: number;
  onLoadMore: () => void;
  onStartSale: (product: Product) => void;
  onOpenHistoryModal: (product: Product) => void;
  onOpenGlobalHistoryModal: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onAdjustInventory: (product: Product) => void;
  onEditGlobalProduct: (product: Product) => void;
  onAdjustGlobalInventory: (product: Product) => void;
}

// Celdas de costo + margen (gated por canViewCosts en el caller).
const CostMarginCells: React.FC<{ product: Product }> = ({ product }) => {
  const cost = product.cost;
  const price = Number(product.price) || 0;
  const margin = cost != null && price > 0 ? ((price - cost) / price) * 100 : null;
  const marginClass = margin == null
    ? 'text-stone-300'
    : margin > 30 ? 'text-green-600'
    : margin > 15 ? 'text-amber-600'
    : 'text-red-600';
  return (
    <>
      <td className="w-24 px-3 py-2 whitespace-nowrap text-sm text-right">
        {cost != null ? (
          <span className="text-stone-900">${Number(cost).toLocaleString()}</span>
        ) : (
          <span className="text-amber-500 text-xs font-medium">Sin costo</span>
        )}
      </td>
      <td className={`w-20 px-3 py-2 whitespace-nowrap text-sm text-right font-medium ${marginClass}`}>
        {margin != null ? `${margin.toFixed(1)}%` : '-'}
      </td>
    </>
  );
};

const getSortIcon = (sortConfig: SortConfig, field: SortField) => {
  if (sortConfig.field !== field) {
    return <ArrowUpDown className="w-4 h-4 text-stone-400" />;
  }
  return sortConfig.direction === 'asc'
    ? <ArrowUp className="w-4 h-4 text-brand-600" />
    : <ArrowDown className="w-4 h-4 text-brand-600" />;
};

const ProductsTable: React.FC<ProductsTableProps> = ({
  activeTab,
  sortConfig,
  onSort,
  schoolProducts,
  globalProducts,
  availableSchools,
  canAdjustGlobalInventory,
  canEditGlobalProduct,
  canViewCosts,
  hasMoreProducts,
  loadingMore,
  productsCount,
  onLoadMore,
  onStartSale,
  onOpenHistoryModal,
  onOpenGlobalHistoryModal,
  onEditProduct,
  onAdjustInventory,
  onEditGlobalProduct,
  onAdjustGlobalInventory,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
      <table className="min-w-full divide-y divide-stone-100 table-fixed tabular-nums">
        <thead className={activeTab === 'global' ? 'bg-green-50' : 'bg-stone-50'}>
          <tr>
            <th
              className="w-28 px-3 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider cursor-pointer hover:bg-stone-100"
              onClick={() => onSort('code')}
            >
              <div className="flex items-center gap-1">
                Codigo
                {getSortIcon(sortConfig, 'code')}
              </div>
            </th>
            {activeTab === 'school' && availableSchools.length > 1 && (
              <th className="w-48 px-3 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                Colegio
              </th>
            )}
            <th
              className="px-3 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider cursor-pointer hover:bg-stone-100"
              onClick={() => onSort('name')}
            >
              <div className="flex items-center gap-1">
                Nombre / Tipo
                {getSortIcon(sortConfig, 'name')}
              </div>
            </th>
            <th
              className="w-20 px-3 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider cursor-pointer hover:bg-stone-100"
              onClick={() => onSort('size')}
            >
              <div className="flex items-center gap-1">
                Talla
                {getSortIcon(sortConfig, 'size')}
              </div>
            </th>
            <th className="w-24 px-3 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
              Color
            </th>
            <th
              className="w-24 px-3 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider cursor-pointer hover:bg-stone-100"
              onClick={() => onSort('price')}
            >
              <div className="flex items-center justify-end gap-1">
                Precio
                {getSortIcon(sortConfig, 'price')}
              </div>
            </th>
            {canViewCosts && (
              <>
                <th className="w-24 px-3 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Costo
                </th>
                <th className="w-20 px-3 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Margen
                </th>
              </>
            )}
            <th
              className="w-20 px-3 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider cursor-pointer hover:bg-stone-100"
              onClick={() => onSort('stock')}
            >
              <div className="flex items-center justify-end gap-1">
                Stock
                {getSortIcon(sortConfig, 'stock')}
              </div>
            </th>
            {activeTab === 'school' && (
              <th
                className="w-24 px-3 py-3 text-center text-xs font-medium text-stone-500 uppercase tracking-wider cursor-pointer hover:bg-stone-100"
                onClick={() => onSort('pending_orders')}
              >
                <div className="flex items-center justify-center gap-1">
                  Encargos
                  {getSortIcon(sortConfig, 'pending_orders')}
                </div>
              </th>
            )}
            <th className="w-20 px-3 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="w-24 px-3 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-stone-100">
          {activeTab === 'school' ? (
            schoolProducts.map((product) => {
              const stock = product.stock ?? product.inventory_quantity ?? 0;
              const minStock = product.min_stock ?? product.inventory_min_stock ?? 5;
              const isLowStock = stock <= minStock && stock > 0;
              const isOutOfStock = stock === 0;
              const schoolName = product.school_name;
              const garmentTypeName = product.garment_type_name;
              const pendingOrdersQty = product.pending_orders_qty ?? 0;
              const pendingOrdersCount = product.pending_orders_count ?? 0;

              return (
                <tr key={product.id} className="hover:bg-stone-50">
                  <td className="w-28 px-3 py-2 whitespace-nowrap text-sm font-medium text-stone-900">
                    {product.code}
                  </td>
                  {availableSchools.length > 1 && (
                    <td className="w-48 px-3 py-2 text-sm text-stone-900">
                      <div className="flex items-center">
                        <Building2 className="w-4 h-4 mr-2 text-stone-400 flex-shrink-0" />
                        <span className="truncate" title={schoolName || ''}>
                          {schoolName || 'Sin colegio'}
                        </span>
                      </div>
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-stone-900 truncate">{product.name || '-'}</div>
                      {garmentTypeName && (
                        <div className="text-xs text-stone-500 truncate">{garmentTypeName}</div>
                      )}
                    </div>
                  </td>
                  <td className="w-20 px-3 py-2 whitespace-nowrap text-sm text-stone-900">
                    <span className="px-2 py-0.5 bg-stone-100 rounded text-stone-700 font-medium text-xs">
                      {product.size}
                    </span>
                  </td>
                  <td className="w-24 px-3 py-2 whitespace-nowrap text-sm text-stone-900">
                    {product.color || '-'}
                  </td>
                  <td className="w-24 px-3 py-2 whitespace-nowrap text-sm text-stone-900 text-right font-medium">
                    ${Number(product.price).toLocaleString()}
                  </td>
                  {canViewCosts && <CostMarginCells product={product} />}
                  <td className="w-20 px-3 py-2 whitespace-nowrap text-sm text-right">
                    <div className="flex flex-col items-end">
                      <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        isOutOfStock
                          ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                          : isLowStock
                          ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                          : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      }`}>
                        {stock}
                      </span>
                      <span className="text-xs text-stone-400">min:{minStock}</span>
                    </div>
                  </td>
                  <td className="w-24 px-3 py-2 whitespace-nowrap text-center">
                    {pendingOrdersQty > 0 ? (
                      <div className="flex flex-col items-center">
                        <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                          {pendingOrdersQty} uds
                        </span>
                        <span className="text-xs text-stone-400">
                          {pendingOrdersCount} enc.
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-stone-400">-</span>
                    )}
                  </td>
                  <td className="w-20 px-3 py-2 whitespace-nowrap">
                    <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      product.is_active
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : 'bg-stone-100 text-stone-800'
                    }`}>
                      {product.is_active ? 'Activo' : 'Inact.'}
                    </span>
                  </td>
                  <td className="w-24 px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-1">
                      <RequirePermission permission={stock > 0 ? "sales.create" : "orders.create"}>
                        <button
                          onClick={() => onStartSale(product)}
                          className="text-purple-600 hover:text-purple-800 p-1 rounded hover:bg-purple-50"
                          title={stock > 0 ? "Iniciar venta con este producto" : "Crear encargo (sin stock)"}
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </button>
                      </RequirePermission>
                      <button
                        onClick={() => onOpenHistoryModal(product)}
                        className="text-stone-600 hover:text-stone-800 p-1 rounded hover:bg-stone-50"
                        title="Ver historial de movimientos"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <RequirePermission permission="products.edit">
                        <button
                          onClick={() => onEditProduct(product)}
                          className="text-brand-600 hover:text-brand-700 p-1 rounded hover:bg-brand-50"
                          title="Editar producto"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </RequirePermission>
                      <RequirePermission permission="inventory.adjust">
                        <button
                          onClick={() => onAdjustInventory(product)}
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
            globalProducts.map((product) => {
              const stock = product.stock ?? product.inventory_quantity ?? 0;
              const minStock = product.min_stock ?? product.inventory_min_stock ?? 5;
              const isLowStock = stock <= minStock && stock > 0;
              const isOutOfStock = stock === 0;

              return (
                <tr key={product.id} className="hover:bg-green-50">
                  <td className="w-28 px-3 py-2 whitespace-nowrap text-sm font-medium text-stone-900">
                    <div className="flex items-center">
                      <Globe className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
                      {product.code}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm text-stone-900">
                    {product.name || '-'}
                  </td>
                  <td className="w-20 px-3 py-2 whitespace-nowrap text-sm text-stone-900">
                    <span className="px-2 py-0.5 bg-stone-100 rounded text-stone-700 font-medium text-xs">
                      {product.size}
                    </span>
                  </td>
                  <td className="w-24 px-3 py-2 whitespace-nowrap text-sm text-stone-900">
                    {product.color || '-'}
                  </td>
                  <td className="w-24 px-3 py-2 whitespace-nowrap text-sm text-stone-900 text-right font-medium">
                    ${Number(product.price).toLocaleString()}
                  </td>
                  {canViewCosts && <CostMarginCells product={product} />}
                  <td className="w-20 px-3 py-2 whitespace-nowrap text-sm text-right">
                    <div className="flex flex-col items-end">
                      <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        isOutOfStock
                          ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                          : isLowStock
                          ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                          : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      }`}>
                        {stock}
                      </span>
                      <span className="text-xs text-stone-400">min:{minStock}</span>
                    </div>
                  </td>
                  <td className="w-20 px-3 py-2 whitespace-nowrap">
                    <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      product.is_active
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : 'bg-stone-100 text-stone-800'
                    }`}>
                      {product.is_active ? 'Activo' : 'Inact.'}
                    </span>
                  </td>
                  <td className="w-24 px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onOpenGlobalHistoryModal(product)}
                        className="text-stone-600 hover:text-stone-800 p-1 rounded hover:bg-stone-50"
                        title="Ver historial de movimientos"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      {canEditGlobalProduct && (
                        <button
                          onClick={() => onEditGlobalProduct(product)}
                          className="text-brand-600 hover:text-brand-700 p-1 rounded hover:bg-brand-50"
                          title="Editar producto global"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canAdjustGlobalInventory && (
                        <button
                          onClick={() => onAdjustGlobalInventory(product)}
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

      {/* Load More Button */}
      {activeTab === 'school' && hasMoreProducts && (
        <div className="p-4 text-center border-t border-stone-200">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cargando...
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-2" />
                Cargar mas productos
              </>
            )}
          </button>
          <p className="text-xs text-stone-500 mt-1">
            Mostrando {productsCount} productos
          </p>
        </div>
      )}
    </div>
  );
};

export default React.memo(ProductsTable);
