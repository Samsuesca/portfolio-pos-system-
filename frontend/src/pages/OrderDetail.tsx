/**
 * Order Detail Page - View and manage a single order
 */
import { useEffect, useState, Fragment } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { ArrowLeft, Calendar, User, Package, DollarSign, AlertCircle, Loader2, Clock, CheckCircle, XCircle, Truck, Edit2, Save, X, Ruler, ChevronDown, ChevronUp, Mail, Printer, Building2, MessageCircle, Ban, RefreshCw, CreditCard } from 'lucide-react';
import apiClient from '../utils/api-client';
import DatePicker, { formatDateSpanish } from '../components/DatePicker';
import { orderService } from '../services/orderService';
import { orderChangeService } from '../services/orderChangeService';
import type { OrderWithItems, OrderStatus, OrderItemStatus, OrderChange } from '../types/api';
import { useSchoolStore } from '../stores/schoolStore';
import ReceiptModal from '../components/ReceiptModal';
import ClientDetailModal from '../components/ClientDetailModal';
import CancelConfirmModal from '../components/CancelConfirmModal';
import OrderChangeModal from '../components/OrderChangeModal';
import { openWhatsApp } from '../utils/whatsapp';
import { clientService } from '../services/clientService';
import thermalPrinterService from '../services/thermalPrinterService';
import { usePrinterStatus } from '../stores/printerStore';
import type { Client } from '../types/api';
import { formatCurrency } from '../utils/formatting';

