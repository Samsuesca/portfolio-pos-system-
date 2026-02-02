'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCcw,
  Loader2,
  AlertCircle,
  Filter,
  ShoppingCart,
  ClipboardList,
  Package,
  Eye,
  ArrowRight,
} from 'lucide-react';
import salesService from '@/lib/services/salesService';
import orderChangesService, { OrderChangeListItem } from '@/lib/services/orderChangesService';
import type { SaleChangeListItem, PaymentMethod, ChangeType, ChangeStatus } from '@/lib/api';
import { useAdminAuth } from '@/lib/adminAuth';
import Link from 'next/link';
import SaleChangeDetailModal from '@/components/SaleChangeDetailModal';

type ActiveTab = 'sales' | 'orders';

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  size_change: 'Cambio de talla',
  product_change: 'Cambio de producto',
  return: 'Devolucion',
  defect: 'Defecto',
};

const CHANGE_STATUS_LABELS: Record<ChangeStatus, string> = {
  pending: 'Pendiente',
  pending_stock: 'Esperando Stock',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

const CHANGE_STATUS_COLORS: Record<ChangeStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  pending_stock: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
];

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
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function SaleChangesPage() {
  const { user } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('sales');

  // Sale Changes State
  const [saleChanges, setSaleChanges] = useState<SaleChangeListItem[]>([]);
  const [saleLoading, setSaleLoading] = useState(true);
  const [saleError, setSaleError] = useState<string | null>(null);

  // Order Changes State
  const [orderChanges, setOrderChanges] = useState<OrderChangeListItem[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Processing state
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Approval Modal
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedChange, setSelectedChange] = useState<SaleChangeListItem | OrderChangeListItem | null>(null);
  const [approvePaymentMethod, setApprovePaymentMethod] = useState<PaymentMethod>('cash');
  const [savingApproval, setSavingApproval] = useState(false);

  // Rejection Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [savingRejection, setSavingRejection] = useState(false);

  // Detail Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetailChange, setSelectedDetailChange] = useState<SaleChangeListItem | undefined>(undefined);
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);

  // Load sale changes on mount
  useEffect(() => {
    loadSaleChanges();
  }, []);

  // Load order changes when tab switches
  useEffect(() => {
    if (activeTab === 'orders' && orderChanges.length === 0 && !orderLoading) {
      loadOrderChanges();
    }
  }, [activeTab]);

  const loadSaleChanges = async () => {
    try {
      setSaleLoading(true);
      setSaleError(null);
      const changes = await salesService.getAllChanges({ limit: 500 });
      setSaleChanges(changes);
    } catch (err) {
      setSaleError('Error al cargar cambios de ventas');
      console.error('Error loading sale changes:', err);
    } finally {
      setSaleLoading(false);
    }
  };

  const loadOrderChanges = async () => {
    try {
      setOrderLoading(true);
      setOrderError(null);
      const changes = await orderChangesService.getAllChanges({ limit: 500 });
      setOrderChanges(changes);
    } catch (err) {
      setOrderError('Error al cargar cambios de encargos');
      console.error('Error loading order changes:', err);
    } finally {
      setOrderLoading(false);
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'sales') {
      loadSaleChanges();
    } else {
      loadOrderChanges();
    }
  };

  // Open approval modal
  const handleApproveClick = (change: SaleChangeListItem | OrderChangeListItem) => {
    setSelectedChange(change);
    setApprovePaymentMethod('cash');
    setShowApproveModal(true);
  };

  // Handle approval
  const handleApprove = async () => {
    if (!selectedChange) return;

    try {
      setSavingApproval(true);
      setProcessingId(selectedChange.id);

      if (activeTab === 'sales') {
        const saleChange = selectedChange as SaleChangeListItem;
        if (!saleChange.school_id) {
          throw new Error('school_id es requerido para aprobar cambio de venta');
        }
        await salesService.approveChange(
          saleChange.school_id,
          saleChange.sale_id,
          saleChange.id,
          { payment_method: approvePaymentMethod }
        );
        loadSaleChanges();
      } else {
        const orderChange = selectedChange as OrderChangeListItem;
        if (!orderChange.school_id) {
          throw new Error('school_id es requerido para aprobar cambio de pedido');
        }
        await orderChangesService.approveChange(
          orderChange.school_id,
          orderChange.order_id,
          orderChange.id,
          approvePaymentMethod
        );
        loadOrderChanges();
      }

      setShowApproveModal(false);
      setSelectedChange(null);
    } catch (err) {
      alert('Error al aprobar cambio');
      console.error('Error approving change:', err);
    } finally {
      setSavingApproval(false);
      setProcessingId(null);
    }
  };

  // Open rejection modal
  const handleRejectClick = (change: SaleChangeListItem | OrderChangeListItem) => {
    setSelectedChange(change);
    setRejectReason('');
    setShowRejectModal(true);
  };

  // Handle rejection
  const handleReject = async () => {
    if (!selectedChange || !rejectReason.trim()) return;

    try {
      setSavingRejection(true);
      setProcessingId(selectedChange.id);

      if (activeTab === 'sales') {
        const saleChange = selectedChange as SaleChangeListItem;
        if (!saleChange.school_id) {
          throw new Error('school_id es requerido para rechazar cambio de venta');
        }
        await salesService.rejectChange(
          saleChange.school_id,
          saleChange.sale_id,
          saleChange.id,
          { reason: rejectReason.trim() }
        );
        loadSaleChanges();
      } else {
        const orderChange = selectedChange as OrderChangeListItem;
        if (!orderChange.school_id) {
          throw new Error('school_id es requerido para rechazar cambio de pedido');
        }
        await orderChangesService.rejectChange(
          orderChange.school_id,
          orderChange.order_id,
          orderChange.id,
          rejectReason.trim()
        );
        loadOrderChanges();
      }

      setShowRejectModal(false);
      setSelectedChange(null);
      setRejectReason('');
    } catch (err) {
      alert('Error al rechazar cambio');
      console.error('Error rejecting change:', err);
    } finally {
      setSavingRejection(false);
      setProcessingId(null);
    }
  };

  // Filter changes
  const filterChanges = <T extends SaleChangeListItem | OrderChangeListItem>(changes: T[]): T[] => {
    return changes.filter(change => {
      const matchesStatus = statusFilter === '' || change.status === statusFilter;
      const matchesType = typeFilter === '' || change.change_type === typeFilter;
      return matchesStatus && matchesType;
    });
  };

  const filteredSaleChanges = filterChanges(saleChanges);
  const filteredOrderChanges = filterChanges(orderChanges);

  // Stats
  const salePendingCount = saleChanges.filter(c => c.status === 'pending').length;
  const saleApprovedCount = saleChanges.filter(c => c.status === 'approved').length;
  const saleRejectedCount = saleChanges.filter(c => c.status === 'rejected').length;

  const orderPendingCount = orderChanges.filter(c => c.status === 'pending').length;
  const orderApprovedCount = orderChanges.filter(c => c.status === 'approved').length;
  const orderRejectedCount = orderChanges.filter(c => c.status === 'rejected').length;

  const activePendingCount = activeTab === 'sales' ? salePendingCount : orderPendingCount;
  const activeApprovedCount = activeTab === 'sales' ? saleApprovedCount : orderApprovedCount;
  const activeRejectedCount = activeTab === 'sales' ? saleRejectedCount : orderRejectedCount;

  const activeLoading = activeTab === 'sales' ? saleLoading : orderLoading;
  const activeError = activeTab === 'sales' ? saleError : orderError;
  const activeFilteredChanges = activeTab === 'sales' ? filteredSaleChanges : filteredOrderChanges;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <RefreshCcw className="w-7 h-7 text-brand-500" />
            Cambios y Devoluciones
          </h1>
          <p className="text-slate-500 mt-1">
            Gestion de cambios de talla, producto y devoluciones
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={activeLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${activeLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'sales'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Ventas
          {salePendingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">
              {salePendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'orders'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <ClipboardList className="w-4 h-4 mr-2" />
          Encargos / Pedidos Web
          {orderPendingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">
              {orderPendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-900">{activePendingCount}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700">Aprobados</p>
              <p className="text-2xl font-bold text-green-900">{activeApprovedCount}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700">Rechazados</p>
              <p className="text-2xl font-bold text-red-900">{activeRejectedCount}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Filtros:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="pending_stock">Esperando Stock</option>
            <option value="approved">Aprobados</option>
            <option value="rejected">Rechazados</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
          >
            <option value="">Todos los tipos</option>
            <option value="size_change">Cambio de Talla</option>
            <option value="product_change">Cambio de Producto</option>
            <option value="return">Devolucion</option>
            <option value="defect">Producto Defectuoso</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {activeError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {activeError}
          <button onClick={handleRefresh} className="ml-auto underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Loading */}
      {activeLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      )}

      {/* Empty State */}
      {!activeLoading && activeFilteredChanges.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          {activeTab === 'sales' ? (
            <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          ) : (
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          )}
          <p className="text-slate-500">
            {statusFilter || typeFilter
              ? 'No se encontraron cambios con los filtros aplicados'
              : activeTab === 'sales'
              ? 'No hay cambios de ventas registrados'
              : 'No hay cambios de encargos registrados'}
          </p>
        </div>
      )}

      {/* Sale Changes Table */}
      {activeTab === 'sales' && !saleLoading && filteredSaleChanges.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Venta
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Fecha
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Tipo
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Producto Original
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Producto Nuevo
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Cant.
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Ajuste
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Estado
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSaleChanges.map((change) => {
                  const isProcessing = processingId === change.id;
                  const isPending = change.status === 'pending';

                  return (
                    <tr key={change.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <Link
                          href={`/sales/${change.sale_id}`}
                          className="text-sm font-medium text-brand-600 hover:text-brand-800"
                        >
                          {change.sale_code}
                        </Link>
                        {change.school_name && (
                          <p className="text-xs text-slate-500">{change.school_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {formatDate(change.change_date)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm">
                          {CHANGE_TYPE_LABELS[change.change_type as ChangeType] || change.change_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {change.original_product_code ? (
                          <div>
                            <span className="font-mono text-xs text-slate-600">{change.original_product_code}</span>
                            <p className="text-slate-900 truncate max-w-[140px]" title={change.original_product_name || ''}>
                              {change.original_product_name || '-'}
                            </p>
                            {change.original_product_size && (
                              <span className="text-xs text-slate-500">Talla: {change.original_product_size}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {change.new_product_code ? (
                          <div className="flex items-start gap-1">
                            <ArrowRight className="w-3 h-3 text-slate-400 mt-1 flex-shrink-0" />
                            <div>
                              <span className="font-mono text-xs text-slate-600">{change.new_product_code}</span>
                              <p className="text-slate-900 truncate max-w-[140px]" title={change.new_product_name || ''}>
                                {change.new_product_name || '-'}
                              </p>
                              {change.new_product_size && (
                                <span className="text-xs text-slate-500">Talla: {change.new_product_size}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Devolucion</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="text-red-600">{change.returned_quantity}</span>
                        {change.new_quantity > 0 && (
                          <>
                            <span className="text-slate-400 mx-1">→</span>
                            <span className="text-green-600">{change.new_quantity}</span>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={change.price_adjustment >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {change.price_adjustment >= 0 ? '+' : ''}{formatCurrency(change.price_adjustment)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${CHANGE_STATUS_COLORS[change.status as ChangeStatus] || 'bg-slate-100 text-slate-700'}`}>
                          {CHANGE_STATUS_LABELS[change.status as ChangeStatus] || change.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedDetailId(change.id);
                              setSelectedDetailChange(change);
                              setShowDetailModal(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded transition"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {isPending && !isProcessing && (
                            <>
                              <button
                                onClick={() => handleApproveClick(change)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"
                                title="Aprobar"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRejectClick(change)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                                title="Rechazar"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {isProcessing && (
                            <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Changes Table */}
      {activeTab === 'orders' && !orderLoading && filteredOrderChanges.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Encargo
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Colegio
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Fecha
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Tipo
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Cant. Dev.
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Cant. Nueva
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Ajuste
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Estado
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Motivo
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrderChanges.map((change) => {
                  const isProcessing = processingId === change.id;
                  const isPending = change.status === 'pending';

                  return (
                    <tr key={change.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <Link
                          href={`/orders?order=${change.order_id}`}
                          className="text-sm font-medium text-brand-600 hover:underline flex items-center gap-1"
                        >
                          {change.order_code}
                          <Eye className="w-3 h-3" />
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {change.school_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDate(change.change_date)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm">
                          {CHANGE_TYPE_LABELS[change.change_type as ChangeType] || change.change_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900 text-right">
                        {change.returned_quantity}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900 text-right">
                        {change.new_quantity}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={change.price_adjustment >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {formatCurrency(change.price_adjustment)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${CHANGE_STATUS_COLORS[change.status as ChangeStatus] || 'bg-slate-100 text-slate-700'}`}>
                          {CHANGE_STATUS_LABELS[change.status as ChangeStatus] || change.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                        {change.reason || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {isPending && !isProcessing && (
                            <>
                              <button
                                onClick={() => handleApproveClick(change)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"
                                title="Aprobar"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRejectClick(change)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                                title="Rechazar"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {isProcessing && (
                            <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApproveModal && selectedChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowApproveModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Aprobar Cambio
            </h3>

            {selectedChange.price_adjustment !== 0 && (
              <div className={`mb-4 p-4 rounded-lg ${
                selectedChange.price_adjustment < 0
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-green-50 border border-green-200'
              }`}>
                <p className="text-sm font-medium mb-1">
                  {selectedChange.price_adjustment < 0
                    ? 'Reembolso al cliente:'
                    : 'Cobro adicional:'}
                </p>
                <p className={`text-xl font-bold ${
                  selectedChange.price_adjustment < 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {formatCurrency(Math.abs(selectedChange.price_adjustment))}
                </p>
              </div>
            )}

            {selectedChange.price_adjustment === 0 && (
              <div className="mb-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm font-medium text-blue-800">
                  Cambio sin ajuste de precio
                </p>
                <p className="text-sm text-blue-700">
                  Este cambio no requiere reembolso ni cobro adicional.
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Metodo de Pago
              </label>
              <select
                value={approvePaymentMethod}
                onChange={(e) => setApprovePaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowApproveModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleApprove}
                disabled={savingApproval}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingApproval && <Loader2 className="w-4 h-4 animate-spin" />}
                Aprobar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && selectedChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowRejectModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Rechazar Cambio
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Motivo del Rechazo *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Escribe el motivo por el cual se rechaza este cambio..."
                rows={4}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
                autoFocus
              />
              <p className="mt-1 text-xs text-slate-500">
                Este motivo sera visible para el vendedor que solicito el cambio.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={savingRejection || !rejectReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingRejection && <Loader2 className="w-4 h-4 animate-spin" />}
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <SaleChangeDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedDetailId(null);
          setSelectedDetailChange(undefined);
        }}
        changeId={selectedDetailId}
        change={selectedDetailChange}
      />
    </div>
  );
}
