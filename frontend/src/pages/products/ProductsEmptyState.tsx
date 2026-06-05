/**
 * Empty state displayed when no products match the current filters
 * or when there are no products at all.
 */
import React from 'react';
import { Package, Plus } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';
import type { TabType } from './types';

interface ProductsEmptyStateProps {
  activeTab: TabType;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onAddProduct: () => void;
}

const ProductsEmptyState: React.FC<ProductsEmptyStateProps> = ({
  activeTab,
  hasActiveFilters,
  onClearFilters,
  onAddProduct,
}) => {
  return (
    <div className={`border rounded-lg p-12 text-center ${
      activeTab === 'global' ? 'bg-green-50 border-green-200' : 'bg-brand-50 border-brand-200'
    }`}>
      <Package className={`w-16 h-16 mx-auto mb-4 ${
        activeTab === 'global' ? 'text-green-400' : 'text-brand-400'
      }`} />
      <h3 className={`text-lg font-medium mb-2 ${
        activeTab === 'global' ? 'text-green-900' : 'text-brand-700'
      }`}>
        {hasActiveFilters ? 'No se encontraron productos' : 'No hay productos'}
      </h3>
      <p className={activeTab === 'global' ? 'text-green-700 mb-4' : 'text-brand-700 mb-4'}>
        {hasActiveFilters
          ? 'Intenta ajustar los filtros de busqueda'
          : activeTab === 'global'
          ? 'Los productos globales son configurados por el administrador'
          : 'Comienza agregando tu primer producto al catalogo'
        }
      </p>
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="text-brand-600 hover:text-brand-700 underline mr-4"
        >
          Limpiar filtros
        </button>
      )}
      {!hasActiveFilters && activeTab === 'school' && (
        <RequirePermission permission="products.create">
          <button
            onClick={onAddProduct}
            className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-2 rounded-lg inline-flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Agregar Producto
          </button>
        </RequirePermission>
      )}
    </div>
  );
};

export default React.memo(ProductsEmptyState);
