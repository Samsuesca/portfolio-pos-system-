'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Draft types
export type DraftType = 'sale' | 'order';

// Cart item state (common for sales and orders)
export interface DraftItem {
  tempId: string;
  productId?: string;
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  isGlobal?: boolean;
  schoolId?: string;
  schoolName?: string;
  // For custom/yomber orders
  orderType?: 'catalog' | 'yomber' | 'custom';
  garmentTypeId?: string;
  garmentTypeName?: string;
  measurements?: Record<string, number>;
  embroideryText?: string;
  color?: string;
  notes?: string;
  additionalPrice?: number;
  stockAvailable?: number;
  reserveStock?: boolean;
  globalProductId?: string;
  isGlobalProduct?: boolean;
}

// Draft payment
export interface DraftPayment {
  id: string;
  amount: number;
  paymentMethod: string;
}

// Sale Draft
export interface SaleDraft {
  id: string;
  type: 'sale';
  createdAt: string;
  updatedAt: string;
  schoolId: string;
  clientId: string;
  clientName?: string;
  notes: string;
  isHistorical: boolean;
  historicalDate?: string;
  items: DraftItem[];
  payments: DraftPayment[];
  total: number;
}

// Order Draft
export interface OrderDraft {
  id: string;
  type: 'order';
  createdAt: string;
  updatedAt: string;
  schoolId: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  deliveryDate: string;
  deliveryType: 'pickup' | 'delivery';
  deliveryZoneId?: string;
  notes: string;
  advancePayment: number;
  advancePaymentMethod: string;
  advanceAmountReceived?: number;
  activeTab: 'catalog' | 'yomber' | 'custom';
  items: DraftItem[];
  total: number;
}

export type Draft = SaleDraft | OrderDraft;

interface DraftStore {
  drafts: Draft[];
  activeDraftId: string | null;

  // Actions
  addDraft: (draft: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateDraft: (id: string, updates: Partial<Draft>) => void;
  removeDraft: (id: string) => void;
  getDraft: (id: string) => Draft | undefined;
  setActiveDraft: (id: string | null) => void;
  clearAllDrafts: () => void;

  // Computed-like getters
  hasDrafts: () => boolean;
  getDraftCount: () => number;
  canAddDraft: () => boolean;
  getOrderDrafts: () => OrderDraft[];
}

const MAX_DRAFTS = 5;

export const useDraftStore = create<DraftStore>()(
  persist(
    (set, get) => ({
      drafts: [],
      activeDraftId: null,

      addDraft: (draftData) => {
        const { drafts } = get();

        // Check limit
        if (drafts.length >= MAX_DRAFTS) {
          throw new Error(`Maximo ${MAX_DRAFTS} borradores permitidos. Elimina uno para continuar.`);
        }

        const id = `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();

        const newDraft: Draft = {
          ...draftData,
          id,
          createdAt: now,
          updatedAt: now,
        } as Draft;

        set({ drafts: [...drafts, newDraft] });
        return id;
      },

      updateDraft: (id, updates) => {
        set((state) => ({
          drafts: state.drafts.map((d) =>
            d.id === id
              ? ({ ...d, ...updates, updatedAt: new Date().toISOString() } as Draft)
              : d
          ),
        }));
      },

      removeDraft: (id) => {
        set((state) => ({
          drafts: state.drafts.filter((d) => d.id !== id),
          activeDraftId: state.activeDraftId === id ? null : state.activeDraftId,
        }));
      },

      getDraft: (id) => {
        return get().drafts.find((d) => d.id === id);
      },

      setActiveDraft: (id) => {
        set({ activeDraftId: id });
      },

      clearAllDrafts: () => {
        set({ drafts: [], activeDraftId: null });
      },

      hasDrafts: () => get().drafts.length > 0,
      getDraftCount: () => get().drafts.length,
      canAddDraft: () => get().drafts.length < MAX_DRAFTS,
      getOrderDrafts: () => get().drafts.filter((d): d is OrderDraft => d.type === 'order'),
    }),
    {
      name: 'admin-drafts-storage',
    }
  )
);

// Helper to format draft label
export function formatDraftLabel(draft: Draft): string {
  if (draft.type === 'sale') {
    const itemCount = draft.items.length;
    const itemText = itemCount === 1 ? 'item' : 'items';
    return `Venta - ${itemCount} ${itemText} - $${draft.total.toLocaleString('es-CO')}`;
  } else {
    const itemCount = draft.items.length;
    const itemText = itemCount === 1 ? 'item' : 'items';
    return `Encargo - ${itemCount} ${itemText}`;
  }
}

// Helper to get time ago
export function getTimeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'hace un momento';
  if (diffMins < 60) return `hace ${diffMins} min`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;

  return `hace ${Math.floor(diffHours / 24)}d`;
}
