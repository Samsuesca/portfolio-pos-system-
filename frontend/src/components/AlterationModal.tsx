/**
 * Alteration Modal - Create/Edit Alteration Form
 *
 * Supports both registered clients (via ClientSelector) and external clients.
 */
import { useState, useEffect } from 'react';
import { X, Loader2, Scissors, User, UserPlus, Phone, CheckCircle, Printer, AlertCircle } from 'lucide-react';
import { alterationService } from '../services/alterationService';
import { useSchoolStore } from '../stores/schoolStore';
import ClientSelector from './ClientSelector';
import thermalPrinterService from '../services/thermalPrinterService';
import { isValidColombianPhone } from '../utils/whatsapp';
import { getColombiaDateString } from '../utils/formatting';
import type {
  AlterationWithPayments,
  AlterationCreate,
  AlterationUpdate,
  AlterationType,
  Client
} from '../types/api';
import { ALTERATION_TYPE_LABELS } from '../types/api';

interface AlterationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  alteration?: AlterationWithPayments | null;  // If provided, edit mode
}

type ClientMode = 'registered' | 'external';

export default function AlterationModal({
  isOpen,
  onClose,
  onSuccess,
  alteration
}: AlterationModalProps) {
  const isEditMode = !!alteration;
  const { currentSchool } = useSchoolStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientMode, setClientMode] = useState<ClientMode>('external');

  // Success modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [alterationResult, setAlterationResult] = useState<{
    code: string;
    id: string;
    cost: number;
    clientName: string;
  } | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const [formData, setFormData] = useState({
    client_id: '',
    external_client_name: '',
    external_client_phone: '',
    alteration_type: 'other' as AlterationType,
    garment_name: '',
    description: '',
    cost: '',
    received_date: getColombiaDateString(),
    estimated_delivery_date: '',
    notes: '',
    initial_payment: '',
    initial_payment_method: '' as '' | 'cash' | 'nequi' | 'transfer' | 'card'
  });

  // Reset form when modal opens/closes or alteration changes
  useEffect(() => {
    if (isOpen) {
      if (alteration) {
        // Edit mode - populate form
        setFormData({
          client_id: alteration.client_id || '',
          external_client_name: alteration.external_client_name || '',
          external_client_phone: alteration.external_client_phone || '',
          alteration_type: alteration.alteration_type,
          garment_name: alteration.garment_name,
          description: alteration.description,
          cost: String(alteration.cost),
          received_date: alteration.received_date,
          estimated_delivery_date: alteration.estimated_delivery_date || '',
          notes: alteration.notes || '',
          initial_payment: '',
          initial_payment_method: ''
        });
        // Set client mode based on existing data
        if (alteration.client_id) {
          setClientMode('registered');
        } else {
          setClientMode('external');
        }
      } else {
        // Create mode - reset form
        setFormData({
          client_id: '',
          external_client_name: '',
          external_client_phone: '',
          alteration_type: 'other',
          garment_name: '',
          description: '',
          cost: '',
          received_date: getColombiaDateString(),
          estimated_delivery_date: '',
          notes: '',
          initial_payment: '',
          initial_payment_method: ''
        });
        setClientMode('external');
      }
      setError(null);
    }
  }, [isOpen, alteration]);

  const handleClientChange = (clientId: string, _client?: Client) => {
    setFormData(prev => ({ ...prev, client_id: clientId }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation - client required
    if (!isEditMode) {
      if (clientMode === 'registered' && !formData.client_id) {
        setError('Selecciona un cliente registrado');
        return;
      }
      if (clientMode === 'external' && !formData.external_client_name.trim()) {
        setError('Ingresa el nombre del cliente');
        return;
      }
    }

    if (!formData.garment_name.trim()) {
      setError('Ingresa el nombre de la prenda');
      return;
    }
    if (!formData.description.trim()) {
      setError('Describe el trabajo a realizar');
      return;
    }
    const cost = parseFloat(formData.cost);
    if (isNaN(cost) || cost <= 0) {
      setError('Ingresa un costo válido');
      return;
    }

    // Validate initial payment if provided
    const initialPayment = formData.initial_payment ? parseFloat(formData.initial_payment) : 0;
    if (initialPayment > 0 && !formData.initial_payment_method) {
      setError('Selecciona el método de pago del anticipo');
      return;
    }
    if (initialPayment > cost) {
      setError('El anticipo no puede ser mayor al costo');
      return;
    }

    try {
      setLoading(true);

      if (isEditMode && alteration) {
        // Update existing alteration
        const updateData: AlterationUpdate = {
          alteration_type: formData.alteration_type,
          garment_name: formData.garment_name,
          description: formData.description,
          cost: cost,
          estimated_delivery_date: formData.estimated_delivery_date || undefined,
          notes: formData.notes || undefined
        };
        await alterationService.update(alteration.id, updateData);
      } else {
        // Create new alteration
        const createData: AlterationCreate = {
          alteration_type: formData.alteration_type,
          garment_name: formData.garment_name,
          description: formData.description,
          cost: cost,
          received_date: formData.received_date,
          estimated_delivery_date: formData.estimated_delivery_date || undefined,
          notes: formData.notes || undefined,
        };

        // Set client based on mode
        if (clientMode === 'registered') {
          createData.client_id = formData.client_id;
        } else {
          createData.external_client_name = formData.external_client_name;
          createData.external_client_phone = formData.external_client_phone || undefined;
        }

        // Add initial payment if provided
        if (initialPayment > 0 && formData.initial_payment_method) {
          createData.initial_payment = initialPayment;
          createData.initial_payment_method = formData.initial_payment_method;
        }

        const newAlteration = await alterationService.create(createData);

        // Show success modal with print option
        setAlterationResult({
          code: newAlteration.code,
          id: newAlteration.id,
          cost: newAlteration.cost,
          clientName: newAlteration.client_display_name
        });
        setShowSuccessModal(true);
        return; // Don't close yet, let user print or close manually
      }

      // For edit mode, just close
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving alteration:', err);
      setError(err.response?.data?.detail || 'Error al guardar el arreglo');
    } finally {
      setLoading(false);
    }
  };

  // Handle print receipt
  const handlePrintReceipt = async () => {
    if (!alterationResult) return;
    setIsPrinting(true);
    try {
      // Si hay pago inicial en efectivo, abrir cajón
      const paymentMethod = formData.initial_payment && parseFloat(formData.initial_payment) > 0
        ? formData.initial_payment_method
        : '';
      await thermalPrinterService.printAlterationReceiptWithDrawer(
        alterationResult.id,
        paymentMethod || ''
      );
    } catch (error) {
      console.error('Error printing receipt:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  // Handle close success modal
  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    setAlterationResult(null);
    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center">
                <Scissors className="w-5 h-5 text-brand-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {isEditMode ? 'Editar Arreglo' : 'Nuevo Arreglo'}
                </h2>
                <p className="text-sm text-gray-500">
                  {isEditMode ? `Editando ${alteration?.code}` : 'Registra un nuevo arreglo o confección'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Client Section */}
            {!isEditMode && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Cliente *
                  </label>
                  {/* Mode Toggle */}
                  <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setClientMode('registered');
                        setFormData(prev => ({ ...prev, external_client_name: '', external_client_phone: '' }));
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                        clientMode === 'registered'
                          ? 'bg-white text-brand-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      Registrado
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setClientMode('external');
                        setFormData(prev => ({ ...prev, client_id: '' }));
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                        clientMode === 'external'
                          ? 'bg-white text-brand-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <UserPlus className="w-4 h-4" />
                      Externo
                    </button>
                  </div>
                </div>

                {clientMode === 'registered' ? (
                  // Registered client selector
                  <div>
                    {currentSchool ? (
                      <ClientSelector
                        value={formData.client_id}
                        onChange={handleClientChange}
                        schoolId={currentSchool.id}
                        allowNoClient={false}
                        placeholder="Buscar cliente por nombre, teléfono..."
                      />
                    ) : (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                        Selecciona un colegio en el menú superior para ver los clientes registrados.
                      </div>
                    )}
                  </div>
                ) : (
                  // External client form
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Nombre *
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={formData.external_client_name}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            external_client_name: e.target.value
                          }))}
                          placeholder="Nombre del cliente"
                          className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Telefono
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={formData.external_client_phone}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            external_client_phone: e.target.value.replace(/\D/g, '').slice(0, 10)
                          }))}
                          placeholder="3001234567 (opcional)"
                          className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${
                            formData.external_client_phone && !isValidColombianPhone(formData.external_client_phone)
                              ? 'border-red-300'
                              : 'border-gray-200'
                          }`}
                        />
                      </div>
                      {formData.external_client_phone && !isValidColombianPhone(formData.external_client_phone) && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          10 digitos, inicia con 3
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Show client info in edit mode */}
            {isEditMode && alteration && (
              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cliente
                </label>
                <div className="flex items-center gap-2 text-gray-900">
                  <User className="w-4 h-4 text-gray-400" />
                  <span>{alteration.client_display_name}</span>
                  {alteration.external_client_phone && (
                    <span className="text-gray-500">• {alteration.external_client_phone}</span>
                  )}
                </div>
              </div>
            )}

            {/* Garment Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Arreglo *
                </label>
                <select
                  value={formData.alteration_type}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    alteration_type: e.target.value as AlterationType
                  }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  {Object.entries(ALTERATION_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prenda *
                </label>
                <input
                  type="text"
                  value={formData.garment_name}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    garment_name: e.target.value
                  }))}
                  placeholder="Ej: Pantalón escolar azul"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción del Trabajo *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  description: e.target.value
                }))}
                rows={3}
                placeholder="Describe detalladamente el trabajo a realizar..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            {/* Dates and Cost */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Recibido *
                </label>
                <input
                  type="date"
                  value={formData.received_date}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    received_date: e.target.value
                  }))}
                  disabled={isEditMode}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Entrega Estimada
                </label>
                <input
                  type="date"
                  value={formData.estimated_delivery_date}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    estimated_delivery_date: e.target.value
                  }))}
                  min={formData.received_date}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Costo *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    value={formData.cost}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      cost: e.target.value
                    }))}
                    placeholder="0"
                    min="0"
                    step="100"
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>
            </div>

            {/* Initial Payment - Only for create mode */}
            {!isEditMode && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">
                    Anticipo (opcional)
                  </h3>
                  {/* Quick amount buttons */}
                  {formData.cost && parseFloat(formData.cost) > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          initial_payment: prev.cost,
                          initial_payment_method: prev.initial_payment_method || 'cash'
                        }))}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          formData.initial_payment === formData.cost
                            ? 'bg-green-600 text-white'
                            : 'bg-white text-green-700 border border-green-300 hover:bg-green-100'
                        }`}
                      >
                        Total (${parseFloat(formData.cost).toLocaleString()})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const half = Math.round(parseFloat(formData.cost) / 2 / 100) * 100;
                          setFormData(prev => ({
                            ...prev,
                            initial_payment: String(half),
                            initial_payment_method: prev.initial_payment_method || 'cash'
                          }));
                        }}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          formData.initial_payment === String(Math.round(parseFloat(formData.cost) / 2 / 100) * 100)
                            ? 'bg-green-600 text-white'
                            : 'bg-white text-green-700 border border-green-300 hover:bg-green-100'
                        }`}
                      >
                        50% (${Math.round(parseFloat(formData.cost) / 2 / 100) * 100})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          initial_payment: '',
                          initial_payment_method: ''
                        }))}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          !formData.initial_payment
                            ? 'bg-gray-600 text-white'
                            : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        Sin anticipo
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Monto
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        value={formData.initial_payment}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          initial_payment: e.target.value
                        }))}
                        placeholder="0"
                        min="0"
                        max={formData.cost || undefined}
                        step="100"
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    {formData.initial_payment && formData.cost && (
                      <p className="text-xs text-gray-500 mt-1">
                        Saldo pendiente: ${(parseFloat(formData.cost) - parseFloat(formData.initial_payment || '0')).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Método de Pago
                    </label>
                    <select
                      value={formData.initial_payment_method}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        initial_payment_method: e.target.value as any
                      }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="cash">💵 Efectivo</option>
                      <option value="nequi">📱 Nequi</option>
                      <option value="transfer">🏦 Transferencia</option>
                      <option value="card">💳 Tarjeta</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas adicionales
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  notes: e.target.value
                }))}
                rows={2}
                placeholder="Observaciones, instrucciones especiales..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Scissors className="w-4 h-4" />
                  {isEditMode ? 'Guardar Cambios' : 'Crear Arreglo'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && alterationResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleCloseSuccessModal} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Arreglo Creado Exitosamente</h3>
            </div>

            {/* Result */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-6">
              <div className="text-sm text-gray-600 mb-1">{alterationResult.clientName}</div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-lg font-bold text-gray-900">{alterationResult.code}</span>
                <span className="text-lg font-semibold text-green-600">
                  ${alterationResult.cost.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {thermalPrinterService.isPrinterConfigured() && (
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  disabled={isPrinting}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isPrinting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Printer className="w-4 h-4" />
                  )}
                  {isPrinting ? 'Imprimiendo...' : 'Imprimir Comprobante'}
                </button>
              )}
              <button
                type="button"
                onClick={handleCloseSuccessModal}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
