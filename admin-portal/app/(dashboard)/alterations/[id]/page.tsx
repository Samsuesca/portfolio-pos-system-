'use client';

/**
 * Alteration Detail Page - View complete alteration information with payments
 */
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  User,
  Scissors,
  AlertCircle,
  Loader2,
  CheckCircle,
  Clock,
  DollarSign,
  Phone,
  Edit,
  Banknote,
  MessageCircle,
  X,
  Wrench,
} from 'lucide-react';
import alterationService, {
  AlterationWithPayments,
  AlterationPayment,
  AlterationStatus,
  AlterationUpdate,
  AlterationPaymentCreate,
  ALTERATION_TYPE_LABELS,
  ALTERATION_STATUS_LABELS,
  ALTERATION_STATUS_COLORS,
} from '@/lib/services/alterationService';
import type { PaymentMethod } from '@/lib/api';
import DatePicker from '@/components/ui/DatePicker';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  nequi: 'Nequi',
  transfer: 'Transferencia',
  card: 'Tarjeta',
};

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
];

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value);
};

export default function AlterationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const alterationId = params.id as string;

  const [alteration, setAlteration] = useState<AlterationWithPayments | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editData, setEditData] = useState<AlterationUpdate>({});

  // Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentData, setPaymentData] = useState<AlterationPaymentCreate>({
    amount: 0,
    payment_method: 'cash',
  });

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
        setError('ID de arreglo no valido');
        return;
      }

      const data = await alterationService.getById(alterationId);
      setAlteration(data);
    } catch (err: any) {
      console.error('Error loading alteration detail:', err);
      setError(
        err.response?.data?.detail || 'Error al cargar los detalles del arreglo'
      );
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

  const handleOpenEditModal = () => {
    if (!alteration) return;
    setEditData({
      alteration_type: alteration.alteration_type,
      garment_name: alteration.garment_name,
      description: alteration.description,
      cost: alteration.cost,
      estimated_delivery_date: alteration.estimated_delivery_date || undefined,
      notes: alteration.notes || undefined,
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!alterationId) return;

    try {
      setSavingEdit(true);
      await alterationService.update(alterationId, editData);
      setShowEditModal(false);
      await loadAlterationDetail();
    } catch (err: any) {
      console.error('Error updating alteration:', err);
      alert(err.response?.data?.detail || 'Error al actualizar arreglo');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleOpenPaymentModal = () => {
    if (!alteration) return;
    setPaymentData({
      amount: alteration.balance,
      payment_method: 'cash',
    });
    setShowPaymentModal(true);
  };

  const handleSavePayment = async () => {
    if (!alterationId || paymentData.amount <= 0) return;

    try {
      setSavingPayment(true);
      await alterationService.recordPayment(alterationId, paymentData);
      setShowPaymentModal(false);
      await loadAlterationDetail();
    } catch (err: any) {
      console.error('Error recording payment:', err);
      alert(err.response?.data?.detail || 'Error al registrar pago');
    } finally {
      setSavingPayment(false);
    }
  };

  const openWhatsApp = (phone: string, message?: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('57')
      ? cleanPhone
      : `57${cleanPhone}`;
    const url = message
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/${formattedPhone}`;
    window.open(url, '_blank');
  };

  // Get next valid status transitions
  const getNextStatuses = (current: AlterationStatus): AlterationStatus[] => {
    const transitions: Record<AlterationStatus, AlterationStatus[]> = {
      pending: ['in_progress', 'cancelled'],
      in_progress: ['ready', 'pending', 'cancelled'],
      ready: ['delivered', 'in_progress'],
      delivered: [],
      cancelled: ['pending'],
    };
    return transitions[current] || [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (error || !alteration) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/alterations')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Arreglos
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error || 'Arreglo no encontrado'}</p>
        </div>
      </div>
    );
  }

  const nextStatuses = getNextStatuses(alteration.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/alterations')}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Scissors className="w-7 h-7 text-brand-500" />
              {alteration.code}
            </h1>
            <p className="text-slate-500 mt-1">
              {ALTERATION_TYPE_LABELS[alteration.alteration_type]} -{' '}
              {alteration.garment_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenEditModal}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
          >
            <Edit className="w-4 h-4" />
            Editar
          </button>
          {alteration.balance > 0 && (
            <button
              onClick={handleOpenPaymentModal}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-medium text-slate-900 mb-4">Estado</h2>
            <div className="flex items-center gap-4 flex-wrap">
              <span
                className={`px-3 py-1.5 text-sm rounded-full font-medium ${ALTERATION_STATUS_COLORS[alteration.status]}`}
              >
                {ALTERATION_STATUS_LABELS[alteration.status]}
              </span>
              {nextStatuses.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Cambiar a:</span>
                  {nextStatuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      disabled={updatingStatus}
                      className={`px-3 py-1.5 text-sm rounded-full border transition ${
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-medium text-slate-900 mb-4">
              Descripcion del Trabajo
            </h2>
            <p className="text-slate-700 whitespace-pre-wrap">
              {alteration.description}
            </p>
            {alteration.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-sm text-slate-500 mb-2">
                  Notas adicionales:
                </p>
                <p className="text-slate-700">{alteration.notes}</p>
              </div>
            )}
          </div>

          {/* Payments History */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-slate-900">
                Historial de Pagos
              </h2>
              <span className="text-sm text-slate-500">
                {alteration.payments?.length || 0} pago(s)
              </span>
            </div>
            {!alteration.payments || alteration.payments.length === 0 ? (
              <p className="text-slate-500 text-center py-4">
                No hay pagos registrados
              </p>
            ) : (
              <div className="space-y-3">
                {alteration.payments.map((payment: AlterationPayment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {formatCurrency(payment.amount)}
                        </p>
                        <p className="text-sm text-slate-500">
                          {PAYMENT_METHOD_LABELS[payment.payment_method] ||
                            payment.payment_method}
                          {payment.notes && ` - ${payment.notes}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-600">
                        {formatDateTime(payment.created_at)}
                      </p>
                      {payment.created_by_username && (
                        <p className="text-xs text-slate-400">
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-medium text-slate-900 mb-4">Cliente</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-slate-400" />
                <span className="text-slate-900">
                  {alteration.client_display_name}
                </span>
              </div>
              {alteration.external_client_phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-700">
                    {alteration.external_client_phone}
                  </span>
                  <button
                    onClick={() =>
                      openWhatsApp(
                        alteration.external_client_phone!,
                        `Hola ${alteration.client_display_name}, me comunico de Uniformes Consuelo respecto a su arreglo ${alteration.code}.`
                      )
                    }
                    className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition"
                    title="Abrir WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                </div>
              )}
              {alteration.client_id ? (
                <p className="text-xs text-slate-400">Cliente registrado</p>
              ) : (
                <p className="text-xs text-slate-400">Cliente externo</p>
              )}
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-medium text-slate-900 mb-4">
              Resumen Financiero
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Costo Total</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(alteration.cost)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Pagado</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(alteration.amount_paid)}
                </span>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Saldo</span>
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-medium text-slate-900 mb-4">Fechas</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Recibido</p>
                  <p className="text-slate-900">
                    {formatDate(alteration.received_date)}
                  </p>
                </div>
              </div>
              {alteration.estimated_delivery_date && (
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500">Entrega Estimada</p>
                    <p className="text-slate-900">
                      {formatDate(alteration.estimated_delivery_date)}
                    </p>
                  </div>
                </div>
              )}
              {alteration.delivered_date && (
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500">Entregado</p>
                    <p className="text-slate-900">
                      {formatDate(alteration.delivered_date)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-xs text-slate-400">
              Creado: {formatDateTime(alteration.created_at)}
            </p>
            <p className="text-xs text-slate-400">
              Actualizado: {formatDateTime(alteration.updated_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowEditModal(false)}
          />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full">
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-800">
                  Editar Arreglo
                </h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Tipo de arreglo
                  </label>
                  <select
                    value={editData.alteration_type}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        alteration_type: e.target
                          .value as AlterationWithPayments['alteration_type'],
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  >
                    {Object.entries(ALTERATION_TYPE_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Prenda
                  </label>
                  <input
                    type="text"
                    value={editData.garment_name || ''}
                    onChange={(e) =>
                      setEditData({ ...editData, garment_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Descripcion
                  </label>
                  <textarea
                    value={editData.description || ''}
                    onChange={(e) =>
                      setEditData({ ...editData, description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Costo
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={editData.cost || ''}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            cost: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Fecha entrega estimada
                    </label>
                    <DatePicker
                      value={editData.estimated_delivery_date || ''}
                      onChange={(date) =>
                        setEditData({
                          ...editData,
                          estimated_delivery_date: date,
                        })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Notas
                  </label>
                  <textarea
                    value={editData.notes || ''}
                    onChange={(e) =>
                      setEditData({ ...editData, notes: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t border-slate-200">
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={savingEdit}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition disabled:opacity-50 flex items-center justify-center"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Cambios'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowPaymentModal(false)}
          />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                  Registrar Pago
                </h2>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-slate-600">Saldo Pendiente</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(alteration.balance)}
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
                      max={alteration.balance}
                      value={paymentData.amount || ''}
                      onChange={(e) =>
                        setPaymentData({
                          ...paymentData,
                          amount: parseInt(e.target.value) || 0,
                        })
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
                    value={paymentData.payment_method}
                    onChange={(e) =>
                      setPaymentData({
                        ...paymentData,
                        payment_method: e.target.value as PaymentMethod,
                      })
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
                    Notas (opcional)
                  </label>
                  <input
                    type="text"
                    value={paymentData.notes || ''}
                    onChange={(e) =>
                      setPaymentData({ ...paymentData, notes: e.target.value })
                    }
                    placeholder="Observaciones del pago..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t border-slate-200">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  disabled={savingPayment}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSavePayment}
                  disabled={savingPayment || paymentData.amount <= 0}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center"
                >
                  {savingPayment ? (
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
    </div>
  );
}
