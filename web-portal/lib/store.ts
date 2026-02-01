import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product, School } from './api';

export interface CartItem {
  product: Product;
  school: School;
  quantity: number;
  isOrder?: boolean; // true = producto sin stock (encargo), false/undefined = producto con stock (venta)
}

interface CartStore {
  items: CartItem[];
  addItem: (product: Product, school: School, isOrder?: boolean) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getItemsBySchool: () => Map<string, CartItem[]>;
  hasOrderItems: () => boolean; // Check if cart has any order items (sin stock)
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product: Product, school: School, isOrder?: boolean) => {
        const items = get().items;
        const existingItem = items.find((item) => item.product.id === product.id);

        if (existingItem) {
          // Si ya existe, incrementar cantidad
          set({
            items: items.map((item) =>
              item.product.id === product.id
                ? { ...item, quantity: item.quantity + 1 }
                : item
            ),
          });
        } else {
          // Si no existe, agregar nuevo item
          set({ items: [...items, { product, school, quantity: 1, isOrder }] });
        }
      },

      removeItem: (productId: string) => {
        set({ items: get().items.filter((item) => item.product.id !== productId) });
      },

      updateQuantity: (productId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }

        set({
          items: get().items.map((item) =>
            item.product.id === productId ? { ...item, quantity } : item
          ),
        });
      },

      clearCart: () => {
        set({ items: [] });
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getTotalPrice: () => {
        return get().items.reduce(
          (total, item) => total + item.product.price * item.quantity,
          0
        );
      },

      getItemsBySchool: () => {
        const items = get().items;
        const grouped = new Map<string, CartItem[]>();

        items.forEach((item) => {
          // Migración: Si el item no tiene school, lo ignoramos (datos viejos)
          if (!item.school || !item.school.id) {
            console.warn('Cart item without school info, skipping:', item);
            return;
          }

          const schoolId = item.school.id;
          if (!grouped.has(schoolId)) {
            grouped.set(schoolId, []);
          }
          grouped.get(schoolId)!.push(item);
        });

        return grouped;
      },

      hasOrderItems: () => {
        return get().items.some((item) => item.isOrder === true);
      },
    }),
    {
      name: 'cart-storage', // Nombre en localStorage
    }
  )
);
