/**
 * Tab bar for switching between School Products, Global Products,
 * and Garment Types views.
 */
import React from 'react';
import { Building2, Globe, Tag } from 'lucide-react';
import type { TabType } from './types';

interface ProductsTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  productsCount: number;
  globalProductsCount: number;
  garmentTypesCount: number;
  globalGarmentTypesCount: number;
  canManageGarmentTypes: boolean;
  currentSchoolName: string;
}

const ProductsTabs: React.FC<ProductsTabsProps> = ({
  activeTab,
  onTabChange,
  productsCount,
  globalProductsCount,
  garmentTypesCount,
  globalGarmentTypesCount,
  canManageGarmentTypes,
  currentSchoolName,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm mb-6">
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => onTabChange('school')}
          className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition ${
            activeTab === 'school'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Building2 className="w-5 h-5 mr-2" />
          Productos del Colegio
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
            {productsCount}
          </span>
        </button>
        <button
          onClick={() => onTabChange('global')}
          className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition ${
            activeTab === 'global'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Globe className="w-5 h-5 mr-2" />
          Productos Compartidos
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
            {globalProductsCount}
          </span>
        </button>
        {canManageGarmentTypes && (
          <button
            onClick={() => onTabChange('garment-types')}
            className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition ${
              activeTab === 'garment-types'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Tag className="w-5 h-5 mr-2" />
            Tipos de Prenda
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
              {garmentTypesCount + globalGarmentTypesCount}
            </span>
          </button>
        )}
      </div>

      {/* Tab description */}
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
        {activeTab === 'school' ? (
          <p className="text-sm text-gray-600">
            Uniformes especificos de <strong>{currentSchoolName}</strong> (camisetas, pantalones, etc.)
          </p>
        ) : activeTab === 'global' ? (
          <p className="text-sm text-gray-600">
            Productos compartidos entre todos los colegios: <strong>Tennis, Zapatos, Medias, Jean, Blusa</strong>
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            Gestiona los <strong>tipos de prenda</strong> (Camisa, Pantalon, Zapatos, etc.) que se pueden usar para crear productos
          </p>
        )}
      </div>
    </div>
  );
};

export default React.memo(ProductsTabs);
