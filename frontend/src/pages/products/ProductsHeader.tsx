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
  garmentTypesDisplayCount: number;
  schoolFilter: string;
  availableSchoolsCount: number;
  isSuperuser: boolean;
  canManageGarmentTypes: boolean;
  showGlobalTypes: boolean;
  onOpenCostManager: () => void;
  onOpenProductModal: () => void;
  onOpenGlobalProductModal: () => void;
  onOpenGarmentTypeModal: (isGlobal: boolean) => void;
}

const ProductsHeader: React.FC<ProductsHeaderProps> = ({
  activeTab,
  isLoading,
  currentProductsCount,
  garmentTypesDisplayCount,
  schoolFilter,
  availableSchoolsCount,
  isSuperuser,
  canManageGarmentTypes,
  showGlobalTypes,
  onOpenCostManager,
  onOpenProductModal,
  onOpenGlobalProductModal,
  onOpenGarmentTypeModal,
}) => {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Productos</h1>
        <p className="text-gray-600 mt-1">
          {isLoading ? 'Cargando...' :
            activeTab === 'garment-types'
              ? `${garmentTypesDisplayCount} tipos de prenda`
              : `${currentProductsCount} productos encontrados`
          }
          {activeTab === 'school' && schoolFilter && availableSchoolsCount > 1 && (
            <span className="ml-2 text-blue-600">
              - Filtrado por colegio
            </span>
          )}
        </p>
      </div>
      <div className="flex gap-3">
        <RequirePermission permission="products.set_cost">
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
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nuevo Producto
            </button>
          </RequirePermission>
        )}
        {activeTab === 'global' && isSuperuser && (
          <button
            onClick={onOpenGlobalProductModal}
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
                onClick={() => onOpenGarmentTypeModal(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition"
              >
                <Plus className="w-5 h-5 mr-2" />
                Nuevo Tipo del Colegio
              </button>
            )}
            {showGlobalTypes && isSuperuser && (
              <button
                onClick={() => onOpenGarmentTypeModal(true)}
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
  );
};

export default React.memo(ProductsHeader);
