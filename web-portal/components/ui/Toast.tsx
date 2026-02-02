'use client';

/**
 * Toast Notification System for Web Portal
 *
 * Provides toast notifications for cart actions, order confirmations, etc.
 *
 * Usage:
 *   import { toast } from '@/components/ui/Toast';
 *   toast.success('Producto agregado al carrito');
 */

import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, ShoppingCart } from 'lucide-react';
import { create } from 'zustand';

// ============================================
// Types
// ============================================

type ToastType = 'success' | 'error' | 'info' | 'cart';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

// ============================================
// Store
// ============================================

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    const duration = toast.duration ?? (toast.type === 'error' ? 5000 : 3000);
    setTimeout(() => {
      get().removeToast(id);
    }, duration);

    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAll: () => set({ toasts: [] }),
}));

// ============================================
// Helper Functions
// ============================================

export const toast = {
  success: (title: string, message?: string) =>
    useToastStore.getState().addToast({ type: 'success', title, message }),

  error: (title: string, message?: string) =>
    useToastStore.getState().addToast({ type: 'error', title, message, duration: 5000 }),

  info: (title: string, message?: string) =>
    useToastStore.getState().addToast({ type: 'info', title, message }),

  cart: (title: string, message?: string) =>
    useToastStore.getState().addToast({ type: 'cart', title, message, duration: 2500 }),
};

// ============================================
// Styling Configuration
// ============================================

const TOAST_ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  cart: ShoppingCart,
} as const;

const TOAST_STYLES = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-blue-600 text-white',
  cart: 'bg-brand-600 text-white',
} as const;

// ============================================
// Toast Item Component
// ============================================

interface ToastItemProps {
  toast: Toast;
  onRemove: () => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const Icon = TOAST_ICONS[toast.type];

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg max-w-sm w-full
        animate-slide-in
        ${TOAST_STYLES[toast.type]}
      `}
      role="alert"
      aria-live="polite"
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{toast.title}</p>
        {toast.message && (
          <p className="text-sm opacity-90 mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={onRemove}
        className="opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ============================================
// Toast Container Component
// ============================================

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && toasts.length > 0) {
        useToastStore.getState().clearAll();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [toasts.length]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-label="Notificaciones"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={() => removeToast(t.id)} />
        </div>
      ))}
    </div>
  );
}

export default ToastContainer;
