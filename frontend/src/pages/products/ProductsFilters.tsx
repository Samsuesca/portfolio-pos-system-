/**
 * Search bar, stock filter buttons, and extended filter dropdowns
 * for the Products page.
 */
import React, { useState } from 'react';
import { Search, Filter, ChevronDown } from 'lucide-react';
import type { TabType, StockFilter, GarmentType } from './types';

interface School {
  id: string;
  name: string;
}

interface ProductsFiltersProps {
  activeTab: TabType;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  stockFilter: StockFilter;
  onStockFilterChange: (filter: StockFilter) => void;
  sizeFilter: string;
  onSizeFilterChange: (value: string) => void;
  schoolFilter: string;
  onSchoolFilterChange: (value: string) => void;
  garmentTypeFilter: string;
  onGarmentTypeFilterChange: (value: string) => void;
  availableSchools: School[];
  garmentTypes: GarmentType[];
  uniqueSizes: string[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

const ProductsFilters: React.FC<ProductsFiltersProps> = ({
  activeTab,
  searchTerm,
  onSearchChange,
  stockFilter,
  onStockFilterChange,
  sizeFilter,
  onSizeFilterChange,
  schoolFilter,
  onSchoolFilterChange,
  garmentTypeFilter,
  onGarmentTypeFilterChange,
  availableSchools,
  garmentTypes,
  uniqueSizes,
  hasActiveFilters,
  onClearFilters,
}) => {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por codigo, nombre, talla, tipo..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Quick Stock Filter Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onStockFilterChange('all')}
            className={`px-3 py-2 text-sm rounded-lg border transition ${
              stockFilter === 'all'
                ? 'bg-blue-100 border-blue-500 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => onStockFilterChange('in_stock')}
            className={`px-3 py-2 text-sm rounded-lg border transition ${
              stockFilter === 'in_stock'
                ? 'bg-green-100 border-green-500 text-green-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            En Stock
          </button>
          <button
            onClick={() => onStockFilterChange('low_stock')}
            className={`px-3 py-2 text-sm rounded-lg border transition ${
              stockFilter === 'low_stock'
                ? 'bg-yellow-100 border-yellow-500 text-yellow-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Stock Bajo
          </button>
          <button
            onClick={() => onStockFilterChange('out_of_stock')}
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
              onClick={() => onStockFilterChange('with_orders')}
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
            onClick={onClearFilters}
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
                onChange={(e) => onSchoolFilterChange(e.target.value)}
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
                onChange={(e) => onGarmentTypeFilterChange(e.target.value)}
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
              onChange={(e) => onSizeFilterChange(e.target.value)}
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
  );
};

export default React.memo(ProductsFilters);
