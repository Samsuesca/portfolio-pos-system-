/**
 * Product Source Tabs
 * Toggle between school products and global products
 */
import { Building, Globe } from 'lucide-react';

interface ProductSourceTabsProps {
  productSource: 'school' | 'global';
  onSourceChange: (source: 'school' | 'global') => void;
  schoolProductCount: number;
  globalProductCount: number;
}

export default function ProductSourceTabs({
  productSource,
  onSourceChange,
  schoolProductCount,
  globalProductCount,
}: ProductSourceTabsProps) {
  return (
    <div className="flex space-x-1 mb-4 bg-gray-100 p-1 rounded-lg">
      <button
        type="button"
        onClick={() => onSourceChange('school')}
        className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition ${
          productSource === 'school'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <Building className="w-4 h-4 mr-2" />
        Productos del Colegio ({schoolProductCount})
      </button>
      <button
        type="button"
        onClick={() => onSourceChange('global')}
        className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition ${
          productSource === 'global'
            ? 'bg-white text-purple-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <Globe className="w-4 h-4 mr-2" />
        Productos Globales ({globalProductCount})
      </button>
    </div>
  );
}
