import { create } from 'zustand';
import type { ProductListItem } from '../types/api';

export interface OrderDraftItem {
  product_id: string;
  garment_type_id: string | null;
  name: string;
  size: string | null;
  color: string | null;
  unit_price: number;
  quantity: number;
  stock: number | null;
}

interface OrderDraftState {
  clientId: string | null;
  clientName: string | null;
  items: OrderDraftItem[];
  deliveryDate: string | null;
  notes: string;
  advanceAmount: string;
  advanceMethod: string;
  advanceReceived: string;

  setClient: (id: string | null, name: string | null) => void;
  addItem: (product: ProductListItem) => void;
  removeItem: (productId: string) => void;
  updateItemQuantity: (productId: string, quantity: number) => void;
  setDeliveryDate: (date: string | null) => void;
  setNotes: (notes: string) => void;
  setAdvance: (amount: string, method: string, received: string) => void;
  getTotal: () => number;
  clear: () => void;
}

export const useOrderDraftStore = create<OrderDraftState>()((set, get) => ({
  clientId: null,
  clientName: null,
  items: [],
  deliveryDate: null,
  notes: '',
  advanceAmount: '',
  advanceMethod: 'cash',
  advanceReceived: '',

  setClient: (id, name) => set({ clientId: id, clientName: name }),

  addItem: (product) => {
    const { items } = get();
    const existing = items.find((i) => i.product_id === product.id);
    if (existing) {
      set({
        items: items.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        ),
      });
    } else {
      set({
        items: [
          ...items,
          {
            product_id: product.id,
            garment_type_id: product.garment_type_id,
            name: product.name,
            size: product.size,
            color: product.color,
            unit_price: Number(product.price),
            quantity: 1,
            stock: product.stock,
          },
        ],
      });
    }
  },

  removeItem: (productId) => {
    set({ items: get().items.filter((i) => i.product_id !== productId) });
  },

  updateItemQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    set({
      items: get().items.map((i) =>
        i.product_id === productId ? { ...i, quantity } : i
      ),
    });
  },

  setDeliveryDate: (date) => set({ deliveryDate: date }),
  setNotes: (notes) => set({ notes }),
  setAdvance: (amount, method, received) =>
    set({ advanceAmount: amount, advanceMethod: method, advanceReceived: received }),

  getTotal: () => get().items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),

  clear: () =>
    set({
      clientId: null,
      clientName: null,
      items: [],
      deliveryDate: null,
      notes: '',
      advanceAmount: '',
      advanceMethod: 'cash',
      advanceReceived: '',
    }),
}));
