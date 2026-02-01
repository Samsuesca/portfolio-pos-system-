/**
 * PrinterSettingsModal - Modal for configuring thermal printer
 *
 * Allows users to:
 * - Select serial port for the printer
 * - Test printer connection
 * - Test cash drawer
 * - Enable/disable auto-print and auto-drawer features
 */
import { useEffect, useState } from "react";
import {
  X,
  Printer,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
  DollarSign,
  Usb,
  Lock,
} from "lucide-react";
import { usePrinterStore } from "../stores/printerStore";
import { useAuthStore } from "../stores/authStore";
import thermalPrinterService from "../services/thermalPrinterService";
import { cashDrawerService } from "../services/cashDrawerService";
import DrawerAccessModal from "./DrawerAccessModal";

interface PrinterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PrinterSettingsModal({
  isOpen,
  onClose,
}: PrinterSettingsModalProps) {
  const {
    settings,
    availablePorts,
    isLoading,
    error,
    setSettings,
    refreshPorts,
    testPrinter,
    testCashDrawer,
    clearError,
  } = usePrinterStore();

  const { user } = useAuthStore();

  const [testResult, setTestResult] = useState<{
    type: "printer" | "drawer" | null;
    success: boolean;
    message: string;
  } | null>(null);

  // Cash drawer permission state
  const [canOpenDrawerDirectly, setCanOpenDrawerDirectly] = useState<boolean | null>(null);
  const [showDrawerAccessModal, setShowDrawerAccessModal] = useState(false);

  // Refresh ports and check drawer permission when modal opens
  useEffect(() => {
    if (isOpen) {
      refreshPorts();
      setTestResult(null);
      checkDrawerPermission();
    }
  }, [isOpen, refreshPorts]);

  // Check if Tauri is available
  const isTauriAvailable = thermalPrinterService.isTauri();

  // Check if user can open drawer directly
  const checkDrawerPermission = async () => {
    // Superuser can always open directly
    if (user?.is_superuser) {
      setCanOpenDrawerDirectly(true);
      return;
    }

    try {
      const response = await cashDrawerService.canOpenDirectly();
      setCanOpenDrawerDirectly(response.can_open_directly);
    } catch (err) {
      // If API fails, default to requiring authorization
      setCanOpenDrawerDirectly(false);
    }
  };

  const handleTestPrinter = async () => {
    setTestResult(null);
    const success = await testPrinter();
    setTestResult({
      type: "printer",
      success,
      message: success
        ? "Impresora funcionando correctamente"
        : "Error al imprimir prueba",
    });
  };

  const handleTestDrawer = async () => {
    setTestResult(null);
    const success = await testCashDrawer();
    setTestResult({
      type: "drawer",
      success,
      message: success
        ? "Cajon abierto correctamente"
        : "Error al abrir cajon",
    });
  };

  const handlePortChange = (portName: string) => {
    setSettings({ portName });
    setTestResult(null);
    clearError();
  };

  const handleToggleEnabled = () => {
    setSettings({ enabled: !settings.enabled });
  };

  const handleToggleAutoDrawer = () => {
    setSettings({ autoOpenDrawer: !settings.autoOpenDrawer });
  };

  const handleToggleAutoPrint = () => {
    setSettings({ autoPrintReceipt: !settings.autoPrintReceipt });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg transform rounded-xl bg-white shadow-2xl transition-all">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Printer className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Configurar Impresora
                </h2>
                <p className="text-sm text-gray-500">
                  Impresora termica y cajon monedero
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-6">
            {/* Tauri Warning */}
            {!isTauriAvailable && (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      Funcion no disponible
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      La impresion directa solo esta disponible en la
                      aplicacion de escritorio (Tauri).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {/* Test Result */}
            {testResult && (
              <div
                className={`rounded-lg p-4 ${
                  testResult.success
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  {testResult.success ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <p
                    className={`text-sm ${
                      testResult.success ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {testResult.message}
                  </p>
                </div>
              </div>
            )}

            {/* Enable Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">
                  Habilitar impresora termica
                </p>
                <p className="text-sm text-gray-500">
                  Activa la impresion directa de recibos
                </p>
              </div>
              <button
                onClick={handleToggleEnabled}
                disabled={!isTauriAvailable}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.enabled ? "bg-blue-600" : "bg-gray-200"
                } ${!isTauriAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Port Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Puerto de impresora
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Usb className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    value={settings.portName}
                    onChange={(e) => handlePortChange(e.target.value)}
                    disabled={!isTauriAvailable || !settings.enabled}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Seleccionar puerto...</option>
                    {availablePorts.map((port) => (
                      <option key={port.name} value={port.name}>
                        {port.name}
                        {port.description ? ` - ${port.description}` : ""}
                        {port.port_type ? ` (${port.port_type})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => refreshPorts()}
                  disabled={!isTauriAvailable || !settings.enabled || isLoading}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Actualizar puertos"
                >
                  <RefreshCw
                    className={`h-5 w-5 text-gray-600 ${
                      isLoading ? "animate-spin" : ""
                    }`}
                  />
                </button>
              </div>
              {availablePorts.length === 0 && isTauriAvailable && (
                <p className="mt-2 text-sm text-gray-500">
                  No se encontraron puertos. Conecta la impresora y presiona
                  actualizar.
                </p>
              )}
            </div>

            {/* Auto Options */}
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900">
                Opciones automaticas
              </h3>

              {/* Auto Print */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Printer className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Imprimir al vender
                    </p>
                    <p className="text-xs text-gray-500">
                      Imprime recibo automaticamente
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleAutoPrint}
                  disabled={!settings.enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.autoPrintReceipt ? "bg-blue-600" : "bg-gray-200"
                  } ${!settings.enabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.autoPrintReceipt
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Auto Drawer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Abrir cajon en efectivo
                    </p>
                    <p className="text-xs text-gray-500">
                      Solo para ventas en efectivo
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleAutoDrawer}
                  disabled={!settings.enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.autoOpenDrawer ? "bg-blue-600" : "bg-gray-200"
                  } ${!settings.enabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.autoOpenDrawer
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Test Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleTestPrinter}
                disabled={
                  !isTauriAvailable ||
                  !settings.enabled ||
                  !settings.portName ||
                  isLoading
                }
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                Probar Impresora
              </button>

              {/* Cash Drawer Button - conditional based on permission */}
              {canOpenDrawerDirectly ? (
                <button
                  onClick={handleTestDrawer}
                  disabled={
                    !isTauriAvailable ||
                    !settings.enabled ||
                    !settings.portName ||
                    isLoading
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <DollarSign className="h-4 w-4" />
                  )}
                  Abrir Cajon
                </button>
              ) : (
                <button
                  onClick={() => setShowDrawerAccessModal(true)}
                  disabled={
                    !isTauriAvailable ||
                    !settings.enabled ||
                    !settings.portName
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Requiere autorizacion de un administrador"
                >
                  <Lock className="h-4 w-4" />
                  Solicitar Apertura
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-xl">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Drawer Access Modal (for users without direct permission) */}
      <DrawerAccessModal
        isOpen={showDrawerAccessModal}
        onClose={() => setShowDrawerAccessModal(false)}
        onSuccess={() => {
          setTestResult({
            type: "drawer",
            success: true,
            message: "Cajon abierto correctamente",
          });
        }}
      />
    </div>
  );
}

// Button component to open the modal from anywhere
export function PrinterSettingsButton() {
  const { openModal, settings } = usePrinterStore();
  const isConfigured = settings.enabled && settings.portName;

  return (
    <button
      onClick={openModal}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
        isConfigured
          ? "bg-green-100 text-green-700 hover:bg-green-200"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
      title={isConfigured ? "Impresora configurada" : "Configurar impresora"}
    >
      <Printer className="h-4 w-4" />
      <span className="text-sm font-medium hidden sm:inline">
        {isConfigured ? "Impresora OK" : "Impresora"}
      </span>
    </button>
  );
}
