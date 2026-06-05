/**
 * Catalog tree: garment types as expandable rows with their product variants
 * underneath. Replaces the flat garment-types table — merges the type templates
 * and their concrete variants into one navigable surface with filters.
 *
 * School types carry server-aggregated stats (with_stats); global types get
 * their stats computed client-side from the already-loaded global catalog.
 */
import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Tag, Plus, Search } from 'lucide-react';
import { productService } from '../../services/productService';
import type { GarmentType, Product } from './types';
import GarmentTypeRow from './GarmentTypeRow';
import { useGarmentTypeVariants } from './useGarmentTypeVariants';

type CategoryFilter = '' | 'uniforme_diario' | 'uniforme_deportivo' | 'accesorios';
type StatusFilter = 'all' | 'active' | 'inactive';
type OriginFilter = 'all' | 'manufactured' | 'purchased';

interface SchoolCatalogTabProps {
  /** Whether this tree manages global types (true) or school-specific ones (false). */
  isGlobal: boolean;
  garmentTypes: GarmentType[];
  globalGarmentTypes: GarmentType[];
  globalProducts: Product[];
  schoolFilter: string;
  canManageGarmentTypes: boolean;
  canManageGlobalGarmentTypes: boolean;
  canViewCosts: boolean;
  getImageUrl: (imageUrl: string | undefined | null) => string | null;
  /** Bumped by the parent after a catalog mutation; collapses the tree so the next expand refetches. */
  refreshKey: number;
  onOpenGarmentTypeModal: (type: GarmentType | undefined, isGlobal: boolean) => void;
  onOpenCostBreakdown: (type: GarmentType, isGlobal: boolean) => void;
  onAddVariant: (type: GarmentType, isGlobal: boolean) => void;
  onEditVariant: (product: Product) => void;
  onAdjustInventory: (product: Product) => void;
  onOpenHistory: (product: Product) => void;
}

const HEADER_GRID = '28px 44px 1fr 104px 84px 84px 116px 132px';

/** Aggregate global-type stats client-side from the loaded global catalog. */
function statsFromProducts(types: GarmentType[], products: Product[]): GarmentType[] {
  const byType = new Map<string, Product[]>();
  for (const p of products) {
    const list = byType.get(p.garment_type_id);
    if (list) list.push(p);
    else byType.set(p.garment_type_id, [p]);
  }
  return types.map(t => {
    const variants = byType.get(t.id) ?? [];
    const prices = variants.map(v => Number(v.price)).filter(n => !Number.isNaN(n));
    const totalStock = variants.reduce((sum, v) => sum + (v.stock ?? v.inventory_quantity ?? 0), 0);
    return {
      ...t,
      product_count: variants.length,
      total_stock: totalStock,
      min_price: prices.length ? Math.min(...prices) : null,
      max_price: prices.length ? Math.max(...prices) : null,
      has_images: t.has_images ?? (Array.isArray(t.images) && t.images.length > 0),
    };
  });
}

