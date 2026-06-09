/**
 * B2B Contracts Page - Contratos empresariales made-to-order (recurso GLOBAL).
 *
 * Ciclo de vida contable (FSM, validado en el servidor):
 *   pending_deposit -> in_production -> (partial_delivery) -> delivered -> closed
 *   pending_deposit | in_production -> cancelled
 *
 * El anticipo es un PASIVO (cuenta 2110 Anticipos de Clientes), NO ingreso: el
 * ingreso se reconoce SOLO en la entrega. La UI refleja ese flujo:
 *   - Stats cards por estado (clickable para filtrar)
 *   - Tabla con número, cliente, estado, total, saldo
 *   - Detalle con timeline de estados, panel anticipo/saldo, hitos y acciones
 *
 * Acciones de escritura gated por hasGlobalPermission (B2B es global):
 *   - b2b.manage_contracts: anticipo / entrega / hito / cobro de saldo
 *   - b2b.void_contracts:   cancelación
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
import { ElectronicInvoiceButton } from '../components/ElectronicInvoiceButton';
import { usePermissions } from '../hooks/usePermissions';
import { useDebounce } from '../hooks/useDebounce';
import { b2bService } from '../services/b2bService';
import { extractErrorMessage } from '../utils/api-client';
import { formatCurrency, formatDateSpanish, getColombiaDateString } from '../utils/formatting';
import type {
  AccPaymentMethod,
  ContractStatus,
  ContractListResponse,
  ContractResponse,
  ContractMilestoneResponse,
  MilestoneStatus,
} from '../types/api';
import {
  Briefcase,
  Search,
  AlertCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  X,
  CheckCircle,
  Clock,
  CircleDollarSign,
  PackageCheck,
  Truck,
  Archive,
  XCircle,
  Eye,
  Wallet,
  Ban,
  Layers,
  ArrowRight,
} from 'lucide-react';

// Payment methods usable as a cash/bank settlement (credit is excluded — a
// deposit / settlement must hit an actual account, not generate a receivable).
const SETTLEMENT_METHODS: AccPaymentMethod[] = ['cash', 'nequi', 'transfer', 'card'];

const ACC_PAYMENT_LABELS: Record<AccPaymentMethod, string> = {
  cash: 'Efectivo',
  nequi: 'Nequi',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  credit: 'Crédito',
  other: 'Otro',
};

function accLabel(method: AccPaymentMethod): string {
  return ACC_PAYMENT_LABELS[method] ?? method;
}

// FSM allowed transitions — mirror of app/services/contract/lifecycle.py.
const STATUS_ORDER: ContractStatus[] = [
  'pending_deposit',
  'in_production',
  'partial_delivery',
  'delivered',
  'closed',
  'cancelled',
];

// The "happy path" timeline shown in the detail panel (cancelled is off-path).
const TIMELINE: ContractStatus[] = [
  'pending_deposit',
  'in_production',
  'delivered',
  'closed',
];

interface StatusMeta {
  label: string;
  badge: string;
  card: string;
  cardActive: string;
  text: string;
  icon: typeof Clock;
}

const STATUS_META: Record<ContractStatus, StatusMeta> = {
  pending_deposit: {
    label: 'Pendiente Anticipo',
    badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    card: 'bg-amber-50 border border-amber-200 hover:border-amber-400',
    cardActive: 'bg-amber-200 border-2 border-amber-500 ring-2 ring-amber-300',
    text: 'text-amber-700',
    icon: CircleDollarSign,
  },
  in_production: {
    label: 'En Producción',
    badge: 'bg-brand-100 text-brand-700 ring-1 ring-brand-200',
    card: 'bg-brand-50 border border-brand-200 hover:border-brand-400',
    cardActive: 'bg-brand-200 border-2 border-brand-500 ring-2 ring-blue-300',
    text: 'text-brand-700',
    icon: Clock,
  },
  partial_delivery: {
    label: 'Entrega Parcial',
    badge: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
    card: 'bg-indigo-50 border border-indigo-200 hover:border-indigo-400',
    cardActive: 'bg-indigo-200 border-2 border-indigo-500 ring-2 ring-indigo-300',
    text: 'text-indigo-700',
    icon: Truck,
  },
  delivered: {
    label: 'Entregado',
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    card: 'bg-emerald-50 border border-emerald-200 hover:border-emerald-400',
    cardActive: 'bg-emerald-200 border-2 border-emerald-500 ring-2 ring-emerald-300',
    text: 'text-emerald-700',
    icon: PackageCheck,
  },
  closed: {
    label: 'Cerrado',
    badge: 'bg-stone-200 text-stone-700 ring-1 ring-stone-300',
    card: 'bg-stone-100 border border-stone-300 hover:border-stone-400',
    cardActive: 'bg-stone-300 border-2 border-stone-500 ring-2 ring-stone-400',
    text: 'text-stone-700',
    icon: Archive,
  },
  cancelled: {
    label: 'Cancelado',
    badge: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    card: 'bg-red-50 border border-red-200 hover:border-red-400',
    cardActive: 'bg-red-200 border-2 border-red-500 ring-2 ring-red-300',
    text: 'text-red-700',
    icon: XCircle,
  },
};

const MILESTONE_STATUS_META: Record<MilestoneStatus, { label: string; badge: string }> = {
  pending: { label: 'Pendiente', badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  delivered: { label: 'Entregado', badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  invoiced: { label: 'Facturado', badge: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' },
  paid: { label: 'Pagado', badge: 'bg-stone-200 text-stone-700 ring-1 ring-stone-300' },
};

const LIMIT = 50;

export default function B2BContracts() {
  // B2B es un recurso GLOBAL (sin school_id): usar hasGlobalPermission para que
  // el gating funcione aunque no haya colegio seleccionado en el store.
  const { hasGlobalPermission } = usePermissions();
  const canManageContracts = hasGlobalPermission('b2b.manage_contracts');
  const canVoidContracts = hasGlobalPermission('b2b.void_contracts');

  const [contracts, setContracts] = useState<ContractListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | ''>('');

  const debouncedSearch = useDebounce(searchTerm, 300);

  const [stats, setStats] = useState<Record<ContractStatus, number>>({
    pending_deposit: 0,
    in_production: 0,
    partial_delivery: 0,
    delivered: 0,
    closed: 0,
    cancelled: 0,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadContracts = useCallback(
    async (append = false) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setError(null);

        const skip = append ? contracts.length : 0;
        const response = await b2bService.getAllContracts({
          status: statusFilter || undefined,
          search: debouncedSearch || undefined,
          limit: LIMIT,
          skip,
        });
        const data = response.items ?? [];
        setContracts((prev) => (append ? [...prev, ...data] : data));
        setHasMore(response.has_more);
      } catch (err) {
        setError(extractErrorMessage(err));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [statusFilter, debouncedSearch, contracts.length]
  );

  // Per-status counts via independent count queries (Stats Pattern: never count
  // over a loaded page). Cheap limit=1 calls until a /stats endpoint exists.
  const loadStats = useCallback(async () => {
    try {
      const entries = await Promise.all(
        STATUS_ORDER.map(
          async (s) => [s, await b2bService.countContracts({ status: s })] as const
        )
      );
      setStats(Object.fromEntries(entries) as Record<ContractStatus, number>);
    } catch {
      // Stats are non-critical; keep the page usable if they fail.
    }
  }, []);

  useEffect(() => {
    loadContracts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, debouncedSearch]);

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAll = () => {
    loadContracts(false);
    loadStats();
  };

  const handleActionDone = (notice: string) => {
    setActionNotice(notice);
    setActionError(null);
    refreshAll();
  };

  const hasActiveFilters = Boolean(debouncedSearch || statusFilter);

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100">Contratos B2B</h1>
          <p className="text-stone-600 dark:text-stone-400 mt-1">
            {loading
              ? 'Cargando...'
              : `${contracts.length} contratos${hasActiveFilters ? ' (filtrados)' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            disabled={loading}
            className="bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 px-3 py-2 rounded-lg flex items-center transition disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
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
      <div className="bg-white dark:bg-stone-800 rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input
              type="text"
              placeholder="Buscar por número (CTR-2026-...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-200 dark:border-stone-600 dark:bg-stone-700 dark:text-stone-100 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ContractStatus | '')}
            className="px-4 py-2 border border-stone-200 dark:border-stone-600 dark:bg-stone-700 dark:text-stone-100 rounded-lg focus:ring-2 focus:ring-brand-400/30 outline-none"
          >
            <option value="">Todos los estados</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <span className="ml-3 text-stone-600 dark:text-stone-400">Cargando contratos...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error al cargar contratos</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                onClick={() => loadContracts(false)}
                className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && contracts.length > 0 && (
        <div className="bg-white dark:bg-stone-800 rounded-lg shadow-sm overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-100 dark:divide-stone-700">
            <thead className="bg-stone-50 dark:bg-stone-900/40">
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
                <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Saldo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Entrega
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-stone-800 divide-y divide-stone-100 dark:divide-stone-700">
              {contracts.map((c) => {
                const meta = STATUS_META[c.status];
                const Icon = meta.icon;
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-stone-50 dark:hover:bg-stone-700/40 cursor-pointer"
                    onClick={() => setSelectedId(c.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono font-medium text-stone-900 dark:text-stone-100">
                        {c.contract_number}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="text-sm text-stone-700 dark:text-stone-200"
                        title={c.b2b_client_id}
                      >
                        {c.client_name ?? `${c.b2b_client_id.slice(0, 8)}…`}
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-stone-900 dark:text-stone-100">
                      {formatCurrency(c.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-stone-600 dark:text-stone-300">
                      {formatCurrency(c.balance_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600 dark:text-stone-300">
                      {c.delivery_date ? formatDateSpanish(c.delivery_date) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(c.id);
                        }}
                        className="text-brand-600 hover:text-brand-700 p-2 rounded hover:bg-brand-50 transition inline-flex items-center gap-1"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="text-xs">Detalle</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {hasMore && (
            <div className="p-4 border-t border-stone-200 dark:border-stone-700 text-center">
              <button
                onClick={() => loadContracts(true)}
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
                    Cargar más contratos
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && contracts.length === 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-12 text-center">
          <Briefcase className="w-16 h-16 text-brand-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-brand-700 mb-2">
            {hasActiveFilters ? 'No se encontraron contratos' : 'No hay contratos'}
          </h3>
          <p className="text-brand-700">
            {hasActiveFilters
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'Los contratos se generan al convertir una cotización aceptada.'}
          </p>
        </div>
      )}

      {/* Detail panel */}
      {selectedId && (
        <ContractDetailDrawer
          contractId={selectedId}
          canManageContracts={canManageContracts}
          canVoidContracts={canVoidContracts}
          onClose={() => setSelectedId(null)}
          onActionDone={handleActionDone}
          onActionError={(msg) => setActionError(msg)}
        />
      )}
    </Layout>
  );
}

