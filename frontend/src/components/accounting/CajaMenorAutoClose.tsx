/**
 * CajaMenorAutoClose - Manages Caja Menor auto-close feature
 *
 * Shows current balance vs configured base amount, allows triggering
 * auto-close (transfers excess to Caja Mayor), and editing config.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRightLeft, Settings, Loader2, CheckCircle,
  AlertTriangle, ChevronDown, ChevronUp, Save
} from 'lucide-react';
import {
  getCajaMenorConfig,
  updateCajaMenorConfig,
  autoCloseCajaMenor,
} from '../../services/globalAccountingService';
import type {
  CajaMenorConfig,
  CajaMenorAutoCloseResult,
} from '../../services/globalAccountingService';
import { formatCurrency } from '../../utils/formatting';
import { usePermissions } from '../../hooks/usePermissions';

interface CajaMenorAutoCloseProps {
  cajaMenorBalance: number;
  onAutoCloseComplete?: () => void;
}

const CajaMenorAutoClose: React.FC<CajaMenorAutoCloseProps> = ({
  cajaMenorBalance,
  onAutoCloseComplete,
}) => {
  const { hasPermission } = usePermissions();
  const canEditConfig = hasPermission('accounting.edit_caja_menor_config');

  // State
  const [config, setConfig] = useState<CajaMenorConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const [closing, setClosing] = useState(false);
  const [closeResult, setCloseResult] = useState<CajaMenorAutoCloseResult | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  const [showConfig, setShowConfig] = useState(false);
  const [editBaseAmount, setEditBaseAmount] = useState<string>('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Derived values
  const baseAmount = config?.base_amount ?? 0;
  const excess = Math.max(0, cajaMenorBalance - baseAmount);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    setConfigError(null);
    try {
      const data = await getCajaMenorConfig();
      setConfig(data);
      setEditBaseAmount(String(data.base_amount));
    } catch (err) {
      console.error('Error loading caja menor config:', err);
      setConfigError('No se pudo cargar la configuracion de Caja Menor');
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  // Handle auto-close
  const handleAutoClose = useCallback(async () => {
    setClosing(true);
    setCloseResult(null);
    setCloseError(null);
    try {
      const result = await autoCloseCajaMenor();
      setCloseResult(result);
      if (result.amount_transferred > 0) {
        onAutoCloseComplete?.();
      }
    } catch (err) {
      console.error('Error auto-closing caja menor:', err);
      setCloseError('Error al cerrar Caja Menor. Intente de nuevo.');
    } finally {
      setClosing(false);
    }
  }, [onAutoCloseComplete]);

  // Handle config save
  const handleSaveConfig = useCallback(async () => {
    const parsedAmount = parseFloat(editBaseAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return;
    }

    setSavingConfig(true);
    setSaveSuccess(false);
    try {
      const updated = await updateCajaMenorConfig({ base_amount: parsedAmount });
      setConfig(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating caja menor config:', err);
      setConfigError('No se pudo guardar la configuracion');
    } finally {
      setSavingConfig(false);
    }
  }, [editBaseAmount]);

  // Loading state
  if (loadingConfig) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando configuracion...</span>
        </div>
      </div>
    );
  }

  // Error loading config
  if (configError && !config) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm">{configError}</span>
        </div>
        <button
          onClick={loadConfig}
          className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
          Auto-cierre Caja Menor
        </h3>
        {canEditConfig && (
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Configurar
            {showConfig ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        )}
      </div>

      {/* Balance Summary Row */}
      <div className="px-6 py-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Current Balance */}
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Saldo Actual</p>
            <p className="text-xl font-bold text-gray-800 mt-1">
              {formatCurrency(cajaMenorBalance)}
            </p>
          </div>

          {/* Configured Base */}
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Base Configurada</p>
            <p className="text-xl font-bold text-blue-700 mt-1">
              {formatCurrency(baseAmount)}
            </p>
          </div>

          {/* Excess */}
          <div className={`text-center p-3 rounded-lg ${excess > 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
            <p className={`text-xs font-medium uppercase tracking-wide ${excess > 0 ? 'text-green-600' : 'text-gray-500'}`}>
              Excedente
            </p>
            <p className={`text-xl font-bold mt-1 ${excess > 0 ? 'text-green-700' : 'text-gray-400'}`}>
              {formatCurrency(excess)}
            </p>
          </div>
        </div>

        {/* Info text */}
        <p className="text-xs text-gray-500 mt-3 text-center">
          {excess > 0
            ? `Se transferiran ${formatCurrency(excess)} de Caja Menor a Caja Mayor`
            : 'No hay excedente para transferir. El saldo es igual o menor a la base configurada.'
          }
        </p>

        {/* Auto-close Button */}
        <div className="mt-4 flex justify-center">
          <button
            onClick={handleAutoClose}
            disabled={closing || excess <= 0}
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {closing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cerrando...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4" />
                Cerrar Caja Menor
              </>
            )}
          </button>
        </div>

        {/* Close Result */}
        {closeResult && (
          <div className={`mt-4 p-3 rounded-lg flex items-start gap-2 text-sm ${
            closeResult.amount_transferred > 0
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-gray-50 border border-gray-200 text-gray-600'
          }`}>
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">{closeResult.message}</p>
              {closeResult.amount_transferred > 0 && (
                <p className="mt-1">
                  Transferido: {formatCurrency(closeResult.amount_transferred)} |
                  Nuevo saldo Caja Menor: {formatCurrency(closeResult.caja_menor_new_balance)} |
                  Nuevo saldo Caja Mayor: {formatCurrency(closeResult.caja_mayor_new_balance)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Close Error */}
        {closeError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {closeError}
          </div>
        )}
      </div>

      {/* Collapsible Config Section */}
      {canEditConfig && showConfig && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Configuracion de Base</h4>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs text-gray-500 mb-1">Monto Base ($)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={editBaseAmount}
                onChange={(e) => setEditBaseAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej: 200000"
              />
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig || !editBaseAmount || parseFloat(editBaseAmount) < 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium transition-colors"
            >
              {savingConfig ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Guardar
            </button>
          </div>
          {saveSuccess && (
            <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="w-3.5 h-3.5" />
              Configuracion guardada correctamente
            </div>
          )}
          {configError && config && (
            <div className="mt-2 flex items-center gap-1 text-sm text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              {configError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CajaMenorAutoClose;
