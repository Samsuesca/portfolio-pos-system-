/**
 * Tab bar for switching between School Products, Global Products,
 * and Cost Insights. Garment types are now managed inside the product tabs
 * via the "Árbol" view mode (type → variants), so they no longer have a tab.
 */
import React from 'react';
import { Building2, Globe, BarChart3 } from 'lucide-react';
import type { TabType } from './types';

interface ProductsTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  productsCount: number;
  globalProductsCount: number;
  canViewCosts: boolean;
}

const ProductsTabs: React.FC<ProductsTabsProps> = ({
  activeTab,
  onTabChange,
  productsCount,
  globalProductsCount,
  canViewCosts,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm mb-6">
      <div className="flex border-b border-stone-200">
        <button
          onClick={() => onTabChange('school')}
          className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition ${
            activeTab === 'school'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-200'
          }`}
        >
          <Building2 className="w-5 h-5 mr-2" />
          Productos por Colegio
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-stone-100">
            {productsCount}
          </span>
        </button>
        <button
          onClick={() => onTabChange('global')}
          className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition ${
            activeTab === 'global'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-200'
          }`}
        >
          <Globe className="w-5 h-5 mr-2" />
          Productos Compartidos
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-stone-100">
            {globalProductsCount}
          </span>
        </button>
        {canViewCosts && (
          <button
            onClick={() => onTabChange('cost-insights')}
            className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition ${
              activeTab === 'cost-insights'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-200'
            }`}
          >
            <BarChart3 className="w-5 h-5 mr-2" />
            Análisis de costos
          </button>
        )}
      </div>

      {/* Tab description */}
      <div className="px-6 py-3 bg-stone-50 border-b border-stone-200">
        {activeTab === 'school' ? (
          <p className="text-sm text-stone-600">
            Uniformes <strong>específicos por colegio</strong>. Cambia a la vista <strong>Árbol</strong> para gestionar tipos de prenda y sus variantes.
          </p>
        ) : activeTab === 'global' ? (
          <p className="text-sm text-stone-600">
            Productos compartidos entre todos los colegios: <strong>Tennis, Zapatos, Medias, Jean, Blusa</strong>
          </p>
        ) : (
          <p className="text-sm text-stone-600">
            Vista agregada: <strong>cobertura de costos, márgenes por colegio</strong> y distribución por componente.
          </p>
        )}
      </div>
    </div>
  );
};

export default React.memo(ProductsTabs);
