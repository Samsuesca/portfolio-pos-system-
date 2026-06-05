/**
 * Page header with title, subtitle, and action buttons
 * (New Product, New Global Product, New Garment Type, Manage Costs).
 */
import React from 'react';
import { Plus, DollarSign } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';
import type { TabType } from './types';

interface ProductsHeaderProps {
  activeTab: TabType;
  isLoading: boolean;
  currentProductsCount: number;
  schoolFilter: string;
  availableSchoolsCount: number;
  onOpenCostManager: () => void;
  onOpenProductModal: () => void;
  onOpenGlobalProductModal: () => void;
}

const ProductsHeader: React.FC<ProductsHeaderProps> = ({
  activeTab,
  isLoading,
  currentProductsCount,
  schoolFilter,
  availableSchoolsCount,
  onOpenCostManager,
  onOpenProductModal,
  onOpenGlobalProductModal,
}) => {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Productos</h1>
        <p className="text-stone-600 mt-1">
          {isLoading ? 'Cargando...' : `${currentProductsCount} productos mostrados`}
          {activeTab === 'school' && schoolFilter && availableSchoolsCount > 1 && (
            <span className="ml-2 text-brand-600">
              - Filtrado por colegio
            </span>
          )}
        </p>
      </div>
      <div className="flex gap-3">
        <RequirePermission permissions={['inventory.view_cost', 'sales.view_cost']}>
          <button
            onClick={onOpenCostManager}
            className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-4 py-2 rounded-lg flex items-center transition"
          >
            <DollarSign className="w-5 h-5 mr-2" />
            Gestionar Costos
          </button>
        </RequirePermission>
        {activeTab === 'school' && (
          <RequirePermission permission="products.create">
            <button
              onClick={onOpenProductModal}
              className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center transition"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nuevo Producto
            </button>
          </RequirePermission>
        )}
        {activeTab === 'global' && (
          <RequirePermission permission="products.create_global">
            <button
              onClick={onOpenGlobalProductModal}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center transition"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nuevo Producto Global
            </button>
          </RequirePermission>
        )}
      </div>
    </div>
  );
};

export default React.memo(ProductsHeader);
