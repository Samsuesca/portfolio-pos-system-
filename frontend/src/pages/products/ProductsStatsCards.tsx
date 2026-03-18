/**
 * Statistics cards row for the Products page.
 * Displays total products, stock, low stock, out of stock, orders info.
 */
import React from 'react';
import {
  Package, BarChart3, AlertTriangle, PackageX, ShoppingCart, TrendingUp,
} from 'lucide-react';
import type { ProductsStats, StockFilter } from './types';

interface ProductsStatsCardsProps {
  stats: ProductsStats;
  onStockFilterChange: (filter: StockFilter) => void;
}

const ProductsStatsCards: React.FC<ProductsStatsCardsProps> = ({ stats, onStockFilterChange }) => {
  return (
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
        onClick={() => onStockFilterChange('low_stock')}
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
        onClick={() => onStockFilterChange('out_of_stock')}
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
        onClick={() => onStockFilterChange('with_orders')}
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
  );
};

export default React.memo(ProductsStatsCards);
