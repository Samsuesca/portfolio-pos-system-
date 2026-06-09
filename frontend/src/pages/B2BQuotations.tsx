/**
 * B2B Quotations Page - Cotizaciones empresariales (recurso GLOBAL, sin colegio)
 *
 * Features:
 * - Clickable stats cards per status (draft/sent/negotiation/accepted/rejected/expired)
 * - Filters: free-text search (over quotation_number), status, date range (client-side)
 * - Create quotation modal with a line-item editor (totals previewed client-side,
 *   source of truth is the backend response)
 * - Row actions (permission-gated): advance status via FSM dropdown, convert to
 *   contract (only when accepted), view/print document (HTML -> Ctrl+P)
 *
 * Write actions require b2b.manage_quotations; convert requires b2b.manage_contracts.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
import { usePermissions } from '../hooks/usePermissions';
import { useDebounce } from '../hooks/useDebounce';
import { b2bService } from '../services/b2bService';
import { extractErrorMessage } from '../utils/api-client';
import { formatCurrency, formatDateSpanish } from '../utils/formatting';
import type {
  QuotationStatus,
  QuotationListResponse,
  QuotationItemCreate,
  QuotationCreate,
  B2BClientResponse,
  B2BClientCreate,
  B2BSegment,
} from '../types/api';
import {
  Briefcase,
  Plus,
  Search,
  UserPlus,
  AlertCircle,
  Loader2,
  RefreshCw,
  Printer,
  ChevronDown,
  ChevronRight,
  X,
  Trash2,
  FileSignature,
  Calendar,
  PencilLine,
  CheckCircle,
  Clock,
  MessageSquare,
  XCircle,
  TimerOff,
} from 'lucide-react';
// NOTE: row "view document" action uses the Printer icon (opens the HTML for Ctrl+P).

// FSM allowed transitions — mirror of app/services/quotation/status.py::VALID_TRANSITIONS.
const VALID_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  draft: ['sent', 'expired'],
  sent: ['negotiation', 'accepted', 'rejected', 'expired'],
  negotiation: ['accepted', 'rejected', 'expired'],
  accepted: [],
  rejected: [],
  expired: [],
};

const STATUS_ORDER: QuotationStatus[] = [
  'draft',
  'sent',
  'negotiation',
  'accepted',
  'rejected',
  'expired',
];

interface StatusMeta {
  label: string;
  badge: string;
  card: string;
  cardActive: string;
  text: string;
  icon: typeof Clock;
}

const STATUS_META: Record<QuotationStatus, StatusMeta> = {
  draft: {
    label: 'Borrador',
    badge: 'bg-stone-100 text-stone-700 ring-1 ring-stone-200',
    card: 'bg-stone-50 border border-stone-200 hover:border-stone-400',
    cardActive: 'bg-stone-200 border-2 border-stone-500 ring-2 ring-stone-300',
    text: 'text-stone-700',
    icon: PencilLine,
  },
  sent: {
    label: 'Enviada',
    badge: 'bg-brand-100 text-brand-700 ring-1 ring-brand-200',
    card: 'bg-brand-50 border border-brand-200 hover:border-brand-400',
    cardActive: 'bg-brand-200 border-2 border-brand-500 ring-2 ring-blue-300',
    text: 'text-brand-700',
    icon: Clock,
  },
  negotiation: {
    label: 'En Negociación',
    badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    card: 'bg-amber-50 border border-amber-200 hover:border-amber-400',
    cardActive: 'bg-amber-200 border-2 border-amber-500 ring-2 ring-amber-300',
    text: 'text-amber-700',
    icon: MessageSquare,
  },
  accepted: {
    label: 'Aceptada',
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    card: 'bg-emerald-50 border border-emerald-200 hover:border-emerald-400',
    cardActive: 'bg-emerald-200 border-2 border-emerald-500 ring-2 ring-emerald-300',
    text: 'text-emerald-700',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Rechazada',
    badge: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    card: 'bg-red-50 border border-red-200 hover:border-red-400',
    cardActive: 'bg-red-200 border-2 border-red-500 ring-2 ring-red-300',
    text: 'text-red-700',
    icon: XCircle,
  },
  expired: {
    label: 'Vencida',
    badge: 'bg-stone-200 text-stone-600 ring-1 ring-stone-300',
    card: 'bg-stone-100 border border-stone-300 hover:border-stone-400',
    cardActive: 'bg-stone-300 border-2 border-stone-500 ring-2 ring-stone-400',
    text: 'text-stone-600',
    icon: TimerOff,
  },
};

const LIMIT = 50;

export default function B2BQuotations() {
  // B2B es un recurso GLOBAL (sin school_id): usar hasGlobalPermission para que
  // el gating funcione aunque no haya colegio seleccionado en el store.
  const { hasGlobalPermission } = usePermissions();
  const canManageQuotations = hasGlobalPermission('b2b.manage_quotations');
  const canManageContracts = hasGlobalPermission('b2b.manage_contracts');

  const [quotations, setQuotations] = useState<QuotationListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const debouncedSearch = useDebounce(searchTerm, 300);

  const [stats, setStats] = useState<Record<QuotationStatus, number>>({
    draft: 0,
    sent: 0,
    negotiation: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
  });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [rowAction, setRowAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadQuotations = useCallback(
    async (append = false) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setError(null);

        const skip = append ? quotations.length : 0;
        const response = await b2bService.getAllQuotations({
          status: statusFilter || undefined,
          search: debouncedSearch || undefined,
          limit: LIMIT,
          skip,
        });
        const data = response.items ?? [];
        setQuotations((prev) => (append ? [...prev, ...data] : data));
        setHasMore(response.has_more);
      } catch (err) {
        setError(extractErrorMessage(err));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [statusFilter, debouncedSearch, quotations.length]
  );

  // Per-status counts via independent count queries (Stats Pattern: never count
  // over a loaded page). Six cheap limit=1 calls until a /stats endpoint exists.
  const loadStats = useCallback(async () => {
    try {
      const entries = await Promise.all(
        STATUS_ORDER.map(async (s) => [s, await b2bService.countQuotations({ status: s })] as const)
      );
      setStats(Object.fromEntries(entries) as Record<QuotationStatus, number>);
    } catch {
      // Stats are non-critical; keep the page usable if they fail.
    }
  }, []);

  useEffect(() => {
    loadQuotations(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, debouncedSearch]);

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Date filtering is client-side (the list endpoint has no date params yet).
  const visibleQuotations = useMemo(() => {
    return quotations.filter((q) => {
      if (startDate && q.created_at.slice(0, 10) < startDate) return false;
      if (endDate && q.created_at.slice(0, 10) > endDate) return false;
      return true;
    });
  }, [quotations, startDate, endDate]);

  const refreshAll = () => {
    loadQuotations(false);
    loadStats();
  };

  const handleStatusChange = async (id: string, next: QuotationStatus) => {
    setActionError(null);
    setActionNotice(null);
    setRowAction(id);
    try {
      await b2bService.updateQuotationStatus(id, next);
      setActionNotice(`Cotización actualizada a "${STATUS_META[next].label}".`);
      await Promise.all([loadQuotations(false), loadStats()]);
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setRowAction(null);
    }
  };

  const handleConvert = async (id: string, number: string) => {
    setActionError(null);
    setActionNotice(null);
    setRowAction(id);
    try {
      const contract = await b2bService.convertToContract(id);
      setActionNotice(
        `Cotización ${number} convertida al contrato ${contract.contract_number}.`
      );
      await Promise.all([loadQuotations(false), loadStats()]);
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setRowAction(null);
    }
  };

  const handleViewDocument = async (id: string) => {
    setActionError(null);
    try {
      await b2bService.openQuotationDocument(id);
    } catch (err) {
      setActionError(extractErrorMessage(err));
    }
  };

  const hasActiveFilters = Boolean(debouncedSearch || statusFilter || startDate || endDate);

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Cotizaciones B2B</h1>
          <p className="text-stone-600 mt-1">
            {loading
              ? 'Cargando...'
              : `${visibleQuotations.length} cotizaciones${hasActiveFilters ? ' (filtradas)' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            disabled={loading}
            className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-2 rounded-lg flex items-center transition disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canManageQuotations && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center transition"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nueva Cotización
            </button>
          )}
        </div>
      </div>

      {/* Action feedback */}
      {actionError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start justify-between">
          <div className="flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {actionNotice && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-start justify-between">
          <div className="flex items-start gap-2 text-sm text-emerald-700">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-emerald-500 hover:text-emerald-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats cards - clickable to filter by status */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {STATUS_ORDER.map((s) => {
          const meta = STATUS_META[s];
          const Icon = meta.icon;
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(active ? '' : s)}
              className={`text-left rounded-lg p-4 transition-all ${active ? meta.cardActive : meta.card}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs ${meta.text}`}>{meta.label}</p>
                  <p className="text-2xl font-bold text-stone-900">{stats[s]}</p>
                </div>
                <Icon className={`w-7 h-7 ${meta.text}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input
              type="text"
              placeholder="Buscar por número (COT-2026-...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as QuotationStatus | '')}
            className="px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 outline-none"
          >
            <option value="">Todos los estados</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-stone-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400/30 outline-none"
              title="Desde"
            />
            <span className="text-stone-400 text-sm">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400/30 outline-none"
              title="Hasta"
            />
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <span className="ml-3 text-stone-600">Cargando cotizaciones...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error al cargar cotizaciones</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                onClick={() => loadQuotations(false)}
                className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && visibleQuotations.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-100">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Número
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Vigencia
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Creada
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-100">
              {visibleQuotations.map((q) => {
                const meta = STATUS_META[q.status];
                const Icon = meta.icon;
                const transitions = VALID_TRANSITIONS[q.status];
                const busy = rowAction === q.id;
                return (
                  <tr key={q.id} className="hover:bg-stone-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono font-medium text-stone-900">
                        {q.quotation_number}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="text-sm text-stone-700"
                        title={q.b2b_client_id}
                      >
                        {q.client_name ?? `${q.b2b_client_id.slice(0, 8)}…`}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-full ${meta.badge}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-stone-900">
                      {formatCurrency(q.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600">
                      {formatDateSpanish(q.valid_until)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600">
                      {formatDateSpanish(q.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {busy && <Loader2 className="w-4 h-4 animate-spin text-stone-400 mr-1" />}

                        {/* FSM status dropdown (only with manage_quotations and valid transitions) */}
                        {canManageQuotations && transitions.length > 0 && (
                          <div className="relative inline-block group">
                            <select
                              disabled={busy}
                              value=""
                              onChange={(e) => {
                                const next = e.target.value as QuotationStatus;
                                if (next) handleStatusChange(q.id, next);
                              }}
                              className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-700 hover:border-brand-400 focus:ring-2 focus:ring-brand-400/30 outline-none disabled:opacity-50"
                              title="Cambiar estado"
                            >
                              <option value="">Cambiar estado…</option>
                              {transitions.map((t) => (
                                <option key={t} value={t}>
                                  {STATUS_META[t].label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Convert to contract: only for accepted + manage_contracts */}
                        {q.status === 'accepted' && canManageContracts && (
                          <button
                            disabled={busy}
                            onClick={() => handleConvert(q.id, q.quotation_number)}
                            className="text-emerald-600 hover:text-emerald-700 p-2 rounded hover:bg-emerald-50 transition disabled:opacity-50 inline-flex items-center gap-1"
                            title="Convertir a contrato"
                          >
                            <FileSignature className="w-4 h-4" />
                            <span className="text-xs">Contrato</span>
                          </button>
                        )}

                        {/* View / print document */}
                        <button
                          onClick={() => handleViewDocument(q.id)}
                          className="text-brand-600 hover:text-brand-700 p-2 rounded hover:bg-brand-50 transition"
                          title="Ver / imprimir documento"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {hasMore && (
            <div className="p-4 border-t border-stone-200 text-center">
              <button
                onClick={() => loadQuotations(true)}
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
                    Cargar más cotizaciones
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && visibleQuotations.length === 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-12 text-center">
          <Briefcase className="w-16 h-16 text-brand-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-brand-700 mb-2">
            {hasActiveFilters ? 'No se encontraron cotizaciones' : 'No hay cotizaciones'}
          </h3>
          <p className="text-brand-700 mb-4">
            {hasActiveFilters
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'Comienza creando tu primera cotización empresarial'}
          </p>
          {!hasActiveFilters && canManageQuotations && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-2 rounded-lg inline-flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nueva Cotización
            </button>
          )}
        </div>
      )}

      {/* Create modal */}
      <CreateQuotationModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(number) => {
          setIsCreateOpen(false);
          setActionNotice(`Cotización ${number} creada en borrador.`);
          refreshAll();
        }}
      />
    </Layout>
  );
}

// ---------------------------------------------------------------------------
// Create Quotation Modal
// ---------------------------------------------------------------------------

interface DraftItem extends QuotationItemCreate {
  _key: string;
}

function emptyItem(): DraftItem {
  return {
    _key: Math.random().toString(36).slice(2),
    description: '',
    quantity: 1,
    unit_price: 0,
    customization: '',
  };
}

function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function plusDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

interface CreateQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (quotationNumber: string) => void;
}

function CreateQuotationModal({ isOpen, onClose, onSuccess }: CreateQuotationModalProps) {
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState<B2BClientResponse[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [issueDate, setIssueDate] = useState(todayISO());
  const [validUntil, setValidUntil] = useState(plusDaysISO(30));
  const [depositPct, setDepositPct] = useState('50');
  const [taxAmount, setTaxAmount] = useState('0');
  const [estimatedDays, setEstimatedDays] = useState('');
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const reset = () => {
    setClientId('');
    setIssueDate(todayISO());
    setValidUntil(plusDaysISO(30));
    setDepositPct('50');
    setTaxAmount('0');
    setEstimatedDays('');
    setTerms('');
    setNotes('');
    setItems([emptyItem()]);
    setFormError(null);
    setShowAdvanced(false);
  };

  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const res = await b2bService.getAllClients({ active_only: true, limit: 200 });
      setClients(res.items);
    } catch {
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) loadClients();
  }, [isOpen, loadClients]);

  if (!isOpen) return null;

  const updateItem = (key: string, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((it) => (it._key === key ? { ...it, ...patch } : it)));
  };

  const removeItem = (key: string) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it._key !== key)));
  };

  // Client-side preview only — the backend is the source of truth for totals.
  const subtotalPreview = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0
  );
  const taxPreview = Number(taxAmount) || 0;
  const totalPreview = subtotalPreview + taxPreview;

  const handleClose = () => {
    if (submitting) return;
    onClose();
    reset();
  };

  const handleSubmit = async () => {
    setFormError(null);

    if (!clientId.trim()) {
      setFormError('Selecciona un cliente B2B (o crea uno nuevo).');
      return;
    }
    if (validUntil < issueDate) {
      setFormError('La vigencia no puede ser anterior a la fecha de emisión.');
      return;
    }
    const cleanItems = items
      .map((it) => ({
        description: it.description.trim(),
        quantity: Number(it.quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
        unit_cost_estimate:
          it.unit_cost_estimate === undefined || it.unit_cost_estimate === null
            ? null
            : Number(it.unit_cost_estimate),
        customization: it.customization?.trim() || null,
      }))
      .filter((it) => it.description.length > 0);

    if (cleanItems.length === 0) {
      setFormError('Agrega al menos un ítem con descripción.');
      return;
    }
    if (cleanItems.some((it) => it.quantity <= 0)) {
      setFormError('La cantidad de cada ítem debe ser mayor a 0.');
      return;
    }

    const payload: QuotationCreate = {
      b2b_client_id: clientId.trim(),
      issue_date: issueDate,
      valid_until: validUntil,
      deposit_pct: Number(depositPct) || 0,
      tax_amount: taxPreview,
      estimated_delivery_days: estimatedDays ? Number(estimatedDays) : null,
      terms: terms.trim() || null,
      notes: notes.trim() || null,
      items: cleanItems,
    };

    try {
      setSubmitting(true);
      const created = await b2bService.createQuotation(payload);
      onSuccess(created.quotation_number);
      reset();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleClose} />
      {showNewClient && (
        <QuickCreateClientModal
          onClose={() => setShowNewClient(false)}
          onCreated={(c) => {
            setClients((prev) => [c, ...prev.filter((x) => x.id !== c.id)]);
            setClientId(c.id);
            setShowNewClient(false);
          }}
        />
      )}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-stone-200 bg-brand-50">
            <div>
              <h2 className="text-lg font-bold text-brand-800 flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Nueva Cotización B2B
              </h2>
              <p className="text-xs text-brand-600 mt-0.5">
                Se crea en estado borrador. Los totales se calculan en el servidor.
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={submitting}
              className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2 text-sm text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Client + dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Cliente B2B <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    disabled={loadingClients}
                    className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400/30 outline-none bg-white disabled:opacity-60"
                  >
                    <option value="">
                      {loadingClients ? 'Cargando clientes…' : 'Selecciona un cliente…'}
                    </option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.legal_name} — NIT {c.tax_id}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewClient(true)}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 transition"
                    title="Crear un nuevo cliente empresarial"
                  >
                    <UserPlus className="w-4 h-4" />
                    Nuevo
                  </button>
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  Empresa a la que se dirige la cotización. ¿No está en la lista? Créala con “Nuevo”.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Fecha de emisión <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Vigente hasta <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 outline-none"
                />
              </div>
            </div>

            {/* Items editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-stone-700">Ítems</h3>
                <button
                  onClick={() => setItems((prev) => [...prev, emptyItem()])}
                  className="text-xs text-brand-600 hover:text-brand-800 inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar ítem
                </button>
              </div>
              <div className="space-y-2">
                {items.map((it, idx) => {
                  const lineTotal = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
                  return (
                    <div
                      key={it._key}
                      className="border border-stone-200 rounded-lg p-3 bg-stone-50/50"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-stone-400 mt-2 w-5">{idx + 1}.</span>
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <input
                            type="text"
                            value={it.description}
                            onChange={(e) => updateItem(it._key, { description: e.target.value })}
                            placeholder="Descripción"
                            className="sm:col-span-6 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400/30 outline-none"
                          />
                          <input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) =>
                              updateItem(it._key, { quantity: Number(e.target.value) })
                            }
                            placeholder="Cant."
                            className="sm:col-span-2 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400/30 outline-none"
                            title="Cantidad"
                          />
                          <input
                            type="number"
                            min={0}
                            value={it.unit_price}
                            onChange={(e) =>
                              updateItem(it._key, { unit_price: Number(e.target.value) })
                            }
                            placeholder="Precio"
                            className="sm:col-span-4 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400/30 outline-none"
                            title="Precio unitario"
                          />
                          <input
                            type="text"
                            value={it.customization ?? ''}
                            onChange={(e) =>
                              updateItem(it._key, { customization: e.target.value })
                            }
                            placeholder="Personalización (opcional)"
                            className="sm:col-span-12 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400/30 outline-none"
                          />
                        </div>
                        <div className="flex flex-col items-end gap-1 min-w-[90px]">
                          <span className="text-sm font-medium text-stone-700 mt-1">
                            {formatCurrency(lineTotal)}
                          </span>
                          <button
                            onClick={() => removeItem(it._key)}
                            disabled={items.length <= 1}
                            className="text-stone-400 hover:text-red-600 disabled:opacity-30 p-1"
                            title="Quitar ítem"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Advanced (deposit, tax, terms) */}
            <div>
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-sm text-stone-600 hover:text-stone-800 inline-flex items-center gap-1"
              >
                {showAdvanced ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                Opciones avanzadas (anticipo, IVA, condiciones)
              </button>
              {showAdvanced && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Anticipo (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={depositPct}
                      onChange={(e) => setDepositPct(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400/30 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      IVA (monto)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400/30 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Días de entrega estimados
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={estimatedDays}
                      onChange={(e) => setEstimatedDays(e.target.value)}
                      placeholder="Opcional"
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400/30 outline-none"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Condiciones
                    </label>
                    <textarea
                      value={terms}
                      onChange={(e) => setTerms(e.target.value)}
                      rows={2}
                      placeholder="Condiciones comerciales (opcional)"
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400/30 outline-none"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Notas
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Notas internas (opcional)"
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400/30 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Totals preview */}
            <div className="border-t border-stone-200 pt-4">
              <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-1 text-sm">
                  <div className="flex justify-between text-stone-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotalPreview)}</span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>IVA</span>
                    <span>{formatCurrency(taxPreview)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-stone-900 text-base pt-1 border-t border-stone-100">
                    <span>Total</span>
                    <span>{formatCurrency(totalPreview)}</span>
                  </div>
                  <p className="text-[11px] text-stone-400 pt-1">
                    Vista previa. El total definitivo lo calcula el servidor.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
            <button
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg flex items-center transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Cotización
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick-create de cliente B2B (modal anidado en el form de cotización).
// Requiere b2b.manage_clients en el backend (POST /b2b/clients).
// ---------------------------------------------------------------------------

const SEGMENT_OPTIONS: { value: B2BSegment; label: string }[] = [
  { value: 'corporate', label: 'Corporativo' },
  { value: 'restaurant', label: 'Restaurante' },
  { value: 'sports', label: 'Deportivo' },
  { value: 'event', label: 'Evento' },
  { value: 'institutional', label: 'Institucional' },
];

interface QuickCreateClientModalProps {
  onClose: () => void;
  onCreated: (client: B2BClientResponse) => void;
}

function QuickCreateClientModal({ onClose, onCreated }: QuickCreateClientModalProps) {
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [segment, setSegment] = useState<B2BSegment>('corporate');
  const [paymentTermsDays, setPaymentTermsDays] = useState('0');
  const [contactName, setContactName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setFormError(null);
    if (!legalName.trim()) {
      setFormError('La razón social es obligatoria.');
      return;
    }
    if (!taxId.trim()) {
      setFormError('El NIT es obligatorio.');
      return;
    }
    const payload: B2BClientCreate = {
      legal_name: legalName.trim(),
      tax_id: taxId.trim(),
      segment,
      payment_terms_days: Number(paymentTermsDays) || 0,
      contact_name: contactName.trim() || null,
    };
    setSubmitting(true);
    try {
      const client = await b2bService.createClient(payload);
      onCreated(client);
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    'w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400/30 outline-none';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={submitting ? undefined : onClose} />
      <div className="relative bg-white dark:bg-stone-900 rounded-xl shadow-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-brand-600" />
            Nuevo cliente B2B
          </h3>
          <button onClick={onClose} disabled={submitting} className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Razón social <span className="text-red-500">*</span>
            </label>
            <input type="text" value={legalName} onChange={(e) => setLegalName(e.target.value)}
              placeholder="Ej: Hotel Estelar SAS" className={fieldClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                NIT <span className="text-red-500">*</span>
              </label>
              <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)}
                placeholder="900123456" className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Segmento</label>
              <select value={segment} onChange={(e) => setSegment(e.target.value as B2BSegment)}
                className={`${fieldClass} bg-white`}>
                {SEGMENT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Plazo de pago (días)</label>
              <input type="number" min={0} value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(e.target.value)} className={fieldClass} />
              <p className="text-xs text-stone-400 mt-1">0 = de contado.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Contacto</label>
              <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
                placeholder="Opcional" className={fieldClass} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} disabled={submitting}
            className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-lg flex items-center transition disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Crear cliente
          </button>
        </div>
      </div>
    </div>
  );
}
