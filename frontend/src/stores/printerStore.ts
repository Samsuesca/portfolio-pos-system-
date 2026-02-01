/**
 * Printer Store - Zustand store for managing thermal printer state
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import thermalPrinterService, {
  type PortInfo,
  type PrinterSettings,
} from "../services/thermalPrinterService";

interface PrinterState {
  // State
  settings: PrinterSettings;
  availablePorts: PortInfo[];
  isLoading: boolean;
  error: string | null;
  lastPrintTime: string | null;
  isModalOpen: boolean;

  // Actions
  setSettings: (settings: Partial<PrinterSettings>) => void;
  refreshPorts: () => Promise<void>;
  testPrinter: () => Promise<boolean>;
  testCashDrawer: () => Promise<boolean>;
  clearError: () => void;
  openModal: () => void;
  closeModal: () => void;
}

const DEFAULT_SETTINGS: PrinterSettings = {
  enabled: false,
  portName: "",
  autoOpenDrawer: true,
  autoPrintReceipt: true,
};

export const usePrinterStore = create<PrinterState>()(
  persist(
    (set, get) => ({
      // Initial state
      settings: DEFAULT_SETTINGS,
      availablePorts: [],
      isLoading: false,
      error: null,
      lastPrintTime: null,
      isModalOpen: false,

      // Update settings
      setSettings: (newSettings: Partial<PrinterSettings>) => {
        const updated = { ...get().settings, ...newSettings };
        thermalPrinterService.saveSettings(updated);
        set({ settings: updated, error: null });
      },

      // Refresh available ports
      refreshPorts: async () => {
        set({ isLoading: true, error: null });
        try {
          const ports = await thermalPrinterService.listPorts();
          set({ availablePorts: ports, isLoading: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Error desconocido";
          set({ error: message, isLoading: false });
        }
      },

      // Test printer
      testPrinter: async () => {
        const { settings } = get();
        if (!settings.portName) {
          set({ error: "Selecciona un puerto primero" });
          return false;
        }

        set({ isLoading: true, error: null });
        try {
          await thermalPrinterService.testPrinter(settings.portName);
          set({
            isLoading: false,
            lastPrintTime: new Date().toISOString(),
          });
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Error de impresión";
          set({ error: message, isLoading: false });
          return false;
        }
      },

      // Test cash drawer
      testCashDrawer: async () => {
        const { settings } = get();
        if (!settings.portName) {
          set({ error: "Selecciona un puerto primero" });
          return false;
        }

        set({ isLoading: true, error: null });
        try {
          await thermalPrinterService.testCashDrawer(settings.portName);
          set({ isLoading: false });
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Error al abrir cajón";
          set({ error: message, isLoading: false });
          return false;
        }
      },

      // Clear error
      clearError: () => set({ error: null }),

      // Modal controls
      openModal: () => set({ isModalOpen: true }),
      closeModal: () => set({ isModalOpen: false }),
    }),
    {
      name: "printer-settings",
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);

// Hook for easy access to printer status
export function usePrinterStatus() {
  const settings = usePrinterStore((state) => state.settings);
  const isTauri = thermalPrinterService.isTauri();

  return {
    isConfigured: settings.enabled && !!settings.portName,
    isEnabled: settings.enabled,
    isTauriAvailable: isTauri,
    portName: settings.portName,
    autoOpenDrawer: settings.autoOpenDrawer,
    autoPrintReceipt: settings.autoPrintReceipt,
  };
}
