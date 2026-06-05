/**
 * useVendors - Custom hook for vendor catalog management
 *
 * Provides state management for vendors with caching and search.
 * Used by VendorCombobox and accounting components.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { vendorService, type VendorListItem, type VendorSearchResult, type VendorCreate } from '../services/vendorService';

let cachedVendors: VendorListItem[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

export function useVendors(options: { autoLoad?: boolean } = {}) {
  const { autoLoad = true } = options;

  const [vendors, setVendors] = useState<VendorListItem[]>(cachedVendors || []);
  const [loading, setLoading] = useState(!cachedVendors);
  const [error, setError] = useState<string | null>(null);

  const loadVendors = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && cachedVendors && Date.now() - cacheTimestamp < CACHE_TTL) {
      setVendors(cachedVendors);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await vendorService.getVendors({ limit: 100 });
      setVendors(result.items);
      cachedVendors = result.items;
      cacheTimestamp = Date.now();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error cargando proveedores';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) loadVendors();
  }, [autoLoad, loadVendors]);

  const searchVendors = useCallback(async (query: string): Promise<VendorSearchResult[]> => {
    if (!query.trim()) return [];
    return vendorService.searchVendors(query.trim());
  }, []);

  const createVendor = useCallback(async (data: VendorCreate) => {
    const vendor = await vendorService.createVendor(data);
    cachedVendors = null;
    await loadVendors(true);
    return vendor;
  }, [loadVendors]);

  const getVendorById = useCallback((id: string) => {
    return vendors.find(v => v.id === id);
  }, [vendors]);

  const getVendorName = useCallback((id: string | null) => {
    if (!id) return null;
    return vendors.find(v => v.id === id)?.name ?? null;
  }, [vendors]);

  const activeVendors = useMemo(() => vendors.filter(v => v.is_active), [vendors]);

  return {
    vendors,
    activeVendors,
    loading,
    error,
    refresh: () => loadVendors(true),
    searchVendors,
    createVendor,
    getVendorById,
    getVendorName,
  };
}
