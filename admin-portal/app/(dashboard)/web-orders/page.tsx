'use client';

/**
 * WebOrdersPage - Manage orders from web portal
 * Filters orders with source='web_portal'
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
  Truck,
} from 'lucide-react';
import ordersService, {
  OrderListItem,
  StockVerification,
  StockVerificationItem,
} from '@/lib/services/ordersService';
import schoolService from '@/lib/services/schoolService';
import type {
  School,
  OrderStatus,
  OrderWithItems,
  PaymentMethod,
} from '@/lib/api';
import { useAdminAuth } from '@/lib/adminAuth';
import { formatCurrency, formatDate } from '@/lib/utils';

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; icon: typeof Clock; bgColor: string }
> = {
  pending: {
    label: 'Pendiente',
    color: 'text-yellow-700',
    icon: Clock,
    bgColor: 'bg-yellow-100',
  },
  in_production: {
    label: 'En Produccion',
    color: 'text-blue-700',
    icon: Wrench,
    bgColor: 'bg-blue-100',
  },
  ready: {
    label: 'Listo',
    color: 'text-green-700',
    icon: CheckCircle,
    bgColor: 'bg-green-100',
  },
  delivered: {
    label: 'Entregado',
    color: 'text-gray-700',
    icon: Package,
    bgColor: 'bg-gray-100',
  },
  cancelled: {
    label: 'Cancelado',
    color: 'text-red-700',
    icon: X,
    bgColor: 'bg-red-100',
  },
};

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
];

export default function WebOrdersPage() {
  const { user } = useAdminAuth();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<
    'all' | 'pickup' | 'delivery'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail modal
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(
    null
  );
  const [selectedOrderSchoolId, setSelectedOrderSchoolId] = useState<
    string | null
  >(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Stock verification
  const [stockVerification, setStockVerification] =
    useState<StockVerification | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [approvingOrder, setApprovingOrder] = useState(false);

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Payment proof modal
  const [showPaymentProofModal, setShowPaymentProofModal] = useState(false);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [processingPaymentProof, setProcessingPaymentProof] = useState(false);

  // Get accessible schools
  const getAccessibleSchools = () => {
    if (user?.is_superuser) {
      return schools;
    }
    if (user?.school_roles) {
      const accessibleIds = user.school_roles.map((r) => r.school_id);
      return schools.filter((s) => accessibleIds.includes(s.id));
    }
    return [];
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const schoolsData = await schoolService.list();
      setSchools(schoolsData);

      await loadOrders(schoolsData);
    } catch (err) {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async (schoolsList?: School[]) => {
    const availableSchools = schoolsList || schools;
    if (availableSchools.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      // Get accessible schools
      const accessible = user?.is_superuser
        ? availableSchools
        : availableSchools.filter((s) =>
            user?.school_roles?.map((r) => r.school_id).includes(s.id)
          );

      // Load orders from all accessible schools
      const ordersPromises = accessible.map((school) =>
        ordersService
          .list({ school_id: school.id })
          .then((orders) =>
            orders.map((o) => ({ ...o, school_name: school.name }))
          )
          .catch(() => [] as OrderListItem[])
      );

      const allSchoolOrders = await Promise.all(ordersPromises);
      const allOrders = allSchoolOrders.flat();

      // Filter for web portal orders
      const webOrders = allOrders
        .filter((o) => o.source === 'web_portal')
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      setOrders(webOrders as OrderListItem[]);
    } catch (err) {
      setError('Error al cargar pedidos web');
    } finally {
      setLoading(false);
    }
  };

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;

      if (deliveryFilter !== 'all') {
        const orderDeliveryType = order.delivery_type || 'pickup';
        if (orderDeliveryType !== deliveryFilter) return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesCode = order.code.toLowerCase().includes(query);
        const matchesClient = order.client_name?.toLowerCase().includes(query);
        const matchesStudent = order.student_name
          ?.toLowerCase()
          .includes(query);
        if (!matchesCode && !matchesClient && !matchesStudent) return false;
      }

      return true;
    });
  }, [orders, statusFilter, deliveryFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    return {
      pending: orders.filter((o) => o.status === 'pending').length,
      in_production: orders.filter((o) => o.status === 'in_production').length,
      ready: orders.filter((o) => o.status === 'ready').length,
      delivered: orders.filter((o) => o.status === 'delivered').length,
      total: orders.length,
      totalPending: orders.reduce(
        (sum, o) => sum + (Number(o.balance) || 0),
        0
      ),
      deliveryOrders: orders.filter((o) => o.delivery_type === 'delivery')
        .length,
      pickupOrders: orders.filter((o) => o.delivery_type !== 'delivery').length,
    };
  }, [orders]);

  const handleViewDetail = async (orderId: string, schoolId: string) => {
    try {
      setLoadingDetail(true);
      setSelectedOrderSchoolId(schoolId);
      setStockVerification(null);

      const order = await ordersService.getWithItems(schoolId, orderId);
      setSelectedOrder(order);
      setShowDetailModal(true);

      // Load stock verification for pending orders
      if (order.status === 'pending') {
        setLoadingStock(true);
        try {
          const stockInfo = await ordersService.verifyStock(schoolId, orderId);
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
      await ordersService.approve(selectedOrderSchoolId, selectedOrder.id, {
        auto_fulfill: autoFulfill,
      });

      const updatedOrder = await ordersService.getWithItems(
        selectedOrderSchoolId,
        selectedOrder.id
      );
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
      await ordersService.updateStatus(
        selectedOrderSchoolId,
        selectedOrder.id,
        newStatus
      );
      const updatedOrder = await ordersService.getWithItems(
        selectedOrderSchoolId,
        selectedOrder.id
      );
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
      await ordersService.addPayment(selectedOrderSchoolId, selectedOrder.id, {
        amount: paymentAmount,
        payment_method: paymentMethod,
        reference: paymentRef || undefined,
      });
      const updatedOrder = await ordersService.getWithItems(
        selectedOrderSchoolId,
        selectedOrder.id
      );
      setSelectedOrder(updatedOrder);
      setShowPaymentModal(false);
      setPaymentAmount(0);
      setPaymentMethod('cash');
      setPaymentRef('');
      loadOrders();
    } catch (err) {
      console.error('Error adding payment:', err);
      setError('Error al registrar pago');
    } finally {
      setProcessingPayment(false);
    }
  };

  const openWhatsApp = (phone: string | null | undefined) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('57')
      ? cleanPhone
      : `57${cleanPhone}`;
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  const handleApprovePayment = async () => {
    if (!selectedOrderSchoolId || !selectedOrder) return;

    try {
      setProcessingPaymentProof(true);
      await ordersService.approvePayment(
        selectedOrderSchoolId,
        selectedOrder.id
      );

      const updatedOrder = await ordersService.getWithItems(
        selectedOrderSchoolId,
        selectedOrder.id
      );
      setSelectedOrder(updatedOrder);
      setShowPaymentProofModal(false);
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
      await ordersService.rejectPayment(
        selectedOrderSchoolId,
        selectedOrder.id,
        reason
      );

      const updatedOrder = await ordersService.getWithItems(
        selectedOrderSchoolId,
        selectedOrder.id
      );
      setSelectedOrder(updatedOrder);
      setShowPaymentProofModal(false);
      await loadOrders();
    } catch (err) {
      console.error('Error rejecting payment:', err);
      setError('Error al rechazar el pago');
    } finally {
      setProcessingPaymentProof(false);
    }
  };

  const accessibleSchools = getAccessibleSchools();

  if (accessibleSchools.length === 0 && !loading) {
    return (
      <div className="p-8 text-center">
        <Globe className="w-12 h-12 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500">No tienes acceso a ningun colegio</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Globe className="w-7 h-7 text-indigo-500" />
            Pedidos Web
          </h1>
          <p className="text-slate-500 mt-1">
            Gestiona los pedidos recibidos desde el portal web
          </p>
        </div>
        <button
          onClick={() => loadOrders()}
          disabled={loading}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition flex items-center disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}
          />
          Actualizar
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <button
          onClick={() =>
            setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')
          }
          className={`text-left rounded-lg p-4 transition-all ${
            statusFilter === 'pending'
              ? 'bg-yellow-200 border-2 border-yellow-500 ring-2 ring-yellow-300'
              : 'bg-yellow-50 border border-yellow-200 hover:border-yellow-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-900">
                {stats.pending}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </button>

        <button
          onClick={() =>
            setStatusFilter(
              statusFilter === 'in_production' ? 'all' : 'in_production'
            )
          }
          className={`text-left rounded-lg p-4 transition-all ${
            statusFilter === 'in_production'
              ? 'bg-blue-200 border-2 border-blue-500 ring-2 ring-blue-300'
              : 'bg-blue-50 border border-blue-200 hover:border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700">En Produccion</p>
              <p className="text-2xl font-bold text-blue-900">
                {stats.in_production}
              </p>
            </div>
            <Wrench className="w-8 h-8 text-blue-600" />
          </div>
        </button>

        <button
          onClick={() =>
            setStatusFilter(statusFilter === 'ready' ? 'all' : 'ready')
          }
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
          onClick={() =>
            setStatusFilter(statusFilter === 'delivered' ? 'all' : 'delivered')
          }
          className={`text-left rounded-lg p-4 transition-all ${
            statusFilter === 'delivered'
              ? 'bg-gray-300 border-2 border-gray-500 ring-2 ring-gray-300'
              : 'bg-gray-50 border border-gray-200 hover:border-gray-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">Entregados</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.delivered}
              </p>
            </div>
            <Package className="w-8 h-8 text-gray-600" />
          </div>
        </button>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Pedidos</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
            <Globe className="w-8 h-8 text-indigo-600" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700">Saldo Pendiente</p>
              <p className="text-xl font-bold text-red-900">
                {formatCurrency(stats.totalPending)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Estado</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as OrderStatus | 'all')
                }
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
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

          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Codigo, cliente, estudiante..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">
              Tipo de Entrega
            </label>
            <div className="relative">
              <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={deliveryFilter}
                onChange={(e) =>
                  setDeliveryFilter(
                    e.target.value as 'all' | 'pickup' | 'delivery'
                  )
                }
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              >
                <option value="all">Todos</option>
                <option value="pickup">
                  Retiro en tienda ({stats.pickupOrders})
                </option>
                <option value="delivery">
                  Domicilio ({stats.deliveryOrders})
                </option>
              </select>
            </div>
          </div>

          {(statusFilter !== 'all' ||
            deliveryFilter !== 'all' ||
            searchQuery) && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setDeliveryFilter('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 transition"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-red-600" />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          <span className="ml-3 text-slate-600">Cargando pedidos web...</span>
        </div>
      )}

      {/* Orders Table */}
      {!loading && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">
                {orders.length === 0
                  ? 'No hay pedidos del portal web'
                  : 'No se encontraron pedidos con los filtros aplicados'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-xs text-slate-500 uppercase">
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
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => {
                    const statusConfig = STATUS_CONFIG[order.status];
                    const StatusIcon = statusConfig.icon;
                    const balance = Number(order.balance) || 0;

                    return (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-indigo-600">
                              {order.code}
                            </span>
                            {order.delivery_type === 'delivery' && (
                              <span
                                className="inline-flex items-center text-blue-600"
                                title="Domicilio"
                              >
                                <Home className="w-4 h-4" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-700">
                            {order.school_name || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-slate-900">
                              {order.client_name || 'Sin cliente'}
                            </p>
                            {order.student_name && (
                              <p className="text-sm text-slate-500">
                                {order.student_name}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-700 rounded text-sm">
                            {order.items_count || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(Number(order.total))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-medium ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}
                          >
                            {balance > 0 ? formatCurrency(balance) : 'Pagado'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {order.payment_proof_url ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPaymentProofUrl(order.payment_proof_url!);
                                setSelectedOrderSchoolId(order.school_id!);
                                handleViewDetail(order.id, order.school_id!);
                                setTimeout(
                                  () => setShowPaymentProofModal(true),
                                  300
                                );
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
                            <span className="text-xs text-slate-400">
                              Sin comprobante
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                          >
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600">
                          {formatDate(order.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() =>
                                handleViewDetail(order.id, order.school_id!)
                              }
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
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowDetailModal(false)}
          />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
                <h2 className="text-xl font-semibold text-slate-800 flex items-center">
                  <Package className="w-6 h-6 mr-2 text-indigo-600" />
                  Pedido {selectedOrder.code}
                </h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Client Info */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="font-medium text-slate-800 mb-3">
                    Informacion del Cliente
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Nombre</p>
                      <p className="font-medium">{selectedOrder.client_name}</p>
                    </div>
                    {(selectedOrder as any).student_name && (
                      <div>
                        <p className="text-sm text-slate-600">Estudiante</p>
                        <p className="font-medium">
                          {(selectedOrder as any).student_name}
                        </p>
                      </div>
                    )}
                    {selectedOrder.client_phone && (
                      <div>
                        <p className="text-sm text-slate-600">Telefono</p>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {selectedOrder.client_phone}
                          </p>
                          <button
                            onClick={() =>
                              openWhatsApp(selectedOrder.client_phone)
                            }
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
                        <p className="font-medium text-blue-900">
                          {(selectedOrder as any).delivery_address || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-blue-600">Barrio</p>
                        <p className="font-medium text-blue-900">
                          {(selectedOrder as any).delivery_neighborhood || '-'}
                        </p>
                      </div>
                      {(selectedOrder as any).delivery_city && (
                        <div>
                          <p className="text-blue-600">Ciudad</p>
                          <p className="font-medium text-blue-900">
                            {(selectedOrder as any).delivery_city}
                          </p>
                        </div>
                      )}
                      {selectedOrder.delivery_fee &&
                        Number(selectedOrder.delivery_fee) > 0 && (
                          <div>
                            <p className="text-blue-600">Costo de Envio</p>
                            <p className="font-bold text-blue-900">
                              {formatCurrency(Number(selectedOrder.delivery_fee))}
                            </p>
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {/* Stock Verification Banner */}
                {selectedOrder.status === 'pending' && (
                  <div
                    className={`rounded-lg p-4 ${
                      loadingStock
                        ? 'bg-slate-50 border border-slate-200'
                        : stockVerification?.can_fulfill_completely
                          ? 'bg-green-50 border border-green-200'
                          : stockVerification?.items_in_stock &&
                              stockVerification.items_in_stock > 0
                            ? 'bg-yellow-50 border border-yellow-200'
                            : 'bg-blue-50 border border-blue-200'
                    }`}
                  >
                    {loadingStock ? (
                      <div className="flex items-center">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-500 mr-2" />
                        <span className="text-slate-600">
                          Verificando disponibilidad de stock...
                        </span>
                      </div>
                    ) : stockVerification ? (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium flex items-center">
                            {stockVerification.can_fulfill_completely ? (
                              <>
                                <PackageCheck className="w-5 h-5 text-green-600 mr-2" />
                                <span className="text-green-800">
                                  Todos los items disponibles en stock
                                </span>
                              </>
                            ) : stockVerification.items_in_stock > 0 ? (
                              <>
                                <Boxes className="w-5 h-5 text-yellow-600 mr-2" />
                                <span className="text-yellow-800">
                                  Stock parcial disponible
                                </span>
                              </>
                            ) : (
                              <>
                                <Factory className="w-5 h-5 text-blue-600 mr-2" />
                                <span className="text-blue-800">
                                  Requiere produccion
                                </span>
                              </>
                            )}
                          </h3>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center mb-4">
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-xs text-slate-500">En Stock</p>
                            <p className="text-lg font-bold text-green-600">
                              {stockVerification.items_in_stock}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-xs text-slate-500">Parcial</p>
                            <p className="text-lg font-bold text-yellow-600">
                              {stockVerification.items_partial}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-xs text-slate-500">A Producir</p>
                            <p className="text-lg font-bold text-blue-600">
                              {stockVerification.items_to_produce}
                            </p>
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
                  <h3 className="font-medium text-slate-800 mb-3">
                    Items del Pedido
                  </h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Producto</th>
                          <th className="px-4 py-2 text-center">Cant.</th>
                          {selectedOrder.status === 'pending' &&
                            stockVerification && (
                              <th className="px-4 py-2 text-center">Stock</th>
                            )}
                          <th className="px-4 py-2 text-right">Precio</th>
                          <th className="px-4 py-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {selectedOrder.items.map((item) => {
                          const stockInfo = stockVerification?.items.find(
                            (si: StockVerificationItem) =>
                              si.item_id === item.id
                          );

                          return (
                            <tr key={item.id}>
                              <td className="px-4 py-2">
                                <div>
                                  <p className="font-medium">
                                    {item.garment_type_name ||
                                      item.product_name ||
                                      '-'}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {item.product_size &&
                                      `Talla: ${item.product_size}`}
                                  </p>
                                  {item.custom_measurements && (
                                    <p className="text-xs text-purple-600">
                                      Con medidas personalizadas
                                    </p>
                                  )}
                                  {stockInfo?.product_code && (
                                    <p className="text-xs text-blue-600">
                                      Producto: {stockInfo.product_code}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2 text-center">
                                {item.quantity}
                              </td>
                              {selectedOrder.status === 'pending' &&
                                stockVerification && (
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
                                            {stockInfo.stock_available}/
                                            {item.quantity}
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs flex items-center">
                                            <PackageX className="w-3 h-3 mr-1" />
                                            0
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                )}
                              <td className="px-4 py-2 text-right">
                                {formatCurrency(Number(item.unit_price))}
                              </td>
                              <td className="px-4 py-2 text-right font-medium">
                                {formatCurrency(Number(item.subtotal))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50">
                        <tr>
                          <td
                            colSpan={
                              selectedOrder.status === 'pending' &&
                              stockVerification
                                ? 4
                                : 3
                            }
                            className="px-4 py-2 text-right font-medium"
                          >
                            Total:
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-lg">
                            {formatCurrency(Number(selectedOrder.total))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Payments */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-slate-800">Pagos</h3>
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
                      <p className="text-sm text-slate-600">Total</p>
                      <p className="font-bold text-lg">
                        {formatCurrency(Number(selectedOrder.total))}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Pagado</p>
                      <p className="font-bold text-lg text-green-600">
                        {formatCurrency(Number(selectedOrder.paid_amount))}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Saldo</p>
                      <p
                        className={`font-bold text-lg ${Number(selectedOrder.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}
                      >
                        {Number(selectedOrder.balance) > 0
                          ? formatCurrency(Number(selectedOrder.balance))
                          : 'Pagado'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status Actions */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="font-medium text-slate-800 mb-3">
                    Estado del Pedido
                  </h3>
                  <div className="flex items-center gap-2 mb-4">
                    {(() => {
                      const config = STATUS_CONFIG[selectedOrder.status];
                      const StatusIcon = config.icon;
                      return (
                        <span
                          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${config.bgColor} ${config.color}`}
                        >
                          <StatusIcon className="w-4 h-4 mr-2" />
                          {config.label}
                        </span>
                      );
                    })()}
                  </div>

                  {selectedOrder.status !== 'delivered' &&
                    selectedOrder.status !== 'cancelled' && (
                      <div className="flex flex-wrap gap-2">
                        {selectedOrder.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateStatus('in_production')}
                            disabled={updatingStatus}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center disabled:opacity-50"
                          >
                            {updatingStatus ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <ChevronRight className="w-4 h-4 mr-1" />
                            )}
                            Pasar a Produccion
                          </button>
                        )}
                        {selectedOrder.status === 'in_production' && (
                          <button
                            onClick={() => handleUpdateStatus('ready')}
                            disabled={updatingStatus}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center disabled:opacity-50"
                          >
                            {updatingStatus ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4 mr-1" />
                            )}
                            Marcar Listo
                          </button>
                        )}
                        {selectedOrder.status === 'ready' && (
                          <button
                            onClick={() => handleUpdateStatus('delivered')}
                            disabled={updatingStatus}
                            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition flex items-center disabled:opacity-50"
                          >
                            {updatingStatus ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Package className="w-4 h-4 mr-1" />
                            )}
                            Entregar
                          </button>
                        )}
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
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowPaymentModal(false)}
          />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                  Registrar Pago - {selectedOrder.code}
                </h2>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-slate-600">Saldo Pendiente</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(Number(selectedOrder.balance))}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Monto *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      min="1"
                      max={Number(selectedOrder.balance)}
                      value={paymentAmount || ''}
                      onChange={(e) =>
                        setPaymentAmount(parseInt(e.target.value) || 0)
                      }
                      className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Metodo de Pago
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as PaymentMethod)
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm.value} value={pm.value}>
                        {pm.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Referencia (opcional)
                  </label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="Numero de transaccion, recibo, etc."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t border-slate-200">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  disabled={processingPayment}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
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
          <div
            className="fixed inset-0 bg-black/75"
            onClick={() => setShowPaymentProofModal(false)}
          />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
                <h2 className="text-xl font-semibold text-slate-800 flex items-center">
                  <ImageIcon className="w-6 h-6 mr-2 text-blue-600" />
                  Comprobante de Pago - {selectedOrder.code}
                </h2>
                <button
                  onClick={() => setShowPaymentProofModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                {/* Image/PDF Viewer */}
                <div className="mb-6 bg-slate-100 rounded-lg p-4 flex items-center justify-center min-h-[400px]">
                  {paymentProofUrl.endsWith('.pdf') ? (
                    <div className="text-center">
                      <FileText className="w-16 h-16 mx-auto text-slate-400 mb-4" />
                      <p className="text-slate-600 mb-4">Archivo PDF</p>
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
                    />
                  )}
                </div>

                {/* Order Info */}
                <div className="bg-slate-50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-slate-600">Total</p>
                      <p className="font-bold text-lg">
                        {formatCurrency(Number(selectedOrder.total))}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Pagado</p>
                      <p className="font-bold text-lg text-green-600">
                        {formatCurrency(Number(selectedOrder.paid_amount))}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Saldo</p>
                      <p
                        className={`font-bold text-lg ${Number(selectedOrder.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}
                      >
                        {Number(selectedOrder.balance) > 0
                          ? formatCurrency(Number(selectedOrder.balance))
                          : 'Pagado'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPaymentProofModal(false)}
                    disabled={processingPaymentProof}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
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
    </div>
  );
}
