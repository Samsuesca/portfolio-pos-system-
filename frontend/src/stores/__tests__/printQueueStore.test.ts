import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePrintQueueStore } from '../printQueueStore';
import printQueueService from '../../services/printQueueService';
import thermalPrinterService from '../../services/thermalPrinterService';

vi.mock('../../services/printQueueService', () => ({
  default: {
    getPendingItems: vi.fn(),
    getQueueStats: vi.fn(),
    markAsPrinted: vi.fn(),
    markAsFailed: vi.fn(),
    markAsSkipped: vi.fn(),
    retryFailed: vi.fn(),
  },
}));

vi.mock('../../services/thermalPrinterService', () => ({
  default: {
    printSaleReceiptWithDrawer: vi.fn(),
    isTauri: vi.fn().mockReturnValue(false),
  },
}));

const mockItem = { id: 'pq-1', school_id: 'school-1', sale_id: 'sale-1', status: 'pending' };
const mockItem2 = { id: 'pq-2', school_id: 'school-1', sale_id: 'sale-2', status: 'pending' };

const DEFAULT_SETTINGS = { autoMode: false, autoOpenDrawer: true, soundEnabled: true, desktopNotification: true };

function resetStore() {
  usePrintQueueStore.setState({
    pendingItems: [],
    stats: null,
    isConnected: false,
    lastEventTime: null,
    settings: DEFAULT_SETTINGS,
    isProcessing: false,
    isPanelOpen: false,
    error: null,
  });
}

