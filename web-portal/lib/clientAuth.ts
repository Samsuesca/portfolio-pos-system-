import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ClientStudent {
  id: string;
  school_id: string;
  student_name: string;
  student_grade?: string;
  school_name?: string;
}

export interface Client {
  id: string;
  code: string;
  name: string;
  email: string;
  phone?: string;
  students: ClientStudent[];
  is_verified: boolean;
  last_login?: string;
}

export type OrderSource = 'desktop_app' | 'web_portal' | 'physical_store';
export type PaymentProofStatus = 'pending' | 'approved' | 'rejected';

export interface ClientOrder {
  id: string;
  code: string;
  status: string;
  source: OrderSource;  // Origen del pedido (web, tienda física, app desktop)
  total: number;
  balance: number;
  created_at: string;
  delivery_date?: string;
  items_count: number;
  payment_proof_url?: string;
  payment_proof_status?: PaymentProofStatus;  // Estado del comprobante de pago
  items: {
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    size?: string;
    color?: string;
  }[];
}

interface ClientAuthStore {
  client: Client | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  getOrders: () => Promise<ClientOrder[]>;
  clearError: () => void;
}

export const useClientAuth = create<ClientAuthStore>()(
  persist(
    (set, get) => ({
      client: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string): Promise<boolean> => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/portal/clients/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Error al iniciar sesión');
          }

          const data = await response.json();

          set({
            client: data.client,
            token: data.access_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          return true;
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.message || 'Error al iniciar sesión',
          });
          return false;
        }
      },

      logout: () => {
        set({
          client: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      getOrders: async (): Promise<ClientOrder[]> => {
        const { client } = get();
        if (!client) {
          console.log('[ClientAuth] No client, returning []');
          return [];
        }

        // Add timestamp to prevent any browser caching
        const timestamp = Date.now();
        const url = `${API_BASE_URL}/api/v1/portal/clients/me/orders?client_id=${client.id}&_t=${timestamp}`;
        console.log('[ClientAuth] Fetching orders from:', url);

        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            cache: 'no-store',
          });

          if (!response.ok) {
            throw new Error('Error al obtener pedidos');
          }

          const orders = await response.json();
          console.log('[ClientAuth] Orders received:', orders);
          return orders;
        } catch (error) {
          console.error('Error fetching orders:', error);
          return [];
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'client-auth-storage',
      partialize: (state) => ({
        client: state.client,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Helper to get status label in Spanish
export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    in_production: 'En Producción',
    ready: 'Listo para Entrega',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  };
  return labels[status] || status;
};

// Helper to get status color
export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_production: 'bg-blue-100 text-blue-800',
    ready: 'bg-green-100 text-green-800',
    delivered: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

// Helper to get order source label in Spanish
export const getSourceLabel = (source: OrderSource): string => {
  const labels: Record<OrderSource, string> = {
    desktop_app: 'Tienda',
    web_portal: 'Web',
    physical_store: 'Tienda Física',
  };
  return labels[source] || 'Tienda';
};

// Helper to get payment proof status label in Spanish
export const getPaymentProofStatusLabel = (status?: PaymentProofStatus): string => {
  if (!status) return 'Sin comprobante';
  const labels: Record<PaymentProofStatus, string> = {
    pending: 'Pendiente de revisión',
    approved: 'Aprobado',
    rejected: 'Rechazado',
  };
  return labels[status] || status;
};

// Helper to get payment proof status color
export const getPaymentProofStatusColor = (status?: PaymentProofStatus): string => {
  if (!status) return 'bg-gray-100 text-gray-600';
  const colors: Record<PaymentProofStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-600';
};
