/**
 * Catalog grid view — one card per garment-type group, mirroring how the
 * product is shown to customers on the web storefront. Built from the loaded
 * products (grid mode loads the full catalog with images), so each card shows
 * the group's photo, price range, total stock, size count, cost coverage and
 * publication state at a glance.
 *
 * When `canReorder` is set, the cards can be dragged (native HTML5 DnD) to
 * define the per-school order shown in the catalog (issue #8). The order is
 * persisted via `onReorder` and the grid sorts groups by `catalogOrder`.
 */
import React, { useMemo, useState } from 'react';
import { Image as ImageIcon, Layers, Eye, Package, GripVertical, ArrowUpDown, Check, Loader2, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import {
  groupProductsByGarmentType,
  groupGlobalProductsByGarmentType,
  formatPriceRange,
  getEmojiForCategory,
} from '../../utils/productGrouping';
import type { ProductGroup } from '../../utils/productGrouping';
import VariantQuickViewModal from './VariantQuickViewModal';
import type { Product, GarmentType, CatalogOrderEntry } from '../../types/api';

interface ProductsGridProps {
  rawProducts: Product[];
  garmentTypes: GarmentType[];
  isGlobal: boolean;
  canViewCosts: boolean;
  /** Schools the user can see — used to label per-school sections. */
  schools?: { id: string; name: string }[];
  onManageGroup: (garmentTypeId: string) => void;
  onViewVariants: (garmentTypeId: string) => void;
  /** Per-school persisted order of garment-type cards. */
  catalogOrder?: CatalogOrderEntry[];
  /** Whether the user can drag-reorder the cards (requires `catalog.reorder`). */
  canReorder?: boolean;
  /** Persist a new order (array of garment_type_ids, first = shown first). */
  onReorder?: (garmentTypeIds: string[]) => void | Promise<void>;
}

interface GroupMeta {
  category: string | null;
  variants: number;
  withCost: number;
  marginAvg: number | null;
  photoCount: number;
  anyLowStock: boolean;
  activeCount: number;
}

function buildMeta(products: Product[], garmentTypes: GarmentType[]): Record<string, GroupMeta> {
  const gtMap = new Map(garmentTypes.map((gt) => [gt.id, gt]));
  const meta: Record<string, GroupMeta> = {};
  const marginSum: Record<string, number> = {};
  const marginCount: Record<string, number> = {};

  for (const p of products) {
    const id = p.garment_type_id;
    if (!meta[id]) {
      meta[id] = {
        category: gtMap.get(id)?.category ?? null,
        variants: 0,
        withCost: 0,
        marginAvg: null,
        photoCount: 0,
        anyLowStock: false,
        activeCount: 0,
      };
      marginSum[id] = 0;
      marginCount[id] = 0;
    }
    const m = meta[id];
    m.variants += 1;
    m.photoCount = Math.max(m.photoCount, p.garment_type_images?.length ?? 0);

    const cost = p.cost != null ? Number(p.cost) : null;
    const price = Number(p.price) || 0;
    if (cost != null && cost > 0) {
      m.withCost += 1;
      if (price > 0) {
        marginSum[id] += ((price - cost) / price) * 100;
        marginCount[id] += 1;
      }
    }

    const stock = p.stock ?? p.inventory_quantity ?? 0;
    const minStock = p.min_stock ?? p.inventory_min_stock ?? 5;
    if (stock > 0 && stock <= minStock) m.anyLowStock = true;
    if (p.is_active) m.activeCount += 1;
  }

  for (const id of Object.keys(meta)) {
    meta[id].marginAvg = marginCount[id] > 0 ? marginSum[id] / marginCount[id] : null;
  }
  return meta;
}

const ProductsGrid: React.FC<ProductsGridProps> = ({
  rawProducts,
  garmentTypes,
  isGlobal,
  canViewCosts,
  schools,
  onManageGroup,
  onViewVariants,
  catalogOrder,
  canReorder = false,
  onReorder,
}) => {
  const groups = useMemo(
    () =>
      isGlobal
        ? groupGlobalProductsByGarmentType(rawProducts, garmentTypes)
        : groupProductsByGarmentType(rawProducts, garmentTypes),
    [rawProducts, garmentTypes, isGlobal],
  );

  const meta = useMemo(() => buildMeta(rawProducts, garmentTypes), [rawProducts, garmentTypes]);

  const schoolNameMap = useMemo(
    () => new Map((schools ?? []).map((s) => [s.id, s.name])),
    [schools],
  );

  // Group into per-school sections when the school catalog spans more than one
  // school (i.e. no school filter is applied). Within a school, cards are
  // ordered by garment type name. Reorder (per-school DnD) is disabled here.
  const bySchool = !isGlobal && new Set(groups.map((g) => g.schoolId)).size > 1;
  const reorderEnabled = canReorder && !bySchool && groups.length > 1;

  // Sort groups by the persisted per-school order. Groups without an order entry
  // fall to the end keeping their original (server) order — JS sort is stable.
  const orderedGroups = useMemo(() => {
    const orderMap = new Map((catalogOrder ?? []).map((e) => [e.garment_type_id, e.display_order]));
    return groups
      .map((g, i) => ({ g, i }))
      .sort((a, b) => {
        const oa = orderMap.has(a.g.garmentTypeId) ? (orderMap.get(a.g.garmentTypeId) as number) : Number.POSITIVE_INFINITY;
        const ob = orderMap.has(b.g.garmentTypeId) ? (orderMap.get(b.g.garmentTypeId) as number) : Number.POSITIVE_INFINITY;
        return oa !== ob ? oa - ob : a.i - b.i;
      })
      .map((x) => x.g);
  }, [groups, catalogOrder]);

  // Reorder mode (drag & drop). `order` holds the live id sequence while dragging.
  const [reordering, setReordering] = useState(false);
  const [order, setOrder] = useState<string[] | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const enterReorder = () => {
    setOrder(orderedGroups.map((g) => g.garmentTypeId));
    setReordering(true);
  };
  const exitReorder = () => {
    setReordering(false);
    setOrder(null);
    setDraggedId(null);
  };

  const displayGroups = useMemo(() => {
    if (reordering && order) {
      const byId = new Map(orderedGroups.map((g) => [g.garmentTypeId, g]));
      return order.map((id) => byId.get(id)).filter(Boolean) as typeof orderedGroups;
    }
    return orderedGroups;
  }, [reordering, order, orderedGroups]);

  // Per-school sections (school → its types sorted by name), schools sorted by name.
  const schoolSections = useMemo(() => {
    if (!bySchool) return [];
    const map = new Map<string, typeof groups>();
    for (const g of groups) {
      const sid = g.schoolId ?? '';
      const list = map.get(sid);
      if (list) list.push(g);
      else map.set(sid, [g]);
    }
    return [...map.entries()]
      .map(([schoolId, gs]) => ({
        schoolId,
        schoolName: schoolNameMap.get(schoolId) ?? 'Sin colegio',
        groups: gs.slice().sort((a, b) => a.garmentTypeName.localeCompare(b.garmentTypeName)),
      }))
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }, [bySchool, groups, schoolNameMap]);

  // Single flat list rendered in one grid; in by-school mode a full-width header
  // row precedes each school's cards (keeps one grid, avoids duplicating cards).
  type GridItem =
    | { kind: 'header'; schoolId: string; schoolName: string; count: number }
    | { kind: 'card'; g: (typeof groups)[number] };
  const gridItems: GridItem[] = useMemo(() => {
    if (bySchool) {
      return schoolSections.flatMap((s) => [
        { kind: 'header', schoolId: s.schoolId, schoolName: s.schoolName, count: s.groups.length } as GridItem,
        ...s.groups.map((g) => ({ kind: 'card', g }) as GridItem),
      ]);
    }
    return displayGroups.map((g) => ({ kind: 'card', g }) as GridItem);
  }, [bySchool, schoolSections, displayGroups]);

  // Collapsible school sections + variant quick-view (opened from a card).
  const [collapsedSchools, setCollapsedSchools] = useState<Set<string>>(new Set());
  const [quickView, setQuickView] = useState<ProductGroup | null>(null);

  const toggleSchool = (schoolId: string) =>
    setCollapsedSchools((prev) => {
      const next = new Set(prev);
      if (next.has(schoolId)) next.delete(schoolId);
      else next.add(schoolId);
      return next;
    });

  // Hide cards under collapsed school headers (headers always render).
  const visibleItems = useMemo(() => {
    if (!bySchool) return gridItems;
    let current = '';
    return gridItems.filter((item) => {
      if (item.kind === 'header') {
        current = item.schoolId;
        return true;
      }
      return !collapsedSchools.has(current);
    });
  }, [bySchool, gridItems, collapsedSchools]);

  const handleDragEnterCard = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    setOrder((prev) => {
      if (!prev) return prev;
      const from = prev.indexOf(draggedId);
      const to = prev.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      const next = prev.slice();
      next.splice(from, 1);
      next.splice(to, 0, draggedId);
      return next;
    });
  };

  const handleDragEnd = async () => {
    const finalOrder = order;
    setDraggedId(null);
    if (finalOrder && onReorder) {
      setSaving(true);
      try {
        await onReorder(finalOrder);
      } finally {
        setSaving(false);
      }
    }
  };

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <Package className="w-12 h-12 mx-auto mb-3 text-stone-300" />
        <p className="text-stone-600">No hay productos para mostrar en cuadrícula.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Reorder toolbar (single-school view only) */}
      {reorderEnabled && (
        <div className="flex items-center justify-between mb-3">
          {reordering ? (
            <>
              <span className="text-[13px] text-stone-500 inline-flex items-center gap-1.5">
                <GripVertical className="w-4 h-4 text-stone-400" />
                Arrastra las cards para definir el orden del catálogo de este colegio.
                {saving && (
                  <span className="inline-flex items-center gap-1 text-brand-600 ml-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={exitReorder}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition"
              >
                <Check className="w-4 h-4" /> Listo
              </button>
            </>
          ) : (
            <>
              <span className="text-[13px] text-stone-400">Orden del catálogo por colegio</span>
              <button
                type="button"
                onClick={enterReorder}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition"
              >
                <ArrowUpDown className="w-4 h-4" /> Reordenar catálogo
              </button>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 tabular-nums">
        {visibleItems.map((item) => {
          if (item.kind === 'header') {
            const collapsed = collapsedSchools.has(item.schoolId);
            return (
              <button
                key={`school-${item.schoolId}`}
                type="button"
                onClick={() => toggleSchool(item.schoolId)}
                className="col-span-full flex items-center gap-2 pb-1.5 mt-2 first:mt-0 border-b border-stone-200 text-left hover:text-brand-700 transition"
                aria-expanded={!collapsed}
              >
                {collapsed ? (
                  <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" />
                )}
                <Building2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
                <h3 className="text-sm font-bold text-stone-800 truncate">{item.schoolName}</h3>
                <span className="text-xs text-stone-400 whitespace-nowrap">
                  · {item.count} {item.count === 1 ? 'tipo' : 'tipos'}
                </span>
              </button>
            );
          }
          const g = item.g;
          const m = meta[g.garmentTypeId];
          const coverage = m && m.variants > 0 ? m.withCost / m.variants : 0;
          const outOfStock = g.totalStock === 0;
          const lowStock = !outOfStock && (m?.anyLowStock ?? false);
          const allActive = m ? m.activeCount === m.variants : true;
          const noneActive = m ? m.activeCount === 0 : false;
          const isDragged = reordering && draggedId === g.garmentTypeId;

          return (
            <div
              key={g.garmentTypeId}
              draggable={reordering}
              onDragStart={reordering ? () => setDraggedId(g.garmentTypeId) : undefined}
              onDragEnter={reordering ? () => handleDragEnterCard(g.garmentTypeId) : undefined}
              onDragOver={reordering ? (e) => e.preventDefault() : undefined}
              onDragEnd={reordering ? handleDragEnd : undefined}
              className={`group relative flex flex-col rounded-xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden transition ${
                reordering
                  ? `cursor-grab active:cursor-grabbing ring-brand-200 ${isDragged ? 'opacity-50 ring-2 ring-brand-400' : ''}`
                  : 'hover:ring-brand-300 hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              {/* Drag handle */}
              {reordering && (
                <div className="absolute top-2 left-2 z-10 inline-flex items-center justify-center w-7 h-7 rounded-md bg-stone-900/70 text-white">
                  <GripVertical className="w-4 h-4" />
                </div>
              )}

              {/* Image — object-contain on white so the full garment shows
                  (catalog photos are framed shots that crop badly with cover). */}
              <button
                type="button"
                onClick={reordering ? undefined : () => setQuickView(g)}
                disabled={reordering}
                className="relative aspect-[4/3] w-full bg-white grid place-items-center overflow-hidden border-b border-stone-100"
                title={reordering ? undefined : 'Ver variantes'}
              >
                {g.garmentTypeImageUrl ? (
                  <img
                    src={g.garmentTypeImageUrl}
                    alt={g.garmentTypeName}
                    loading="lazy"
                    draggable={false}
                    className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex flex-col items-center text-stone-400">
                    <span className="text-3xl leading-none">{getEmojiForCategory(g.garmentTypeName)}</span>
                    <span className="mt-1 text-[11px] font-medium flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" /> Foto pendiente
                    </span>
                  </div>
                )}

                {/* Photo count */}
                {m && m.photoCount > 0 && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-900/70 text-white text-[11px] font-semibold">
                    <ImageIcon className="w-3 h-3" /> {m.photoCount}
                  </span>
                )}

                {/* Active state */}
                <span
                  className={`absolute bottom-2 left-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    noneActive
                      ? 'bg-stone-200 text-stone-600'
                      : allActive
                        ? 'bg-emerald-500 text-white'
                        : 'bg-amber-400 text-amber-900'
                  }`}
                >
                  {noneActive ? 'Inactivo' : allActive ? 'Activo' : 'Parcial'}
                </span>
              </button>

              {/* Body */}
              <div className="p-3 flex flex-col gap-2.5">
                {/* Identity */}
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-stone-900 truncate leading-tight" title={g.garmentTypeName}>
                    {g.garmentTypeName}
                  </h3>
                  <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600">
                    {m?.category || 'Sin categoría'}
                  </span>
                </div>

                {/* Price + margin (labeled) */}
                <div className="flex items-end justify-between border-t border-stone-100 pt-2">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-stone-400 font-medium">Precio</div>
                    <div className="text-[15px] font-bold text-stone-900 leading-tight truncate">
                      {formatPriceRange(g.basePrice, g.maxPrice)}
                    </div>
                  </div>
                  {canViewCosts && (
                    <div className="text-right shrink-0">
                      <div className="text-[10px] uppercase tracking-wider text-stone-400 font-medium">Margen</div>
                      <div className={`text-sm font-bold leading-tight ${
                        m?.marginAvg == null
                          ? 'text-rose-500'
                          : m.marginAvg > 30
                            ? 'text-emerald-600'
                            : m.marginAvg > 15
                              ? 'text-amber-600'
                              : 'text-red-600'
                      }`}>
                        {m?.marginAvg != null ? `${m.marginAvg.toFixed(0)}%` : 'sin costo'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-3 rounded-lg border border-stone-200 divide-x divide-stone-100 bg-stone-50/40">
                  <div className="px-1 py-1.5 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-stone-400">Tallas</div>
                    <div className="text-sm font-semibold text-stone-800">{g.sizes.length}</div>
                  </div>
                  <div className="px-1 py-1.5 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-stone-400">Variantes</div>
                    <div className="text-sm font-semibold text-stone-800">{m?.variants ?? 0}</div>
                  </div>
                  <div className="px-1 py-1.5 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-stone-400">Stock</div>
                    <div className={`text-sm font-semibold ${
                      outOfStock ? 'text-rose-500' : lowStock ? 'text-amber-600' : 'text-stone-800'
                    }`}>
                      {outOfStock ? '0' : g.totalStock}{lowStock && ' ⬇'}
                    </div>
                  </div>
                </div>

                {/* Cost coverage (labeled) */}
                {canViewCosts && m && (
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-stone-400">Cobertura de costos</span>
                      <span className={coverage === 1 ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                        {m.withCost}/{m.variants}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className={`h-full ${coverage === 1 ? 'bg-emerald-400' : coverage > 0 ? 'bg-amber-400' : 'bg-rose-300'}`}
                        style={{ width: `${Math.max(4, coverage * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className={`flex items-center gap-1 pt-1 border-t border-stone-100 ${reordering ? 'pointer-events-none opacity-50' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setQuickView(g)}
                    disabled={reordering}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-[12px] font-medium text-stone-600 bg-stone-50 hover:bg-stone-100 rounded-lg transition"
                  >
                    <Eye className="w-3.5 h-3.5" /> Variantes
                  </button>
                  <button
                    type="button"
                    onClick={() => onManageGroup(g.garmentTypeId)}
                    disabled={reordering}
                    className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition"
                    title="Gestionar grupo (nombre, categoría, fotos)"
                  >
                    <Layers className="w-3.5 h-3.5" /> Gestionar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Variant quick view (opened from a card — no jump to the table) */}
      {quickView && (
        <VariantQuickViewModal
          group={quickView}
          onClose={() => setQuickView(null)}
          onManage={() => {
            const id = quickView.garmentTypeId;
            setQuickView(null);
            onManageGroup(id);
          }}
          onViewInTable={() => {
            const id = quickView.garmentTypeId;
            setQuickView(null);
            onViewVariants(id);
          }}
        />
      )}
    </div>
  );
};

export default React.memo(ProductsGrid);
