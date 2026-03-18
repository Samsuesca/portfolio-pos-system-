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

export interface PaymentAccount {
  id: string;
  method_type: string;
  account_name: string;
  account_number: string;
  account_holder: string;
  bank_name: string | null;
  account_type: string | null;
  qr_code_url: string | null;
  instructions: string | null;
  display_order: number;
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

    return res.json();
  } catch (error) {
    console.error('[serverApi] Error fetching schools:', error);
    return [];
  }
}

/**
 * Fetch payment accounts (public endpoint)
 */
export async function fetchPaymentAccounts(): Promise<PaymentAccount[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/payment-accounts/public`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!res.ok) {
      console.error('[serverApi] Failed to fetch payment accounts:', res.status);
      return [];
    }

    const data: PaymentAccount[] = await res.json();
    return data.slice(0, 3); // Show max 3 inline
  } catch (error) {
    console.error('[serverApi] Error fetching payment accounts:', error);
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

    return res.json();
  } catch (error) {
    console.error('[serverApi] Error fetching school products:', error);
    return [];
  }
}

/**
 * Fetch global products (requires auth)
 */
export async function fetchGlobalProducts(): Promise<Product[]> {
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

    return res.json();
  } catch (error) {
    console.error('[serverApi] Error fetching global products:', error);
    return [];
  }
}
