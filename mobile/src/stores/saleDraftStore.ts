import { create } from 'zustand';
import type { SaleCreateItem, SaleCreatePayment, PaymentMethod } from '../types/api';

interface ProductForCart {
  id: string;
  name: string;
  size: string | null;
  price: number;
  stock: number | null;
}

export interface CartItem extends SaleCreateItem {
  name: string;
  size: string | null;
  unit_price: number;
  stock: number | null;
}

interface SaleDraftState {
  clientId: string | null;
  clientName: string | null;
  items: CartItem[];
  payments: SaleCreatePayment[];

  setClient: (id: string | null, name: string | null) => void;
  addItem: (product: ProductForCart) => void;
  removeItem: (productId: string) => void;
  updateItemQuantity: (productId: string, quantity: number) => void;
  addPayment: (payment: SaleCreatePayment) => void;
  removePayment: (index: number) => void;
  getTotal: () => number;
  getPaidAmount: () => number;
  clear: () => void;
}

export const useSaleDraftStore = create<SaleDraftState>()((set, get) => ({
  clientId: null,
  clientName: null,
  items: [],
  payments: [],

  setClient: (id, name) => set({ clientId: id, clientName: name }),

  addItem: (product) => {
    const { items } = get();
    const existing = items.find((i) => i.product_id === product.id);
    if (existing) {
      set({
        items: items.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      });
    } else {
      set({
        items: [
          ...items,
          {
            product_id: product.id,
            quantity: 1,
            name: product.name,
            size: product.size,
            unit_price: Number(product.price),
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

  addPayment: (payment) => {
    set({ payments: [...get().payments, payment] });
  },

  removePayment: (index) => {
    set({ payments: get().payments.filter((_, i) => i !== index) });
  },

  getTotal: () => {
    return get().items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  },

  getPaidAmount: () => {
    return get().payments.reduce((sum, p) => sum + Number(p.amount), 0);
  },

  clear: () => set({ clientId: null, clientName: null, items: [], payments: [] }),
}));
