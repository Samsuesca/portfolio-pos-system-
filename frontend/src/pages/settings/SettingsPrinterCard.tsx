/**
 * Printer and Print Queue Settings Cards
 * Thermal printer configuration + print queue sync settings.
 */
import React from 'react';
import {
  Printer,
  CheckCircle,
  Wifi,
  Zap,
  Hand,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface PrinterSettings {
  enabled: boolean;
  portName?: string;
}

interface PrintQueueSettings {
  autoMode: boolean;
  autoOpenDrawer: boolean;
  soundEnabled: boolean;
}

interface SettingsPrinterCardProps {
  printerSettings: PrinterSettings;
  openPrinterModal: () => void;
  printQueueSettings: PrintQueueSettings;
  setPrintQueueSettings: (settings: Partial<PrintQueueSettings>) => void;
  printQueueConnected: boolean;
}

const SettingsPrinterCard: React.FC<SettingsPrinterCardProps> = ({
  printerSettings,
  openPrinterModal,
  printQueueSettings,
  setPrintQueueSettings,
  printQueueConnected,
}) => {
  return (
    <>
      {/* Thermal Printer */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center mb-4">
          <Printer className="w-5 h-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-800">Impresora Termica</h2>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Configura la impresora termica para imprimir recibos de ventas y comprobantes de pedidos.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Estado:</span>
            {printerSettings.enabled && printerSettings.portName ? (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Configurada ({printerSettings.portName})
              </span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                No configurada
              </span>
            )}
          </div>
          <button
            onClick={openPrinterModal}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center"
          >
            <Printer className="w-4 h-4 mr-2" />
            Configurar Impresora
          </button>
        </div>
      </div>

      {/* Print Queue Sync - Only show if printer is configured */}
      {printerSettings.enabled && printerSettings.portName && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center mb-4">
            <Wifi className="w-5 h-5 text-teal-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-800">Sincronizacion de Caja</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Recibe e imprime automaticamente las ventas en efectivo realizadas desde otros dispositivos (admin portal, celulares, otros PCs).
            </p>

            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Estado:</span>
              {printQueueConnected ? (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Conectado (SSE)
                </span>
              ) : (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  Desconectado
                </span>
              )}
            </div>

            {/* Auto/Manual Mode Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                {printQueueSettings.autoMode ? (
                  <Zap className="w-5 h-5 text-teal-600" />
                ) : (
                  <Hand className="w-5 h-5 text-gray-500" />
                )}
                <div>
                  <span className="text-sm font-medium text-gray-700">
                    {printQueueSettings.autoMode ? 'Modo Automatico' : 'Modo Manual'}
                  </span>
                  <p className="text-xs text-gray-500">
                    {printQueueSettings.autoMode
                      ? 'Imprime automaticamente al recibir venta'
                      : 'Muestra notificacion para imprimir manualmente'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPrintQueueSettings({ autoMode: !printQueueSettings.autoMode })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  printQueueSettings.autoMode ? 'bg-teal-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    printQueueSettings.autoMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Auto Open Drawer (only visible in auto mode) */}
            {printQueueSettings.autoMode && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-700">Abrir cajon automaticamente</span>
                  <p className="text-xs text-gray-500">Abre el cajon de dinero con cada impresion</p>
                </div>
                <button
                  onClick={() => setPrintQueueSettings({ autoOpenDrawer: !printQueueSettings.autoOpenDrawer })}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    printQueueSettings.autoOpenDrawer ? 'bg-teal-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      printQueueSettings.autoOpenDrawer ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Sound Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                {printQueueSettings.soundEnabled ? (
                  <Volume2 className="w-5 h-5 text-blue-600" />
                ) : (
                  <VolumeX className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <span className="text-sm font-medium text-gray-700">Sonido de notificacion</span>
                  <p className="text-xs text-gray-500">Reproduce un sonido al recibir nueva venta</p>
                </div>
              </div>
              <button
                onClick={() => setPrintQueueSettings({ soundEnabled: !printQueueSettings.soundEnabled })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  printQueueSettings.soundEnabled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    printQueueSettings.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Info box */}
            <div className="p-3 bg-teal-50 rounded-lg border border-teal-100">
              <p className="text-xs text-teal-700">
                <strong>Tip:</strong> Abre el panel de cola de impresion desde el icono{' '}
                <Printer className="w-3 h-3 inline" /> en la barra superior para ver las ventas pendientes y controlar la impresion manualmente.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default React.memo(SettingsPrinterCard);
