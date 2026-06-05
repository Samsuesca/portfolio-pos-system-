/**
 * Quick view of a garment-type group's variants — opened from a grid card so
 * the user can scan sizes/colors/prices/stock without leaving the catalog
 * (replaces the old jump to the dense table view).
 */
import React from 'react';
import { X, Image as ImageIcon, Layers, Table2 } from 'lucide-react';
import type { ProductGroup } from '../../utils/productGrouping';
import { formatPriceRange, getEmojiForCategory } from '../../utils/productGrouping';
import { colorToCss } from '../../utils/colorSwatch';

interface VariantQuickViewModalProps {
  group: ProductGroup;
  onClose: () => void;
  onManage: () => void;
  onViewInTable: () => void;
}

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function stockClasses(stock: number): string {
  if (stock === 0) return 'text-rose-600 bg-rose-50';
  if (stock <= 5) return 'text-amber-700 bg-amber-50';
  return 'text-stone-700 bg-stone-100';
}

const VariantQuickViewModal: React.FC<VariantQuickViewModalProps> = ({
  group,
  onClose,
  onManage,
  onViewInTable,
}) => {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-start gap-3 p-4 border-b border-stone-200">
            <div className="w-16 h-16 rounded-lg bg-white border border-stone-100 grid place-items-center overflow-hidden flex-shrink-0">
              {group.garmentTypeImageUrl ? (
                <img src={group.garmentTypeImageUrl} alt={group.garmentTypeName} className="w-full h-full object-contain p-1" />
              ) : (
                <span className="text-2xl">{getEmojiForCategory(group.garmentTypeName)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-stone-900 truncate">{group.garmentTypeName}</h2>
              <p className="text-sm text-stone-500 tabular-nums">
                {formatPriceRange(group.basePrice, group.maxPrice)}
              </p>
              <div className="mt-1 flex items-center gap-3 text-xs text-stone-400 tabular-nums">
                <span>{group.variants.length} variantes</span>
                <span>·</span>
                <span>{group.sizes.length} tallas</span>
                <span>·</span>
                <span>{group.totalStock} und</span>
              </div>
            </div>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Variant list */}
          <div className="overflow-y-auto p-2 flex-1">
            {group.variants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-stone-400">
                <ImageIcon className="w-8 h-8 mb-2" />
                <p className="text-sm">Este tipo no tiene variantes aún.</p>
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {group.variants.map((v) => (
                  <li key={v.productId} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-brand-50/50 transition">
                    <span className="inline-flex items-center justify-center min-w-[2.25rem] h-7 px-2 rounded-md bg-stone-100 text-sm font-semibold text-stone-800">
                      {v.size}
                    </span>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {v.color ? (
                        <>
                          <span
                            className="w-3 h-3 rounded-full ring-1 ring-stone-300 flex-shrink-0"
                            style={{ backgroundColor: colorToCss(v.color) }}
                          />
                          <span className="text-sm text-stone-600 truncate">{v.color}</span>
                        </>
                      ) : (
                        <span className="text-sm text-stone-400">Sin color</span>
                      )}
                    </div>
                    <span className="text-sm font-medium tabular-nums text-stone-800">{COP.format(Number(v.price))}</span>
                    <span className={`text-xs font-semibold tabular-nums px-2 py-0.5 rounded ${stockClasses(v.stock)}`}>
                      {v.stock} und
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 p-3 border-t border-stone-200">
            <button
              onClick={onManage}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition"
            >
              <Layers className="w-4 h-4" /> Gestionar grupo
            </button>
            <button
              onClick={onViewInTable}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 bg-stone-50 hover:bg-stone-100 rounded-lg transition"
              title="Abrir en la tabla con filtro por este tipo"
            >
              <Table2 className="w-4 h-4" /> Ver en tabla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(VariantQuickViewModal);
