/**
 * WebOrders - Page to manage orders from web portal
 * Filters orders with source='web_portal' and user_id=NULL
 * Includes stock verification and smart approval
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Loader2,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Wrench,
  CheckCircle,
  Package,
  Phone,
  Eye,
  DollarSign,
  AlertCircle,
  X,
  MessageCircle,
  ChevronRight,
  PackageCheck,
  PackageX,
  Boxes,
  Sparkles,
  Factory,
  Image as ImageIcon,
  FileText,
  Home,
  Truck
} from 'lucide-react';
import Layout from '../components/Layout';
import { formatDateSpanish } from '../components/DatePicker';
import { useSchoolStore } from '../stores/schoolStore';
import { orderService, OrderStockVerification, OrderItemStockInfo } from '../services/orderService';
import { saleService } from '../services/saleService';
import type { OrderListItem, OrderStatus, OrderWithItems } from '../types/api';
import { Ban } from 'lucide-react';

// Status configuration
const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: typeof Clock; bgColor: string }> = {
  pending: { label: 'Pendiente', color: 'text-yellow-700', icon: Clock, bgColor: 'bg-yellow-100' },
  in_production: { label: 'En Produccion', color: 'text-blue-700', icon: Wrench, bgColor: 'bg-blue-100' },
  ready: { label: 'Listo', color: 'text-green-700', icon: CheckCircle, bgColor: 'bg-green-100' },
  delivered: { label: 'Entregado', color: 'text-gray-700', icon: Package, bgColor: 'bg-gray-100' },
  cancelled: { label: 'Cancelado', color: 'text-red-700', icon: X, bgColor: 'bg-red-100' },
};

export default function WebOrders() {
  const { availableSchools } = useSchoolStore();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'pickup' | 'delivery'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail modal
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [selectedOrderSchoolId, setSelectedOrderSchoolId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Stock verification
  const [stockVerification, setStockVerification] = useState<OrderStockVerification | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [approvingOrder, setApprovingOrder] = useState(false);

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Payment proof modal
  const [showPaymentProofModal, setShowPaymentProofModal] = useState(false);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [processingPaymentProof, setProcessingPaymentProof] = useState(false);

  // Resolve duplicate modal
  const [showResolveDuplicateModal, setShowResolveDuplicateModal] = useState(false);
  const [resolvingSaleCode, setResolvingSaleCode] = useState('');
  const [resolvingDuplicate, setResolvingDuplicate] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    if (availableSchools.length > 0) {
      loadOrders();
    }
  }, [availableSchools]);

  const loadOrders = async () => {
    if (availableSchools.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      // Load orders from ALL available schools (not just current)
      const ordersPromises = availableSchools.map(school =>
        orderService.getAllOrders({ school_id: school.id })
          .then(orders => orders.map(o => ({ ...o, school_name: school.name })))
          .catch(() => [] as OrderListItem[]) // Ignore errors for individual schools
      );

      const allSchoolOrders = await Promise.all(ordersPromises);
      const allOrders = allSchoolOrders.flat();

      // Filter for web portal orders (source = web_portal)
      const webOrders = allOrders
        .filter(o => o.source === 'web_portal')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setOrders(webOrders);
    } catch (err: any) {
      console.error('Error loading web orders:', err);
      setError('Error al cargar pedidos web');
    } finally {
      setLoading(false);
    }
  };

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Status filter
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;

      // Delivery type filter
      if (deliveryFilter !== 'all') {
        const orderDeliveryType = order.delivery_type || 'pickup';
        if (orderDeliveryType !== deliveryFilter) return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesCode = order.code.toLowerCase().includes(query);
        const matchesClient = order.client_name?.toLowerCase().includes(query);
        const matchesStudent = order.student_name?.toLowerCase().includes(query);
        if (!matchesCode && !matchesClient && !matchesStudent) return false;
      }

      return true;
    });
  }, [orders, statusFilter, deliveryFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const webOrders = orders;
    return {
      pending: webOrders.filter(o => o.status === 'pending').length,
      in_production: webOrders.filter(o => o.status === 'in_production').length,
      ready: webOrders.filter(o => o.status === 'ready').length,
      delivered: webOrders.filter(o => o.status === 'delivered').length,
      total: webOrders.length,
      totalPending: webOrders.reduce((sum, o) => sum + (Number(o.balance) || 0), 0),
      // Delivery stats
      deliveryOrders: webOrders.filter(o => o.delivery_type === 'delivery').length,
      pickupOrders: webOrders.filter(o => o.delivery_type !== 'delivery').length,
    };
  }, [orders]);

  const handleViewDetail = async (orderId: string, schoolId: string) => {
    try {
      setLoadingDetail(true);
      setSelectedOrderSchoolId(schoolId);
      setStockVerification(null);

      const order = await orderService.getOrder(schoolId, orderId);
      setSelectedOrder(order);
      setShowDetailModal(true);

      // Load stock verification for pending orders
      if (order.status === 'pending') {
        setLoadingStock(true);
        try {
          const stockInfo = await orderService.verifyOrderStock(schoolId, orderId);
          setStockVerification(stockInfo);
        } catch (err) {
          console.error('Error loading stock verification:', err);
        } finally {
          setLoadingStock(false);
        }
      }
    } catch (err) {
      console.error('Error loading order detail:', err);
      setError('Error al cargar detalle del pedido');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleApproveWithStock = async (autoFulfill: boolean = true) => {
    if (!selectedOrderSchoolId || !selectedOrder) return;

    try {
      setApprovingOrder(true);
      await orderService.approveOrderWithStock(selectedOrderSchoolId, selectedOrder.id, {
        auto_fulfill_if_stock: autoFulfill
      });

      // Reload order detail and list
      const updatedOrder = await orderService.getOrder(selectedOrderSchoolId, selectedOrder.id);
      setSelectedOrder(updatedOrder);
      setStockVerification(null);
      loadOrders();
    } catch (err: any) {
      console.error('Error approving order:', err);
      setError(err.response?.data?.detail || 'Error al aprobar pedido');
    } finally {
      setApprovingOrder(false);
    }
  };

  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    if (!selectedOrderSchoolId || !selectedOrder) return;

    try {
      setUpdatingStatus(true);
      await orderService.updateStatus(selectedOrderSchoolId, selectedOrder.id, newStatus);
      // Reload order detail and list
      const updatedOrder = await orderService.getOrder(selectedOrderSchoolId, selectedOrder.id);
      setSelectedOrder(updatedOrder);
      loadOrders();
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Error al actualizar estado');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddPayment = async () => {
    if (!selectedOrderSchoolId || !selectedOrder || paymentAmount <= 0) return;

    try {
      setProcessingPayment(true);
      await orderService.addPayment(selectedOrderSchoolId, selectedOrder.id, {
        amount: paymentAmount,
        payment_method: paymentMethod,
        payment_reference: paymentRef || undefined,
        notes: paymentNotes || undefined,
      });
      // Reload order detail and list
      const updatedOrder = await orderService.getOrder(selectedOrderSchoolId, selectedOrder.id);
      setSelectedOrder(updatedOrder);
      setShowPaymentModal(false);
      setPaymentAmount(0);
      setPaymentMethod('cash');
      setPaymentRef('');
      setPaymentNotes('');
      loadOrders();
    } catch (err) {
      console.error('Error adding payment:', err);
      setError('Error al registrar pago');
    } finally {
      setProcessingPayment(false);
    }
  };

  const openWhatsApp = (phone: string | null) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  const handleApprovePayment = async () => {
    if (!selectedOrderSchoolId || !selectedOrder) return;

    try {
      setProcessingPaymentProof(true);
      await orderService.approvePayment(selectedOrderSchoolId, selectedOrder.id);

      // Reload order detail
      const updatedOrder = await orderService.getOrder(selectedOrderSchoolId, selectedOrder.id);
      setSelectedOrder(updatedOrder);
      setShowPaymentProofModal(false);

      // CRITICAL: Reload the full orders list to update table
      await loadOrders();
    } catch (err) {
      console.error('Error approving payment:', err);
      setError('Error al aprobar el pago');
    } finally {
      setProcessingPaymentProof(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedOrderSchoolId || !selectedOrder) return;

    const reason = prompt('Motivo del rechazo:');
    if (!reason) return;

    try {
      setProcessingPaymentProof(true);
      await orderService.rejectPayment(selectedOrderSchoolId, selectedOrder.id, reason);

      // Reload order detail
      const updatedOrder = await orderService.getOrder(selectedOrderSchoolId, selectedOrder.id);
      setSelectedOrder(updatedOrder);
      setShowPaymentProofModal(false);

      // CRITICAL: Reload the full orders list to update table
      await loadOrders();
    } catch (err) {
      console.error('Error rejecting payment:', err);
      setError('Error al rechazar el pago');
    } finally {
      setProcessingPaymentProof(false);
    }
  };

  const handleResolveDuplicate = async () => {
    if (!selectedOrder || !selectedOrderSchoolId || !resolvingSaleCode.trim()) return;

    setResolvingDuplicate(true);
    setResolveError(null);
    try {
      const sales = await saleService.getAllSales({ search: resolvingSaleCode.trim(), limit: 5 });
      const sale = sales.find(s => s.code === resolvingSaleCode.trim());
      if (!sale) {
        setResolveError(`No se encontro una venta con codigo "${resolvingSaleCode.trim()}"`);
        return;
      }

      await orderService.resolveDuplicate(selectedOrderSchoolId, selectedOrder.id, sale.id);
      setShowResolveDuplicateModal(false);
      setResolvingSaleCode('');
      setShowDetailModal(false);
      setSelectedOrder(null);
      await loadOrders();
    } catch (err: any) {
      console.error('Error resolving duplicate:', err);
      setResolveError(err?.response?.data?.detail || 'Error al resolver duplicado');
    } finally {
      setResolvingDuplicate(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return formatDateSpanish(dateStr);
  };

  if (availableSchools.length === 0) {
    return (
      <Layout>
        <div className="p-8 text-center">
          <Globe className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No tienes acceso a ningún colegio</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Globe className="w-7 h-7 mr-3 text-indigo-600" />
            Pedidos Web
          </h1>
          <p className="text-gray-600 mt-1">Gestiona los pedidos recibidos desde el portal web</p>
        </div>
        <button
          onClick={loadOrders}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Statistics Cards - Clickable to filter (click again to clear) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <button
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          className={`text-left rounded-lg p-4 transition-all ${
            statusFilter === 'pending'
              ? 'bg-yellow-200 border-2 border-yellow-500 ring-2 ring-yellow-300'
              : 'bg-yellow-50 border border-yellow-200 hover:border-yellow-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'in_production' ? 'all' : 'in_production')}
          className={`text-left rounded-lg p-4 transition-all ${
            statusFilter === 'in_production'
              ? 'bg-blue-200 border-2 border-blue-500 ring-2 ring-blue-300'
              : 'bg-blue-50 border border-blue-200 hover:border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700">En Produccion</p>
              <p className="text-2xl font-bold text-blue-900">{stats.in_production}</p>
            </div>
            <Wrench className="w-8 h-8 text-blue-600" />
          </div>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'ready' ? 'all' : 'ready')}
          className={`text-left rounded-lg p-4 transition-all ${
            statusFilter === 'ready'
              ? 'bg-green-200 border-2 border-green-500 ring-2 ring-green-300'
              : 'bg-green-50 border border-green-200 hover:border-green-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700">Listos</p>
              <p className="text-2xl font-bold text-green-900">{stats.ready}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'delivered' ? 'all' : 'delivered')}
          className={`text-left rounded-lg p-4 transition-all ${
            statusFilter === 'delivered'
              ? 'bg-gray-300 border-2 border-gray-500 ring-2 ring-gray-300'
              : 'bg-gray-50 border border-gray-200 hover:border-gray-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">Entregados</p>
              <p className="text-2xl font-bold text-gray-900">{stats.delivered}</p>
            </div>
            <Package className="w-8 h-8 text-gray-600" />
          </div>
        </button>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Pedidos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Globe className="w-8 h-8 text-indigo-600" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700">Saldo Pendiente</p>
              <p className="text-xl font-bold text-red-900">${stats.totalPending.toLocaleString()}</p>
            </div>
            <DollarSign className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Status Filter */}
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Estado</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendientes</option>
                <option value="in_production">En Produccion</option>
                <option value="ready">Listos</option>
                <option value="delivered">Entregados</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Codigo, cliente, estudiante..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Delivery Type Filter */}
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Tipo de Entrega</label>
            <div className="relative">
              <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={deliveryFilter}
                onChange={(e) => setDeliveryFilter(e.target.value as 'all' | 'pickup' | 'delivery')}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              >
                <option value="all">Todos</option>
                <option value="pickup">Retiro en tienda ({stats.pickupOrders})</option>
                <option value="delivery">Domicilio ({stats.deliveryOrders})</option>
              </select>
            </div>
          </div>

          {/* Clear Filters */}
          {(statusFilter !== 'all' || deliveryFilter !== 'all' || searchQuery) && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setDeliveryFilter('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-red-600" />
          </button>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="ml-3 text-gray-600">Cargando pedidos web...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <Globe className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">
              {orders.length === 0
                ? 'No hay pedidos del portal web'
                : 'No se encontraron pedidos con los filtros aplicados'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 text-left">Codigo</th>
                  <th className="px-4 py-3 text-left">Colegio</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-center">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3 text-center">Comprobante</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Fecha</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOrders.map((order) => {
                  const statusConfig = STATUS_CONFIG[order.status];
                  const StatusIcon = statusConfig.icon;
                  const balance = Number(order.balance) || 0;

                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-indigo-600">{order.code}</span>
                          {order.delivery_type === 'delivery' && (
                            <span className="inline-flex items-center text-blue-600" title="Domicilio">
                              <Home className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{order.school_name || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{order.client_name || 'Sin cliente'}</p>
                          {order.student_name && (
                            <p className="text-sm text-gray-500">{order.student_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                          {order.items_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        ${Number(order.total).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {balance > 0 ? `$${balance.toLocaleString()}` : 'Pagado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {order.payment_proof_url ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPaymentProofUrl(order.payment_proof_url);
                              setSelectedOrder(null);
                              setSelectedOrderSchoolId(order.school_id);
                              handleViewDetail(order.id, order.school_id!);
                              setTimeout(() => setShowPaymentProofModal(true), 300);
                            }}
                            className="inline-flex items-center text-blue-600 hover:text-blue-700"
                            title="Ver comprobante de pago"
                          >
                            {order.payment_proof_url.endsWith('.pdf') ? (
                              <FileText className="w-5 h-5" />
                            ) : (
                              <ImageIcon className="w-5 h-5" />
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">Sin comprobante</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewDetail(order.id, order.school_id!)}
                            disabled={loadingDetail}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowDetailModal(false)} />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                  <Package className="w-6 h-6 mr-2 text-indigo-600" />
                  Pedido {selectedOrder.code}
                </h2>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Client Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-800 mb-3">Informacion del Cliente</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Nombre</p>
                      <p className="font-medium">{selectedOrder.client_name}</p>
                    </div>
                    {selectedOrder.student_name && (
                      <div>
                        <p className="text-sm text-gray-600">Estudiante</p>
                        <p className="font-medium">{selectedOrder.student_name}</p>
                      </div>
                    )}
                    {selectedOrder.client_phone && (
                      <div>
                        <p className="text-sm text-gray-600">Telefono</p>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{selectedOrder.client_phone}</p>
                          <button
                            onClick={() => openWhatsApp(selectedOrder.client_phone)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Enviar WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <a
                            href={`tel:${selectedOrder.client_phone}`}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Llamar"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delivery Information */}
                {selectedOrder.delivery_type === 'delivery' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-medium text-blue-800 mb-3 flex items-center">
                      <Truck className="w-5 h-5 mr-2" />
                      Informacion de Domicilio
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-blue-600">Direccion</p>
                        <p className="font-medium text-blue-900">{selectedOrder.delivery_address || '-'}</p>
                      </div>
                      <div>
                        <p className="text-blue-600">Barrio</p>
                        <p className="font-medium text-blue-900">{selectedOrder.delivery_neighborhood || '-'}</p>
                      </div>
                      {selectedOrder.delivery_city && (
                        <div>
                          <p className="text-blue-600">Ciudad</p>
                          <p className="font-medium text-blue-900">{selectedOrder.delivery_city}</p>
                        </div>
                      )}
                      {selectedOrder.delivery_fee && Number(selectedOrder.delivery_fee) > 0 && (
                        <div>
                          <p className="text-blue-600">Costo de Envio</p>
                          <p className="font-bold text-blue-900">${Number(selectedOrder.delivery_fee).toLocaleString()}</p>
                        </div>
                      )}
                      {selectedOrder.delivery_references && (
                        <div className="col-span-2">
                          <p className="text-blue-600">Indicaciones</p>
                          <p className="font-medium text-blue-900">{selectedOrder.delivery_references}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Stock Verification Banner (for pending orders) */}
                {selectedOrder.status === 'pending' && (
                  <div className={`rounded-lg p-4 ${
                    loadingStock
                      ? 'bg-gray-50 border border-gray-200'
                      : stockVerification?.can_fulfill_completely
                      ? 'bg-green-50 border border-green-200'
                      : stockVerification?.items_in_stock && stockVerification.items_in_stock > 0
                      ? 'bg-yellow-50 border border-yellow-200'
                      : 'bg-blue-50 border border-blue-200'
                  }`}>
                    {loadingStock ? (
                      <div className="flex items-center">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-500 mr-2" />
                        <span className="text-gray-600">Verificando disponibilidad de stock...</span>
                      </div>
                    ) : stockVerification ? (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium flex items-center">
                            {stockVerification.can_fulfill_completely ? (
                              <>
                                <PackageCheck className="w-5 h-5 text-green-600 mr-2" />
                                <span className="text-green-800">Todos los items disponibles en stock</span>
                              </>
                            ) : stockVerification.items_in_stock > 0 ? (
                              <>
                                <Boxes className="w-5 h-5 text-yellow-600 mr-2" />
                                <span className="text-yellow-800">Stock parcial disponible</span>
                              </>
                            ) : (
                              <>
                                <Factory className="w-5 h-5 text-blue-600 mr-2" />
                                <span className="text-blue-800">Requiere produccion</span>
                              </>
                            )}
                          </h3>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center mb-4">
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-xs text-gray-500">En Stock</p>
                            <p className="text-lg font-bold text-green-600">{stockVerification.items_in_stock}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-xs text-gray-500">Parcial</p>
                            <p className="text-lg font-bold text-yellow-600">{stockVerification.items_partial}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-xs text-gray-500">A Producir</p>
                            <p className="text-lg font-bold text-blue-600">{stockVerification.items_to_produce}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {stockVerification.can_fulfill_completely ? (
                            <button
                              onClick={() => handleApproveWithStock(true)}
                              disabled={approvingOrder}
                              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center disabled:opacity-50"
                            >
                              {approvingOrder ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Sparkles className="w-4 h-4 mr-2" />
                              )}
                              Aprobar y Despachar
                            </button>
                          ) : stockVerification.items_in_stock > 0 ? (
                            <>
                              <button
                                onClick={() => handleApproveWithStock(true)}
                                disabled={approvingOrder}
                                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition flex items-center justify-center disabled:opacity-50"
                              >
                                {approvingOrder ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <PackageCheck className="w-4 h-4 mr-2" />
                                )}
                                Despachar Stock + Producir Resto
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleApproveWithStock(false)}
                              disabled={approvingOrder}
                              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center disabled:opacity-50"
                            >
                              {approvingOrder ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Factory className="w-4 h-4 mr-2" />
                              )}
                              Enviar Todo a Produccion
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Items */}
                <div>
                  <h3 className="font-medium text-gray-800 mb-3">Items del Pedido</h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Producto</th>
                          <th className="px-4 py-2 text-center">Cant.</th>
                          {selectedOrder.status === 'pending' && stockVerification && (
                            <th className="px-4 py-2 text-center">Stock</th>
                          )}
                          <th className="px-4 py-2 text-right">Precio</th>
                          <th className="px-4 py-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedOrder.items.map((item) => {
                          // Find stock info for this item
                          const stockInfo = stockVerification?.items.find(
                            (si: OrderItemStockInfo) => si.item_id === item.id
                          );

                          return (
                            <tr key={item.id}>
                              <td className="px-4 py-2">
                                <div>
                                  <p className="font-medium">{item.garment_type_name}</p>
                                  <p className="text-xs text-gray-500">
                                    {item.size && `Talla: ${item.size}`}
                                    {item.color && ` | Color: ${item.color}`}
                                  </p>
                                  {item.custom_measurements && (
                                    <p className="text-xs text-purple-600">Con medidas personalizadas</p>
                                  )}
                                  {stockInfo?.product_code && (
                                    <p className="text-xs text-blue-600">Producto: {stockInfo.product_code}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2 text-center">{item.quantity}</td>
                              {selectedOrder.status === 'pending' && stockVerification && (
                                <td className="px-4 py-2 text-center">
                                  {stockInfo ? (
                                    <div className="flex flex-col items-center">
                                      {stockInfo.has_custom_measurements ? (
                                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                          Yomber
                                        </span>
                                      ) : stockInfo.can_fulfill_from_stock ? (
                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs flex items-center">
                                          <PackageCheck className="w-3 h-3 mr-1" />
                                          {stockInfo.stock_available}
                                        </span>
                                      ) : stockInfo.stock_available > 0 ? (
                                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                                          {stockInfo.stock_available}/{item.quantity}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs flex items-center">
                                          <PackageX className="w-3 h-3 mr-1" />
                                          0
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              )}
                              <td className="px-4 py-2 text-right">${Number(item.unit_price).toLocaleString()}</td>
                              <td className="px-4 py-2 text-right font-medium">${Number(item.subtotal).toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={selectedOrder.status === 'pending' && stockVerification ? 4 : 3} className="px-4 py-2 text-right font-medium">Total:</td>
                          <td className="px-4 py-2 text-right font-bold text-lg">
                            ${Number(selectedOrder.total).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Payments */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-800">Pagos</h3>
                    {Number(selectedOrder.balance) > 0 && (
                      <button
                        onClick={() => {
                          setPaymentAmount(Number(selectedOrder.balance));
                          setShowPaymentModal(true);
                        }}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition flex items-center"
                      >
                        <DollarSign className="w-4 h-4 mr-1" />
                        Registrar Pago
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="font-bold text-lg">${Number(selectedOrder.total).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Pagado</p>
                      <p className="font-bold text-lg text-green-600">${Number(selectedOrder.paid_amount).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Saldo</p>
                      <p className={`font-bold text-lg ${Number(selectedOrder.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {Number(selectedOrder.balance) > 0 ? `$${Number(selectedOrder.balance).toLocaleString()}` : 'Pagado'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status Actions */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-800 mb-3">Estado del Pedido</h3>
                  <div className="flex items-center gap-2 mb-4">
                    {(() => {
                      const config = STATUS_CONFIG[selectedOrder.status];
                      const StatusIcon = config.icon;
                      return (
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${config.bgColor} ${config.color}`}>
                          <StatusIcon className="w-4 h-4 mr-2" />
                          {config.label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Status Workflow */}
                  {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
                    <div className="flex flex-wrap gap-2">
                      {selectedOrder.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateStatus('in_production')}
                          disabled={updatingStatus}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center disabled:opacity-50"
                        >
                          {updatingStatus ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ChevronRight className="w-4 h-4 mr-1" />}
                          Pasar a Produccion
                        </button>
                      )}
                      {selectedOrder.status === 'in_production' && (
                        <button
                          onClick={() => handleUpdateStatus('ready')}
                          disabled={updatingStatus}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center disabled:opacity-50"
                        >
                          {updatingStatus ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                          Marcar Listo
                        </button>
                      )}
                      {selectedOrder.status === 'ready' && (
                        <button
                          onClick={() => handleUpdateStatus('delivered')}
                          disabled={updatingStatus}
                          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition flex items-center disabled:opacity-50"
                        >
                          {updatingStatus ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Package className="w-4 h-4 mr-1" />}
                          Entregar
                        </button>
                      )}
                      <button
                        onClick={() => setShowResolveDuplicateModal(true)}
                        className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition flex items-center text-sm"
                        title="El cliente ya compro en punto fisico"
                      >
                        <Ban className="w-4 h-4 mr-1" />
                        Duplicado
                      </button>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {selectedOrder.notes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 className="font-medium text-yellow-800 mb-2">Notas</h3>
                    <p className="text-yellow-900">{selectedOrder.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowPaymentModal(false)} />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                  Registrar Pago - {selectedOrder.code}
                </h2>
                <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-600">Saldo Pendiente</p>
                  <p className="text-2xl font-bold text-red-600">${Number(selectedOrder.balance).toLocaleString()}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      min="1"
                      max={Number(selectedOrder.balance)}
                      value={paymentAmount || ''}
                      onChange={(e) => setPaymentAmount(parseInt(e.target.value) || 0)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Metodo de Pago</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="nequi">Nequi</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referencia (opcional)</label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="Numero de transaccion, recibo, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows={2}
                    placeholder="Observaciones del pago..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  disabled={processingPayment}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddPayment}
                  disabled={processingPayment || paymentAmount <= 0}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center"
                >
                  {processingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    'Registrar Pago'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Proof Modal */}
      {showPaymentProofModal && paymentProofUrl && selectedOrder && (
        <div className="fixed inset-0 z-[70] overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-75" onClick={() => setShowPaymentProofModal(false)} />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                  <ImageIcon className="w-6 h-6 mr-2 text-blue-600" />
                  Comprobante de Pago - {selectedOrder.code}
                </h2>
                <button onClick={() => setShowPaymentProofModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                {/* Image/PDF Viewer */}
                <div className="mb-6 bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-[400px]">
                  {paymentProofUrl.endsWith('.pdf') ? (
                    <div className="text-center">
                      <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600 mb-4">Archivo PDF</p>
                      <a
                        href={`https://api.yourdomain.com${paymentProofUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition inline-block"
                      >
                        Abrir PDF
                      </a>
                    </div>
                  ) : (
                    <img
                      src={`https://api.yourdomain.com${paymentProofUrl}`}
                      alt="Comprobante de pago"
                      className="max-w-full max-h-[600px] object-contain rounded"
                      onError={(e) => {
                        console.error('Error loading image:', paymentProofUrl);
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5FcnJvciBhbCBjYXJnYXIgaW1hZ2VuPC90ZXh0Pjwvc3ZnPg==';
                      }}
                    />
                  )}
                </div>

                {/* Order Info */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="font-bold text-lg">${Number(selectedOrder.total).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Pagado</p>
                      <p className="font-bold text-lg text-green-600">${Number(selectedOrder.paid_amount).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Saldo</p>
                      <p className={`font-bold text-lg ${Number(selectedOrder.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {Number(selectedOrder.balance) > 0 ? `$${Number(selectedOrder.balance).toLocaleString()}` : 'Pagado'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPaymentProofModal(false)}
                    disabled={processingPaymentProof}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={handleRejectPayment}
                    disabled={processingPaymentProof}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center"
                  >
                    {processingPaymentProof ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <X className="w-4 h-4 mr-2" />
                    )}
                    Rechazar
                  </button>
                  <button
                    onClick={handleApprovePayment}
                    disabled={processingPaymentProof}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center"
                  >
                    {processingPaymentProof ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Aprobar Pago
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Duplicate Modal */}
      {showResolveDuplicateModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Resolver Pedido Duplicado</h3>
              <button
                onClick={() => { setShowResolveDuplicateModal(false); setResolvingSaleCode(''); setResolveError(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-start">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-xs text-yellow-800">
                  <p className="font-medium mb-1">Esta accion cancelara el pedido web {selectedOrder.code}:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Se liberara el stock reservado ({selectedOrder.items?.length || 0} item(s))</li>
                    {Number(selectedOrder.paid_amount) > 0 && <li>Se revertiran anticipos por ${Number(selectedOrder.paid_amount).toLocaleString()}</li>}
                    {Number(selectedOrder.balance) > 0 && <li>Se cancelaran cuentas por cobrar por ${Number(selectedOrder.balance).toLocaleString()}</li>}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Codigo de la venta fisica que reemplaza este pedido
              </label>
              <input
                type="text"
                value={resolvingSaleCode}
                onChange={(e) => { setResolvingSaleCode(e.target.value.toUpperCase()); setResolveError(null); }}
                placeholder="Ej: VEN-0042"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 font-mono"
                disabled={resolvingDuplicate}
              />
            </div>

            {resolveError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                {resolveError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowResolveDuplicateModal(false); setResolvingSaleCode(''); setResolveError(null); }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                disabled={resolvingDuplicate}
              >
                Cancelar
              </button>
              <button
                onClick={handleResolveDuplicate}
                disabled={!resolvingSaleCode.trim() || resolvingDuplicate}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resolvingDuplicate ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Resolviendo...
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4 mr-2" />
                    Resolver Duplicado
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
