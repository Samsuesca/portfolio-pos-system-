/**
 * Alterations Page - List and manage alterations/repairs (Global view)
 *
 * Features:
 * - 8 clickable stats cards with filtering
 * - Alerts section for urgent items
 * - Improved table with urgency indicators
 * - Refresh button and result counter
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import AlterationModal from '../components/AlterationModal';
import {
  Scissors, Plus, Search, AlertCircle, Loader2, Eye,
  User, DollarSign, CheckCircle, Clock, Package, ChevronDown,
  RefreshCw, XCircle, AlertTriangle, Calendar, Truck, UserX,
  ChevronUp
} from 'lucide-react';
import { alterationService } from '../services/alterationService';
import DateFilter, { DateRange } from '../components/DateFilter';
import { useDebounce } from '../hooks/useDebounce';
import type {
  AlterationListItem,
  AlterationsSummary,
  AlterationStatus,
  AlterationType
} from '../types/api';
import {
  ALTERATION_TYPE_LABELS,
  ALTERATION_STATUS_LABELS,
  ALTERATION_STATUS_COLORS
} from '../types/api';
import { formatCurrency } from '../utils/formatting';

interface LocationState {
  openNew?: boolean;
}

// Helper to calculate delivery urgency
const getDeliveryUrgency = (deliveryDate: string | null, status: AlterationStatus) => {
  if (!deliveryDate || status === 'delivered' || status === 'cancelled') return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delivery = new Date(deliveryDate);
  delivery.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    return {
      type: 'overdue',
      label: absDays === 1 ? 'Ayer' : `Hace ${absDays} días`,
      color: 'text-red-600 bg-red-100',
      priority: 0
    };
  }
  if (diffDays === 0) return { type: 'today', label: 'Hoy', color: 'text-orange-600 bg-orange-100', priority: 1 };
  if (diffDays === 1) return { type: 'tomorrow', label: 'Mañana', color: 'text-yellow-600 bg-yellow-100', priority: 2 };
  if (diffDays <= 3) return { type: 'soon', label: `En ${diffDays} días`, color: 'text-blue-600 bg-blue-100', priority: 3 };
  return null;
};

// Helper to get payment status indicator
const getPaymentStatus = (_cost: number, amountPaid: number, balance: number) => {
  if (balance === 0) {
    return { type: 'paid', label: 'Pagado', color: 'text-green-600', icon: CheckCircle };
  }
  if (amountPaid > 0) {
    return { type: 'partial', label: `Abono ${formatCurrency(amountPaid)}`, color: 'text-yellow-600', icon: DollarSign };
  }
  return { type: 'pending', label: formatCurrency(balance), color: 'text-red-600', icon: AlertCircle };
};

export default function Alterations() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  const [alterations, setAlterations] = useState<AlterationListItem[]>([]);
  const [summary, setSummary] = useState<AlterationsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AlterationStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<AlterationType | ''>('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showAlerts, setShowAlerts] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({});

  // Debounce search for backend
  const debouncedSearch = useDebounce(searchTerm, 300);
  const LIMIT = 50;

  // Handle openNew from navigation state (Quick Actions)
  useEffect(() => {
    if (locationState?.openNew) {
      setIsModalOpen(true);
      // Clear the state to prevent re-opening on subsequent renders
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [locationState, navigate, location.pathname]);

  // Reload when filters or debounced search changes
  useEffect(() => {
    loadData();
  }, [statusFilter, typeFilter, paymentFilter, debouncedSearch, dateRange]);

  const loadData = useCallback(async (append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const skip = append ? alterations.length : 0;

      const [alterationsData, summaryData] = await Promise.all([
        alterationService.getAll({
          status: statusFilter || undefined,
          type: typeFilter || undefined,
          is_paid: paymentFilter === 'all' ? undefined : paymentFilter === 'paid',
          search: debouncedSearch || undefined,
          start_date: dateRange.start_date,
          end_date: dateRange.end_date,
          limit: LIMIT,
          skip: skip
        }),
        append ? Promise.resolve(summary) : alterationService.getSummary()
      ]);

      if (append) {
        setAlterations(prev => [...prev, ...alterationsData]);
      } else {
        setAlterations(alterationsData);
      }
      if (summaryData) setSummary(summaryData);
      setHasMore(alterationsData.length === LIMIT);
    } catch (err: any) {
      console.error('Error loading alterations:', err);
      setError(err.response?.data?.detail || 'Error al cargar arreglos');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [statusFilter, typeFilter, paymentFilter, debouncedSearch, dateRange, alterations.length, summary]);

  const handleSuccess = () => {
    loadData();
  };

  // Calculate alerts from current data
  const alerts = useMemo(() => {
    const overdue: AlterationListItem[] = [];
    const ready: AlterationListItem[] = [];
    const deliveredWithBalance: AlterationListItem[] = [];

    alterations.forEach(alt => {
      // Overdue: has delivery date in the past and not delivered/cancelled
      if (alt.estimated_delivery_date &&
          alt.status !== 'delivered' &&
          alt.status !== 'cancelled') {
        const urgency = getDeliveryUrgency(alt.estimated_delivery_date, alt.status);
        if (urgency?.type === 'overdue') {
          overdue.push(alt);
        }
      }
      // Ready to deliver
      if (alt.status === 'ready') {
        ready.push(alt);
      }
      // Delivered but with pending balance
      if (alt.status === 'delivered' && alt.balance > 0) {
        deliveredWithBalance.push(alt);
      }
    });

    return { overdue, ready, deliveredWithBalance };
  }, [alterations]);

  const totalAlerts = alerts.overdue.length + alerts.ready.length + alerts.deliveredWithBalance.length;

  // Check if any filter is active
  const hasActiveFilters = statusFilter !== '' || typeFilter !== '' || paymentFilter !== 'all' || debouncedSearch !== '' || !!dateRange.start_date || !!dateRange.end_date;

  const clearAllFilters = () => {
    setStatusFilter('');
    setTypeFilter('');
    setPaymentFilter('all');
    setSearchTerm('');
    setDateRange({});
  };

  const formatDateShort = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short'
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Scissors className="w-7 h-7 text-brand-600" />
              Arreglos
            </h1>
            <p className="text-gray-500 mt-1">
              Gestiona arreglos y confecciones
              {!loading && (
                <span className="ml-2">
                  • <span className="font-medium text-gray-700">{alterations.length}</span> encontrados
                </span>
              )}
              {hasActiveFilters && (
                <span className="ml-2 text-brand-600">• Filtros activos</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Refresh Button */}
            <button
              onClick={() => loadData()}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
              title="Actualizar"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nuevo Arreglo
            </button>
          </div>
        </div>

        {/* Summary Cards - 8 cards in 2 rows */}
        {summary && (
          <div className="space-y-3">
            {/* Row 1: Status cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Pendientes */}
              <button
                onClick={() => setStatusFilter(statusFilter === 'pending' ? '' : 'pending')}
                className={`text-left rounded-lg p-4 transition-all ${
                  statusFilter === 'pending'
                    ? 'bg-yellow-200 border-2 border-yellow-500 ring-2 ring-yellow-300'
                    : 'bg-yellow-50 border border-yellow-200 hover:border-yellow-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-700">Pendientes</p>
                    <p className="text-2xl font-bold text-yellow-900">{summary.pending_count}</p>
                    <p className="text-xs text-yellow-600 mt-0.5">por iniciar</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-600" />
                </div>
              </button>

              {/* En Proceso */}
              <button
                onClick={() => setStatusFilter(statusFilter === 'in_progress' ? '' : 'in_progress')}
                className={`text-left rounded-lg p-4 transition-all ${
                  statusFilter === 'in_progress'
                    ? 'bg-blue-200 border-2 border-blue-500 ring-2 ring-blue-300'
                    : 'bg-blue-50 border border-blue-200 hover:border-blue-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-700">En Proceso</p>
                    <p className="text-2xl font-bold text-blue-900">{summary.in_progress_count}</p>
                    <p className="text-xs text-blue-600 mt-0.5">en trabajo</p>
                  </div>
                  <Scissors className="w-8 h-8 text-blue-600" />
                </div>
              </button>

              {/* Listos */}
              <button
                onClick={() => setStatusFilter(statusFilter === 'ready' ? '' : 'ready')}
                className={`text-left rounded-lg p-4 transition-all ${
                  statusFilter === 'ready'
                    ? 'bg-green-200 border-2 border-green-500 ring-2 ring-green-300'
                    : 'bg-green-50 border border-green-200 hover:border-green-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-700">Listos</p>
                    <p className="text-2xl font-bold text-green-900">{summary.ready_count}</p>
                    <p className="text-xs text-green-600 mt-0.5">para entregar</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </button>

              {/* Entregados */}
              <button
                onClick={() => setStatusFilter(statusFilter === 'delivered' ? '' : 'delivered')}
                className={`text-left rounded-lg p-4 transition-all ${
                  statusFilter === 'delivered'
                    ? 'bg-gray-300 border-2 border-gray-500 ring-2 ring-gray-300'
                    : 'bg-gray-50 border border-gray-200 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700">Entregados</p>
                    <p className="text-2xl font-bold text-gray-900">{summary.delivered_count}</p>
                    <p className="text-xs text-gray-600 mt-0.5">completados</p>
                  </div>
                  <Truck className="w-8 h-8 text-gray-600" />
                </div>
              </button>
            </div>

            {/* Row 2: Financial & Activity cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Hoy */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-700">Hoy</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold text-purple-900">{summary.today_received}</p>
                      <span className="text-xs text-purple-600">recibidos</span>
                    </div>
                    <p className="text-xs text-purple-600 mt-0.5">
                      {summary.today_delivered} entregados
                    </p>
                  </div>
                  <Calendar className="w-8 h-8 text-purple-600" />
                </div>
              </div>

              {/* Ingresos */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-700">Ingresos</p>
                    <p className="text-xl font-bold text-emerald-900">{formatCurrency(summary.total_revenue)}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">total pagado</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-emerald-600" />
                </div>
              </div>

              {/* Por Cobrar */}
              <button
                onClick={() => setPaymentFilter(paymentFilter === 'pending' ? 'all' : 'pending')}
                className={`text-left rounded-lg p-4 transition-all ${
                  paymentFilter === 'pending'
                    ? 'bg-red-200 border-2 border-red-500 ring-2 ring-red-300'
                    : 'bg-red-50 border border-red-200 hover:border-red-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-700">Por Cobrar</p>
                    <p className="text-xl font-bold text-red-900">{formatCurrency(summary.total_pending_payment)}</p>
                    <p className="text-xs text-red-600 mt-0.5">saldo pendiente</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
              </button>

              {/* Total */}
              <button
                onClick={clearAllFilters}
                className={`text-left rounded-lg p-4 transition-all ${
                  !hasActiveFilters
                    ? 'bg-white border-2 border-brand-500 ring-2 ring-brand-200'
                    : 'bg-white border border-gray-200 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700">Total</p>
                    <p className="text-2xl font-bold text-gray-900">{summary.total_count}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {hasActiveFilters ? 'click para ver todos' : 'todos los arreglos'}
                    </p>
                  </div>
                  <Package className="w-8 h-8 text-gray-500" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Alerts Section */}
        {totalAlerts > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowAlerts(!showAlerts)}
              className="w-full flex items-center justify-between p-4 hover:bg-amber-100 transition"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span className="font-medium text-amber-800">
                  Alertas ({totalAlerts})
                </span>
              </div>
              {showAlerts ? (
                <ChevronUp className="w-5 h-5 text-amber-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-amber-600" />
              )}
            </button>

            {showAlerts && (
              <div className="px-4 pb-4 flex flex-wrap gap-3">
                {/* Overdue alerts */}
                {alerts.overdue.length > 0 && (
                  <button
                    onClick={() => {
                      clearAllFilters();
                      // Filter will show overdue items (we'll rely on sorting)
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                  >
                    <XCircle className="w-4 h-4" />
                    <span className="font-medium">Entrega vencida ({alerts.overdue.length})</span>
                  </button>
                )}

                {/* Ready to deliver */}
                {alerts.ready.length > 0 && (
                  <button
                    onClick={() => setStatusFilter('ready')}
                    className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">Listos para entregar ({alerts.ready.length})</span>
                  </button>
                )}

                {/* Delivered with pending balance */}
                {alerts.deliveredWithBalance.length > 0 && (
                  <button
                    onClick={() => {
                      setStatusFilter('delivered');
                      setPaymentFilter('pending');
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span className="font-medium">Saldo pendiente ({alerts.deliveredWithBalance.length})</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por código, cliente o prenda..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AlterationStatus | '')}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="">Todos los estados</option>
              {Object.entries(ALTERATION_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as AlterationType | '')}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="">Todos los tipos</option>
              {Object.entries(ALTERATION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {/* Payment Filter */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as 'all' | 'paid' | 'pending')}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="all">Todos los pagos</option>
              <option value="paid">Pagados</option>
              <option value="pending">Con saldo</option>
            </select>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
              >
                <XCircle className="w-4 h-4" />
                Limpiar
              </button>
            )}
          </div>

          {/* Date Filter */}
          <div className="border-t border-gray-200 pt-3 mt-3">
            <DateFilter value={dateRange} onChange={setDateRange} />
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => loadData()}
              className="ml-auto text-red-700 hover:text-red-800 underline text-sm"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          </div>
        )}

        {/* Alterations Table */}
        {!loading && !error && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            {alterations.length === 0 ? (
              <div className="text-center py-12">
                <Scissors className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {debouncedSearch || statusFilter || typeFilter || paymentFilter !== 'all'
                    ? 'No hay arreglos que coincidan con los filtros'
                    : 'No hay arreglos que mostrar'}
                </p>
                {!debouncedSearch && !statusFilter && !typeFilter && paymentFilter === 'all' && (
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="mt-4 text-brand-600 hover:text-brand-700 font-medium"
                  >
                    Crear primer arreglo
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Código</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Cliente</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Trabajo</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Entrega</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Financiero</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {alterations.map((alteration, index) => {
                      const urgency = getDeliveryUrgency(alteration.estimated_delivery_date, alteration.status);
                      const paymentStatus = getPaymentStatus(alteration.cost, alteration.amount_paid, alteration.balance);
                      const PaymentIcon = paymentStatus.icon;

                      return (
                        <tr
                          key={alteration.id}
                          className={`hover:bg-gray-50 cursor-pointer transition ${
                            index % 2 === 1 ? 'bg-gray-50/50' : ''
                          }`}
                          onClick={() => navigate(`/alterations/${alteration.id}`)}
                        >
                          {/* Código */}
                          <td className="px-4 py-3">
                            <span className="font-mono text-sm text-brand-600 font-medium">
                              {alteration.code}
                            </span>
                          </td>

                          {/* Cliente */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {alteration.client_id ? (
                                <User className="w-4 h-4 text-gray-400" />
                              ) : (
                                <UserX className="w-4 h-4 text-gray-300" />
                              )}
                              <span className="text-gray-900 truncate max-w-[150px]" title={alteration.client_display_name}>
                                {alteration.client_display_name}
                              </span>
                            </div>
                          </td>

                          {/* Trabajo (Prenda + Tipo) */}
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-gray-900 font-medium truncate max-w-[180px]" title={alteration.garment_name}>
                                {alteration.garment_name}
                              </p>
                              <span className="text-xs text-gray-500">
                                {ALTERATION_TYPE_LABELS[alteration.alteration_type]}
                              </span>
                            </div>
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${ALTERATION_STATUS_COLORS[alteration.status]}`}>
                              {ALTERATION_STATUS_LABELS[alteration.status]}
                            </span>
                          </td>

                          {/* Entrega */}
                          <td className="px-4 py-3">
                            {alteration.estimated_delivery_date ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-sm text-gray-600">
                                  {formatDateShort(alteration.estimated_delivery_date)}
                                </span>
                                {urgency && (
                                  <span className={`inline-flex px-1.5 py-0.5 text-xs rounded font-medium ${urgency.color}`}>
                                    {urgency.label}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">Sin fecha</span>
                            )}
                          </td>

                          {/* Financiero */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-sm font-medium text-gray-900">
                                {formatCurrency(alteration.cost)}
                              </span>
                              <span className={`text-xs flex items-center gap-1 ${paymentStatus.color}`}>
                                <PaymentIcon className="w-3 h-3" />
                                {paymentStatus.label}
                              </span>
                            </div>
                          </td>

                          {/* Acciones */}
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/alterations/${alteration.id}`);
                              }}
                              className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                              title="Ver detalle"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Load More Button */}
                {hasMore && alterations.length > 0 && (
                  <div className="p-4 border-t border-gray-100 text-center">
                    <button
                      onClick={() => { loadData(true); }}
                      disabled={loadingMore}
                      className="px-4 py-2 text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg inline-flex items-center transition disabled:opacity-50"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Cargando...
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 mr-2" />
                          Cargar más arreglos
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <AlterationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </Layout>
  );
}