const SchoolCatalogTab: React.FC<SchoolCatalogTabProps> = ({
  isGlobal,
  garmentTypes,
  globalGarmentTypes,
  globalProducts,
  schoolFilter,
  canManageGarmentTypes,
  canManageGlobalGarmentTypes,
  canViewCosts,
  getImageUrl,
  refreshKey,
  onOpenGarmentTypeModal,
  onOpenCostBreakdown,
  onAddVariant,
  onEditVariant,
  onAdjustInventory,
  onOpenHistory,
}) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [origin, setOrigin] = useState<OriginFilter>('all');

  const { expandedIds, variantsByType, loadingIds, toggle, collapseAll } = useGarmentTypeVariants();

  // After a catalog mutation the parent bumps refreshKey; collapse the tree so
  // stale cached variants are dropped and re-expanding refetches. Skip the
  // initial mount (refreshKey starts at 0, nothing is expanded yet anyway).
  const lastRefresh = useRef(refreshKey);
  useEffect(() => {
    if (lastRefresh.current !== refreshKey) {
      lastRefresh.current = refreshKey;
      collapseAll();
    }
  }, [refreshKey, collapseAll]);

  const canManage = isGlobal ? canManageGlobalGarmentTypes : canManageGarmentTypes;

  // Source types for the active scope, with stats resolved.
  const sourceTypes = useMemo(() => {
    if (isGlobal) return statsFromProducts(globalGarmentTypes, globalProducts);
    return garmentTypes;
  }, [isGlobal, globalGarmentTypes, globalProducts, garmentTypes]);

  // Apply filters.
  const filteredTypes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sourceTypes.filter(t => {
      if (term && !t.name.toLowerCase().includes(term)) return false;
      if (category && t.category !== category) return false;
      if (status === 'active' && !t.is_active) return false;
      if (status === 'inactive' && t.is_active) return false;
      if (origin === 'manufactured' && t.cost_type === 'purchased') return false;
      if (origin === 'purchased' && t.cost_type !== 'purchased') return false;
      return true;
    });
  }, [sourceTypes, search, category, status, origin]);

  const handleToggle = useCallback((type: GarmentType) => {
    toggle(type.id, () => {
      if (isGlobal) {
        return Promise.resolve(globalProducts.filter(p => p.garment_type_id === type.id));
      }
      return productService
        .getAllProducts({
          garment_type_id: type.id,
          school_id: type.school_id || schoolFilter || undefined,
          with_stock: true,
          // Match the type row's stat count, which includes inactive variants.
          active_only: false,
          limit: 500,
        })
        .then(r => r.items);
    });
  }, [toggle, isGlobal, globalProducts, schoolFilter]);

  const hasFilters = !!(search || category || status !== 'all' || origin !== 'all');
  const clearFilters = () => { setSearch(''); setCategory(''); setStatus('all'); setOrigin('all'); };

  return (
    <div className="bg-white rounded-lg shadow-sm mb-6">
      {/* Header: scope label + new-type action */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <Tag className={`w-4 h-4 ${isGlobal ? 'text-purple-600' : 'text-brand-600'}`} />
          <span className="text-sm font-semibold text-stone-700">
            {isGlobal ? 'Tipos Globales' : 'Tipos del Colegio'}
          </span>
          <span className="text-xs text-stone-400">
            ({(isGlobal ? globalGarmentTypes : garmentTypes).length})
          </span>
        </div>
        {canManage && (
          <button
            onClick={() => onOpenGarmentTypeModal(undefined, isGlobal)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-lg transition ${
              isGlobal ? 'bg-purple-600 hover:bg-purple-700' : 'bg-brand-500 hover:bg-brand-600'
            }`}
          >
            <Plus className="w-4 h-4" />
            {isGlobal ? 'Nuevo tipo global' : 'Nuevo tipo'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-stone-100">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tipo de prenda..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryFilter)}
          className="px-3 py-2 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 outline-none bg-white text-stone-700"
        >
          <option value="">Todas las categorías</option>
          <option value="uniforme_diario">Diario</option>
          <option value="uniforme_deportivo">Deportivo</option>
          <option value="accesorios">Accesorios</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="px-3 py-2 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 outline-none bg-white text-stone-700"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        <select
          value={origin}
          onChange={(e) => setOrigin(e.target.value as OriginFilter)}
          className="px-3 py-2 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 outline-none bg-white text-stone-700"
        >
          <option value="all">Todos los orígenes</option>
          <option value="manufactured">Se fabrica</option>
          <option value="purchased">Se compra</option>
        </select>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Column header */}
      {filteredTypes.length > 0 && (
        <div
          className="grid items-center gap-2 px-4 py-2 bg-stone-50 border-b border-stone-200 text-[11px] font-semibold text-stone-500 uppercase tracking-wider"
          style={{ gridTemplateColumns: HEADER_GRID }}
        >
          <span />
          <span />
          <span>Nombre</span>
          <span>Categoría</span>
          <span className="text-center">Variantes</span>
          <span className="text-right">Stock</span>
          <span className="text-right">Precio</span>
          <span className="text-right">Acciones</span>
        </div>
      )}

      {/* Tree */}
      {filteredTypes.map(type => (
        <GarmentTypeRow
          key={type.id}
          type={type}
          isGlobal={isGlobal}
          isExpanded={expandedIds.has(type.id)}
          isLoadingVariants={loadingIds.has(type.id)}
          variants={variantsByType[type.id]}
          canManage={canManage}
          canViewCosts={canViewCosts}
          getImageUrl={getImageUrl}
          onToggle={handleToggle}
          onEditType={(t) => onOpenGarmentTypeModal(t, isGlobal)}
          onOpenCostBreakdown={onOpenCostBreakdown}
          onAddVariant={(t) => onAddVariant(t, isGlobal)}
          onEditVariant={onEditVariant}
          onAdjustInventory={onAdjustInventory}
          onOpenHistory={onOpenHistory}
        />
      ))}

      {/* Result count */}
      {filteredTypes.length > 0 && hasFilters && (
        <div className="px-4 py-2 text-xs text-stone-400 border-t border-stone-100">
          Mostrando {filteredTypes.length} de {sourceTypes.length} tipos
        </div>
      )}

      {/* Empty state */}
      {filteredTypes.length === 0 && (
        <div className="text-center py-12">
          <Tag className={`w-12 h-12 mx-auto mb-3 ${isGlobal ? 'text-purple-400' : 'text-brand-400'}`} />
          <p className="text-stone-600">
            {hasFilters
              ? 'Ningún tipo coincide con los filtros'
              : isGlobal
              ? 'No hay tipos de prenda globales'
              : 'No hay tipos de prenda para este colegio'}
          </p>
          {hasFilters ? (
            <button onClick={clearFilters} className="mt-3 text-sm text-brand-600 hover:text-brand-700 underline">
              Limpiar filtros
            </button>
          ) : canManage && (
            <button
              onClick={() => onOpenGarmentTypeModal(undefined, isGlobal)}
              className={`mt-4 ${
                isGlobal ? 'bg-purple-600 hover:bg-purple-700' : 'bg-brand-500 hover:bg-brand-600'
              } text-white px-4 py-2 rounded-lg inline-flex items-center transition`}
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Primer Tipo
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(SchoolCatalogTab);
