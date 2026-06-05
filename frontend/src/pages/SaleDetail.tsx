/**
 * Sale Detail Page - View complete sale information
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import SaleChangeModal from '../components/SaleChangeModal';
import SaleChangeDetailModal from '../components/SaleChangeDetailModal';
import AddPaymentModal from '../components/AddPaymentModal';
import ReceiptModal from '../components/ReceiptModal';
import PrinterSettingsModal from '../components/PrinterSettingsModal';
import ClientDetailModal from '../components/ClientDetailModal';
import CancelConfirmModal from '../components/CancelConfirmModal';
import { RequirePermission } from '../components/RequirePermission';
import { ElectronicInvoiceButton } from '../components/ElectronicInvoiceButton';
import ClientSelector, { NO_CLIENT_ID } from '../components/ClientSelector';
import { ArrowLeft, Calendar, User, CreditCard, Package, Printer, AlertCircle, Loader2, RefreshCw, CheckCircle, XCircle, Clock, History, DollarSign, Banknote, Mail, Building2, MessageCircle, Ban, Pencil, X, Save, Eye, ArrowRight } from 'lucide-react';
import { formatDateTimeSpanish } from '../components/DatePicker';
import { saleService } from '../services/saleService';
import { saleChangeService } from '../services/saleChangeService';
import { clientService } from '../services/clientService';
import { productService } from '../services/productService';
import thermalPrinterService from '../services/thermalPrinterService';
import { usePrinterStore, usePrinterStatus } from '../stores/printerStore';
import type { SaleItemWithProduct, Client, Product, SaleChangeListItem, SaleWithItems } from '../types/api';
import { useSchoolStore } from '../stores/schoolStore';
import { openWhatsApp } from '../utils/whatsapp';


export default function SaleDetail() {
  const { saleId } = useParams<{ saleId: string }>();
  const navigate = useNavigate();
  const { currentSchool } = useSchoolStore();
  const printerStatus = usePrinterStatus();
  const isPrinterModalOpen = usePrinterStore((state) => state.isModalOpen);
  const openPrinterModal = usePrinterStore((state) => state.openModal);
  const closePrinterModal = usePrinterStore((state) => state.closeModal);
  const [sale, setSale] = useState<SaleWithItems | null>(null);
  const [items, setItems] = useState<SaleItemWithProduct[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [changes, setChanges] = useState<SaleChangeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isClientDetailModalOpen, setIsClientDetailModalOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [printingThermal, setPrintingThermal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Change detail modal state
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [selectedChange, setSelectedChange] = useState<SaleChangeListItem | undefined>(undefined);
  const [isChangeDetailModalOpen, setIsChangeDetailModalOpen] = useState(false);

  // Client editing state
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [savingClient, setSavingClient] = useState(false);

  // Calculate pending balance
  const pendingBalance = sale ? Number(sale.total) - Number(sale.paid_amount || 0) : 0;

  // Show add payment button if:
  // 1. There's pending balance (partial payments)
  // 2. OR no payment method is set AND no payments recorded (sale created without payment)
  const showAddPaymentButton = sale && (
    pendingBalance > 0 ||
    (!sale.payment_method && (!sale.payments || sale.payments.length === 0))
  );

  const schoolId = currentSchool?.id || '';

  useEffect(() => {
    if (saleId) {
      loadSaleDetail();
    }
  }, [saleId]);

  const loadSaleDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!saleId) {
        setError('ID de venta no válido');
        return;
      }

      // Load sale with items (using global endpoint that doesn't require school_id)
      const saleData = await saleService.getSaleDetails(saleId);
      setSale(saleData);
      setItems(saleData.items || []);

      // Get the school_id from the sale itself
      const saleSchoolId = saleData.school_id;

      // Load client info
      if (saleData.client_id && saleSchoolId) {
        const clientData = await clientService.getClient(saleSchoolId, saleData.client_id);
        setClient(clientData);
      }

      // Load all products info
      if (saleData.items && saleData.items.length > 0 && saleSchoolId) {
        const allProducts = await productService.getProducts(saleSchoolId);
        const productsMap = new Map<string, Product>();
        allProducts.forEach(p => productsMap.set(p.id, p));
        setProducts(productsMap);
      }

      // Load sale changes (pass the school_id from the sale)
      await loadChanges(saleSchoolId);
    } catch (err: any) {
      console.error('Error loading sale detail:', err);
      setError(err.response?.data?.detail || 'Error al cargar los detalles de la venta');
    } finally {
      setLoading(false);
    }
  };

  const loadChanges = async (saleSchoolId?: string) => {
    try {
      if (!saleId) return;
      const effectiveSchoolId = saleSchoolId || sale?.school_id || schoolId;
      if (!effectiveSchoolId) return;
      const changesData = await saleChangeService.getSaleChanges(effectiveSchoolId, saleId);
      setChanges(changesData);
    } catch (err: any) {
      console.error('Error loading changes:', err);
      // Don't set error state, just log it - changes are optional
    }
  };

  const formatDate = (dateString: string) => {
    return formatDateTimeSpanish(dateString);
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
      case 'pending':
        return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 ring-1 ring-red-200';
      default:
        return 'bg-stone-100 text-stone-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completada';
      case 'pending':
        return 'Pendiente';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  };

  const getPaymentMethodText = (method: string | null | undefined) => {
    if (!method) return 'No especificado';
    // Normalize to lowercase to handle any case variations
    const normalizedMethod = method.toLowerCase();
    switch (normalizedMethod) {
      case 'cash':
        return 'Efectivo';
      case 'nequi':
        return 'Nequi';
      case 'card':
        return 'Tarjeta';
      case 'transfer':
        return 'Transferencia';
      case 'credit':
        return 'Crédito';
      default:
        return method;
    }
  };

  const getProductNameFromItem = (item: SaleItemWithProduct) => {
    if (item.product_name) {
      return `${item.product_name} - ${item.product_size || ''}`;
    }
    if (item.product_id) {
      const product = products.get(item.product_id);
      if (product) return `${product.name || product.code} - ${product.size}`;
    }
    return 'Producto no encontrado';
  };

  const getProductCodeFromItem = (item: SaleItemWithProduct) => {
    if (item.product_code) {
      return item.product_code;
    }
    if (item.product_id) {
      const product = products.get(item.product_id);
      if (product) return product.code;
      return item.product_id;
    }
    return 'N/A';
  };

  const getChangeTypeLabel = (type: string) => {
    switch (type) {
      case 'size_change': return 'Cambio de Talla';
      case 'product_change': return 'Cambio de Producto';
      case 'return': return 'Devolución';
      case 'defect': return 'Producto Defectuoso';
      default: return type;
    }
  };

  const getChangeStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
      case 'pending': return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
      case 'pending_stock': return 'bg-amber-100 text-amber-800';
      case 'rejected': return 'bg-red-50 text-red-700 ring-1 ring-red-200';
      default: return 'bg-stone-100 text-stone-800';
    }
  };

  const getChangeStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'pending_stock': return <Package className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getChangeStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'Aprobado';
      case 'pending': return 'Pendiente';
      case 'pending_stock': return 'Esperando Stock';
      case 'rejected': return 'Rechazado';
      default: return status;
    }
  };

  const handleChangeSuccess = () => {
    loadChanges();
  };

  const handlePrint = () => {
    setIsReceiptModalOpen(true);
  };

  const handlePrintThermal = async () => {
    if (!sale || printingThermal) return;

    if (!printerStatus.isConfigured) {
      openPrinterModal();
      return;
    }

    setPrintingThermal(true);
    try {
      await thermalPrinterService.printSaleReceipt(sale.school_id, sale.id);
      // Optional: show success toast
    } catch (err: any) {
      console.error('Error printing thermal:', err);
      alert(err.message || 'Error al imprimir');
    } finally {
      setPrintingThermal(false);
    }
  };

  const handleSendEmail = async () => {
    if (!sale || !client?.email || sendingEmail) return;

    setSendingEmail(true);
    try {
      const result = await saleService.sendReceiptEmail(schoolId, sale.id);
      alert(result.message);
    } catch (err: any) {
      console.error('Error sending email:', err);
      alert(err.response?.data?.detail || 'Error al enviar el email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCancelSale = async (reason: string) => {
    if (!sale || !saleId) return;

    setCancelling(true);
    try {
      await saleService.cancelSale(sale.school_id, saleId, { reason });
      alert('Venta cancelada exitosamente');
      setShowCancelModal(false);
      loadSaleDetail(); // Reload to show updated status
    } catch (err: any) {
      console.error('Error cancelling sale:', err);
      throw err; // Re-throw to let the modal handle the error
    } finally {
      setCancelling(false);
    }
  };

  const handleStartEditClient = () => {
    setSelectedClientId(sale?.client_id || '');
    setIsEditingClient(true);
  };

  const handleCancelEditClient = () => {
    setIsEditingClient(false);
    setSelectedClientId('');
  };

  const handleSaveClient = async () => {
    if (!sale || !saleId) return;

    setSavingClient(true);
    try {
      // If NO_CLIENT_ID, set to null; otherwise use the selected ID
      const clientIdToSave = selectedClientId === NO_CLIENT_ID ? null : (selectedClientId || null);
      await saleService.updateSale(sale.school_id, saleId, { client_id: clientIdToSave });

      // Reload sale to get updated data
      await loadSaleDetail();
      setIsEditingClient(false);
      setSelectedClientId('');
    } catch (err: any) {
      console.error('Error updating client:', err);
      alert(err.response?.data?.detail || 'Error al actualizar el cliente');
    } finally {
      setSavingClient(false);
    }
  };

  const handleClientChange = (clientId: string, _clientData?: Client) => {
    setSelectedClientId(clientId);
    // If a client is selected (not NO_CLIENT_ID or empty), we can show their info
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <span className="ml-3 text-stone-600">Cargando detalles de la venta...</span>
        </div>
      </Layout>
    );
  }

  if (error || !sale) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error al cargar la venta</h3>
              <p className="mt-1 text-sm text-red-700">{error || 'Venta no encontrada'}</p>
              <button
                onClick={() => navigate('/sales')}
                className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
              >
                Volver a ventas
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <button
          onClick={() => navigate('/sales')}
          className="flex items-center text-stone-600 hover:text-stone-800 mb-4 transition"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Volver a ventas
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-800">Detalle de Venta</h1>
            <p className="text-stone-600 mt-1">{sale.code}</p>
          </div>
          <div className="flex gap-3">
            {/* Add Payment button - show when there's pending balance or no payment recorded */}
            {showAddPaymentButton && (
              <RequirePermission permission="sales.add_payment">
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center transition"
                >
                  <DollarSign className="w-5 h-5 mr-2" />
                  Agregar Pago
                </button>
              </RequirePermission>
            )}
            <RequirePermission permission="changes.create">
              <button
                onClick={() => setIsChangeModalOpen(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center transition"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Cambio/Devolución
              </button>
            </RequirePermission>
            <button
              onClick={handlePrint}
              className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center transition"
            >
              <Printer className="w-5 h-5 mr-2" />
              Descargar PDF
            </button>
            {/* Electronic invoice (Facturacion Electronica DIAN) */}
            <ElectronicInvoiceButton
              documentType="sale"
              documentId={sale.id}
              disabled={sale.status === 'cancelled'}
              disabledReason="No se puede facturar una venta cancelada"
            />
            {/* Thermal Printer Button */}
            {printerStatus.isTauriAvailable && (
              <button
                onClick={handlePrintThermal}
                disabled={printingThermal}
                className={`px-4 py-2 rounded-lg flex items-center transition ${
                  printerStatus.isConfigured
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-stone-200 hover:bg-stone-300 text-stone-700'
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
            {/* Send Email button - only show if client has email */}
            {client?.email && (
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="border border-stone-200 text-stone-700 hover:bg-stone-50 px-4 py-2 rounded-lg flex items-center transition disabled:opacity-50"
                title={`Enviar a ${client.email}`}
              >
                {sendingEmail ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-5 h-5 mr-2" />
                )}
                {sendingEmail ? 'Enviando...' : 'Enviar Email'}
              </button>
            )}
            {/* WhatsApp button - only show if client has phone */}
            {client?.phone && (
              <button
                onClick={() => openWhatsApp(client.phone!, `Hola ${client.name}, me comunico de Uniformes Consuelo respecto a su venta ${sale.code}.`)}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center transition"
                title={`WhatsApp a ${client.phone}`}
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                WhatsApp
              </button>
            )}
            {/* Cancel Sale button - only show if not already cancelled */}
            {sale.status !== 'cancelled' && (
              <RequirePermission permission="sales.cancel">
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center transition"
                  title="Cancelar esta venta"
                >
                  <Ban className="w-5 h-5 mr-2" />
                  Cancelar Venta
                </button>
              </RequirePermission>
            )}
          </div>
        </div>
      </div>

      <div className="printable-wrapper">
      <div id="printable-section">

      {/* Print Header - Only visible when printing */}
      <div className="hidden print:block mb-6 text-center border-b-2 border-stone-200 pb-4">
        <h1 className="text-3xl font-bold text-stone-900">Sistema de Uniformes</h1>
        <p className="text-stone-600 mt-1">Recibo de Venta</p>
        <p className="text-sm text-stone-500 mt-2">Venta #{sale.code}</p>
        <p className="text-sm text-stone-500">{formatDate(sale.sale_date)}</p>
      </div>

      {/* Sale Information */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-4">Información de la Venta</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
          {/* School */}
          <div>
            <div className="flex items-center text-sm text-stone-500 mb-1">
              <Building2 className="w-4 h-4 mr-2" />
              Colegio
            </div>
            <p className="font-medium text-stone-900">{sale.school_name || currentSchool?.name || '-'}</p>
          </div>

          {/* Date */}
          <div>
            <div className="flex items-center text-sm text-stone-500 mb-1">
              <Calendar className="w-4 h-4 mr-2" />
              Fecha
            </div>
            <p className="font-medium text-stone-900">{formatDate(sale.sale_date)}</p>
          </div>

          {/* Client */}
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-sm text-stone-500 mb-1">
              <div className="flex items-center">
                <User className="w-4 h-4 mr-2" />
                Cliente
              </div>
              {!isEditingClient && sale.status !== 'cancelled' && (
                <button
                  onClick={handleStartEditClient}
                  className="text-brand-600 hover:text-brand-700 flex items-center gap-1 text-xs"
                  title={client ? 'Cambiar cliente' : 'Asignar cliente'}
                >
                  <Pencil className="w-3 h-3" />
                  {client ? 'Cambiar' : 'Asignar'}
                </button>
              )}
            </div>

            {isEditingClient ? (
              <div className="space-y-2">
                <ClientSelector
                  value={selectedClientId}
                  onChange={handleClientChange}
                  schoolId={sale.school_id}
                  allowNoClient={true}
                  placeholder="Buscar o seleccionar cliente..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveClient}
                    disabled={savingClient}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50"
                  >
                    {savingClient ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Guardar
                  </button>
                  <button
                    onClick={handleCancelEditClient}
                    disabled={savingClient}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 rounded-lg disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </button>
                </div>
              </div>
            ) : client ? (
              <div>
                <button
                  onClick={() => setIsClientDetailModalOpen(true)}
                  className="font-medium text-brand-600 hover:text-brand-700 hover:underline text-left"
                >
                  {client.name} ({client.code})
                </button>
                {client?.student_name && (
                  <p className="text-sm text-stone-600">Estudiante: {client.student_name}</p>
                )}
              </div>
            ) : sale.client_id ? (
              <p className="font-medium text-stone-900">Cargando...</p>
            ) : (
              <p className="font-medium text-stone-400 italic">Sin cliente asignado</p>
            )}
          </div>

          {/* Seller */}
          <div>
            <div className="text-sm text-stone-500 mb-1">Vendedor</div>
            <p className="font-medium text-stone-900">{sale.user_name || '-'}</p>
          </div>

          {/* Payment Method */}
          <div>
            <div className="flex items-center text-sm text-stone-500 mb-1">
              <CreditCard className="w-4 h-4 mr-2" />
              Método de Pago
            </div>
            {sale.payment_method ? (
              <p className="font-medium text-stone-900">{getPaymentMethodText(sale.payment_method)}</p>
            ) : sale.payments && sale.payments.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {[...new Set(sale.payments.map(p => p.payment_method))].map(method => (
                  <span key={method} className="px-2 py-0.5 text-sm bg-brand-100 text-brand-700 rounded">
                    {getPaymentMethodText(method)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="font-medium text-amber-600">Sin registrar</p>
            )}
          </div>

          {/* Status */}
          <div>
            <div className="text-sm text-stone-500 mb-1">Estado</div>
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${getStatusColor(sale.status)}`}>
                {getStatusText(sale.status)}
              </span>
              {sale.is_historical && (
                <span className="px-3 py-1 inline-flex items-center gap-1 text-sm font-semibold rounded-full bg-amber-100 text-amber-800">
                  <History className="w-4 h-4" />
                  Histórica
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Historical Sale Notice */}
        {sale.is_historical && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-amber-800">
              <History className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Venta Histórica (Migración)</p>
                <p className="text-sm text-amber-700">
                  Esta venta fue registrada como dato histórico y no afectó el inventario actual.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {sale.notes && (
          <div className="mt-6 pt-6 border-t border-stone-200">
            <p className="text-sm text-stone-500 mb-1">Notas</p>
            <p className="text-stone-900">{sale.notes}</p>
          </div>
        )}
      </div>

      {/* Sale Items */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-800 flex items-center">
            <Package className="w-5 h-5 mr-2" />
            Productos
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-100">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Cantidad
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Precio Unitario
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-900">
                    {getProductCodeFromItem(item)}
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-900">
                    {getProductNameFromItem(item)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-900 text-right">
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-900 text-right">
                    ${Number(item.unit_price).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-stone-900 text-right">
                    ${Number(item.subtotal).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="bg-stone-50 px-6 py-4">
          <div className="max-w-xs ml-auto space-y-2">
            <div className="flex justify-between text-xl font-bold">
              <span className="text-stone-900">Total:</span>
              <span className="text-brand-600">${Number(sale.total).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-stone-600">
              <span>Pagado:</span>
              <span className="text-green-600">${Number(sale.paid_amount || 0).toLocaleString()}</span>
            </div>
            {pendingBalance > 0 && (
              <div className="flex justify-between text-sm font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded">
                <span>Saldo pendiente:</span>
                <span>${pendingBalance.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      </div> {/* End printable-section */}
      </div> {/* End printable-wrapper */}

      {/* Payments History */}
      {sale.payments && sale.payments.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mt-6 print-hidden">
          <div className="p-6 border-b border-stone-200">
            <h2 className="text-lg font-semibold text-stone-800 flex items-center">
              <Banknote className="w-5 h-5 mr-2" />
              Historial de Pagos
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-100">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Método
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Notas
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-stone-100">
                {sale.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-900">
                      {formatDate(payment.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-900">
                      {getPaymentMethodText(payment.payment_method)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 text-right">
                      ${Number(payment.amount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-600">
                      {payment.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sale Changes History */}
      {changes.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mt-6 print-hidden">
          <div className="p-6 border-b border-stone-200">
            <h2 className="text-lg font-semibold text-stone-800 flex items-center">
              <RefreshCw className="w-5 h-5 mr-2" />
              Historial de Cambios y Devoluciones
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-100">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Producto Original
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Producto Nuevo
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Cant.
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Ajuste
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-stone-500 uppercase tracking-wider">

                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-stone-100">
                {changes.map((change) => (
                  <tr key={change.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-stone-900">
                      {formatDate(change.change_date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-stone-900">
                      {getChangeTypeLabel(change.change_type)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {change.original_product_code ? (
                        <div>
                          <span className="font-mono text-xs text-stone-600">{change.original_product_code}</span>
                          <p className="text-stone-900 truncate max-w-[150px]" title={change.original_product_name || ''}>
                            {change.original_product_name || '-'}
                          </p>
                          {change.original_product_size && (
                            <span className="text-xs text-stone-500">Talla: {change.original_product_size}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-stone-400 italic">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {change.new_product_code ? (
                        <div className="flex items-start gap-1">
                          <ArrowRight className="w-3 h-3 text-stone-400 mt-1 flex-shrink-0" />
                          <div>
                            <span className="font-mono text-xs text-stone-600">{change.new_product_code}</span>
                            <p className="text-stone-900 truncate max-w-[150px]" title={change.new_product_name || ''}>
                              {change.new_product_name || '-'}
                            </p>
                            {change.new_product_size && (
                              <span className="text-xs text-stone-500">Talla: {change.new_product_size}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-stone-400 italic text-xs">Devolucion</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-stone-900 text-center">
                      <span className="text-red-600">{change.returned_quantity}</span>
                      {change.new_quantity > 0 && (
                        <>
                          <span className="text-stone-400 mx-1">→</span>
                          <span className="text-green-600">{change.new_quantity}</span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      <span className={change.price_adjustment >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {change.price_adjustment >= 0 ? '+' : ''}${Number(change.price_adjustment).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-full ${getChangeStatusColor(change.status)}`}>
                        {getChangeStatusIcon(change.status)}
                        {getChangeStatusLabel(change.status)}
                      </span>
                      {change.order_code && (
                        <button
                          onClick={() => navigate(`/orders/${change.order_id}`)}
                          className="ml-1 text-xs text-brand-600 hover:text-brand-700 underline"
                          title="Ver encargo asociado"
                        >
                          {change.order_code}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <button
                        onClick={() => {
                          setSelectedChangeId(change.id);
                          setSelectedChange(change);
                          setIsChangeDetailModalOpen(true);
                        }}
                        className="p-1.5 text-stone-500 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                        title="Ver detalle completo"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sale Change Modal */}
      <SaleChangeModal
        isOpen={isChangeModalOpen}
        onClose={() => setIsChangeModalOpen(false)}
        onSuccess={handleChangeSuccess}
        schoolId={schoolId}
        saleId={saleId!}
        saleItems={items}
      />

      {/* Sale Change Detail Modal */}
      <SaleChangeDetailModal
        isOpen={isChangeDetailModalOpen}
        onClose={() => {
          setIsChangeDetailModalOpen(false);
          setSelectedChangeId(null);
          setSelectedChange(undefined);
        }}
        changeId={selectedChangeId}
        change={selectedChange}
      />

      {/* Add Payment Modal */}
      <AddPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={loadSaleDetail}
        saleId={saleId!}
        schoolId={schoolId}
        saleCode={sale?.code || ''}
        pendingAmount={pendingBalance > 0 ? pendingBalance : Number(sale?.total || 0)}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        type="sale"
        sale={sale}
        client={client}
        schoolName={currentSchool?.name}
      />

      {/* Printer Settings Modal */}
      <PrinterSettingsModal
        isOpen={isPrinterModalOpen}
        onClose={closePrinterModal}
      />

      {/* Client Detail Modal */}
      {client && (
        <ClientDetailModal
          isOpen={isClientDetailModalOpen}
          onClose={() => setIsClientDetailModalOpen(false)}
          client={client}
        />
      )}

      {/* Cancel Confirm Modal */}
      <CancelConfirmModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelSale}
        title="Cancelar Venta"
        entityCode={sale.code}
        warnings={[
          `Se restaurará el inventario de ${items.length} producto(s)`,
          `Se revertirán las transacciones por $${Number(sale.paid_amount || 0).toLocaleString()}`,
          pendingBalance > 0 ? `Se cancelarán cuentas por cobrar por $${pendingBalance.toLocaleString()}` : '',
        ].filter(Boolean)}
        loading={cancelling}
      />
    </Layout>
  );
}
