/**
 * Print Queue Store - Zustand store for managing print queue state
 *
 * Tracks pending print items and configuration for automatic vs manual mode.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import printQueueService, {
  type PrintQueueItem,
  type PrintQueueStats
} from '../services/printQueueService';
import thermalPrinterService from '../services/thermalPrinterService';

export interface PrintQueueSettings {
  // Mode: automatic prints immediately, manual shows notification
  autoMode: boolean;
  // Whether to open cash drawer with automatic prints
  autoOpenDrawer: boolean;
  // Sound notification for new items
  soundEnabled: boolean;
  // Desktop notification (if supported)
  desktopNotification: boolean;
}

interface PrintQueueState {
  // Queue items
  pendingItems: PrintQueueItem[];
  stats: PrintQueueStats | null;

  // Connection state
  isConnected: boolean;
  lastEventTime: string | null;

  // Settings
  settings: PrintQueueSettings;

  // UI state
  isProcessing: boolean;
  isPanelOpen: boolean;
  error: string | null;

  // Actions
  setPendingItems: (items: PrintQueueItem[]) => void;
  addPendingItem: (item: Partial<PrintQueueItem>) => void;
  removeItem: (itemId: string) => void;
  updateItemStatus: (itemId: string, status: string) => void;

  setConnected: (connected: boolean) => void;
  setLastEventTime: (time: string) => void;

  setSettings: (settings: Partial<PrintQueueSettings>) => void;

  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;

  // API actions
  fetchPendingItems: () => Promise<void>;
  fetchStats: () => Promise<void>;
  printItem: (item: PrintQueueItem, openDrawer?: boolean) => Promise<boolean>;
  skipItem: (itemId: string) => Promise<void>;
  retryItem: (itemId: string) => Promise<void>;

  clearError: () => void;
}

const DEFAULT_SETTINGS: PrintQueueSettings = {
  autoMode: false,  // Default to manual mode for safety
  autoOpenDrawer: true,
  soundEnabled: true,
  desktopNotification: true,
};

export const usePrintQueueStore = create<PrintQueueState>()(
  persist(
    (set, get) => ({
      // Initial state
      pendingItems: [],
      stats: null,
      isConnected: false,
      lastEventTime: null,
      settings: DEFAULT_SETTINGS,
      isProcessing: false,
      isPanelOpen: false,
      error: null,

      // State setters
      setPendingItems: (items) => set({ pendingItems: items }),

      addPendingItem: (item) => {
        const items = get().pendingItems;
        // Avoid duplicates
        if (items.some(i => i.id === item.id)) {
          return;
        }
        // Add to front of list (most recent first)
        set({
          pendingItems: [item as PrintQueueItem, ...items],
          lastEventTime: new Date().toISOString()
        });
      },

      removeItem: (itemId) => {
        set({
          pendingItems: get().pendingItems.filter(i => i.id !== itemId)
        });
      },

      updateItemStatus: (itemId, status) => {
        if (status === 'printed' || status === 'skipped') {
          // Remove from pending
          get().removeItem(itemId);
        } else {
          // Update status in place
          set({
            pendingItems: get().pendingItems.map(i =>
              i.id === itemId ? { ...i, status: status as PrintQueueItem['status'] } : i
            )
          });
        }
      },

      setConnected: (connected) => set({ isConnected: connected }),
      setLastEventTime: (time) => set({ lastEventTime: time }),

      setSettings: (newSettings) => {
        set({
          settings: { ...get().settings, ...newSettings }
        });
      },

      setPanelOpen: (open) => set({ isPanelOpen: open }),
      togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),

      // API actions
      fetchPendingItems: async () => {
        try {
          const items = await printQueueService.getPendingItems();
          set({ pendingItems: items, error: null });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Error loading queue';
          set({ error: message });
        }
      },

      fetchStats: async () => {
        try {
          const stats = await printQueueService.getQueueStats();
          set({ stats });
        } catch (error) {
          console.error('Error fetching queue stats:', error);
        }
      },

      printItem: async (item, openDrawer = true) => {
        set({ isProcessing: true, error: null });

        try {
          // Print the receipt using thermal printer service
          const success = await thermalPrinterService.printSaleReceiptWithDrawer(
            item.school_id,
            item.sale_id,
            openDrawer ? 'cash' : 'transfer' // Use 'transfer' to skip drawer
          );

          if (success) {
            await printQueueService.markAsPrinted(item.id);
            get().removeItem(item.id);
          } else {
            // Print failed but no exception - mark as failed
            await printQueueService.markAsFailed(item.id, 'Print operation returned false');
          }

          set({ isProcessing: false });
          return success;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Print failed';
          set({ error: message, isProcessing: false });

          // Mark as failed in backend
          try {
            await printQueueService.markAsFailed(item.id, message);
          } catch (e) {
            console.error('Failed to mark item as failed:', e);
          }

          return false;
        }
      },

      skipItem: async (itemId) => {
        try {
          await printQueueService.markAsSkipped(itemId);
          get().removeItem(itemId);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to skip';
          set({ error: message });
        }
      },

      retryItem: async (itemId) => {
        try {
          await printQueueService.retryFailed(itemId);
          // Item will be re-added via SSE event
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Retry failed';
          set({ error: message });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'print-queue-settings',
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);

// Selector hooks for common use cases
export const usePrintQueuePendingCount = () =>
  usePrintQueueStore((state) => state.pendingItems.length);

export const usePrintQueueSettings = () =>
  usePrintQueueStore((state) => state.settings);

export const usePrintQueueConnection = () =>
  usePrintQueueStore((state) => ({
    isConnected: state.isConnected,
    lastEventTime: state.lastEventTime,
  }));
