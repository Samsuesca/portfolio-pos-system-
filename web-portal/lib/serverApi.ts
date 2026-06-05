/**
 * Server-side API fetch functions for Next.js Server Components
 *
 * These functions use native fetch (no axios) and run on the server.
 * They fetch data that is then passed as props to client components.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

// Re-export API_BASE_URL for image URLs in server components
export { API_BASE_URL as SERVER_API_BASE_URL };

import type { School, Product } from './api';
import { unwrapPaginated } from './pagination';
import { getBusinessInfo, type BusinessInfo } from './businessInfo';

/**
 * Server-side wrapper around getBusinessInfo() so v3 server components
 * can import everything from a single module. Falls through to the cached
 * implementation in businessInfo.ts (which returns DEFAULT_BUSINESS_INFO on error).
 */
export async function fetchBusinessInfo(): Promise<BusinessInfo | null> {
  try {
    return await getBusinessInfo();
  } catch (error) {
    console.error('[serverApi] fetchBusinessInfo failed:', error);
    return null;
  }
}

/**
 * Resolve a representative image URL for each school by reading the first
 * product in its catalog that exposes `garment_type_primary_image_url`.
 * Returns absolute URLs (prefixed with API_BASE_URL) so the browser can fetch
 * them directly — relative paths resolve against :3001 and 404.
 *
 * Called once on the v3-preview home (cached via revalidate). Falls back to
 * `null` per-school when nothing matches; the picker draws a typography-only
 * card in that case.
 */