// Item status configuration
const ITEM_STATUS_CONFIG: Record<OrderItemStatus, { label: string; color: string; bgColor: string; icon: string }> = {
  pending: { label: 'Pendiente', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: '🟡' },
  in_production: { label: 'En Producción', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: '🔵' },
  ready: { label: 'Listo', color: 'text-green-700', bgColor: 'bg-green-100', icon: '🟢' },
  delivered: { label: 'Entregado', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: '✅' },
  cancelled: { label: 'Cancelado', color: 'text-red-700', bgColor: 'bg-red-100', icon: '❌' },
};

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentSchool } = useSchoolStore();
  const printerStatus = usePrinterStatus();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState(false);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmountReceived, setPaymentAmountReceived] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Edit delivery date state
  const [editingDeliveryDate, setEditingDeliveryDate] = useState(false);
  const [newDeliveryDate, setNewDeliveryDate] = useState('');
  const [savingDeliveryDate, setSavingDeliveryDate] = useState(false);

  // Expanded measurements for yomber items
  const [expandedMeasurements, setExpandedMeasurements] = useState<Set<string>>(new Set());

  // Item status update loading state (by item ID)
  const [updatingItemStatus, setUpdatingItemStatus] = useState<string | null>(null);

  // Email sending state
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  // Receipt modal state
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Thermal printing state
  const [printingThermal, setPrintingThermal] = useState(false);

  // Client detail modal state
  const [isClientDetailModalOpen, setIsClientDetailModalOpen] = useState(false);
  const [clientDetail, setClientDetail] = useState<Client | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Order change modal state
  const [showChangeModal, setShowChangeModal] = useState(false);

  // Order changes history
  const [orderChanges, setOrderChanges] = useState<OrderChange[]>([]);

  // Wompi payment transactions
  const [wompiPayments, setWompiPayments] = useState<{
    id: string;
    reference: string;
    status: string;
    amount_in_cents: number;
    payment_method_type: string | null;
    wompi_fee_cents: number | null;
    wompi_fee_tax_cents: number | null;
    created_at: string;
    completed_at: string | null;
  }[]>([]);

  // Get school_id from the order itself (preferred), URL query param, or currentSchool as fallback
  const getEffectiveSchoolId = () => order?.school_id || searchParams.get('school_id') || currentSchool?.id || '';

  // Toggle measurement visibility
  const toggleMeasurements = (itemId: string) => {
    const newExpanded = new Set(expandedMeasurements);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedMeasurements(newExpanded);
  };

  // Labels for measurements in Spanish
  const measurementLabels: Record<string, string> = {
    delantero: 'Talle Delantero',
    trasero: 'Talle Trasero',
    cintura: 'Cintura',
    largo: 'Largo',
    espalda: 'Espalda',
    cadera: 'Cadera',
    hombro: 'Hombro',
    pierna: 'Pierna',
    entrepierna: 'Entrepierna',
    manga: 'Manga',
    cuello: 'Cuello',
    pecho: 'Pecho',
    busto: 'Busto',
    tiro: 'Tiro',
  };

  useEffect(() => {
    if (orderId) {
      loadOrder();
    }
  }, [orderId]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      // Use global endpoint that doesn't require school_id
      const data = await orderService.getOrderDetails(orderId!);
      setOrder(data);
      // Load changes after we have the order data
      await loadOrderChanges(data.school_id);
      // Load Wompi payment transactions
      loadWompiPayments();
    } catch (err: any) {
      console.error('Error loading order:', err);
      setError(err.response?.data?.detail || 'Error al cargar el encargo');
    } finally {
      setLoading(false);
    }
  };

  const loadWompiPayments = async () => {
    try {
      const resp = await apiClient.get<typeof wompiPayments>(`/api/v1/payments/order/${orderId}`);
      setWompiPayments(resp.data);
    } catch {
      // Silently fail — Wompi payments are supplementary info
    }
  };

  const loadOrderChanges = async (schoolId?: string) => {
    try {
      if (!orderId) return;
      const effectiveSchoolId = schoolId || order?.school_id || getEffectiveSchoolId();
      if (!effectiveSchoolId) return;
      const changesData = await orderChangeService.getOrderChanges(effectiveSchoolId, orderId);
      setOrderChanges(changesData);
    } catch (err: any) {
      console.error('Error loading order changes:', err);
      // Don't set error state - changes are optional
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Sin fecha';
    return formatDateSpanish(dateString);
  };

  const getStatusConfig = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-5 h-5" /> };
      case 'in_production':
        return { label: 'En Producción', color: 'bg-blue-100 text-blue-800', icon: <Package className="w-5 h-5" /> };
      case 'ready':
        return { label: 'Listo para Entregar', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-5 h-5" /> };
      case 'delivered':
        return { label: 'Entregado', color: 'bg-gray-100 text-gray-800', icon: <Truck className="w-5 h-5" /> };
      case 'cancelled':
        return { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: <XCircle className="w-5 h-5" /> };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800', icon: null };
    }
  };

  const getNextStatus = (currentStatus: OrderStatus): OrderStatus | null => {
    switch (currentStatus) {
      case 'pending': return 'in_production';
      case 'in_production': return 'ready';
      case 'ready': return 'delivered';
      default: return null;
    }
  };

  const getNextStatusLabel = (currentStatus: OrderStatus): string => {
    switch (currentStatus) {
      case 'pending': return 'Iniciar Producción';
      case 'in_production': return 'Marcar como Listo';
      case 'ready': return 'Marcar como Entregado';
      default: return '';
    }
  };

  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    if (!order) return;

    try {
      setProcessingStatus(true);
      await orderService.updateStatus(getEffectiveSchoolId(), order.id, newStatus);
      await loadOrder();
    } catch (err: any) {
      console.error('Error updating status:', err);
      setError(err.response?.data?.detail || 'Error al actualizar el estado');
    } finally {
      setProcessingStatus(false);
    }
  };

  const handleAddPayment = async () => {
    if (!order || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Ingresa un monto válido');
      return;
    }

    // Build payment data
    const paymentData: { amount: number; payment_method: string; amount_received?: number } = {
      amount,
      payment_method: paymentMethod,
    };

    // Include amount_received for cash payments
    if (paymentMethod === 'cash' && paymentAmountReceived) {
      const amtReceived = parseFloat(paymentAmountReceived);
      if (!isNaN(amtReceived) && amtReceived > 0) {
        paymentData.amount_received = amtReceived;
      }
    }

    try {
      setPaymentLoading(true);
      await orderService.addPayment(getEffectiveSchoolId(), order.id, paymentData);
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentMethod('cash');
      setPaymentAmountReceived('');
      await loadOrder();
    } catch (err: any) {
      console.error('Error adding payment:', err);
      setError(err.response?.data?.detail || 'Error al registrar el pago');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleEditDeliveryDate = () => {
    setNewDeliveryDate(order?.delivery_date || '');
    setEditingDeliveryDate(true);
  };

  const handleSaveDeliveryDate = async () => {
    if (!order) return;

    try {
      setSavingDeliveryDate(true);
      await orderService.updateOrder(getEffectiveSchoolId(), order.id, {
        delivery_date: newDeliveryDate || undefined,
      });
      setEditingDeliveryDate(false);
      await loadOrder();
    } catch (err: any) {
      console.error('Error updating delivery date:', err);
      setError(err.response?.data?.detail || 'Error al actualizar la fecha de entrega');
    } finally {
      setSavingDeliveryDate(false);
    }
  };

  const handleCancelEditDeliveryDate = () => {
    setEditingDeliveryDate(false);
    setNewDeliveryDate('');
  };

  // Handle item status change
  const handleItemStatusChange = async (itemId: string, newStatus: OrderItemStatus) => {
    if (!order) return;

    try {
      setUpdatingItemStatus(itemId);
      await orderService.updateItemStatus(getEffectiveSchoolId(), order.id, itemId, newStatus);
      // Reload order to get updated item statuses and potentially updated order status
      await loadOrder();
    } catch (err: any) {
      console.error('Error updating item status:', err);
      setError(err.response?.data?.detail || 'Error al actualizar el estado del item');
    } finally {
      setUpdatingItemStatus(null);
    }
  };

  // Check if item status can be changed
  const canChangeItemStatus = (itemStatus: OrderItemStatus): boolean => {
    return !['delivered', 'cancelled'].includes(itemStatus);
  };

  // Handle sending receipt email
  const handleSendEmail = async () => {
    if (!order) return;

    try {
      setSendingEmail(true);
      setEmailSuccess(null);
      setError(null);

      const result = await orderService.sendReceiptEmail(getEffectiveSchoolId(), order.id);

      if (result.success) {
        setEmailSuccess(result.message || 'Correo enviado exitosamente');
        // Clear success message after 5 seconds
        setTimeout(() => setEmailSuccess(null), 5000);
      } else {
        setError(result.message || 'Error al enviar el correo');
      }
    } catch (err: any) {
      console.error('Error sending email:', err);
      setError(err.response?.data?.detail || 'Error al enviar el correo');
    } finally {
      setSendingEmail(false);
    }
  };

  // Handle thermal printing
  const handlePrintThermal = async () => {
    if (!order || printingThermal) return;

    if (!printerStatus.isConfigured) {
      alert('Configura la impresora térmica en Configuración');
      return;
    }

    setPrintingThermal(true);
    try {
      await thermalPrinterService.printOrderReceipt(order.school_id, order.id, currentSchool?.name);
    } catch (err: any) {
      console.error('Error printing thermal:', err);
      alert(err.message || 'Error al imprimir');
    } finally {
      setPrintingThermal(false);
    }
  };

  // Check if client has email
  const clientHasEmail = order?.client_email || false;

  // Handle opening client detail modal
  const handleOpenClientDetail = async () => {
    if (!order) return;

    setLoadingClient(true);
    try {
      const client = await clientService.getClient(getEffectiveSchoolId(), order.client_id);
      setClientDetail(client);
      setIsClientDetailModalOpen(true);
    } catch (err: any) {
      console.error('Error loading client:', err);
      setError('Error al cargar información del cliente');
    } finally {
      setLoadingClient(false);
    }
  };

  // Handle order cancellation
  const handleCancelOrder = async (reason: string) => {
    if (!order) return;

    setCancelling(true);
    try {
      await orderService.cancelOrder(getEffectiveSchoolId(), order.id, reason);
      alert('Encargo cancelado exitosamente');
      setShowCancelModal(false);
      loadOrder(); // Reload to show updated status
    } catch (err: any) {
      console.error('Error cancelling order:', err);
      throw err; // Re-throw to let the modal handle the error
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Cargando encargo...</span>
        </div>
      </Layout>
    );
  }

  if (error || !order) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error al cargar el encargo</h3>
              <p className="mt-1 text-sm text-red-700">{error || 'Encargo no encontrado'}</p>
              <button
                onClick={() => navigate('/orders')}
                className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
              >
                Volver a encargos
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const statusConfig = getStatusConfig(order.status);
  const nextStatus = getNextStatus(order.status);
  const hasBalance = order.balance > 0;

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center text-gray-600 hover:text-gray-800 mb-4 transition"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Volver a encargos
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Encargo {order.code}</h1>
            <p className="text-gray-600 mt-1">Creado el {formatDate(order.created_at)}</p>
          </div>
          <div className="flex gap-3">
            {/* PDF Download Button */}
            <button
              onClick={() => setIsReceiptModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition"
            >
              <Printer className="w-5 h-5 mr-2" />
              Descargar PDF
            </button>
            {/* Thermal Printer Button */}
            {printerStatus.isTauriAvailable && (
              <button
                onClick={handlePrintThermal}
                disabled={printingThermal}
                className={`px-4 py-2 rounded-lg flex items-center transition ${
                  printerStatus.isConfigured
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                } disabled:opacity-50`}
                title={printerStatus.isConfigured ? 'Imprimir en impresora termica' : 'Configurar impresora'}
              >
                {printingThermal ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Printer className="w-5 h-5 mr-2" />
                )}
                {printingThermal ? 'Imprimiendo...' : 'Imprimir'}
              </button>
            )}

            {/* Send Email Button - only show if client has email */}
            {clientHasEmail && (
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg flex items-center transition disabled:opacity-50"
                title={`Enviar a ${order.client_email}`}
              >
                {sendingEmail ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-5 h-5 mr-2" />
                )}
                {sendingEmail ? 'Enviando...' : 'Enviar Email'}
              </button>
            )}

            {/* WhatsApp Button - only show if client has phone */}
            {order.client_phone && (
              <button
                onClick={() => openWhatsApp(order.client_phone!, `Hola ${order.client_name}, me comunico de Uniformes Consuelo respecto a su encargo ${order.code}.`)}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center transition"
                title={`WhatsApp a ${order.client_phone}`}
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                WhatsApp
              </button>
            )}

            {nextStatus && order.status !== 'cancelled' && (
              <button
                onClick={() => handleUpdateStatus(nextStatus)}
                disabled={processingStatus}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition disabled:opacity-50"
              >
                {processingStatus ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5 mr-2" />
                )}
                {getNextStatusLabel(order.status)}
              </button>
            )}
            {hasBalance && order.status !== 'cancelled' && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center transition"
              >
                <DollarSign className="w-5 h-5 mr-2" />
                Registrar Pago
              </button>
            )}
            {/* Change/Return button - only show if not cancelled */}
            {order.status !== 'cancelled' && (
              <button
                onClick={() => setShowChangeModal(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center transition"
                title="Registrar cambio o devolucion"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Cambio/Devolucion
              </button>
            )}
            {/* Cancel button - only show if not already cancelled or delivered */}
            {order.status !== 'cancelled' && order.status !== 'delivered' && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center transition"
                title="Cancelar este encargo"
              >
                <Ban className="w-5 h-5 mr-2" />
                Cancelar Encargo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Success Alert (for email sent) */}
      {emailSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start">
          <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">{emailSuccess}</p>
        </div>
      )}

      {/* Sale Change Origin Banner */}
      {(() => {
        const saleChangeMatch = order.notes?.match(/cambio de venta (VNT-\d{4}-\d+)/i);
        const saleIdMatch = order.notes?.match(/\[sale_id:([a-f0-9-]+)\]/i);
        const sourceSaleCode = saleChangeMatch?.[1];
        const sourceSaleId = saleIdMatch?.[1];
        if (!sourceSaleCode) return null;
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start">
            <Package className="w-5 h-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Este encargo fue creado automáticamente por un cambio/devolución
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Venta origen:{' '}
                <button
                  onClick={() => navigate(sourceSaleId ? `/sales/${sourceSaleId}` : `/sales`)}
                  className="font-semibold underline hover:text-amber-900"
                >
                  {sourceSaleCode}
                </button>
              </p>
            </div>
          </div>
        );
      })()}

      {/* Order Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Estado</h2>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusConfig.color}`}>
            {statusConfig.icon}
            <span className="font-semibold">{statusConfig.label}</span>
          </div>

          {/* Delivery Date - Editable */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-gray-600">
                <Calendar className="w-5 h-5 mr-2 text-gray-400" />
                <span className="text-sm font-medium">Fecha de Entrega:</span>
              </div>
              {!editingDeliveryDate && order.status !== 'cancelled' && order.status !== 'delivered' && (
                <button
                  onClick={handleEditDeliveryDate}
                  className="text-blue-600 hover:text-blue-700 p-1 rounded transition"
                  title="Editar fecha de entrega"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {editingDeliveryDate ? (
              <div className="mt-2 flex items-center gap-2">
                <DatePicker
                  value={newDeliveryDate}
                  onChange={(value) => setNewDeliveryDate(value)}
                  className="flex-1"
                />
                <button
                  onClick={handleSaveDeliveryDate}
                  disabled={savingDeliveryDate}
                  className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  title="Guardar"
                >
                  {savingDeliveryDate ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={handleCancelEditDeliveryDate}
                  disabled={savingDeliveryDate}
                  className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition"
                  title="Cancelar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p className="mt-1 text-gray-900 font-medium">
                {order.delivery_date ? formatDate(order.delivery_date) : 'Sin fecha asignada'}
              </p>
            )}
          </div>
        </div>

        {/* Client Card */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Cliente</h2>
          <div className="flex items-center mb-3">
            <Building2 className="w-5 h-5 mr-2 text-gray-400" />
            <span className="font-medium text-gray-900">{order.school_name || currentSchool?.name || '-'}</span>
          </div>
          <div className="flex items-center">
            <User className="w-5 h-5 mr-2 text-gray-400" />
            <button
              onClick={handleOpenClientDetail}
              disabled={loadingClient}
              className="font-medium text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50"
            >
              {loadingClient ? 'Cargando...' : order.client_name}
            </button>
          </div>
          {order.student_name && (
            <p className="text-sm text-gray-600 mt-2 ml-7">Estudiante: {order.student_name}</p>
          )}
          {order.client_phone && (
            <p className="text-sm text-gray-600 mt-1 ml-7">Tel: {order.client_phone}</p>
          )}
        </div>

        {/* Payment Card */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Pagos</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total:</span>
              <span className="font-bold text-gray-900">{formatCurrency(order.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pagado:</span>
              <span className="font-medium text-green-600">{formatCurrency(order.paid_amount)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-gray-600">Saldo:</span>
              <span className={`font-bold ${hasBalance ? 'text-red-600' : 'text-green-600'}`}>
                {hasBalance ? formatCurrency(order.balance) : 'Pagado'}
              </span>
            </div>
          </div>

          {/* Wompi Payment Transactions */}
          {wompiPayments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" />
                Pagos en linea (Wompi)
              </h3>
              <div className="space-y-2">
                {wompiPayments.map((p) => {
                  const amount = p.amount_in_cents / 100;
                  const isApproved = p.status === 'APPROVED';
                  const isPending = p.status === 'PENDING';
                  const feeCop = p.wompi_fee_cents ? p.wompi_fee_cents / 100 : null;
                  const feeTaxCop = p.wompi_fee_tax_cents ? p.wompi_fee_tax_cents / 100 : null;
                  const totalFee = feeCop && feeTaxCop ? feeCop + feeTaxCop : null;
                  return (
                    <div
                      key={p.id}
                      className={`text-sm rounded-lg p-3 ${
                        isApproved ? 'bg-green-50 border border-green-200' :
                        isPending ? 'bg-amber-50 border border-amber-200' :
                        'bg-red-50 border border-red-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          {isApproved ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : isPending ? (
                            <Clock className="w-4 h-4 text-amber-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600" />
                          )}
                          <span className={`font-medium ${
                            isApproved ? 'text-green-800' :
                            isPending ? 'text-amber-800' :
                            'text-red-800'
                          }`}>
                            {formatCurrency(amount)}
                          </span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isApproved ? 'bg-green-200 text-green-800' :
                          isPending ? 'bg-amber-200 text-amber-800' :
                          'bg-red-200 text-red-800'
                        }`}>
                          {isApproved ? 'Aprobado' : isPending ? 'Pendiente' : p.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                        {p.payment_method_type && (
                          <p>Metodo: {p.payment_method_type}</p>
                        )}
                        <p>Ref: {p.reference}</p>
                        {totalFee && isApproved && (
                          <p className="text-amber-700">
                            Comision Wompi: {formatCurrency(totalFee)}
                            {feeCop && feeTaxCop && (
                              <span className="text-gray-400 ml-1">
                                ({formatCurrency(feeCop)} + IVA {formatCurrency(feeTaxCop)})
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center">
            <Package className="w-5 h-5 mr-2" />
            Items del Encargo
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Talla / Color
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cantidad
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Precio Unit.
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {order.items.map((item) => {
                // Check if item has custom measurements (Yomber)
                const hasValidMeasurements = item.custom_measurements &&
                  typeof item.custom_measurements === 'object' &&
                  Object.keys(item.custom_measurements).length > 0;
                const isYomber = item.has_custom_measurements || hasValidMeasurements;
                const isExpanded = expandedMeasurements.has(item.id);

                return (
                  <Fragment key={item.id}>
                    <tr className={isYomber ? 'bg-purple-50' : ''}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex items-center">
                          {item.garment_type_name}
                          {item.embroidery_text && (
                            <span className="ml-2 text-xs text-gray-500">
                              (Bordado: {item.embroidery_text})
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <p className="text-xs text-gray-500 mt-1">{item.notes}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isYomber ? (
                          hasValidMeasurements ? (
                            <button
                              onClick={() => toggleMeasurements(item.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition"
                            >
                              <Ruler className="w-3 h-3" />
                              Yomber
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-50 text-purple-600 rounded-full">
                              <Ruler className="w-3 h-3" />
                              Yomber (sin medidas)
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-gray-400">Estándar</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.size || '-'} / {item.color || '-'}
                        {item.gender && <span className="ml-1">({item.gender})</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {updatingItemStatus === item.id ? (
                          <div className="flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          </div>
                        ) : canChangeItemStatus(item.item_status) && order.status !== 'cancelled' ? (
                          <select
                            value={item.item_status}
                            onChange={(e) => handleItemStatusChange(item.id, e.target.value as OrderItemStatus)}
                            className={`text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer ${ITEM_STATUS_CONFIG[item.item_status].bgColor} ${ITEM_STATUS_CONFIG[item.item_status].color}`}
                          >
                            <option value="pending">🟡 Pendiente</option>
                            <option value="in_production">🔵 En Producción</option>
                            <option value="ready">🟢 Listo</option>
                            <option value="delivered">✅ Entregado</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${ITEM_STATUS_CONFIG[item.item_status].bgColor} ${ITEM_STATUS_CONFIG[item.item_status].color}`}>
                            {ITEM_STATUS_CONFIG[item.item_status].icon} {ITEM_STATUS_CONFIG[item.item_status].label}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>

                    {/* Expanded measurements row for Yomber items */}
                    {hasValidMeasurements && isExpanded && (
                      <tr className="bg-purple-100">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="flex items-start gap-2">
                            <Ruler className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-purple-800 mb-3">
                                Medidas Personalizadas (Yomber)
                              </h4>
                              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                                {Object.entries(item.custom_measurements!).map(([key, value]) => (
                                  <div
                                    key={key}
                                    className="bg-white rounded-lg px-3 py-2 shadow-sm border border-purple-200"
                                  >
                                    <span className="text-xs text-purple-600 block font-medium">
                                      {measurementLabels[key] || key}
                                    </span>
                                    <span className="text-lg font-bold text-purple-800">
                                      {value} <span className="text-xs font-normal text-purple-500">cm</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="bg-gray-50 px-6 py-4">
          <div className="max-w-xs ml-auto space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="text-gray-900">{formatCurrency(order.subtotal)}</span>
            </div>
            {order.tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">IVA:</span>
                <span className="text-gray-900">{formatCurrency(order.tax)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold pt-2 border-t">
              <span className="text-gray-900">Total:</span>
              <span className="text-blue-600">{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Yomber Items Summary - Detailed measurements view */}
      {order.items.some(item =>
        item.custom_measurements &&
        typeof item.custom_measurements === 'object' &&
        Object.keys(item.custom_measurements).length > 0
      ) && (
        <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 bg-purple-100 border-b border-purple-200">
            <h2 className="text-lg font-semibold text-purple-800 flex items-center">
              <Ruler className="w-5 h-5 mr-2" />
              Resumen de Yombers - Medidas Personalizadas
            </h2>
            <p className="text-sm text-purple-600 mt-1">
              Detalle de medidas para confección de prendas sobre-medida
            </p>
          </div>

          <div className="p-4 space-y-4">
            {order.items.filter(item =>
              item.custom_measurements &&
              typeof item.custom_measurements === 'object' &&
              Object.keys(item.custom_measurements).length > 0
            ).map((item) => (
              <div key={item.id} className="bg-white rounded-lg p-4 border border-purple-200">
                {/* Item Header */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-purple-100">
                  <div>
                    <h3 className="font-semibold text-purple-800">{item.garment_type_name}</h3>
                    <p className="text-sm text-purple-600">
                      {item.size && `Talla: ${item.size}`}
                      {item.color && ` | Color: ${item.color}`}
                      {item.gender && ` | ${item.gender === 'male' ? 'Hombre' : item.gender === 'female' ? 'Mujer' : 'Unisex'}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-gray-500">Cantidad:</span>
                    <span className="ml-1 font-bold text-purple-800">{item.quantity}</span>
                  </div>
                </div>

                {/* Measurements Grid - 4 obligatorias primero */}
                <div className="space-y-3">
                  {/* Required measurements (highlighted) */}
                  <div>
                    <p className="text-xs text-purple-500 uppercase font-medium mb-2">Medidas Principales</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {['delantero', 'trasero', 'cintura', 'largo'].map(key => {
                        const value = item.custom_measurements![key];
                        if (value === undefined) return null;
                        return (
                          <div key={key} className="bg-purple-100 rounded-lg px-3 py-2 text-center">
                            <span className="text-xs text-purple-600 block font-medium">
                              {measurementLabels[key]}
                            </span>
                            <span className="text-xl font-bold text-purple-800">
                              {value}
                            </span>
                            <span className="text-xs text-purple-500 ml-1">cm</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional measurements */}
                  {Object.entries(item.custom_measurements!).filter(([key]) =>
                    !['delantero', 'trasero', 'cintura', 'largo'].includes(key)
                  ).length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-2">Medidas Adicionales</p>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {Object.entries(item.custom_measurements!)
                          .filter(([key]) => !['delantero', 'trasero', 'cintura', 'largo'].includes(key))
                          .map(([key, value]) => (
                            <div key={key} className="bg-gray-100 rounded-lg px-2 py-1.5 text-center">
                              <span className="text-xs text-gray-500 block">
                                {measurementLabels[key] || key}
                              </span>
                              <span className="text-sm font-bold text-gray-800">
                                {value} <span className="text-xs font-normal">cm</span>
                              </span>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes for this item */}
                {item.notes && (
                  <div className="mt-3 pt-2 border-t border-purple-100">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Notas:</span> {item.notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Notas</h2>
          <p className="text-gray-600">{order.notes}</p>
        </div>
      )}

      {/* Order Changes History */}
      <div className="mt-6 bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center">
            <RefreshCw className="w-5 h-5 mr-2" />
            Historial de Cambios y Devoluciones
          </h2>
        </div>

        {orderChanges.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No hay cambios registrados
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cant. Devuelta
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cant. Nueva
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ajuste Precio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Motivo
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orderChanges.map((change) => (
                  <tr key={change.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(change.change_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        change.change_type === 'return' ? 'bg-red-100 text-red-800' :
                        change.change_type === 'size_change' ? 'bg-blue-100 text-blue-800' :
                        change.change_type === 'product_change' ? 'bg-purple-100 text-purple-800' :
                        change.change_type === 'defect' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {change.change_type === 'size_change' ? 'Cambio de Talla' :
                         change.change_type === 'product_change' ? 'Cambio de Producto' :
                         change.change_type === 'return' ? 'Devolucion' :
                         change.change_type === 'defect' ? 'Producto Defectuoso' :
                         change.change_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {change.returned_quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {change.new_quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className={change.price_adjustment >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(change.price_adjustment)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-full ${
                        change.status === 'approved' ? 'bg-green-100 text-green-800' :
                        change.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        change.status === 'pending_stock' ? 'bg-amber-100 text-amber-800' :
                        change.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {change.status === 'approved' && <CheckCircle className="w-3 h-3" />}
                        {change.status === 'pending' && <Clock className="w-3 h-3" />}
                        {change.status === 'pending_stock' && <Package className="w-3 h-3" />}
                        {change.status === 'rejected' && <XCircle className="w-3 h-3" />}
                        {change.status === 'approved' ? 'Aprobado' :
                         change.status === 'pending' ? 'Pendiente' :
                         change.status === 'pending_stock' ? 'Esperando Stock' :
                         change.status === 'rejected' ? 'Rechazado' :
                         change.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {change.reason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowPaymentModal(false)} />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Registrar Pago</h2>

              <div className="space-y-4">
                {/* Quick pay full balance button */}
                {order.balance > 0 && (
                  <button
                    onClick={() => setPaymentAmount(String(order.balance))}
                    className="w-full px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition font-medium"
                  >
                    Pagar saldo completo: {formatCurrency(order.balance)}
                  </button>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto
                  </label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder={`Saldo: ${formatCurrency(order.balance)}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Método de Pago
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => {
                      setPaymentMethod(e.target.value);
                      if (e.target.value !== 'cash') setPaymentAmountReceived('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                  </select>
                </div>

                {/* Cash change tracking - Only for cash payments */}
                {paymentMethod === 'cash' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-amber-800 mb-1">
                          Monto Recibido del Cliente
                        </label>
                        <input
                          type="number"
                          value={paymentAmountReceived}
                          onChange={(e) => setPaymentAmountReceived(e.target.value)}
                          placeholder={paymentAmount ? `Min: $${parseFloat(paymentAmount).toLocaleString()}` : 'Opcional'}
                          className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none bg-white"
                        />
                      </div>

                      {/* Show calculated change */}
                      {paymentAmountReceived && paymentAmount && parseFloat(paymentAmountReceived) >= parseFloat(paymentAmount) && (
                        <div className="text-right min-w-[100px]">
                          <span className="text-xs text-amber-700">Devueltas:</span>
                          <p className="text-xl font-bold text-amber-800">
                            ${(parseFloat(paymentAmountReceived) - parseFloat(paymentAmount)).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Error: insufficient amount */}
                    {paymentAmountReceived && paymentAmount && parseFloat(paymentAmountReceived) < parseFloat(paymentAmount) && (
                      <p className="text-xs text-red-600 mt-2">
                        Monto insuficiente. Minimo: ${parseFloat(paymentAmount).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  disabled={paymentLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddPayment}
                  disabled={paymentLoading || !paymentAmount}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center"
                >
                  {paymentLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Registrar Pago'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        type="order"
        order={order}
        schoolName={currentSchool?.name}
      />

      {/* Client Detail Modal */}
      {clientDetail && (
        <ClientDetailModal
          isOpen={isClientDetailModalOpen}
          onClose={() => setIsClientDetailModalOpen(false)}
          client={clientDetail}
        />
      )}

      {/* Order Change Modal */}
      <OrderChangeModal
        isOpen={showChangeModal}
        onClose={() => setShowChangeModal(false)}
        onSuccess={() => {
          loadOrderChanges();
          loadOrder();
        }}
        schoolId={getEffectiveSchoolId()}
        orderId={orderId!}
        orderItems={order.items}
      />

      {/* Cancel Confirm Modal */}
      <CancelConfirmModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelOrder}
        title="Cancelar Encargo"
        entityCode={order.code}
        warnings={[
          `Se liberará el stock reservado de ${order.items.length} item(s)`,
          order.paid_amount > 0 ? `Se revertirán anticipos por $${Number(order.paid_amount).toLocaleString()}` : '',
          hasBalance ? `Se cancelarán cuentas por cobrar por $${Number(order.balance).toLocaleString()}` : '',
        ].filter(Boolean)}
        loading={cancelling}
      />

    </Layout>
  );
}