// ---------------------------------------------------------------------------
// Contract Detail Drawer
// ---------------------------------------------------------------------------

type ActiveModal = 'deposit' | 'deliver' | 'pay' | 'cancel' | null;

interface ContractDetailDrawerProps {
  contractId: string;
  canManageContracts: boolean;
  canVoidContracts: boolean;
  onClose: () => void;
  onActionDone: (notice: string) => void;
  onActionError: (msg: string) => void;
}

function ContractDetailDrawer({
  contractId,
  canManageContracts,
  canVoidContracts,
  onClose,
  onActionDone,
  onActionError,
}: ContractDetailDrawerProps) {
  const [contract, setContract] = useState<ContractResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [milestoneTarget, setMilestoneTarget] = useState<ContractMilestoneResponse | null>(null);

  const loadContract = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await b2bService.getContractById(contractId);
      setContract(data);
    } catch (err) {
      setLoadError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    loadContract();
  }, [loadContract]);

  // Refresh the drawer after a successful action and bubble a notice up.
  const handleSuccess = (updated: ContractResponse, notice: string) => {
    setContract(updated);
    setActiveModal(null);
    setMilestoneTarget(null);
    onActionDone(notice);
  };

  const status = contract?.status;
  const canDeposit = canManageContracts && status === 'pending_deposit';
  const canDeliverWhole =
    canManageContracts &&
    !contract?.has_milestones &&
    (status === 'in_production' || status === 'partial_delivery');
  // "Cobrar saldo" solo cuando hay una CxC ABIERTA real (outstanding_balance),
  // no el balance_amount contractual estático: los contratos de contado liquidan
  // el saldo en la entrega (sin CxC) y mostrar el botón llevaba a un error 404.
  const canPay =
    canManageContracts &&
    (status === 'delivered' || status === 'partial_delivery') &&
    Number(contract?.outstanding_balance ?? 0) > 0;
  const canCancel =
    canVoidContracts && (status === 'pending_deposit' || status === 'in_production');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="flex min-h-screen items-start justify-end">
        <div className="relative bg-white dark:bg-stone-900 shadow-2xl w-full max-w-2xl min-h-screen overflow-y-auto flex flex-col">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-stone-200 dark:border-stone-700 bg-brand-50 dark:bg-stone-800">
            <div>
              <h2 className="text-lg font-bold text-brand-800 dark:text-brand-200 flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                {contract ? contract.contract_number : 'Contrato'}
              </h2>
              {contract && (
                <p className="text-xs text-brand-600 dark:text-brand-300 mt-0.5">
                  Cliente: {contract.client_name ?? contract.b2b_client_id}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 p-5 space-y-6">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-7 h-7 animate-spin text-brand-600" />
                <span className="ml-3 text-stone-600 dark:text-stone-400">Cargando contrato...</span>
              </div>
            )}

            {loadError && !loading && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2 text-sm text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{loadError}</span>
              </div>
            )}

            {contract && !loading && (
              <>
                {/* Timeline */}
                <StatusTimeline status={contract.status} />

                {/* Financial summary */}
                <FinancialSummary contract={contract} />

                {/* Milestones */}
                {contract.has_milestones && (
                  <MilestonesPanel
                    milestones={contract.milestones}
                    canManageContracts={canManageContracts}
                    contractStatus={contract.status}
                    onDeliver={(m) => {
                      setMilestoneTarget(m);
                      setActiveModal('deliver');
                    }}
                  />
                )}

                {/* Notes */}
                {contract.notes && (
                  <div>
                    <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-200 mb-1">
                      Notas
                    </h3>
                    <p className="text-sm text-stone-600 dark:text-stone-300 whitespace-pre-wrap">
                      {contract.notes}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="border-t border-stone-200 dark:border-stone-700 pt-4 flex flex-wrap gap-2">
                  {canDeposit && (
                    <button
                      onClick={() => setActiveModal('deposit')}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg inline-flex items-center gap-2 transition text-sm"
                    >
                      <CircleDollarSign className="w-4 h-4" />
                      Registrar anticipo
                    </button>
                  )}
                  {canDeliverWhole && (
                    <button
                      onClick={() => {
                        setMilestoneTarget(null);
                        setActiveModal('deliver');
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg inline-flex items-center gap-2 transition text-sm"
                    >
                      <PackageCheck className="w-4 h-4" />
                      Registrar entrega
                    </button>
                  )}
                  {canPay && (
                    <button
                      onClick={() => setActiveModal('pay')}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg inline-flex items-center gap-2 transition text-sm"
                    >
                      <Wallet className="w-4 h-4" />
                      Cobrar saldo
                    </button>
                  )}
                  {canCancel && (
                    <button
                      onClick={() => setActiveModal('cancel')}
                      className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg inline-flex items-center gap-2 transition text-sm"
                    >
                      <Ban className="w-4 h-4" />
                      Cancelar contrato
                    </button>
                  )}
                  {!canManageContracts && !canVoidContracts && (
                    <p className="text-xs text-stone-400">
                      Solo lectura: no tienes permisos para gestionar este contrato.
                    </p>
                  )}
                </div>

                {/* Factura electrónica DIAN — dotación corporativa B2B grava IVA.
                    B2B es global → el botón resuelve los permisos invoicing.* de
                    forma global. Disponible una vez hay entrega (facturable). */}
                {(contract.status === 'delivered' ||
                  contract.status === 'closed' ||
                  contract.status === 'partial_delivery') && (
                  <div className="border-t border-stone-200 dark:border-stone-700 pt-4">
                    <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-200 mb-2">
                      Factura electrónica
                    </h3>
                    <ElectronicInvoiceButton
                      documentType="contract"
                      documentId={contract.id}
                      global
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action modals */}
          {contract && activeModal === 'deposit' && (
            <DepositModal
              contract={contract}
              onClose={() => setActiveModal(null)}
              onSuccess={handleSuccess}
              onError={onActionError}
            />
          )}
          {contract && activeModal === 'deliver' && (
            <DeliveryModal
              contract={contract}
              milestone={milestoneTarget}
              onClose={() => {
                setActiveModal(null);
                setMilestoneTarget(null);
              }}
              onSuccess={handleSuccess}
              onError={onActionError}
            />
          )}
          {contract && activeModal === 'pay' && (
            <PayBalanceModal
              contract={contract}
              onClose={() => setActiveModal(null)}
              onSuccess={handleSuccess}
              onError={onActionError}
            />
          )}
          {contract && activeModal === 'cancel' && (
            <CancelModal
              contract={contract}
              onClose={() => setActiveModal(null)}
              onSuccess={handleSuccess}
              onError={onActionError}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail sub-components
// ---------------------------------------------------------------------------

function StatusTimeline({ status }: { status: ContractStatus }) {
  if (status === 'cancelled') {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2 text-sm text-red-700">
        <XCircle className="w-5 h-5" />
        Contrato cancelado.
      </div>
    );
  }

  // partial_delivery sits between in_production and delivered on the timeline.
  const effectiveIndex = (() => {
    if (status === 'partial_delivery') return TIMELINE.indexOf('in_production');
    return TIMELINE.indexOf(status);
  })();

  return (
    <div>
      <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-200 mb-3">Estado</h3>
      <div className="flex items-center">
        {TIMELINE.map((s, idx) => {
          const meta = STATUS_META[s];
          const Icon = meta.icon;
          const reached = idx <= effectiveIndex;
          const isCurrent =
            idx === effectiveIndex ||
            (status === 'partial_delivery' && s === 'in_production');
          return (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    reached
                      ? 'bg-brand-600 text-white'
                      : 'bg-stone-200 dark:bg-stone-700 text-stone-400'
                  } ${isCurrent ? 'ring-4 ring-brand-200 dark:ring-brand-900' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className={`mt-1 text-[10px] text-center max-w-[72px] leading-tight ${
                    reached ? 'text-stone-700 dark:text-stone-200 font-medium' : 'text-stone-400'
                  }`}
                >
                  {s === 'in_production' && status === 'partial_delivery'
                    ? 'Entrega Parcial'
                    : meta.label}
                </span>
              </div>
              {idx < TIMELINE.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 ${
                    idx < effectiveIndex ? 'bg-brand-600' : 'bg-stone-200 dark:bg-stone-700'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FinancialSummary({ contract }: { contract: ContractResponse }) {
  const depositReceived = Boolean(contract.deposit_received_at);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="rounded-lg border border-stone-200 dark:border-stone-700 p-4 bg-stone-50/50 dark:bg-stone-800/50">
        <p className="text-xs text-stone-500">Total contrato</p>
        <p className="text-xl font-bold text-stone-900 dark:text-stone-100">
          {formatCurrency(contract.total)}
        </p>
      </div>
      <div className="rounded-lg border border-amber-200 p-4 bg-amber-50/60">
        <p className="text-xs text-amber-700 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5" />
          Anticipo (pasivo 2110)
        </p>
        <p className="text-xl font-bold text-amber-800">
          {formatCurrency(contract.deposit_amount)}
        </p>
        <p className="text-[11px] mt-0.5 text-amber-600">
          {depositReceived
            ? `Recibido el ${formatDateSpanish(contract.deposit_received_at as string)}`
            : 'Pendiente de recibir'}
        </p>
      </div>
      <div className="rounded-lg border border-brand-200 p-4 bg-brand-50/60">
        {/* Tras la entrega mostramos el saldo REALMENTE por cobrar (CxC abierta):
            un contrato de contado lo liquida en la entrega → "Saldo liquidado". */}
        <p className="text-xs text-brand-700">
          {contract.delivered_at && Number(contract.outstanding_balance ?? 0) === 0
            ? 'Saldo liquidado'
            : 'Saldo pendiente'}
        </p>
        <p className="text-xl font-bold text-brand-800">
          {formatCurrency(
            contract.delivered_at ? (contract.outstanding_balance ?? 0) : contract.balance_amount
          )}
        </p>
        {contract.delivered_at && (
          <p className="text-[11px] mt-0.5 text-brand-600">
            Entregado el {formatDateSpanish(contract.delivered_at)}
          </p>
        )}
      </div>
    </div>
  );
}

function MilestonesPanel({
  milestones,
  canManageContracts,
  contractStatus,
  onDeliver,
}: {
  milestones: ContractMilestoneResponse[];
  canManageContracts: boolean;
  contractStatus: ContractStatus;
  onDeliver: (m: ContractMilestoneResponse) => void;
}) {
  const sorted = useMemo(
    () => [...milestones].sort((a, b) => a.sequence - b.sequence),
    [milestones]
  );
  // Milestones can only be delivered once the deposit is in and the contract is
  // in production / partial delivery.
  const deliverableStage =
    contractStatus === 'in_production' || contractStatus === 'partial_delivery';

  return (
    <div>
      <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-200 mb-2 flex items-center gap-1">
        <Layers className="w-4 h-4" />
        Hitos ({sorted.length})
      </h3>
      <div className="space-y-2">
        {sorted.map((m) => {
          const meta = MILESTONE_STATUS_META[m.status];
          const canDeliver =
            canManageContracts && deliverableStage && m.status === 'pending';
          return (
            <div
              key={m.id}
              className="border border-stone-200 dark:border-stone-700 rounded-lg p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-stone-400">#{m.sequence}</span>
                  <span className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">
                    {m.description}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-stone-600 dark:text-stone-300">
                    {formatCurrency(m.amount)}
                  </span>
                  {m.due_date && (
                    <span className="text-[11px] text-stone-400">
                      vence {formatDateSpanish(m.due_date)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${meta.badge}`}
                >
                  {meta.label}
                </span>
                {canDeliver && (
                  <button
                    onClick={() => onDeliver(m)}
                    className="text-emerald-600 hover:text-emerald-700 p-1.5 rounded hover:bg-emerald-50 transition inline-flex items-center gap-1"
                    title="Registrar entrega del hito"
                  >
                    <Truck className="w-4 h-4" />
                    <span className="text-xs">Entregar</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action modals
// ---------------------------------------------------------------------------

interface ModalShellProps {
  title: string;
  icon: typeof CircleDollarSign;
  children: React.ReactNode;
  footer: React.ReactNode;
  onClose: () => void;
}

function ModalShell({ title, icon: Icon, children, footer, onClose }: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white dark:bg-stone-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800">
            <h3 className="text-base font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
              <Icon className="w-5 h-5" />
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-5 space-y-4">{children}</div>
          <div className="p-4 border-t border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 flex items-center justify-end gap-2">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ActionModalProps {
  contract: ContractResponse;
  onClose: () => void;
  onSuccess: (updated: ContractResponse, notice: string) => void;
  onError: (msg: string) => void;
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2 text-sm text-red-700">
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

const fieldClass =
  'w-full px-3 py-2 border border-stone-200 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 rounded-lg text-sm focus:ring-2 focus:ring-brand-400/30 outline-none';
const labelClass = 'block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1';

function DepositModal({ contract, onClose, onSuccess, onError }: ActionModalProps) {
  const [method, setMethod] = useState<AccPaymentMethod>('cash');
  const [amount, setAmount] = useState(String(contract.deposit_amount || ''));
  const [paymentDate, setPaymentDate] = useState(getColombiaDateString());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setFormError(null);
    const numericAmount = Number(amount);
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      setFormError('El monto del anticipo debe ser mayor a 0.');
      return;
    }
    try {
      setSubmitting(true);
      const updated = await b2bService.recordDeposit(contract.id, {
        payment_method: method,
        amount: numericAmount,
        payment_date: paymentDate || undefined,
      });
      onSuccess(
        updated,
        `Anticipo de ${formatCurrency(numericAmount)} registrado en ${contract.contract_number}.`
      );
    } catch (err) {
      const msg = extractErrorMessage(err);
      setFormError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="Registrar anticipo" icon={CircleDollarSign} onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <SubmitButton submitting={submitting} onClick={handleSubmit} label="Registrar" />
        </>
      }
    >
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        El anticipo entra a caja y se registra como pasivo (Anticipos de Clientes). No es ingreso
        hasta la entrega.
      </p>
      <FormError message={formError} />
      <div>
        <label className={labelClass}>Método de pago</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as AccPaymentMethod)}
          className={fieldClass}
        >
          {SETTLEMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {accLabel(m)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Monto del anticipo</label>
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={fieldClass}
        />
        <p className="text-[11px] text-stone-400 mt-1">
          Sugerido por contrato: {formatCurrency(contract.deposit_amount)}
        </p>
      </div>
      <div>
        <label className={labelClass}>Fecha del anticipo</label>
        <input
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          className={fieldClass}
        />
      </div>
    </ModalShell>
  );
}

function DeliveryModal({
  contract,
  milestone,
  onClose,
  onSuccess,
  onError,
}: ActionModalProps & { milestone: ContractMilestoneResponse | null }) {
  const [deliveryDate, setDeliveryDate] = useState(getColombiaDateString());
  const [settlementMethod, setSettlementMethod] = useState<AccPaymentMethod>('cash');
  const [cogs, setCogs] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isMilestone = Boolean(milestone);
  const recognized = isMilestone ? milestone!.amount : contract.total;

  const handleSubmit = async () => {
    setFormError(null);
    let cogsAmount: number | undefined;
    if (cogs.trim()) {
      const n = Number(cogs);
      if (isNaN(n) || n < 0) {
        setFormError('El costo (COGS) no puede ser negativo.');
        return;
      }
      cogsAmount = n;
    }
    try {
      setSubmitting(true);
      const updated = isMilestone
        ? await b2bService.deliverMilestone(contract.id, milestone!.id, {
            delivery_date: deliveryDate || undefined,
            settlement_method: settlementMethod,
            cogs_amount: cogsAmount,
          })
        : await b2bService.recordDelivery(contract.id, {
            delivery_date: deliveryDate || undefined,
            settlement_method: settlementMethod,
            cogs_amount: cogsAmount,
          });
      onSuccess(
        updated,
        isMilestone
          ? `Hito #${milestone!.sequence} entregado en ${contract.contract_number}.`
          : `Entrega registrada en ${contract.contract_number}.`
      );
    } catch (err) {
      const msg = extractErrorMessage(err);
      setFormError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title={isMilestone ? `Entregar hito #${milestone!.sequence}` : 'Registrar entrega'}
      icon={PackageCheck}
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <SubmitButton submitting={submitting} onClick={handleSubmit} label="Registrar entrega" />
        </>
      }
    >
      <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
        Reconoce el ingreso de {formatCurrency(recognized)}, reversa el anticipo aplicado y, si el
        cliente es a crédito, genera la cuenta por cobrar del saldo.
      </p>
      <FormError message={formError} />
      <div>
        <label className={labelClass}>Fecha de entrega</label>
        <input
          type="date"
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass}>Método de liquidación del saldo (si es de contado)</label>
        <select
          value={settlementMethod}
          onChange={(e) => setSettlementMethod(e.target.value as AccPaymentMethod)}
          className={fieldClass}
        >
          {SETTLEMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {accLabel(m)}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-stone-400 mt-1">
          Si el cliente es a crédito, el saldo va a cuenta por cobrar y este método se ignora.
        </p>
      </div>
      <div>
        <label className={labelClass}>Costo de producción / COGS (opcional)</label>
        <input
          type="number"
          min={0}
          value={cogs}
          onChange={(e) => setCogs(e.target.value)}
          placeholder="0"
          className={fieldClass}
        />
      </div>
    </ModalShell>
  );
}

function PayBalanceModal({ contract, onClose, onSuccess, onError }: ActionModalProps) {
  const outstanding = contract.outstanding_balance ?? contract.balance_amount;
  const [amount, setAmount] = useState(String(outstanding || ''));
  const [method, setMethod] = useState<AccPaymentMethod>('cash');
  const [paymentDate, setPaymentDate] = useState(getColombiaDateString());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setFormError(null);
    const numericAmount = Number(amount);
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      setFormError('El monto del cobro debe ser mayor a 0.');
      return;
    }
    try {
      setSubmitting(true);
      const updated = await b2bService.payBalance(contract.id, {
        amount: numericAmount,
        payment_method: method,
        payment_date: paymentDate || undefined,
      });
      onSuccess(
        updated,
        `Cobro de ${formatCurrency(numericAmount)} aplicado al saldo de ${contract.contract_number}.`
      );
    } catch (err) {
      const msg = extractErrorMessage(err);
      setFormError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="Cobrar saldo" icon={Wallet} onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <SubmitButton submitting={submitting} onClick={handleSubmit} label="Registrar cobro" />
        </>
      }
    >
      <p className="text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
        Mueve la cuenta por cobrar a caja. No re-reconoce ingreso (ya se reconoció en la entrega).
      </p>
      <FormError message={formError} />
      <div className="rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-3 py-2 text-sm flex items-center justify-between">
        <span className="text-stone-500">Saldo pendiente</span>
        <span className="font-bold text-stone-800 dark:text-stone-100">
          {formatCurrency(outstanding)}
        </span>
      </div>
      <div>
        <label className={labelClass}>Monto a cobrar</label>
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass}>Método de pago</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as AccPaymentMethod)}
          className={fieldClass}
        >
          {SETTLEMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {accLabel(m)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Fecha del cobro</label>
        <input
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          className={fieldClass}
        />
      </div>
    </ModalShell>
  );
}

function CancelModal({ contract, onClose, onSuccess, onError }: ActionModalProps) {
  const [retainDeposit, setRetainDeposit] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const depositReceived = Boolean(contract.deposit_received_at);

  const handleSubmit = async () => {
    setFormError(null);
    try {
      setSubmitting(true);
      const updated = await b2bService.cancelContract(contract.id, {
        retain_deposit: retainDeposit,
        reason: reason.trim() || undefined,
      });
      onSuccess(updated, `Contrato ${contract.contract_number} cancelado.`);
    } catch (err) {
      const msg = extractErrorMessage(err);
      setFormError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="Cancelar contrato" icon={Ban} onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition disabled:opacity-50"
          >
            Volver
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center transition disabled:opacity-50 text-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelando...
              </>
            ) : (
              <>
                <Ban className="w-4 h-4 mr-2" />
                Confirmar cancelación
              </>
            )}
          </button>
        </>
      }
    >
      <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        Esta acción no se puede deshacer. Los contratos con entregas registradas no se pueden
        cancelar (requieren devolución / nota crédito).
      </p>
      <FormError message={formError} />
      {depositReceived && (
        <div className="space-y-2">
          <label className={labelClass}>Política del anticipo</label>
          <label className="flex items-start gap-2 text-sm text-stone-700 dark:text-stone-200 cursor-pointer">
            <input
              type="radio"
              name="retain"
              checked={!retainDeposit}
              onChange={() => setRetainDeposit(false)}
              className="mt-1"
            />
            <span>
              Devolver el anticipo al cliente
              <span className="block text-[11px] text-stone-400">
                Reversa caja y pasivo. No afecta P&amp;L.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-stone-700 dark:text-stone-200 cursor-pointer">
            <input
              type="radio"
              name="retain"
              checked={retainDeposit}
              onChange={() => setRetainDeposit(true)}
              className="mt-1"
            />
            <span>
              Retener el anticipo como penalidad
              <span className="block text-[11px] text-stone-400">
                Realiza el anticipo como ingreso. La caja conserva el efectivo.
              </span>
            </span>
          </label>
        </div>
      )}
      <div>
        <label className={labelClass}>Motivo (opcional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Motivo de la cancelación"
          className={fieldClass}
        />
      </div>
    </ModalShell>
  );
}

function SubmitButton({
  submitting,
  onClick,
  label,
}: {
  submitting: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={submitting}
      className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg flex items-center transition disabled:opacity-50 text-sm"
    >
      {submitting ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Guardando...
        </>
      ) : (
        <>
          <ArrowRight className="w-4 h-4 mr-2" />
          {label}
        </>
      )}
    </button>
  );
}
