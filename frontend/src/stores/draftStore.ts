import { create } from 'zustand';

// Tipos de borrador
export type DraftType = 'sale' | 'order';

// Estado de un item en el carrito (común para ventas y encargos)
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
  // Para encargos custom/yomber
  orderType?: 'catalog' | 'yomber' | 'custom';
  garmentTypeId?: string;
  garmentTypeName?: string;
  measurements?: Record<string, number>;
  embroideryText?: string;
  color?: string;
  notes?: string;
  additionalPrice?: number;
}

// Pago en borrador
export interface DraftPayment {
  id: string;
  amount: number;
  paymentMethod: string;
}

// Borrador de Venta
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

// Borrador de Encargo
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
  notes: string;
  advancePayment: number;
  advancePaymentMethod: string;
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
}

const MAX_DRAFTS = 5;

export const useDraftStore = create<DraftStore>((set, get) => ({
  drafts: [],
  activeDraftId: null,

  addDraft: (draftData) => {
    const { drafts } = get();

    // Verificar límite
    if (drafts.length >= MAX_DRAFTS) {
      throw new Error(`Máximo ${MAX_DRAFTS} borradores permitidos. Elimina uno para continuar.`);
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
    set(state => ({
      drafts: state.drafts.map(d =>
        d.id === id
          ? { ...d, ...updates, updatedAt: new Date().toISOString() } as Draft
          : d
      )
    }));
  },

  removeDraft: (id) => {
    set(state => ({
      drafts: state.drafts.filter(d => d.id !== id),
      activeDraftId: state.activeDraftId === id ? null : state.activeDraftId
    }));
  },

  getDraft: (id) => {
    return get().drafts.find(d => d.id === id);
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
}));

// Helper para formatear label de borrador
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

// Helper para obtener tiempo transcurrido
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
