'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  Eye,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  ClipboardList,
  X,
  Package,
  Truck,
  Play,
  Check,
  Plus,
} from 'lucide-react';
import ordersService from '@/lib/services/ordersService';
import schoolService from '@/lib/services/schoolService';
import type {
  Order,
  OrderWithItems,
  OrderItem,
  School,
  OrderStatus,
  OrderItemStatus,
  PaymentMethod,
} from '@/lib/api';
import { useAdminAuth } from '@/lib/adminAuth';
import CreateOrderModal from '@/components/orders/CreateOrderModal';
import DraftsList from '@/components/orders/DraftsList';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'credit', label: 'Crédito' },
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  in_production: 'En Producción',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'badge-warning',
  in_production: 'badge-info',
  ready: 'badge-success',
  delivered: 'badge-default',
  cancelled: 'badge-error',
};

const STATUS_FLOW: OrderStatus[] = ['pending', 'in_production', 'ready', 'delivered'];

// Helper to extract error message from API response
const getErrorMessage = (err: any, fallback: string): string => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join(', ');
  }
  if (typeof detail === 'object' && detail !== null) {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return fallback;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function OrdersPage() {
  const { user } = useAdminAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Detail Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    payment_method: '' as PaymentMethod | '',
    reference: '',
  });
  const [savingPayment, setSavingPayment] = useState(false);

  // Status change loading
  const [changingStatus, setChangingStatus] = useState(false);
  const [changingItemStatus, setChangingItemStatus] = useState<string | null>(null);

  // Create Order Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  // Get accessible schools based on user roles
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

  const loadSchools = async () => {
    try {
      const data = await schoolService.list();
      setSchools(data.filter((s) => s.is_active));
    } catch (err) {
      console.error('Error loading schools:', err);
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (selectedSchool) params.school_id = selectedSchool;
      if (selectedStatus) params.status = selectedStatus;
      if (searchTerm) params.search = searchTerm;
      const data = await ordersService.list(params);
      setOrders(data);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cargar encargos'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [selectedSchool, selectedStatus]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadOrders();
  };

  const openDetailModal = async (order: Order) => {
    if (!order.school_id) {
      setError('Este encargo no tiene colegio asignado');
      return;
    }
    setLoadingDetail(true);
    setShowDetailModal(true);
    try {
      const orderDetail = await ordersService.getWithItems(order.school_id, order.id);
      setSelectedOrder(orderDetail);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cargar detalle'));
      setShowDetailModal(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedOrder(null);
  };

  const reloadOrderDetail = async () => {
    if (!selectedOrder || !selectedOrder.school_id) return;
    try {
      const orderDetail = await ordersService.getWithItems(
        selectedOrder.school_id,
        selectedOrder.id
      );
      setSelectedOrder(orderDetail);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al recargar detalle'));
    }
  };

  const openPaymentModal = () => {
    if (!selectedOrder) return;
    const remaining = selectedOrder.balance;
    setPaymentData({
      amount: remaining > 0 ? remaining : 0,
      payment_method: '',
      reference: '',
    });
    setShowPaymentModal(true);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !selectedOrder.school_id) return;

    setSavingPayment(true);
    try {
      await ordersService.addPayment(selectedOrder.school_id, selectedOrder.id, {
        amount: paymentData.amount,
        payment_method: paymentData.payment_method as PaymentMethod,
        reference: paymentData.reference || undefined,
      });
      setShowPaymentModal(false);
      await reloadOrderDetail();
      loadOrders();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al agregar pago'));
    } finally {
      setSavingPayment(false);
    }
  };

  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    if (!selectedOrder || !selectedOrder.school_id) return;

    setChangingStatus(true);
    try {
      await ordersService.updateStatus(selectedOrder.school_id, selectedOrder.id, newStatus);
      await reloadOrderDetail();
      loadOrders();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cambiar estado'));
    } finally {
      setChangingStatus(false);
    }
  };

  const handleUpdateItemStatus = async (itemId: string, newStatus: OrderItemStatus) => {
    if (!selectedOrder || !selectedOrder.school_id) return;

    setChangingItemStatus(itemId);
    try {
      await ordersService.updateItemStatus(
        selectedOrder.school_id,
        selectedOrder.id,
        itemId,
        newStatus
      );
      await reloadOrderDetail();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cambiar estado del item'));
    } finally {
      setChangingItemStatus(null);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder || !selectedOrder.school_id) return;
    if (!confirm('¿Estás seguro de cancelar este encargo? Esta acción liberará el stock reservado.'))
      return;

    setChangingStatus(true);
    try {
      await ordersService.cancel(selectedOrder.school_id, selectedOrder.id);
      await reloadOrderDetail();
      loadOrders();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cancelar encargo'));
    } finally {
      setChangingStatus(false);
    }
  };

  const getNextStatus = (currentStatus: OrderStatus): OrderStatus | null => {
    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex >= STATUS_FLOW.length - 1) return null;
    return STATUS_FLOW[currentIndex + 1];
  };

  const accessibleSchools = getAccessibleSchools();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">Encargos</h1>
          <p className="text-slate-600 mt-1">Gestiona los encargos y pedidos personalizados</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadOrders}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={() => {
              setSelectedDraftId(null);
              setShowCreateModal(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Crear Encargo
          </button>
        </div>
      </div>

      {/* Drafts List */}
      <DraftsList
        onResumeDraft={(draftId) => {
          setSelectedDraftId(draftId);
          setShowCreateModal(true);
        }}
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por código o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="admin-input pl-10"
              />
            </div>
            <button type="submit" className="btn-primary">
              Buscar
            </button>
          </form>

          <div className="flex gap-2">
            <select
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
              className="admin-input min-w-[150px]"
            >
              <option value="">Todos los colegios</option>
              {accessibleSchools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="admin-input min-w-[140px]"
            >
              <option value="">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="in_production">En Producción</option>
              <option value="ready">Listo</option>
              <option value="delivered">Entregado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Colegio</th>
                <th>Total</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th>Entrega</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-brand-500"></div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <ClipboardList className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                    <p className="text-slate-500">No hay encargos registrados</p>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="font-mono font-medium text-brand-600">{order.code}</td>
                    <td>
                      <p>{order.client_name || 'Sin cliente'}</p>
                      {order.client_phone && (
                        <p className="text-xs text-slate-500">{order.client_phone}</p>
                      )}
                    </td>
                    <td className="text-sm text-slate-600">{order.school_name || '-'}</td>
                    <td className="font-medium">{formatCurrency(order.total)}</td>
                    <td
                      className={order.balance > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}
                    >
                      {formatCurrency(order.balance)}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="text-sm text-slate-500">
                      {order.delivery_date ? formatDate(order.delivery_date) : '-'}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openDetailModal(order)}
                          className="p-2 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
            {loadingDetail ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-brand-500"></div>
              </div>
            ) : selectedOrder ? (
              <>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Encargo {selectedOrder.code}
                    </h2>
                    <p className="text-slate-600">{selectedOrder.school_name}</p>
                  </div>
                  <button
                    onClick={closeDetailModal}
                    className="p-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Order Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-xs text-slate-500">Cliente</p>
                    <p className="font-medium">
                      {selectedOrder.client_name || 'Sin cliente'}
                    </p>
                    {selectedOrder.client_phone && (
                      <p className="text-sm text-slate-500">{selectedOrder.client_phone}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="font-bold text-lg">{formatCurrency(selectedOrder.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Saldo Pendiente</p>
                    <p
                      className={`font-bold text-lg ${
                        selectedOrder.balance > 0 ? 'text-orange-600' : 'text-green-600'
                      }`}
                    >
                      {formatCurrency(selectedOrder.balance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Estado</p>
                    <span className={`badge ${STATUS_COLORS[selectedOrder.status]}`}>
                      {STATUS_LABELS[selectedOrder.status]}
                    </span>
                  </div>
                </div>

                {/* Delivery Info */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 p-4 bg-blue-50 rounded-lg">
                  <div>
                    <p className="text-xs text-blue-600">Fecha de Entrega</p>
                    <p className="font-medium">
                      {selectedOrder.delivery_date
                        ? formatDate(selectedOrder.delivery_date)
                        : 'No definida'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">Tipo de Entrega</p>
                    <p className="font-medium flex items-center gap-1">
                      {selectedOrder.delivery_type === 'delivery' ? (
                        <>
                          <Truck className="w-4 h-4" /> Domicilio
                        </>
                      ) : (
                        <>
                          <Package className="w-4 h-4" /> Recoger en tienda
                        </>
                      )}
                    </p>
                  </div>
                  {selectedOrder.delivery_zone_name && (
                    <div>
                      <p className="text-xs text-blue-600">Zona</p>
                      <p className="font-medium">{selectedOrder.delivery_zone_name}</p>
                      {selectedOrder.delivery_fee && (
                        <p className="text-sm text-slate-500">
                          Envío: {formatCurrency(selectedOrder.delivery_fee)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Status Actions */}
                {selectedOrder.status !== 'cancelled' &&
                  selectedOrder.status !== 'delivered' && (
                    <div className="mb-6 p-4 border border-slate-200 rounded-lg">
                      <p className="text-sm font-medium text-slate-700 mb-3">
                        Cambiar Estado del Encargo
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_FLOW.map((status) => {
                          const isCurrent = status === selectedOrder.status;
                          const currentIndex = STATUS_FLOW.indexOf(selectedOrder.status);
                          const statusIndex = STATUS_FLOW.indexOf(status);
                          const isNext = statusIndex === currentIndex + 1;

                          return (
                            <button
                              key={status}
                              onClick={() => handleUpdateStatus(status)}
                              disabled={changingStatus || isCurrent || statusIndex <= currentIndex}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                isCurrent
                                  ? 'bg-brand-500 text-white'
                                  : isNext
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : statusIndex < currentIndex
                                  ? 'bg-slate-100 text-slate-400'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              {STATUS_LABELS[status]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* Items */}
                <div className="mb-6">
                  <h3 className="font-semibold mb-3">Items del Encargo</h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left p-3">Producto</th>
                          <th className="text-center p-3">Cant.</th>
                          <th className="text-right p-3">Precio</th>
                          <th className="text-center p-3">Estado</th>
                          <th className="text-center p-3">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items?.map((item) => (
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="p-3">
                              <p className="font-medium">
                                {item.product_name || item.garment_type_name || 'Item'}
                              </p>
                              {item.product_code && (
                                <p className="text-slate-500 text-xs">
                                  {item.product_code}
                                  {item.product_size && ` - ${item.product_size}`}
                                </p>
                              )}
                              {item.embroidery_text && (
                                <p className="text-xs text-blue-600 mt-1">
                                  Bordado: {item.embroidery_text}
                                </p>
                              )}
                              {item.reserved_from_stock && (
                                <span className="badge badge-info text-xs mt-1">
                                  Stock reservado: {item.quantity_reserved}
                                </span>
                              )}
                            </td>
                            <td className="text-center p-3">{item.quantity}</td>
                            <td className="text-right p-3">
                              {formatCurrency(item.unit_price)}
                            </td>
                            <td className="text-center p-3">
                              <span
                                className={`badge ${STATUS_COLORS[item.item_status]}`}
                              >
                                {STATUS_LABELS[item.item_status]}
                              </span>
                            </td>
                            <td className="text-center p-3">
                              {item.item_status !== 'delivered' &&
                                item.item_status !== 'cancelled' && (
                                  <div className="flex justify-center gap-1">
                                    {getNextStatus(item.item_status) && (
                                      <button
                                        onClick={() =>
                                          handleUpdateItemStatus(
                                            item.id,
                                            getNextStatus(item.item_status)!
                                          )
                                        }
                                        disabled={changingItemStatus === item.id}
                                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                                        title={`Pasar a ${
                                          STATUS_LABELS[getNextStatus(item.item_status)!]
                                        }`}
                                      >
                                        {changingItemStatus === item.id ? (
                                          <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Play className="w-4 h-4" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payments */}
                {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-3">Pagos Registrados</h3>
                    <div className="space-y-2">
                      {selectedOrder.payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex justify-between items-center p-3 bg-green-50 rounded-lg"
                        >
                          <div>
                            <span className="font-medium text-green-700">
                              {formatCurrency(payment.amount)}
                            </span>
                            <span className="text-sm text-green-600 ml-2">
                              {PAYMENT_METHODS.find((m) => m.value === payment.payment_method)
                                ?.label || payment.payment_method}
                            </span>
                          </div>
                          <span className="text-sm text-slate-500">
                            {formatDateTime(payment.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedOrder.notes && (
                  <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
                    <p className="text-xs text-yellow-700 mb-1">Notas</p>
                    <p className="text-sm text-slate-700">{selectedOrder.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-200">
                  <button onClick={closeDetailModal} className="btn-secondary">
                    Cerrar
                  </button>
                  {selectedOrder.status !== 'cancelled' &&
                    selectedOrder.status !== 'delivered' && (
                      <>
                        {selectedOrder.balance > 0 && (
                          <button
                            onClick={openPaymentModal}
                            className="btn-primary flex items-center gap-2"
                          >
                            <DollarSign className="w-4 h-4" />
                            Agregar Pago
                          </button>
                        )}
                        <button
                          onClick={handleCancelOrder}
                          disabled={changingStatus}
                          className="btn-danger flex items-center gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancelar Encargo
                        </button>
                      </>
                    )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Agregar Pago</h2>
            <p className="text-slate-600 mb-4">
              Saldo pendiente:{' '}
              <span className="font-bold text-orange-600">
                {formatCurrency(selectedOrder.balance)}
              </span>
            </p>

            <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
                <label className="admin-label">Monto *</label>
                <input
                  type="number"
                  value={paymentData.amount}
                  onChange={(e) =>
                    setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })
                  }
                  className="admin-input"
                  required
                  min={1}
                  step={100}
                />
              </div>

              <div>
                <label className="admin-label">Método de Pago *</label>
                <select
                  value={paymentData.payment_method}
                  onChange={(e) =>
                    setPaymentData({
                      ...paymentData,
                      payment_method: e.target.value as PaymentMethod,
                    })
                  }
                  className={`admin-input ${!paymentData.payment_method ? 'border-red-300 text-gray-400' : ''}`}
                  required
                >
                  <option value="" disabled>-- Seleccione método --</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
                {!paymentData.payment_method && (
                  <p className="text-xs text-red-500 mt-1">Debe seleccionar un método de pago</p>
                )}
              </div>

              <div>
                <label className="admin-label">Referencia</label>
                <input
                  type="text"
                  value={paymentData.reference}
                  onChange={(e) =>
                    setPaymentData({ ...paymentData, reference: e.target.value })
                  }
                  className="admin-input"
                  placeholder="Número de transacción (opcional)"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPayment || !paymentData.payment_method}
                  className="btn-primary flex-1"
                >
                  {savingPayment ? 'Guardando...' : 'Registrar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      <CreateOrderModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedDraftId(null);
        }}
        onSuccess={() => {
          loadOrders();
          setShowCreateModal(false);
          setSelectedDraftId(null);
        }}
        draftId={selectedDraftId}
        onMinimize={() => {
          setShowCreateModal(false);
          setSelectedDraftId(null);
        }}
      />
    </div>
  );
}
