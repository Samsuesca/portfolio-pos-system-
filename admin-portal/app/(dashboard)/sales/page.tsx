'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  Eye,
  DollarSign,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  ShoppingCart,
  X,
  Filter,
  Plus,
} from 'lucide-react';
import salesService from '@/lib/services/salesService';
import schoolService from '@/lib/services/schoolService';
import SaleModal from '@/components/vendor/SaleModal';
import type {
  Sale,
  SaleWithItems,
  SaleChange,
  School,
  SaleStatus,
  PaymentMethod,
  ChangeType,
  ChangeStatus,
} from '@/lib/api';
import { useAdminAuth } from '@/lib/adminAuth';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'credit', label: 'Crédito' },
];

const STATUS_LABELS: Record<SaleStatus, string> = {
  pending: 'Pendiente',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const STATUS_COLORS: Record<SaleStatus, string> = {
  pending: 'badge-warning',
  completed: 'badge-success',
  cancelled: 'badge-error',
};

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  size_change: 'Cambio de talla',
  product_change: 'Cambio de producto',
  return: 'Devolución',
  defect: 'Defecto',
};

const CHANGE_STATUS_LABELS: Record<ChangeStatus, string> = {
  pending: 'Pendiente',
  pending_stock: 'Pendiente Stock',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

const CHANGE_STATUS_COLORS: Record<ChangeStatus, string> = {
  pending: 'badge-warning',
  pending_stock: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-error',
};

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
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function SalesPage() {
  const { user } = useAdminAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Detail Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null);
  const [saleChanges, setSaleChanges] = useState<SaleChange[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    payment_method: '' as PaymentMethod | '',
    reference: '',
  });
  const [savingPayment, setSavingPayment] = useState(false);

  // Change Approval Modal
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedChange, setSelectedChange] = useState<SaleChange | null>(null);
  const [approvePaymentMethod, setApprovePaymentMethod] = useState<PaymentMethod | ''>('');
  const [savingApproval, setSavingApproval] = useState(false);

  // New Sale Modal
  const [showSaleModal, setShowSaleModal] = useState(false);

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

  const loadSales = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (selectedSchool) params.school_id = selectedSchool;
      if (selectedStatus) params.status = selectedStatus;
      if (searchTerm) params.search = searchTerm;
      const data = await salesService.list(params);
      setSales(data);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cargar ventas'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  useEffect(() => {
    loadSales();
  }, [selectedSchool, selectedStatus]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadSales();
  };

  const openDetailModal = async (sale: Sale) => {
    setLoadingDetail(true);
    setShowDetailModal(true);
    try {
      const [saleDetail, changes] = await Promise.all([
        salesService.getWithItems(sale.school_id, sale.id),
        salesService.getChanges(sale.school_id, sale.id),
      ]);
      setSelectedSale(saleDetail);
      setSaleChanges(changes);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cargar detalle'));
      setShowDetailModal(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedSale(null);
    setSaleChanges([]);
  };

  const openPaymentModal = () => {
    if (!selectedSale) return;
    const remaining = selectedSale.total - selectedSale.paid_amount;
    setPaymentData({
      amount: remaining > 0 ? remaining : 0,
      payment_method: '',
      reference: '',
    });
    setShowPaymentModal(true);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) return;

    setSavingPayment(true);
    try {
      await salesService.addPayment(selectedSale.school_id, selectedSale.id, {
        amount: paymentData.amount,
        payment_method: paymentData.payment_method as PaymentMethod,
        reference: paymentData.reference || undefined,
        create_accounting_entry: true,
      });
      setShowPaymentModal(false);
      // Reload sale detail
      const [saleDetail, changes] = await Promise.all([
        salesService.getWithItems(selectedSale.school_id, selectedSale.id),
        salesService.getChanges(selectedSale.school_id, selectedSale.id),
      ]);
      setSelectedSale(saleDetail);
      setSaleChanges(changes);
      loadSales();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al agregar pago'));
    } finally {
      setSavingPayment(false);
    }
  };

  const openApproveModal = (change: SaleChange) => {
    setSelectedChange(change);
    setApprovePaymentMethod('cash');
    setShowApproveModal(true);
  };

  const handleApproveChange = async () => {
    if (!selectedSale || !selectedChange) return;

    setSavingApproval(true);
    try {
      await salesService.approveChange(
        selectedSale.school_id,
        selectedSale.id,
        selectedChange.id,
        { payment_method: approvePaymentMethod as PaymentMethod }
      );
      setShowApproveModal(false);
      // Reload changes
      const changes = await salesService.getChanges(selectedSale.school_id, selectedSale.id);
      setSaleChanges(changes);
      loadSales();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al aprobar cambio'));
    } finally {
      setSavingApproval(false);
    }
  };

  const handleRejectChange = async (change: SaleChange) => {
    if (!selectedSale) return;
    if (!confirm('¿Estás seguro de rechazar este cambio?')) return;

    try {
      await salesService.rejectChange(selectedSale.school_id, selectedSale.id, change.id);
      const changes = await salesService.getChanges(selectedSale.school_id, selectedSale.id);
      setSaleChanges(changes);
      loadSales();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al rechazar cambio'));
    }
  };

  const accessibleSchools = getAccessibleSchools();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">Ventas</h1>
          <p className="text-slate-600 mt-1">Gestiona las ventas del sistema</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadSales}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={() => setShowSaleModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nueva Venta
          </button>
        </div>
      </div>

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
              className="admin-input min-w-[130px]"
            >
              <option value="">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="completed">Completada</option>
              <option value="cancelled">Cancelada</option>
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

      {/* Sales Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Colegio</th>
                <th>Total</th>
                <th>Pagado</th>
                <th>Estado</th>
                <th>Fecha</th>
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
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                    <p className="text-slate-500">No hay ventas registradas</p>
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50">
                    <td className="font-mono font-medium text-brand-600">{sale.code}</td>
                    <td>{sale.client_name || 'Sin cliente'}</td>
                    <td className="text-sm text-slate-600">{sale.school_name}</td>
                    <td className="font-medium">{formatCurrency(sale.total)}</td>
                    <td
                      className={
                        sale.paid_amount >= sale.total ? 'text-green-600' : 'text-orange-600'
                      }
                    >
                      {formatCurrency(sale.paid_amount)}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[sale.status]}`}>
                        {STATUS_LABELS[sale.status]}
                      </span>
                    </td>
                    <td className="text-sm text-slate-500">{formatDate(sale.sale_date)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openDetailModal(sale)}
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
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
            {loadingDetail ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-brand-500"></div>
              </div>
            ) : selectedSale ? (
              <>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Venta {selectedSale.code}
                    </h2>
                    <p className="text-slate-600">{selectedSale.school_name}</p>
                  </div>
                  <button
                    onClick={closeDetailModal}
                    className="p-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Sale Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-xs text-slate-500">Cliente</p>
                    <p className="font-medium">
                      {selectedSale.client_name || 'Sin cliente'}
                    </p>
                    {selectedSale.client_phone && (
                      <p className="text-sm text-slate-500">{selectedSale.client_phone}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="font-bold text-lg">{formatCurrency(selectedSale.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Pagado</p>
                    <p
                      className={`font-bold text-lg ${
                        selectedSale.paid_amount >= selectedSale.total
                          ? 'text-green-600'
                          : 'text-orange-600'
                      }`}
                    >
                      {formatCurrency(selectedSale.paid_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Estado</p>
                    <span className={`badge ${STATUS_COLORS[selectedSale.status]}`}>
                      {STATUS_LABELS[selectedSale.status]}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className="mb-6">
                  <h3 className="font-semibold mb-3">Productos</h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left p-3">Producto</th>
                          <th className="text-center p-3">Cant.</th>
                          <th className="text-right p-3">Precio</th>
                          <th className="text-right p-3">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSale.items?.map((item) => (
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="p-3">
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-slate-500 text-xs">
                                {item.product_code} - {item.product_size}
                              </p>
                            </td>
                            <td className="text-center p-3">{item.quantity}</td>
                            <td className="text-right p-3">
                              {formatCurrency(item.unit_price)}
                            </td>
                            <td className="text-right p-3 font-medium">
                              {formatCurrency(item.subtotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payments */}
                {selectedSale.payments && selectedSale.payments.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-3">Pagos</h3>
                    <div className="space-y-2">
                      {selectedSale.payments.map((payment) => (
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
                            {formatDate(payment.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Changes */}
                {saleChanges.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-3">Cambios/Devoluciones</h3>
                    <div className="space-y-3">
                      {saleChanges.map((change) => (
                        <div
                          key={change.id}
                          className="p-4 border border-slate-200 rounded-lg"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-medium">
                                {CHANGE_TYPE_LABELS[change.change_type]}
                              </span>
                              <span
                                className={`badge ${
                                  CHANGE_STATUS_COLORS[change.status]
                                } ml-2`}
                              >
                                {CHANGE_STATUS_LABELS[change.status]}
                              </span>
                            </div>
                            {change.status === 'pending' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => openApproveModal(change)}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  title="Aprobar"
                                >
                                  <CheckCircle className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleRejectChange(change)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  title="Rechazar"
                                >
                                  <XCircle className="w-5 h-5" />
                                </button>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-slate-600">
                            Cantidad: {change.quantity}
                            {Number(change.price_difference) !== 0 && (
                              <span
                                className={
                                  Number(change.price_difference) > 0
                                    ? 'text-green-600 ml-2'
                                    : 'text-red-600 ml-2'
                                }
                              >
                                Diferencia: {formatCurrency(Number(change.price_difference))}
                              </span>
                            )}
                          </p>
                          {change.reason && (
                            <p className="text-sm text-slate-500 mt-1">
                              Razón: {change.reason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <button onClick={closeDetailModal} className="btn-secondary flex-1">
                    Cerrar
                  </button>
                  {selectedSale.status === 'pending' &&
                    selectedSale.paid_amount < selectedSale.total && (
                      <button
                        onClick={openPaymentModal}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                      >
                        <DollarSign className="w-4 h-4" />
                        Agregar Pago
                      </button>
                    )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Agregar Pago</h2>
            <p className="text-slate-600 mb-4">
              Saldo pendiente:{' '}
              <span className="font-bold text-orange-600">
                {formatCurrency(selectedSale.total - selectedSale.paid_amount)}
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

      {/* Approve Change Modal */}
      {showApproveModal && selectedChange && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Aprobar Cambio</h2>
            <p className="text-slate-600 mb-4">
              {CHANGE_TYPE_LABELS[selectedChange.change_type]} - Cantidad:{' '}
              {selectedChange.quantity}
            </p>
            {Number(selectedChange.price_difference) !== 0 && (
              <p className="mb-4">
                <span className="text-slate-600">Diferencia de precio: </span>
                <span
                  className={`font-bold ${
                    Number(selectedChange.price_difference) > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(Number(selectedChange.price_difference))}
                </span>
              </p>
            )}

            <div className="mb-4">
              <label className="admin-label">Método de Pago (si aplica)</label>
              <select
                value={approvePaymentMethod}
                onChange={(e) => setApprovePaymentMethod(e.target.value as PaymentMethod)}
                className={`admin-input ${!approvePaymentMethod ? 'border-red-300 text-gray-400' : ''}`}
              >
                <option value="" disabled>-- Seleccione método --</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
              {!approvePaymentMethod && (
                <p className="text-xs text-red-500 mt-1">Debe seleccionar un método de pago</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowApproveModal(false)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleApproveChange}
                disabled={savingApproval || !approvePaymentMethod}
                className="btn-primary flex-1"
              >
                {savingApproval ? 'Aprobando...' : 'Aprobar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Sale Modal */}
      <SaleModal
        isOpen={showSaleModal}
        onClose={() => setShowSaleModal(false)}
        onSuccess={() => {
          setShowSaleModal(false);
          loadSales();
        }}
      />
    </div>
  );
}
