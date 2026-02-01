/**
 * Business Info Store - Zustand store for centralized business information
 *
 * Caches business info locally and fetches from API on app start.
 * Falls back to defaults if API is unavailable.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { businessInfoService, type BusinessInfo, type BusinessInfoUpdate, DEFAULT_BUSINESS_INFO } from '../services/businessInfoService';

interface BusinessInfoState {
  // State
  info: BusinessInfo;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  lastFetched: number | null;

  // Actions
  fetchInfo: () => Promise<void>;
  updateInfo: (updates: BusinessInfoUpdate) => Promise<void>;
  clearError: () => void;

  // Computed helpers
  getFullAddress: () => string;
  getWhatsAppLink: (message?: string) => string;
  getPhoneLink: (phone?: string) => string;
  getEmailLink: (subject?: string) => string;
}

// Cache duration: 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000;

export const useBusinessInfoStore = create<BusinessInfoState>()(
  persist(
    (set, get) => ({
      // Initial state with defaults
      info: DEFAULT_BUSINESS_INFO,
      isLoading: false,
      isLoaded: false,
      error: null,
      lastFetched: null,

      // Fetch business info from API
      fetchInfo: async () => {
        const { lastFetched, isLoading } = get();

        // Skip if already loading
        if (isLoading) return;

        // Skip if cache is still valid
        if (lastFetched && Date.now() - lastFetched < CACHE_DURATION_MS) {
          return;
        }

        set({ isLoading: true, error: null });

        try {
          const info = await businessInfoService.getInfo();
          set({
            info,
            isLoading: false,
            isLoaded: true,
            error: null,
            lastFetched: Date.now(),
          });
        } catch (error) {
          console.error('[BusinessInfoStore] Failed to fetch:', error);
          set({
            isLoading: false,
            error: 'No se pudo cargar la información del negocio',
          });
        }
      },

      // Update business info (requires admin)
      updateInfo: async (updates: BusinessInfoUpdate) => {
        set({ isLoading: true, error: null });

        try {
          const updatedInfo = await businessInfoService.updateInfo(updates);
          set({
            info: updatedInfo,
            isLoading: false,
            error: null,
            lastFetched: Date.now(),
          });
        } catch (error) {
          console.error('[BusinessInfoStore] Failed to update:', error);
          set({
            isLoading: false,
            error: 'No se pudo actualizar la información del negocio',
          });
          throw error;
        }
      },

      clearError: () => set({ error: null }),

      // Helper: Get formatted full address
      getFullAddress: () => {
        const { info } = get();
        return businessInfoService.getFullAddress(info);
      },

      // Helper: Get WhatsApp link
      getWhatsAppLink: (message?: string) => {
        const { info } = get();
        return businessInfoService.getWhatsAppLink(info, message);
      },

      // Helper: Get phone link
      getPhoneLink: (phone?: string) => {
        const { info } = get();
        return businessInfoService.getPhoneLink(phone || info.phone_main);
      },

      // Helper: Get email link
      getEmailLink: (subject?: string) => {
        const { info } = get();
        return businessInfoService.getEmailLink(info.email_contact, subject);
      },
    }),
    {
      name: 'business-info-storage',
      // Only persist the info and lastFetched, not loading states
      partialize: (state) => ({
        info: state.info,
        lastFetched: state.lastFetched,
        isLoaded: state.isLoaded,
      }),
    }
  )
);

// Export for convenience
export type { BusinessInfo, BusinessInfoUpdate };
