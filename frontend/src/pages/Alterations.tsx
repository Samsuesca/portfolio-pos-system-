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
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import AlterationModal from '../components/AlterationModal';
import {
  Scissors, Plus, Search, AlertCircle, Loader2, Eye,
  User, DollarSign, CheckCircle, Clock, Package, ChevronDown,
  RefreshCw, XCircle, AlertTriangle, Calendar, Truck, UserX,
  ChevronUp, X
} from 'lucide-react';
import { alterationService } from '../services/alterationService';
import { clientService } from '../services/clientService';
import DateFilter, { DateRange } from '../components/DateFilter';
import { useDebounce } from '../hooks/useDebounce';
import type {
  AlterationListItem,
  AlterationsSummary,
  AlterationStatus,
  AlterationType,
  Client
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
  if (diffDays <= 3) return { type: 'soon', label: `En ${diffDays} días`, color: 'text-brand-600 bg-brand-100', priority: 3 };
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
  const [searchParams, setSearchParams] = useSearchParams();
  const locationState = location.state as LocationState | null;
  const clientIdFilter = searchParams.get('client');
  const [filterClient, setFilterClient] = useState<Client | null>(null);

  useEffect(() => {
    if (!clientIdFilter) {
      setFilterClient(null);
      return;
    }
    let cancelled = false;
    clientService
      .getClient(clientIdFilter)
      .then((c) => { if (!cancelled) setFilterClient(c); })
      .catch(() => { if (!cancelled) setFilterClient(null); });
    return () => { cancelled = true; };
  }, [clientIdFilter]);

  const clearClientFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('client');
    setSearchParams(next, { replace: true });
  };

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
  }, [statusFilter, typeFilter, paymentFilter, debouncedSearch, dateRange, clientIdFilter]);

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
          client_id: clientIdFilter || undefined,
          start_date: dateRange.start_date,
          end_date: dateRange.end_date,
          limit: LIMIT,
          skip: skip
        }),
        append ? Promise.resolve(summary) : alterationService.getSummary()
      ]);

      const items = alterationsData.items;
      if (append) {
        setAlterations(prev => [...prev, ...items]);
      } else {
        setAlterations(items);
      }
      if (summaryData) setSummary(summaryData);
      setHasMore(alterationsData.has_more);
    } catch (err: any) {
      console.error('Error loading alterations:', err);
      setError(err.response?.data?.detail || 'Error al cargar arreglos');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [statusFilter, typeFilter, paymentFilter, debouncedSearch, dateRange, alterations.length, summary, clientIdFilter]);

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
            <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
              <Scissors className="w-7 h-7 text-brand-600" />
              Arreglos
            </h1>
            <p className="text-stone-500 mt-1">
              Gestiona arreglos y confecciones
              {!loading && (
                <span className="ml-2">
                  • <span className="font-medium text-stone-700">{alterations.length}</span> encontrados
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
              className="p-2 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition disabled:opacity-50"
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
        {summary && (() => {
          const canViewFinancials = summary.total_revenue !== null;
          return (
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
                    ? 'bg-brand-200 border-2 border-brand-500 ring-2 ring-blue-300'
                    : 'bg-brand-50 border border-brand-200 hover:border-brand-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-brand-700">En Proceso</p>
                    <p className="text-2xl font-bold text-brand-700">{summary.in_progress_count}</p>
                    <p className="text-xs text-brand-600 mt-0.5">en trabajo</p>
                  </div>
                  <Scissors className="w-8 h-8 text-brand-600" />
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
                    ? 'bg-stone-300 border-2 border-stone-500 ring-2 ring-stone-300'
                    : 'bg-stone-50 border border-stone-200 hover:border-stone-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-stone-700">Entregados</p>
                    <p className="text-2xl font-bold text-stone-900">{summary.delivered_count}</p>
                    <p className="text-xs text-stone-600 mt-0.5">completados</p>
                  </div>
                  <Truck className="w-8 h-8 text-stone-600" />
                </div>
              </button>
            </div>

            {/* Row 2: Financial & Activity cards
                The financial cards (Ingresos, Por Cobrar) are server-gated by
                `alterations.view_revenue`; when the user lacks the permission,
                the backend returns null on those fields and we drop the cards
                so the grid reflows to operational metrics only. */}
            <div className={`grid grid-cols-2 gap-3 ${canViewFinancials ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
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
              {summary.total_revenue !== null && (
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
              )}

              {/* Por Cobrar */}
              {summary.total_pending_payment !== null && (
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
              )}

              {/* Total */}
              <button
                onClick={clearAllFilters}
                className={`text-left rounded-lg p-4 transition-all ${
                  !hasActiveFilters
                    ? 'bg-white border-2 border-brand-500 ring-2 ring-brand-200'
                    : 'bg-white border border-stone-200 hover:border-stone-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-stone-700">Total</p>
                    <p className="text-2xl font-bold text-stone-900">{summary.total_count}</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {hasActiveFilters ? 'click para ver todos' : 'todos los arreglos'}
                    </p>
                  </div>
                  <Package className="w-8 h-8 text-stone-500" />
                </div>
              </button>
            </div>
          </div>
          );
        })()}

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
                    className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 ring-1 ring-red-200 rounded-lg hover:bg-red-200 transition"
                  >
                    <XCircle className="w-4 h-4" />
                    <span className="font-medium">Entrega vencida ({alerts.overdue.length})</span>
                  </button>
                )}

                {/* Ready to deliver */}
                {alerts.ready.length > 0 && (
                  <button
                    onClick={() => setStatusFilter('ready')}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 rounded-lg hover:bg-green-200 transition"
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
                    className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 ring-1 ring-amber-200 rounded-lg hover:bg-yellow-200 transition"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span className="font-medium">Saldo pendiente ({alerts.deliveredWithBalance.length})</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Active client filter banner */}
        {clientIdFilter && (
          <div className="bg-brand-50 border border-brand-200 rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-brand-800">
              <User className="w-4 h-4" />
              <span>
                Filtrado por cliente:{' '}
                <strong>
                  {filterClient ? `${filterClient.name} (${filterClient.code})` : clientIdFilter}
                </strong>
              </span>
            </div>
            <button
              onClick={clearClientFilter}
              className="flex items-center gap-1 text-sm text-brand-700 hover:text-brand-900 font-medium"
            >
              Quitar filtro
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-100 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar por código, cliente o prenda..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AlterationStatus | '')}
              className="px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
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
              className="px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
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
              className="px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="all">Todos los pagos</option>
              <option value="paid">Pagados</option>
              <option value="pending">Con saldo</option>
            </select>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-2 px-4 py-2 text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition"
              >
                <XCircle className="w-4 h-4" />
                Limpiar
              </button>
            )}
          </div>

          {/* Date Filter */}
          <div className="border-t border-stone-200 pt-3 mt-3">
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
          <div className="bg-white rounded-lg shadow-sm border border-stone-100 overflow-hidden">
            {alterations.length === 0 ? (
              <div className="text-center py-12">
                <Scissors className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                <p className="text-stone-500">
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
                  <thead className="bg-stone-50 border-b border-stone-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Código</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Cliente</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Trabajo</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Estado</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Entrega</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-stone-600">Financiero</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-stone-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {alterations.map((alteration, index) => {
                      const urgency = getDeliveryUrgency(alteration.estimated_delivery_date, alteration.status);
                      const paymentStatus = getPaymentStatus(alteration.cost, alteration.amount_paid, alteration.balance);
                      const PaymentIcon = paymentStatus.icon;

                      return (
                        <tr
                          key={alteration.id}
                          className={`hover:bg-stone-50 cursor-pointer transition ${
                            index % 2 === 1 ? 'bg-stone-50/50' : ''
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
                                <User className="w-4 h-4 text-stone-400" />
                              ) : (
                                <UserX className="w-4 h-4 text-stone-300" />
                              )}
                              <span className="text-stone-900 truncate max-w-[150px]" title={alteration.client_display_name}>
                                {alteration.client_display_name}
                              </span>
                            </div>
                          </td>

                          {/* Trabajo (Prenda + Tipo) */}
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-stone-900 font-medium truncate max-w-[180px]" title={alteration.garment_name}>
                                {alteration.garment_name}
                              </p>
                              <span className="text-xs text-stone-500">
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
                                <span className="text-sm text-stone-600">
                                  {formatDateShort(alteration.estimated_delivery_date)}
                                </span>
                                {urgency && (
                                  <span className={`inline-flex px-1.5 py-0.5 text-xs rounded font-medium ${urgency.color}`}>
                                    {urgency.label}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-stone-400 text-sm">Sin fecha</span>
                            )}
                          </td>

                          {/* Financiero */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-sm font-medium text-stone-900">
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
                              className="p-2 text-stone-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
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
                  <div className="p-4 border-t border-stone-100 text-center">
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
