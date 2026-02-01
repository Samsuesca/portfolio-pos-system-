/**
 * Alteration Detail Page - View complete alteration information with payments
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import AlterationModal from '../components/AlterationModal';
import AlterationPaymentModal from '../components/AlterationPaymentModal';
import {
  ArrowLeft, Calendar, User, Scissors, AlertCircle,
  Loader2, CheckCircle, Clock, DollarSign, Phone,
  Edit, Banknote, Printer, MessageCircle
} from 'lucide-react';
import { formatDateTimeSpanish } from '../components/DatePicker';
import { alterationService } from '../services/alterationService';
import thermalPrinterService from '../services/thermalPrinterService';
import type {
  AlterationWithPayments,
  AlterationPayment,
  AlterationStatus
} from '../types/api';
import {
  ALTERATION_TYPE_LABELS,
  ALTERATION_STATUS_LABELS,
  ALTERATION_STATUS_COLORS
} from '../types/api';
import { openWhatsApp } from '../utils/whatsapp';
import ClientDetailModal from '../components/ClientDetailModal';
import ReceiptModal from '../components/ReceiptModal';
import { clientService } from '../services/clientService';
import type { Client } from '../types/api';
import { formatCurrency } from '../utils/formatting';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  nequi: 'Nequi',
  transfer: 'Transferencia',
  card: 'Tarjeta'
};

export default function AlterationDetail() {
  const { alterationId } = useParams<{ alterationId: string }>();
  const navigate = useNavigate();
  const [alteration, setAlteration] = useState<AlterationWithPayments | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isClientDetailModalOpen, setIsClientDetailModalOpen] = useState(false);
  const [clientDetail, setClientDetail] = useState<Client | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  useEffect(() => {
    if (alterationId) {
      loadAlterationDetail();
    }
  }, [alterationId]);

  const loadAlterationDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!alterationId) {
        setError('ID de arreglo no válido');
        return;
      }

      const data = await alterationService.getById(alterationId);
      setAlteration(data);
    } catch (err: any) {
      console.error('Error loading alteration detail:', err);
      setError(err.response?.data?.detail || 'Error al cargar los detalles del arreglo');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: AlterationStatus) => {
    if (!alterationId || !alteration) return;

    try {
      setUpdatingStatus(true);
      await alterationService.updateStatus(alterationId, newStatus);
      await loadAlterationDetail();
    } catch (err: any) {
      console.error('Error updating status:', err);
      setError(err.response?.data?.detail || 'Error al actualizar estado');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!alteration) return;
    setIsPrinting(true);
    try {
      await thermalPrinterService.printAlterationReceipt(alteration.id);
    } catch (err) {
      console.error('Error printing receipt:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return formatDateTimeSpanish(dateString);
  };

  // Handle opening client detail modal (only for registered clients)
  const handleOpenClientDetail = async () => {
    if (!alteration || !alteration.client_id) return;

    setLoadingClient(true);
    try {
      // Clients are global - only need client_id
      const client = await clientService.getClient(alteration.client_id);
      setClientDetail(client);
      setIsClientDetailModalOpen(true);
    } catch (err: any) {
      console.error('Error loading client:', err);
      setError('Error al cargar información del cliente');
    } finally {
      setLoadingClient(false);
    }
  };

  // Get next valid status transitions
  const getNextStatuses = (current: AlterationStatus): AlterationStatus[] => {
    const transitions: Record<AlterationStatus, AlterationStatus[]> = {
      pending: ['in_progress', 'cancelled'],
      in_progress: ['ready', 'pending', 'cancelled'],
      ready: ['delivered', 'in_progress'],
      delivered: [],
      cancelled: ['pending']
    };
    return transitions[current] || [];
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error || !alteration) {
    return (
      <Layout>
        <div className="space-y-4">
          <button
            onClick={() => navigate('/alterations')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver a Arreglos
          </button>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700">{error || 'Arreglo no encontrado'}</p>
          </div>
        </div>
      </Layout>
    );
  }

  const nextStatuses = getNextStatuses(alteration.status);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/alterations')}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <Scissors className="w-7 h-7 text-brand-600" />
                {alteration.code}
              </h1>
              <p className="text-gray-500 mt-1">
                {ALTERATION_TYPE_LABELS[alteration.alteration_type]} - {alteration.garment_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* PDF Download Button */}
            <button
              onClick={() => setIsReceiptModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Descargar PDF
            </button>
            {/* Thermal Printer Button */}
            {thermalPrinterService.isPrinterConfigured() && (
              <button
                onClick={handlePrintReceipt}
                disabled={isPrinting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                title="Imprimir en impresora termica"
              >
                {isPrinting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                Imprimir
              </button>
            )}
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Editar
            </button>
            {alteration.balance > 0 && (
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Banknote className="w-4 h-4" />
                Registrar Pago
              </button>
            )}
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Estado</h2>
              <div className="flex items-center gap-4 flex-wrap">
                <span className={`px-3 py-1.5 text-sm rounded-full font-medium ${ALTERATION_STATUS_COLORS[alteration.status]}`}>
                  {ALTERATION_STATUS_LABELS[alteration.status]}
                </span>
                {nextStatuses.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Cambiar a:</span>
                    {nextStatuses.map(status => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        disabled={updatingStatus}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          status === 'cancelled'
                            ? 'border-red-200 text-red-600 hover:bg-red-50'
                            : 'border-brand-200 text-brand-600 hover:bg-brand-50'
                        } disabled:opacity-50`}
                      >
                        {updatingStatus ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          ALTERATION_STATUS_LABELS[status]
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Description Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Descripción del Trabajo</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{alteration.description}</p>
              {alteration.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500 mb-2">Notas adicionales:</p>
                  <p className="text-gray-700">{alteration.notes}</p>
                </div>
              )}
            </div>

            {/* Payments History */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">Historial de Pagos</h2>
                <span className="text-sm text-gray-500">
                  {alteration.payments?.length || 0} pago(s)
                </span>
              </div>
              {!alteration.payments || alteration.payments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay pagos registrados</p>
              ) : (
                <div className="space-y-3">
                  {alteration.payments.map((payment: AlterationPayment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method}
                            {payment.notes && ` - ${payment.notes}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          {formatDateTime(payment.created_at)}
                        </p>
                        {payment.created_by_username && (
                          <p className="text-xs text-gray-400">
                            por {payment.created_by_username}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Client Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Cliente</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  {alteration.client_id ? (
                    <button
                      onClick={handleOpenClientDetail}
                      disabled={loadingClient}
                      className="text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50"
                    >
                      {loadingClient ? 'Cargando...' : alteration.client_display_name}
                    </button>
                  ) : (
                    <span className="text-gray-900">{alteration.client_display_name}</span>
                  )}
                </div>
                {alteration.external_client_phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-700">{alteration.external_client_phone}</span>
                    <button
                      onClick={() => openWhatsApp(alteration.external_client_phone!, `Hola ${alteration.client_display_name}, me comunico de Uniformes Consuelo respecto a su arreglo ${alteration.code}.`)}
                      className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition"
                      title="Abrir WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {alteration.client_id && (
                  <p className="text-xs text-gray-400">Cliente registrado</p>
                )}
                {!alteration.client_id && (
                  <p className="text-xs text-gray-400">Cliente externo</p>
                )}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Resumen Financiero</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Costo Total</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(alteration.cost)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Pagado</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(alteration.amount_paid)}
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Saldo</span>
                    {alteration.balance > 0 ? (
                      <span className="font-semibold text-red-600">
                        {formatCurrency(alteration.balance)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        Pagado
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Fechas</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Recibido</p>
                    <p className="text-gray-900">{formatDate(alteration.received_date)}</p>
                  </div>
                </div>
                {alteration.estimated_delivery_date && (
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Entrega Estimada</p>
                      <p className="text-gray-900">{formatDate(alteration.estimated_delivery_date)}</p>
                    </div>
                  </div>
                )}
                {alteration.delivered_date && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Entregado</p>
                      <p className="text-gray-900">{formatDate(alteration.delivered_date)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-400">
                Creado: {formatDateTime(alteration.created_at)}
              </p>
              <p className="text-xs text-gray-400">
                Actualizado: {formatDateTime(alteration.updated_at)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <AlterationModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={loadAlterationDetail}
        alteration={alteration}
      />

      {/* Payment Modal */}
      <AlterationPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={loadAlterationDetail}
        alteration={alteration}
      />

      {/* Client Detail Modal */}
      {clientDetail && (
        <ClientDetailModal
          isOpen={isClientDetailModalOpen}
          onClose={() => setIsClientDetailModalOpen(false)}
          client={clientDetail}
        />
      )}

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        type="alteration"
        alteration={alteration}
      />
    </Layout>
  );
}