export async function fetchSchoolPreviewImages(
  schoolIds: string[],
): Promise<Record<string, string | null>> {
  const entries = await Promise.all(
    schoolIds.map(async (id) => {
      try {
        const products = await fetchSchoolProducts(id);
        const withImage = products.find(
          (p) => p.garment_type_primary_image_url,
        );
        const raw = withImage?.garment_type_primary_image_url ?? null;
        if (!raw) return [id, null] as const;
        const absolute = raw.startsWith('http')
          ? raw
          : `${API_BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
        return [id, absolute] as const;
      } catch {
        return [id, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

// ============================================
// Public Endpoints (no auth required)
// ============================================

/**
 * Fetch all active schools (public endpoint)
 */
export async function fetchSchools(): Promise<School[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/schools`, {
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!res.ok) {
      console.error('[serverApi] Failed to fetch schools:', res.status);
      return [];
    }

    const data = await res.json();
    return unwrapPaginated<School>(data).items;
  } catch (error) {
    console.error('[serverApi] Error fetching schools:', error);
    return [];
  }
}

/**
 * Fetch a school by slug (public endpoint)
 */
export async function fetchSchoolBySlug(slug: string): Promise<School | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/schools/slug/${slug}`, {
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return null;
    }

    return res.json();
  } catch (error) {
    console.error('[serverApi] Error fetching school by slug:', error);
    return null;
  }
}

// ============================================
// Authenticated Endpoints (require public-viewer token)
// ============================================

/**
 * Get a public-viewer auth token for server-side requests.
 * This authenticates with the backend to access product endpoints.
 */
// Module-level token cache to avoid duplicate auth calls per render
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getServerToken(): Promise<string | null> {
  // Return cached token if still valid (with 30s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30000) {
    return cachedToken.value;
  }

  try {
    const username = process.env.PORTAL_PUBLIC_USER || 'public-viewer';
    const password = process.env.PORTAL_PUBLIC_PASSWORD || 'Public2025';

    const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      console.error('[serverApi] Failed to get server token:', res.status);
      return null;
    }

    const data = await res.json();
    const token = data.token?.access_token || null;

    if (token) {
      // Cache for 5 minutes
      cachedToken = { value: token, expiresAt: Date.now() + 5 * 60 * 1000 };
    }

    return token;
  } catch (error) {
    console.error('[serverApi] Error getting server token:', error);
    return null;
  }
}

/**
 * Fetch products for a specific school (requires auth)
 */
export async function fetchSchoolProducts(schoolId: string): Promise<Product[]> {
  try {
    const token = await getServerToken();
    if (!token) {
      console.error('[serverApi] No token available for fetchSchoolProducts');
      return [];
    }

    const params = new URLSearchParams({
      school_id: schoolId,
      with_stock: 'true',
      with_images: 'true',
      // Sin limit el backend pagina a 100; colegios con mas productos (Comfama=113)
      // pierden los del final del orden por nombre (ej. la sudadera amarilla no salia).
      // 500 es el tope del endpoint y cubre de sobra el colegio mas grande.
      limit: '500',
    });

    let res = await fetch(`${API_BASE_URL}/api/v1/products?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 30 }, // Cache for 30 seconds
    });

    // If 401, token might be stale — clear cache and retry once
    if (res.status === 401) {
      cachedToken = null;
      const freshToken = await getServerToken();
      if (!freshToken) {
        console.error('[serverApi] Failed to refresh token for fetchSchoolProducts');
        return [];
      }
      res = await fetch(`${API_BASE_URL}/api/v1/products?${params}`, {
        headers: {
          Authorization: `Bearer ${freshToken}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 30 },
      });
    }

    if (!res.ok) {
      console.error('[serverApi] Failed to fetch school products:', res.status);
      return [];
    }

    const data = await res.json();
    return unwrapPaginated<Product>(data).items;
  } catch (error) {
    console.error('[serverApi] Error fetching school products:', error);
    return [];
  }
}

/**
 * Fetch global products (requires auth)
 */
export async function fetchGlobalProducts(schoolId?: string): Promise<Product[]> {
  try {
    const token = await getServerToken();
    if (!token) {
      console.error('[serverApi] No token available for fetchGlobalProducts');
      return [];
    }

    const params = new URLSearchParams({
      with_inventory: 'true',
      limit: '500',
    });
    // Si viene schoolId, el backend excluye los globales ocultos para ese colegio.
    if (schoolId) params.set('school_id', schoolId);

    let res = await fetch(`${API_BASE_URL}/api/v1/global/products?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 30 },
    });

    // If 401, token might be stale — clear cache and retry once
    if (res.status === 401) {
      cachedToken = null;
      const freshToken = await getServerToken();
      if (!freshToken) {
        console.error('[serverApi] Failed to refresh token for fetchGlobalProducts');
        return [];
      }
      res = await fetch(`${API_BASE_URL}/api/v1/global/products?${params}`, {
        headers: {
          Authorization: `Bearer ${freshToken}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 30 },
      });
    }

    if (!res.ok) {
      console.error('[serverApi] Failed to fetch global products:', res.status);
      return [];
    }

    const data = await res.json();
    return unwrapPaginated<Product>(data).items;
  } catch (error) {
    console.error('[serverApi] Error fetching global products:', error);
    return [];
  }
}

export interface CatalogOrderEntry {
  garment_type_id: string;
  display_order: number;
}

/**
 * Fetch the per-school catalog order (garment-type card order, issue #8).
 * Returns [] on any failure so the catalog falls back to its default order.
 */
export async function fetchCatalogOrder(schoolId: string): Promise<CatalogOrderEntry[]> {
  try {
    const token = await getServerToken();
    if (!token) return [];

    const url = `${API_BASE_URL}/api/v1/schools/${schoolId}/catalog/garment-types/order`;
    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      next: { revalidate: 30 },
    });

    if (res.status === 401) {
      cachedToken = null;
      const freshToken = await getServerToken();
      if (!freshToken) return [];
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${freshToken}`, 'Content-Type': 'application/json' },
        next: { revalidate: 30 },
      });
    }

    if (!res.ok) {
      console.error('[serverApi] Failed to fetch catalog order:', res.status);
      return [];
    }

    return (await res.json()) as CatalogOrderEntry[];
  } catch (error) {
    console.error('[serverApi] Error fetching catalog order:', error);
    return [];
  }
}
