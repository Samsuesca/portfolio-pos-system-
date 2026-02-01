/**
 * PrintQueuePanel Component
 *
 * Panel showing pending cash sales to print.
 * Includes controls for auto/manual mode and actions per item.
 */
import { useEffect, useRef, useCallback } from 'react';
import {
  X,
  Printer,
  SkipForward,
  RefreshCw,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Zap,
  Hand,
  DollarSign,
  Store,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { usePrintQueueStore } from '../stores/printQueueStore';
import { usePrintQueueSSE } from '../hooks/usePrintQueueSSE';
import { usePrinterStore } from '../stores/printerStore';
import type { PrintQueueItem } from '../services/printQueueService';

// Format relative time
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Source device badge
function SourceBadge({ source }: { source: string | null }) {
  const labels: Record<string, string> = {
    'desktop_app': 'Desktop',
    'admin_portal': 'Admin',
    'web_portal': 'Web',
    'api': 'API',
  };

  const colors: Record<string, string> = {
    'desktop_app': 'bg-blue-100 text-blue-700',
    'admin_portal': 'bg-purple-100 text-purple-700',
    'web_portal': 'bg-green-100 text-green-700',
    'api': 'bg-gray-100 text-gray-700',
  };

  const label = labels[source || ''] || source || 'Unknown';
  const colorClass = colors[source || ''] || 'bg-gray-100 text-gray-600';

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${colorClass}`}>
      {label}
    </span>
  );
}

interface QueueItemProps {
  item: PrintQueueItem;
  onPrint: (item: PrintQueueItem, openDrawer: boolean) => void;
  onSkip: (itemId: string) => void;
  isProcessing: boolean;
}

function QueueItem({ item, onPrint, onSkip, isProcessing }: QueueItemProps) {
  return (
    <div className="p-3 border-b border-gray-100 last:border-b-0 hover:bg-surface-50 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-primary-600">
            {item.sale_code}
          </span>
          <SourceBadge source={item.source_device} />
        </div>
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatTimeAgo(item.created_at)}
        </span>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
        {item.school_name && (
          <span className="flex items-center gap-1">
            <Store className="w-3.5 h-3.5" />
            {item.school_name}
          </span>
        )}
        {item.client_name && (
          <span className="truncate max-w-[150px]" title={item.client_name}>
            {item.client_name}
          </span>
        )}
      </div>

      {/* Total and actions */}
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-gray-900 flex items-center gap-1">
          <DollarSign className="w-4 h-4 text-green-600" />
          {formatCurrency(item.sale_total)}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onSkip(item.id)}
            disabled={isProcessing}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Omitir"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={() => onPrint(item, false)}
            disabled={isProcessing}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
            title="Solo imprimir"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            onClick={() => onPrint(item, true)}
            disabled={isProcessing}
            className="px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
            title="Imprimir y abrir cajon"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            + Cajon
          </button>
        </div>
      </div>

      {/* Error message if failed */}
      {item.status === 'failed' && item.error_message && (
        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{item.error_message}</span>
        </div>
      )}
    </div>
  );
}

export function PrintQueuePanel() {
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    pendingItems,
    settings,
    isProcessing,
    isPanelOpen,
    error,
    isConnected,
    setPanelOpen,
    setSettings,
    fetchPendingItems,
    printItem,
    skipItem,
    addPendingItem,
    updateItemStatus,
    setConnected,
    clearError,
  } = usePrintQueueStore();

  const { settings: printerSettings } = usePrinterStore();
  const isPrinterConfigured = printerSettings.enabled && printerSettings.portName;

  // SSE connection
  const { isConnected: sseConnected, reconnect } = usePrintQueueSSE({
    enabled: Boolean(isPanelOpen && isPrinterConfigured),
    onEvent: (event) => {
      if (event.type === 'connected') {
        setConnected(true);
      } else if (event.type === 'initial' && Array.isArray(event.data)) {
        // Initial items from SSE
        event.data.forEach((item) => {
          addPendingItem(item as PrintQueueItem);
        });
      }
    },
    onNewSale: (item) => {
      addPendingItem(item as PrintQueueItem);

      // Play sound if enabled
      if (settings.soundEnabled) {
        playNotificationSound();
      }

      // Auto print if enabled
      if (settings.autoMode && isPrinterConfigured) {
        const fullItem = { ...item, status: 'pending' } as PrintQueueItem;
        printItem(fullItem, settings.autoOpenDrawer);
      }
    },
    onItemUpdated: (itemId, status) => {
      updateItemStatus(itemId, status);
    },
  });

  // Update connection state from SSE
  useEffect(() => {
    setConnected(sseConnected);
  }, [sseConnected, setConnected]);

  // Fetch initial items when panel opens
  useEffect(() => {
    if (isPanelOpen) {
      fetchPendingItems();
    }
  }, [isPanelOpen, fetchPendingItems]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    };

    if (isPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPanelOpen, setPanelOpen]);

  const handlePrint = useCallback(async (item: PrintQueueItem, openDrawer: boolean) => {
    await printItem(item, openDrawer);
  }, [printItem]);

  const handleSkip = useCallback(async (itemId: string) => {
    await skipItem(itemId);
  }, [skipItem]);

  if (!isPanelOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-[80vh] flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Cola de Impresion</h3>
            {pendingItems.length > 0 && (
              <span className="bg-primary-100 text-primary-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {pendingItems.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Connection status */}
            <div
              className={`p-1.5 rounded-lg ${
                isConnected ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}
              title={isConnected ? 'Conectado' : 'Desconectado'}
            >
              {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Mode toggles */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSettings({ autoMode: !settings.autoMode })}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              settings.autoMode
                ? 'bg-primary-100 text-primary-700 border-2 border-primary-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
            }`}
          >
            {settings.autoMode ? <Zap className="w-4 h-4" /> : <Hand className="w-4 h-4" />}
            {settings.autoMode ? 'Automatico' : 'Manual'}
          </button>

          <button
            onClick={() => setSettings({ soundEnabled: !settings.soundEnabled })}
            className={`p-2 rounded-lg transition-colors ${
              settings.soundEnabled
                ? 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-400'
            }`}
            title={settings.soundEnabled ? 'Sonido activado' : 'Sonido desactivado'}
          >
            {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={reconnect}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            title="Reconectar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
          <span className="text-sm text-red-600">{error}</span>
          <button onClick={clearError} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {!isPrinterConfigured ? (
          <div className="p-8 text-center text-gray-500">
            <Printer className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Impresora no configurada</p>
            <p className="text-sm mt-1">
              Configura tu impresora en Ajustes para usar esta funcion.
            </p>
          </div>
        ) : pendingItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Printer className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Sin ventas pendientes</p>
            <p className="text-sm mt-1">
              Las ventas en efectivo de otros dispositivos apareceran aqui.
            </p>
          </div>
        ) : (
          pendingItems.map((item) => (
            <QueueItem
              key={item.id}
              item={item}
              onPrint={handlePrint}
              onSkip={handleSkip}
              isProcessing={isProcessing}
            />
          ))
        )}
      </div>

      {/* Footer with stats */}
      {isPrinterConfigured && pendingItems.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
          <span>{pendingItems.length} pendiente{pendingItems.length !== 1 ? 's' : ''}</span>
          <span>
            {settings.autoMode ? 'Modo automatico' : 'Modo manual'}
          </span>
        </div>
      )}
    </div>
  );
}

// Simple notification sound
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (e) {
    console.warn('Could not play notification sound:', e);
  }
}

export default PrintQueuePanel;
