/**
 * Lazy loader for the variants (products) of a garment type, used by the
 * catalog tree. Variants are fetched on first expand and cached per type, so
 * collapsing/re-expanding is instant. The loader is supplied by the caller so
 * the same hook serves both school types (server fetch) and global types
 * (client-side filter over the already-loaded global catalog).
 */
import { useCallback, useState } from 'react';
import type { Product } from './types';

type VariantLoader = () => Promise<Product[]>;

export function useGarmentTypeVariants() {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [variantsByType, setVariantsByType] = useState<Record<string, Product[]>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const toggle = useCallback(async (typeId: string, loader: VariantLoader) => {
    // Decide from current state — reading a flag set inside the (deferred)
    // setState updater would race and skip the fetch.
    const isExpanding = !expandedIds.has(typeId);
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId);
      else next.add(typeId);
      return next;
    });

    // Fetch only the first time a type is expanded.
    if (!isExpanding || variantsByType[typeId]) return;

    setLoadingIds(prev => new Set(prev).add(typeId));
    try {
      const variants = await loader();
      setVariantsByType(prev => ({ ...prev, [typeId]: variants }));
    } catch (err) {
      console.error('Error loading variants for type', typeId, err);
      setVariantsByType(prev => ({ ...prev, [typeId]: [] }));
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(typeId);
        return next;
      });
    }
  }, [expandedIds, variantsByType]);

  // Drop a type's cached variants so the next expand refetches (after an edit).
  const invalidate = useCallback((typeId: string) => {
    setVariantsByType(prev => {
      const next = { ...prev };
      delete next[typeId];
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => setExpandedIds(new Set()), []);

  return {
    expandedIds,
    variantsByType,
    loadingIds,
    toggle,
    invalidate,
    collapseAll,
  };
}
