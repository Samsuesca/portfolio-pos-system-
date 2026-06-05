/**
 * One garment type rendered as an expandable tree row. Collapsed it shows the
 * type's catalog stats (variant count, total stock, price range) plus its
 * category and origin badges; expanded it reveals the variant sub-rows.
 */
import React from 'react';
import {
  ChevronRight, Image as ImageIcon, Factory, ShoppingBag,
  Pencil, Layers, Plus, Loader2,
} from 'lucide-react';
import type { GarmentType, Product } from './types';
import ProductVariantRow from './ProductVariantRow';

interface GarmentTypeRowProps {
  type: GarmentType;
  isGlobal: boolean;
  isExpanded: boolean;
  isLoadingVariants: boolean;
  variants: Product[] | undefined;
  canManage: boolean;
  canViewCosts: boolean;
  getImageUrl: (imageUrl: string | undefined | null) => string | null;
  onToggle: (type: GarmentType) => void;
  onEditType: (type: GarmentType) => void;
  onOpenCostBreakdown: (type: GarmentType, isGlobal: boolean) => void;
  onAddVariant: (type: GarmentType) => void;
  onEditVariant: (product: Product) => void;
  onAdjustInventory: (product: Product) => void;
  onOpenHistory: (product: Product) => void;
}

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const CATEGORY_LABELS: Record<string, string> = {
  uniforme_diario: 'Diario',
  uniforme_deportivo: 'Deportivo',
  accesorios: 'Accesorios',
};

const GRID = '28px 44px 1fr 104px 84px 84px 116px 132px';

function priceRange(min?: number | null, max?: number | null): string {
  if (min == null && max == null) return '—';
  if (min != null && max != null && min !== max) return `${COP.format(min)}–${COP.format(max)}`;
  return COP.format((min ?? max) as number);
}

const GarmentTypeRow: React.FC<GarmentTypeRowProps> = ({
  type,
  isGlobal,
  isExpanded,
  isLoadingVariants,
  variants,
  canManage,
  canViewCosts,
  getImageUrl,
  onToggle,
  onEditType,
  onOpenCostBreakdown,
  onAddVariant,
  onEditVariant,
  onAdjustInventory,
  onOpenHistory,
}) => {
  const primaryImage = Array.isArray(type.images) && type.images.length > 0
    ? type.images.find(img => img.is_primary)?.image_url ?? type.images[0].image_url
    : type.primary_image_url ?? null;
  const imageUrl = getImageUrl(primaryImage);
  const isManufactured = type.cost_type !== 'purchased';
  const count = type.product_count ?? 0;

  return (
    <div className={`border-b border-stone-100 ${!type.is_active ? 'opacity-60' : ''}`}>
      {/* Type row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggle(type)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(type); } }}
        className="grid items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-brand-50/60 transition-colors group focus:outline-none focus-visible:bg-brand-50"
        style={{ gridTemplateColumns: GRID }}
      >
        {/* Chevron */}
        <span className="flex items-center justify-center">
          <ChevronRight
            className={`w-4 h-4 text-stone-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        </span>

        {/* Thumbnail */}
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-stone-100 flex items-center justify-center">
          {imageUrl ? (
            <img src={imageUrl} alt={type.name} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-5 h-5 text-stone-300" />
          )}
        </div>

        {/* Name + badges */}
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-sm font-semibold truncate ${type.is_active ? 'text-stone-900' : 'text-stone-500 line-through'}`}>
            {type.name}
          </span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
            isManufactured
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            {isManufactured ? <Factory className="w-3 h-3" /> : <ShoppingBag className="w-3 h-3" />}
            {isManufactured ? 'Fabrica' : 'Compra'}
          </span>
          {!type.has_images && type.is_active && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-orange-50 text-orange-600 border border-orange-200">
              Sin foto
            </span>
          )}
        </div>

        {/* Category */}
        <div className="flex justify-start">
          {type.category ? (
            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-50 text-brand-700 border border-brand-200">
              {CATEGORY_LABELS[type.category] ?? type.category}
            </span>
          ) : (
            <span className="text-xs text-stone-300">—</span>
          )}
        </div>

        {/* Variant count */}
        <span className="text-sm text-center tabular-nums text-stone-700 font-medium">
          {count}
        </span>

        {/* Total stock */}
        <span className="text-sm text-right tabular-nums text-stone-600">
          {type.total_stock ?? 0} u
        </span>

        {/* Price range */}
        <span className="text-sm text-right tabular-nums text-stone-600">
          {isManufactured && (type.min_price == null && type.max_price == null)
            ? '—'
            : priceRange(type.min_price, type.max_price)}
        </span>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {canViewCosts && isManufactured && (
            <button
              onClick={() => onOpenCostBreakdown(type, isGlobal)}
              title="Ver desglose de costos"
              className="p-1.5 text-stone-400 hover:text-amber-700 hover:bg-amber-50 rounded transition"
            >
              <Layers className="w-4 h-4" />
            </button>
          )}
          {canManage && (
            <>
              <button
                onClick={() => onAddVariant(type)}
                title="Agregar variante"
                className="hidden group-hover:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-md transition"
              >
                <Plus className="w-3.5 h-3.5" /> Variante
              </button>
              <button
                onClick={() => onEditType(type)}
                title="Editar tipo de prenda"
                className="p-1.5 text-stone-400 hover:text-brand-600 hover:bg-brand-50 rounded transition"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded variants */}
      {isExpanded && (
        <div className="bg-stone-50/40">
          {isLoadingVariants ? (
            <div className="flex items-center gap-2 pl-12 py-4 text-sm text-stone-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando variantes...
            </div>
          ) : variants && variants.length > 0 ? (
            <>
              {variants.map(v => (
                <ProductVariantRow
                  key={v.id}
                  product={v}
                  canViewCosts={canViewCosts}
                  onEdit={onEditVariant}
                  onAdjustInventory={onAdjustInventory}
                  onOpenHistory={onOpenHistory}
                />
              ))}
              {canManage && (
                <div className="pl-12 py-2">
                  <button
                    onClick={() => onAddVariant(type)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 px-2 py-1 rounded-md hover:bg-brand-50 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar talla / variante
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="pl-12 pr-4 py-4">
              <p className="text-sm text-stone-500">Este tipo no tiene variantes aún.</p>
              {canManage && (
                <button
                  onClick={() => onAddVariant(type)}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-brand-500 hover:bg-brand-600 px-3 py-1.5 rounded-md transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar primera variante
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(GarmentTypeRow);
