import { useNavigate } from 'react-router-dom';
import { AlertCircle, Package } from 'lucide-react';
import type { Product } from '../../types/api';
import { DashboardWidget } from './DashboardWidget';

interface LowStockWidgetProps {
  products: Product[];
  loading?: boolean;
}

export function LowStockWidget({ products, loading = false }: LowStockWidgetProps) {
  const navigate = useNavigate();

  return (
    <DashboardWidget
      title="Alertas de Stock Bajo"
      icon={AlertCircle}
      iconColor="text-amber-600"
      headerAction={{
        label: 'Ver productos',
        onClick: () => navigate('/products'),
      }}
      loading={loading}
      emptyState={{
        icon: Package,
        message: 'No hay alertas de stock bajo',
        submessage: '¡Todo en orden!',
      }}
    >
      {products.length > 0 && (
        <div className="space-y-3">
          {products.map((product) => {
            const stock = product.stock ?? product.inventory_quantity ?? 0;
            const isOutOfStock = stock === 0;
            return (
              <div
                key={product.id}
                onClick={() => navigate('/products')}
                className="flex items-center justify-between py-3 px-3 -mx-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-800 truncate">
                      {product.name || product.code}
                    </span>
                  </div>
                  <p className="text-sm text-stone-500">
                    {product.code} - Talla {product.size}
                  </p>
                </div>
                <div className="flex-shrink-0 ml-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      isOutOfStock
                        ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isOutOfStock ? 'Sin stock' : `${stock} uds`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}

export default LowStockWidget;