describe('printQueueStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe('setPendingItems', () => {
    it('sets pending items', () => {
      usePrintQueueStore.getState().setPendingItems([mockItem as any]);
      expect(usePrintQueueStore.getState().pendingItems).toHaveLength(1);
    });
  });

  describe('addPendingItem', () => {
    it('adds item to front of list', () => {
      usePrintQueueStore.setState({ pendingItems: [mockItem as any] });
      usePrintQueueStore.getState().addPendingItem(mockItem2 as any);
      const items = usePrintQueueStore.getState().pendingItems;
      expect(items).toHaveLength(2);
      expect(items[0].id).toBe('pq-2');
    });

    it('skips duplicates', () => {
      usePrintQueueStore.setState({ pendingItems: [mockItem as any] });
      usePrintQueueStore.getState().addPendingItem(mockItem as any);
      expect(usePrintQueueStore.getState().pendingItems).toHaveLength(1);
    });
  });

  describe('removeItem', () => {
    it('removes item by ID', () => {
      usePrintQueueStore.setState({ pendingItems: [mockItem as any, mockItem2 as any] });
      usePrintQueueStore.getState().removeItem('pq-1');
      expect(usePrintQueueStore.getState().pendingItems).toHaveLength(1);
      expect(usePrintQueueStore.getState().pendingItems[0].id).toBe('pq-2');
    });
  });

  describe('updateItemStatus', () => {
    it('removes item for terminal statuses (printed/skipped)', () => {
      usePrintQueueStore.setState({ pendingItems: [mockItem as any] });
      usePrintQueueStore.getState().updateItemStatus('pq-1', 'printed');
      expect(usePrintQueueStore.getState().pendingItems).toHaveLength(0);
    });

    it('updates status in place for non-terminal statuses', () => {
      usePrintQueueStore.setState({ pendingItems: [mockItem as any] });
      usePrintQueueStore.getState().updateItemStatus('pq-1', 'processing');
      expect(usePrintQueueStore.getState().pendingItems[0].status).toBe('processing');
    });
  });

  describe('connection state', () => {
    it('setConnected sets isConnected', () => {
      usePrintQueueStore.getState().setConnected(true);
      expect(usePrintQueueStore.getState().isConnected).toBe(true);
    });

    it('setLastEventTime sets time', () => {
      usePrintQueueStore.getState().setLastEventTime('2026-01-01T00:00:00');
      expect(usePrintQueueStore.getState().lastEventTime).toBe('2026-01-01T00:00:00');
    });
  });

  describe('setSettings', () => {
    it('merges partial settings', () => {
      usePrintQueueStore.getState().setSettings({ autoMode: true });
      const settings = usePrintQueueStore.getState().settings;
      expect(settings.autoMode).toBe(true);
      expect(settings.soundEnabled).toBe(true); // preserved
    });
  });

  describe('panel controls', () => {
    it('setPanelOpen sets isPanelOpen', () => {
      usePrintQueueStore.getState().setPanelOpen(true);
      expect(usePrintQueueStore.getState().isPanelOpen).toBe(true);
    });

    it('togglePanel toggles isPanelOpen', () => {
      usePrintQueueStore.getState().togglePanel();
      expect(usePrintQueueStore.getState().isPanelOpen).toBe(true);
      usePrintQueueStore.getState().togglePanel();
      expect(usePrintQueueStore.getState().isPanelOpen).toBe(false);
    });
  });

  describe('fetchPendingItems', () => {
    it('fetches and stores pending items', async () => {
      vi.mocked(printQueueService.getPendingItems).mockResolvedValueOnce({ items: [mockItem], total: 1 } as any);
      await usePrintQueueStore.getState().fetchPendingItems();
      expect(usePrintQueueStore.getState().pendingItems).toHaveLength(1);
      expect(usePrintQueueStore.getState().error).toBeNull();
    });

    it('sets error on failure', async () => {
      vi.mocked(printQueueService.getPendingItems).mockRejectedValueOnce(new Error('Network'));
      await usePrintQueueStore.getState().fetchPendingItems();
      expect(usePrintQueueStore.getState().error).toBe('Network');
    });
  });

  describe('fetchStats', () => {
    it('fetches and stores stats', async () => {
      const stats = { pending: 5, printed: 100, failed: 2 };
      vi.mocked(printQueueService.getQueueStats).mockResolvedValueOnce(stats as any);
      await usePrintQueueStore.getState().fetchStats();
      expect(usePrintQueueStore.getState().stats).toEqual(stats);
    });
  });

  describe('printItem', () => {
    it('prints successfully and removes item', async () => {
      usePrintQueueStore.setState({ pendingItems: [mockItem as any] });
      vi.mocked(thermalPrinterService.printSaleReceiptWithDrawer).mockResolvedValueOnce(true);
      vi.mocked(printQueueService.markAsPrinted).mockResolvedValueOnce(undefined as any);

      const result = await usePrintQueueStore.getState().printItem(mockItem as any);

      expect(result).toBe(true);
      expect(usePrintQueueStore.getState().pendingItems).toHaveLength(0);
      expect(usePrintQueueStore.getState().isProcessing).toBe(false);
    });

    it('marks as failed when print returns false', async () => {
      usePrintQueueStore.setState({ pendingItems: [mockItem as any] });
      vi.mocked(thermalPrinterService.printSaleReceiptWithDrawer).mockResolvedValueOnce(false);

      const result = await usePrintQueueStore.getState().printItem(mockItem as any);

      expect(result).toBe(false);
      expect(printQueueService.markAsFailed).toHaveBeenCalled();
    });

    it('handles print error', async () => {
      usePrintQueueStore.setState({ pendingItems: [mockItem as any] });
      vi.mocked(thermalPrinterService.printSaleReceiptWithDrawer).mockRejectedValueOnce(new Error('Printer offline'));

      const result = await usePrintQueueStore.getState().printItem(mockItem as any);

      expect(result).toBe(false);
      expect(usePrintQueueStore.getState().error).toBe('Printer offline');
    });

    it('uses transfer (no drawer) when openDrawer=false', async () => {
      vi.mocked(thermalPrinterService.printSaleReceiptWithDrawer).mockResolvedValueOnce(true);
      vi.mocked(printQueueService.markAsPrinted).mockResolvedValueOnce(undefined as any);

      await usePrintQueueStore.getState().printItem(mockItem as any, false);

      expect(thermalPrinterService.printSaleReceiptWithDrawer).toHaveBeenCalledWith('school-1', 'sale-1', 'transfer');
    });
  });

  describe('skipItem', () => {
    it('marks as skipped and removes from list', async () => {
      usePrintQueueStore.setState({ pendingItems: [mockItem as any] });
      vi.mocked(printQueueService.markAsSkipped).mockResolvedValueOnce(undefined as any);

      await usePrintQueueStore.getState().skipItem('pq-1');

      expect(printQueueService.markAsSkipped).toHaveBeenCalledWith('pq-1');
      expect(usePrintQueueStore.getState().pendingItems).toHaveLength(0);
    });
  });

  describe('retryItem', () => {
    it('calls retry on service', async () => {
      vi.mocked(printQueueService.retryFailed).mockResolvedValueOnce(undefined as any);

      await usePrintQueueStore.getState().retryItem('pq-1');

      expect(printQueueService.retryFailed).toHaveBeenCalledWith('pq-1');
    });

    it('sets error on retry failure', async () => {
      vi.mocked(printQueueService.retryFailed).mockRejectedValueOnce(new Error('Not found'));

      await usePrintQueueStore.getState().retryItem('pq-1');

      expect(usePrintQueueStore.getState().error).toBe('Not found');
    });
  });

  describe('clearError', () => {
    it('sets error to null', () => {
      usePrintQueueStore.setState({ error: 'some error' });
      usePrintQueueStore.getState().clearError();
      expect(usePrintQueueStore.getState().error).toBeNull();
    });
  });
});
