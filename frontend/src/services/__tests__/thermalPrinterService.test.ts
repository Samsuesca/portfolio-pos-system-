import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';

vi.mock('../../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('../../utils/escpos', () => ({
  generateSaleReceipt: vi.fn(() => [0x1b, 0x40]),
  generateOrderReceipt: vi.fn(() => [0x1b, 0x41]),
  generateAlterationReceipt: vi.fn(() => [0x1b, 0x42]),
  generateTestReceipt: vi.fn(() => [0x1b, 0x43]),
}));

const apiMock = vi.mocked(apiClient);

let thermalPrinterService: typeof import('../thermalPrinterService');

function enableTauri() {
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: true, writable: true, configurable: true });
}

function disableTauri() {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  delete (window as unknown as Record<string, unknown>).__TAURI_IPC__;
  delete (window as unknown as Record<string, unknown>).__TAURI__;
}

describe('thermalPrinterService', () => {
  let localStorageData: Record<string, string>;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageData = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageData[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { localStorageData[key] = value; }),
      removeItem: vi.fn((key: string) => { delete localStorageData[key]; }),
    });
    disableTauri();

    vi.resetModules();
    thermalPrinterService = await import('../thermalPrinterService');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getSettings', () => {
    it('returns defaults when localStorage is empty', () => {
      const settings = thermalPrinterService.getSettings();

      expect(settings).toEqual({
        enabled: false,
        portName: '',
        autoOpenDrawer: true,
        autoPrintReceipt: false,
      });
    });

    it('merges stored settings with defaults', () => {
      localStorageData['thermal_printer_settings'] = JSON.stringify({ enabled: true, portName: '/dev/ttyUSB0' });

      const settings = thermalPrinterService.getSettings();

      expect(settings.enabled).toBe(true);
      expect(settings.portName).toBe('/dev/ttyUSB0');
      expect(settings.autoOpenDrawer).toBe(true);
    });

    it('returns defaults when localStorage throws', () => {
      (localStorage.getItem as Mock).mockImplementation(() => { throw new Error('quota'); });

      const settings = thermalPrinterService.getSettings();

      expect(settings.enabled).toBe(false);
    });
  });

  describe('saveSettings', () => {
    it('merges partial settings and persists', () => {
      const result = thermalPrinterService.saveSettings({ enabled: true, portName: 'COM3' });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'thermal_printer_settings',
        expect.stringContaining('"enabled":true')
      );
      expect(result.enabled).toBe(true);
      expect(result.portName).toBe('COM3');
      expect(result.autoOpenDrawer).toBe(true);
    });
  });

  describe('isPrinterConfigured', () => {
    it('returns false when disabled', () => {
      expect(thermalPrinterService.isPrinterConfigured()).toBe(false);
    });

    it('returns false when enabled but no port', () => {
      localStorageData['thermal_printer_settings'] = JSON.stringify({ enabled: true, portName: '' });

      expect(thermalPrinterService.isPrinterConfigured()).toBe(false);
    });

    it('returns true when enabled and port set', () => {
      localStorageData['thermal_printer_settings'] = JSON.stringify({ enabled: true, portName: 'COM3' });

      expect(thermalPrinterService.isPrinterConfigured()).toBe(true);
    });
  });

  describe('listPorts', () => {
    it('returns empty array when not in Tauri', async () => {
      const ports = await thermalPrinterService.listPorts();
      expect(ports).toEqual([]);
    });

    it('invokes Tauri command when in Tauri environment', async () => {
      enableTauri();
      vi.resetModules();
      thermalPrinterService = await import('../thermalPrinterService');

      const mockPorts = [{ name: 'COM3', port_type: 'USB', description: 'Jaltech 80mm' }];
      mockInvoke.mockResolvedValueOnce(mockPorts);

      const ports = await thermalPrinterService.listPorts();

      expect(mockInvoke).toHaveBeenCalledWith('list_serial_ports');
      expect(ports).toEqual(mockPorts);
    });
  });

  describe('printRaw', () => {
    it('returns false when not in Tauri', async () => {
      const result = await thermalPrinterService.printRaw('COM3', [0x1b, 0x40]);
      expect(result).toBe(false);
    });

    it('throws when port name is empty', async () => {
      enableTauri();
      vi.resetModules();
      thermalPrinterService = await import('../thermalPrinterService');

      await expect(thermalPrinterService.printRaw('', [0x1b])).rejects.toThrow('Puerto de impresora no configurado');
    });

    it('invokes print_thermal command', async () => {
      enableTauri();
      vi.resetModules();
      thermalPrinterService = await import('../thermalPrinterService');
      mockInvoke.mockResolvedValueOnce(true);

      const result = await thermalPrinterService.printRaw('COM3', [0x1b, 0x40]);

      expect(mockInvoke).toHaveBeenCalledWith('print_thermal', { portName: 'COM3', data: [0x1b, 0x40] });
      expect(result).toBe(true);
    });
  });

  describe('printSaleReceipt', () => {
    it('returns false when printer not configured', async () => {
      const result = await thermalPrinterService.printSaleReceipt('school-1', 'sale-1');
      expect(result).toBe(false);
      expect(apiMock.get).not.toHaveBeenCalled();
    });

    it('fetches sale data and prints when configured', async () => {
      enableTauri();
      vi.resetModules();
      thermalPrinterService = await import('../thermalPrinterService');

      localStorageData['thermal_printer_settings'] = JSON.stringify({ enabled: true, portName: 'COM3' });

      const saleApiResponse = {
        code: 'V-001',
        sale_date: '2026-01-15',
        client_name: 'Maria',
        items: [{ quantity: 2, unit_price: 50000, subtotal: 100000, product_name: 'Camisa' }],
        total: 100000,
        payment_method: 'cash',
      };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: saleApiResponse });
      mockInvoke.mockResolvedValueOnce(true);

      const result = await thermalPrinterService.printSaleReceipt('school-1', 'sale-1');

      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/sales/sale-1/items');
      expect(mockInvoke).toHaveBeenCalledWith('print_thermal', expect.objectContaining({ portName: 'COM3' }));
      expect(result).toBe(true);
    });
  });

  describe('handlePostSalePrint', () => {
    it('does nothing when printer not enabled', async () => {
      await thermalPrinterService.handlePostSalePrint('school-1', 'sale-1', 'cash');
      expect(apiMock.get).not.toHaveBeenCalled();
    });

    it('does nothing when autoPrintReceipt is false', async () => {
      localStorageData['thermal_printer_settings'] = JSON.stringify({ enabled: true, portName: 'COM3', autoPrintReceipt: false });

      await thermalPrinterService.handlePostSalePrint('school-1', 'sale-1', 'cash');
      expect(apiMock.get).not.toHaveBeenCalled();
    });
  });

  describe('handlePostOrderPrint', () => {
    it('does nothing when printer not enabled', async () => {
      await thermalPrinterService.handlePostOrderPrint('school-1', 'order-1');
      expect(apiMock.get).not.toHaveBeenCalled();
    });
  });
});
