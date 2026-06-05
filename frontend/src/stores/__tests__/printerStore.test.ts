import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePrinterStore } from '../printerStore';
import thermalPrinterService from '../../services/thermalPrinterService';

vi.mock('../../services/thermalPrinterService', () => ({
  default: {
    saveSettings: vi.fn(),
    listPorts: vi.fn(),
    testPrinter: vi.fn(),
    testCashDrawer: vi.fn(),
    isTauri: vi.fn().mockReturnValue(false),
  },
}));

const DEFAULT_SETTINGS = {
  enabled: false,
  portName: '',
  autoOpenDrawer: true,
  autoPrintReceipt: true,
};

describe('printerStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePrinterStore.setState({
      settings: DEFAULT_SETTINGS,
      availablePorts: [],
      isLoading: false,
      error: null,
      lastPrintTime: null,
      isModalOpen: false,
    });
  });

  describe('setSettings', () => {
    it('merges partial settings and persists', () => {
      usePrinterStore.getState().setSettings({ enabled: true, portName: '/dev/ttyUSB0' });

      const { settings } = usePrinterStore.getState();
      expect(settings.enabled).toBe(true);
      expect(settings.portName).toBe('/dev/ttyUSB0');
      expect(settings.autoOpenDrawer).toBe(true); // existing field preserved
      expect(thermalPrinterService.saveSettings).toHaveBeenCalledWith(settings);
    });

    it('clears error on settings update', () => {
      usePrinterStore.setState({ error: 'some error' });
      usePrinterStore.getState().setSettings({ enabled: true });
      expect(usePrinterStore.getState().error).toBeNull();
    });
  });

  describe('refreshPorts', () => {
    it('loads available ports and clears loading state', async () => {
      const mockPorts = [{ path: '/dev/ttyUSB0', manufacturer: 'FTDI' }];
      vi.mocked(thermalPrinterService.listPorts).mockResolvedValueOnce(mockPorts as any);

      await usePrinterStore.getState().refreshPorts();

      const state = usePrinterStore.getState();
      expect(state.availablePorts).toEqual(mockPorts);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failure', async () => {
      vi.mocked(thermalPrinterService.listPorts).mockRejectedValueOnce(new Error('Port unavailable'));

      await usePrinterStore.getState().refreshPorts();

      const state = usePrinterStore.getState();
      expect(state.error).toBe('Port unavailable');
      expect(state.isLoading).toBe(false);
    });

    it('uses fallback error message for non-Error throws', async () => {
      vi.mocked(thermalPrinterService.listPorts).mockRejectedValueOnce('unknown');

      await usePrinterStore.getState().refreshPorts();

      expect(usePrinterStore.getState().error).toBe('Error desconocido');
    });
  });

  describe('testPrinter', () => {
    it('returns false and sets error when no port configured', async () => {
      usePrinterStore.setState({ settings: { ...DEFAULT_SETTINGS, portName: '' } });

      const result = await usePrinterStore.getState().testPrinter();

      expect(result).toBe(false);
      expect(usePrinterStore.getState().error).toBe('Selecciona un puerto primero');
      expect(thermalPrinterService.testPrinter).not.toHaveBeenCalled();
    });

    it('returns true and updates lastPrintTime on success', async () => {
      usePrinterStore.setState({ settings: { ...DEFAULT_SETTINGS, portName: '/dev/ttyUSB0' } });
      vi.mocked(thermalPrinterService.testPrinter).mockResolvedValueOnce(undefined as any);

      const result = await usePrinterStore.getState().testPrinter();

      expect(result).toBe(true);
      expect(thermalPrinterService.testPrinter).toHaveBeenCalledWith('/dev/ttyUSB0');
      expect(usePrinterStore.getState().lastPrintTime).not.toBeNull();
      expect(usePrinterStore.getState().isLoading).toBe(false);
    });

    it('returns false and sets error on failure', async () => {
      usePrinterStore.setState({ settings: { ...DEFAULT_SETTINGS, portName: '/dev/ttyUSB0' } });
      vi.mocked(thermalPrinterService.testPrinter).mockRejectedValueOnce(new Error('Printer offline'));

      const result = await usePrinterStore.getState().testPrinter();

      expect(result).toBe(false);
      expect(usePrinterStore.getState().error).toBe('Printer offline');
      expect(usePrinterStore.getState().isLoading).toBe(false);
    });
  });

  describe('testCashDrawer', () => {
    it('returns false when no port configured', async () => {
      usePrinterStore.setState({ settings: { ...DEFAULT_SETTINGS, portName: '' } });

      const result = await usePrinterStore.getState().testCashDrawer();

      expect(result).toBe(false);
      expect(usePrinterStore.getState().error).toBe('Selecciona un puerto primero');
    });

    it('returns true on success', async () => {
      usePrinterStore.setState({ settings: { ...DEFAULT_SETTINGS, portName: '/dev/ttyUSB0' } });
      vi.mocked(thermalPrinterService.testCashDrawer).mockResolvedValueOnce(undefined as any);

      const result = await usePrinterStore.getState().testCashDrawer();

      expect(result).toBe(true);
      expect(thermalPrinterService.testCashDrawer).toHaveBeenCalledWith('/dev/ttyUSB0');
    });

    it('returns false and sets error on failure', async () => {
      usePrinterStore.setState({ settings: { ...DEFAULT_SETTINGS, portName: '/dev/ttyUSB0' } });
      vi.mocked(thermalPrinterService.testCashDrawer).mockRejectedValueOnce(new Error('Drawer jammed'));

      const result = await usePrinterStore.getState().testCashDrawer();

      expect(result).toBe(false);
      expect(usePrinterStore.getState().error).toBe('Drawer jammed');
    });
  });

  describe('clearError', () => {
    it('sets error to null', () => {
      usePrinterStore.setState({ error: 'some error' });
      usePrinterStore.getState().clearError();
      expect(usePrinterStore.getState().error).toBeNull();
    });
  });

  describe('modal controls', () => {
    it('openModal sets isModalOpen to true', () => {
      usePrinterStore.getState().openModal();
      expect(usePrinterStore.getState().isModalOpen).toBe(true);
    });

    it('closeModal sets isModalOpen to false', () => {
      usePrinterStore.setState({ isModalOpen: true });
      usePrinterStore.getState().closeModal();
      expect(usePrinterStore.getState().isModalOpen).toBe(false);
    });
  });
});
