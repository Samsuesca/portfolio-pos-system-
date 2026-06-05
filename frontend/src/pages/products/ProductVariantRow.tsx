/**
 * A single product variant (size/color SKU) rendered as a sub-row under its
 * garment type in the catalog tree. Shows code, size, color swatch, price,
 * margin, stock, and inline actions revealed on hover.
 */
import React from 'react';
import { Pencil, Boxes, History } from 'lucide-react';
import type { Product } from './types';
import { colorToCss } from '../../utils/colorSwatch';

interface ProductVariantRowProps {
  product: Product;
  canViewCosts: boolean;
  onEdit: (product: Product) => void;
  onAdjustInventory: (product: Product) => void;
  onOpenHistory: (product: Product) => void;
}

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function stockBadgeClasses(stock: number, minStock: number): string {
  if (stock === 0) return 'text-red-600 bg-red-50';
  if (stock <= minStock) return 'text-amber-700 bg-amber-50';
  return 'text-stone-700 bg-stone-100';
}

const ProductVariantRow: React.FC<ProductVariantRowProps> = ({
  product,
  canViewCosts,
  onEdit,
  onAdjustInventory,
  onOpenHistory,
}) => {
  const stock = product.stock ?? product.inventory_quantity ?? 0;
  const minStock = product.min_stock ?? product.inventory_min_stock ?? 5;
  const price = Number(product.price);
  const cost = product.cost != null ? Number(product.cost) : null;
  const margin = cost != null && price > 0 ? (1 - cost / price) * 100 : null;

  return (
    <div className="grid items-center gap-2 pl-12 pr-4 py-2 border-b border-stone-100 last:border-0 hover:bg-brand-50/40 transition-colors group"
      style={{ gridTemplateColumns: '90px 56px 1fr 96px 96px 72px 80px' }}>
      {/* Code */}
      <span className="text-xs font-mono text-stone-500 truncate" title={product.code}>{product.code}</span>

      {/* Size */}
      <span className="text-sm font-semibold text-stone-800">{product.size}</span>

      {/* Color with swatch */}
      <div className="flex items-center gap-1.5 min-w-0">
        {product.color && (
          <span
            className="w-3 h-3 rounded-full ring-1 ring-stone-300 flex-shrink-0"
            style={{ backgroundColor: colorToCss(product.color) }}
          />
        )}
        <span className="text-xs text-stone-600 truncate">{product.color || '—'}</span>
      </div>

      {/* Price */}
      <span className="text-sm text-right tabular-nums text-stone-800 font-medium">
        {COP.format(price)}
      </span>

      {/* Margin (only with cost permission) */}
      {canViewCosts ? (
        margin != null ? (
          <div className="flex items-center justify-end gap-1.5">
            <div className="w-10 h-1.5 bg-stone-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${margin >= 30 ? 'bg-emerald-400' : margin >= 15 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${Math.max(0, Math.min(100, margin))}%` }}
              />
            </div>
            <span className="text-xs text-stone-500 tabular-nums w-8 text-right">{margin.toFixed(0)}%</span>
          </div>
        ) : (
          <span className="text-xs text-stone-300 text-right">—</span>
        )
      ) : (
        <span />
      )}

      {/* Stock */}
      <span className={`text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded text-right ${stockBadgeClasses(stock, minStock)}`}>
        {stock} u
      </span>

      {/* Actions */}
      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(product)}
          title="Editar variante"
          className="p-1.5 text-stone-400 hover:text-brand-600 hover:bg-brand-50 rounded transition"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onAdjustInventory(product)}
          title="Ajustar inventario"
          className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
        >
          <Boxes className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onOpenHistory(product)}
          title="Ver historial de inventario"
          className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded transition"
        >
          <History className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default React.memo(ProductVariantRow);
