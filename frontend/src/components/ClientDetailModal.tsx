/**
 * Client Detail Modal
 *
 * Tabs:
 * - Resumen: contact info, summary stats, portal status
 * - Compras: paginated sales list
 * - Encargos: paginated orders list
 * - Arreglos: paginated alterations list
 * - CxC: paginated receivables list
 */
import { useState, useEffect, useMemo } from 'react';
import ModalWrapper from './common/ModalWrapper';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  GraduationCap,
  MessageCircle,
  Edit2,
  Send,
  CheckCircle,
  Clock,
  Loader2,
  StickyNote,
  ShoppingBag,
  DollarSign,
  Package,
  Calendar,
  AlertCircle,
  Scissors,
  Receipt,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import type {
  Client,
  SaleListItem,
  OrderListItem,
  AlterationListItem,
  PaginatedResponse,
} from '../types/api';
import { openWhatsApp, DEFAULT_WHATSAPP_MESSAGE, formatPhoneDisplay } from '../utils/whatsapp';
import { clientService } from '../services/clientService';
import { saleService } from '../services/saleService';
import { orderService } from '../services/orderService';
import { alterationService } from '../services/alterationService';
import {
  getGlobalReceivables,
  type AccountsReceivableListItem,
} from '../services/globalAccountingService';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface ClientSummary {
  total_purchases: number;
  total_spent: number;
  pending_orders: number;
  last_purchase_date: string | null;
  schools: string[];
}

type TabKey = 'resumen' | 'compras' | 'encargos' | 'arreglos' | 'cxc';

interface ClientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  onEdit?: () => void;
  onUpdated?: () => void;
}

const PAGE_SIZE = 20;

const formatMoney = (value: number) =>
  `$${Number(value || 0).toLocaleString('es-CO')}`;

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota',
  });
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_production: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-blue-100 text-blue-700',
  ready: 'bg-green-100 text-green-700',
  delivered: 'bg-stone-100 text-stone-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  in_production: 'En produccion',
  in_progress: 'En proceso',
  ready: 'Listo',
  delivered: 'Entregado',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

interface TabState<T> {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  data: PaginatedResponse<T> | null;
}

const emptyTab = <T,>(): TabState<T> => ({
  loaded: false,
  loading: false,
  error: null,
  data: null,
});

export default function ClientDetailModal({
  isOpen,
  onClose,
  client,
  onEdit,
  onUpdated,
}: ClientDetailModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('resumen');
  const [resendingEmail, setResendingEmail] = useState(false);
  const [summary, setSummary] = useState<ClientSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [salesTab, setSalesTab] = useState<TabState<SaleListItem>>(emptyTab());
  const [ordersTab, setOrdersTab] = useState<TabState<OrderListItem>>(emptyTab());
  const [alterationsTab, setAlterationsTab] = useState<TabState<AlterationListItem>>(emptyTab());
  const [receivablesTab, setReceivablesTab] = useState<TabState<AccountsReceivableListItem>>(emptyTab());

  // Reset tab state when client changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('resumen');
      setSalesTab(emptyTab());
      setOrdersTab(emptyTab());
      setAlterationsTab(emptyTab());
      setReceivablesTab(emptyTab());
    }
  }, [isOpen, client?.id]);

  // Load summary on open
  useEffect(() => {
    if (isOpen && client?.id) {
      setLoadingSummary(true);
      setSummaryError(null);
      clientService.getClientSummary(client.id)
        .then((data) => setSummary(data))
        .catch((err) => {
          console.error('Error loading client summary:', err);
          setSummaryError('No se pudo cargar el historial');
        })
        .finally(() => setLoadingSummary(false));
    }
  }, [isOpen, client?.id]);

  // Lazy-load tab data
  useEffect(() => {
    if (!isOpen || !client?.id) return;
    if (activeTab === 'resumen') return;

    if (activeTab === 'compras' && !salesTab.loaded && !salesTab.loading) {
      setSalesTab((s) => ({ ...s, loading: true, error: null }));
      saleService
        .getAllSales({ client_id: client.id, limit: PAGE_SIZE, include_historical: true })
        .then((data) => setSalesTab({ loaded: true, loading: false, error: null, data }))
        .catch((err) => {
          console.error('Error loading sales:', err);
          setSalesTab({ loaded: true, loading: false, error: 'No se pudo cargar las ventas', data: null });
        });
    }

    if (activeTab === 'encargos' && !ordersTab.loaded && !ordersTab.loading) {
      setOrdersTab((s) => ({ ...s, loading: true, error: null }));
      orderService
        .getAllOrders({ client_id: client.id, limit: PAGE_SIZE })
        .then((data) => setOrdersTab({ loaded: true, loading: false, error: null, data }))
        .catch((err) => {
          console.error('Error loading orders:', err);
          setOrdersTab({ loaded: true, loading: false, error: 'No se pudo cargar los encargos', data: null });
        });
    }

    if (activeTab === 'arreglos' && !alterationsTab.loaded && !alterationsTab.loading) {
      setAlterationsTab((s) => ({ ...s, loading: true, error: null }));
      alterationService
        .getAll({ client_id: client.id, limit: PAGE_SIZE })
        .then((data) => setAlterationsTab({ loaded: true, loading: false, error: null, data }))
        .catch((err) => {
          console.error('Error loading alterations:', err);
          setAlterationsTab({ loaded: true, loading: false, error: 'No se pudo cargar los arreglos', data: null });
        });
    }

    if (activeTab === 'cxc' && !receivablesTab.loaded && !receivablesTab.loading) {
      setReceivablesTab((s) => ({ ...s, loading: true, error: null }));
      getGlobalReceivables({ clientId: client.id, limit: PAGE_SIZE })
        .then((data) => setReceivablesTab({ loaded: true, loading: false, error: null, data }))
        .catch((err) => {
          console.error('Error loading receivables:', err);
          setReceivablesTab({ loaded: true, loading: false, error: 'No se pudo cargar las cuentas por cobrar', data: null });
        });
    }
  }, [activeTab, isOpen, client?.id, salesTab.loaded, salesTab.loading, ordersTab.loaded, ordersTab.loading, alterationsTab.loaded, alterationsTab.loading, receivablesTab.loaded, receivablesTab.loading]);

  const getActivationStatus = (): {
    label: string;
    color: string;
    icon: typeof CheckCircle;
  } => {
    if (client.is_verified && client.has_password) {
      return { label: 'Activado', color: 'text-green-600 bg-green-50', icon: CheckCircle };
    }
    if (client.welcome_email_sent) {
      return { label: 'Pendiente', color: 'text-yellow-600 bg-yellow-50', icon: Clock };
    }
    if (client.email) {
      return { label: 'Sin enviar', color: 'text-stone-500 bg-stone-50', icon: Mail };
    }
    return { label: 'Sin email', color: 'text-stone-400 bg-stone-50', icon: Mail };
  };

  const handleWhatsApp = () => {
    if (client.phone) {
      openWhatsApp(client.phone, DEFAULT_WHATSAPP_MESSAGE);
    }
  };

  const handleEmail = () => {
    if (client.email) {
      window.location.href = `mailto:${client.email}`;
    }
  };

  const handleResendActivation = async () => {
    if (!client.email) {
      toast.error('El cliente no tiene email registrado');
      return;
    }
    setResendingEmail(true);
    try {
      const result = await clientService.resendActivationEmail(client.id);
      toast.success(result.message);
      onUpdated?.();
    } catch (err: any) {
      console.error('Error resending activation:', err);
      toast.error(err.response?.data?.detail || 'Error al enviar el correo');
    } finally {
      setResendingEmail(false);
    }
  };

  const goToFullPage = (path: string) => {
    onClose();
    navigate(path);
  };

  const tabsMeta = useMemo(() => ([
    { key: 'resumen' as TabKey, label: 'Resumen', icon: User, count: null as number | null },
    { key: 'compras' as TabKey, label: 'Compras', icon: ShoppingBag, count: salesTab.data?.total ?? summary?.total_purchases ?? null },
    { key: 'encargos' as TabKey, label: 'Encargos', icon: Package, count: ordersTab.data?.total ?? summary?.pending_orders ?? null },
    { key: 'arreglos' as TabKey, label: 'Arreglos', icon: Scissors, count: alterationsTab.data?.total ?? null },
    { key: 'cxc' as TabKey, label: 'CxC', icon: Receipt, count: receivablesTab.data?.total ?? null },
  ]), [summary, salesTab.data, ordersTab.data, alterationsTab.data, receivablesTab.data]);

  const activationStatus = getActivationStatus();
  const StatusIcon = activationStatus.icon;

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl">
      <div className="max-h-[90vh] overflow-hidden flex flex-col rounded-xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">{client.name}</h2>
              <p className="text-blue-100 text-sm flex items-center gap-2">
                <span className="bg-brand-500 px-2 py-0.5 rounded text-xs">
                  {client.code}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    client.is_active ? 'bg-green-500' : 'bg-stone-500'
                  }`}
                >
                  {client.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 rounded-lg p-2 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-stone-200 bg-white px-2 flex overflow-x-auto">
          {tabsMeta.map(({ key, label, icon: Icon, count }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                  active
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {count !== null && count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-brand-100 text-brand-700' : 'bg-stone-100 text-stone-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'resumen' && (
            <ResumenTab
              client={client}
              summary={summary}
              loadingSummary={loadingSummary}
              summaryError={summaryError}
              activationStatus={activationStatus}
              StatusIcon={StatusIcon}
              resendingEmail={resendingEmail}
              onWhatsApp={handleWhatsApp}
              onEmail={handleEmail}
              onResendActivation={handleResendActivation}
            />
          )}

          {activeTab === 'compras' && (
            <ListContainer
              loading={salesTab.loading}
              error={salesTab.error}
              empty={salesTab.data?.items.length === 0}
              emptyLabel="Sin compras registradas"
              showAllAction={
                salesTab.data && salesTab.data.total > PAGE_SIZE
                  ? () => goToFullPage(`/sales?client=${client.id}`)
                  : undefined
              }
            >
              {salesTab.data?.items.map((s) => (
                <SaleRow
                  key={s.id}
                  sale={s}
                  onClick={() => goToFullPage(`/sales/${s.id}`)}
                />
              ))}
            </ListContainer>
          )}

          {activeTab === 'encargos' && (
            <ListContainer
              loading={ordersTab.loading}
              error={ordersTab.error}
              empty={ordersTab.data?.items.length === 0}
              emptyLabel="Sin encargos"
              showAllAction={
                ordersTab.data && ordersTab.data.total > PAGE_SIZE
                  ? () => goToFullPage(`/orders?client=${client.id}`)
                  : undefined
              }
            >
              {ordersTab.data?.items.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  onClick={() =>
                    goToFullPage(
                      o.school_id
                        ? `/orders/${o.id}?school_id=${o.school_id}`
                        : `/orders/${o.id}`,
                    )
                  }
                />
              ))}
            </ListContainer>
          )}

          {activeTab === 'arreglos' && (
            <ListContainer
              loading={alterationsTab.loading}
              error={alterationsTab.error}
              empty={alterationsTab.data?.items.length === 0}
              emptyLabel="Sin arreglos"
              showAllAction={
                alterationsTab.data && alterationsTab.data.total > PAGE_SIZE
                  ? () => goToFullPage(`/alterations?client=${client.id}`)
                  : undefined
              }
            >
              {alterationsTab.data?.items.map((a) => (
                <AlterationRow
                  key={a.id}
                  alteration={a}
                  onClick={() => goToFullPage(`/alterations/${a.id}`)}
                />
              ))}
            </ListContainer>
          )}

          {activeTab === 'cxc' && (
            <ListContainer
              loading={receivablesTab.loading}
              error={receivablesTab.error}
              empty={receivablesTab.data?.items.length === 0}
              emptyLabel="Sin cuentas por cobrar"
            >
              {receivablesTab.data?.items.map((r) => (
                <ReceivableRow key={r.id} receivable={r} />
              ))}
            </ListContainer>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-stone-200 px-6 py-4 bg-stone-50 flex items-center justify-between">
          <div className="flex gap-2">
            {client.phone && (
              <button
                onClick={handleWhatsApp}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-stone-200 rounded-lg text-stone-700 hover:bg-stone-50 font-medium transition"
            >
              Cerrar
            </button>
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit();
                }}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 font-medium transition flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface ResumenTabProps {
  client: Client;
  summary: ClientSummary | null;
  loadingSummary: boolean;
  summaryError: string | null;
  activationStatus: { label: string; color: string; icon: typeof CheckCircle };
  StatusIcon: typeof CheckCircle;
  resendingEmail: boolean;
  onWhatsApp: () => void;
  onEmail: () => void;
  onResendActivation: () => void;
}

function ResumenTab({
  client,
  summary,
  loadingSummary,
  summaryError,
  activationStatus,
  StatusIcon,
  resendingEmail,
  onWhatsApp,
  onEmail,
  onResendActivation,
}: ResumenTabProps) {
  return (
    <>
      {/* Contact Info */}
      <div className="bg-stone-50 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
          Informacion de Contacto
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Phone className="w-5 h-5 text-stone-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-stone-500">Telefono</p>
              {client.phone ? (
                <div className="flex items-center gap-2">
                  <p className="text-stone-900 font-medium">
                    {formatPhoneDisplay(client.phone)}
                  </p>
                  <button
                    onClick={onWhatsApp}
                    className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition"
                    title="Abrir WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <p className="text-stone-400 italic">No registrado</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Mail className="w-5 h-5 text-stone-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-stone-500">Email</p>
              {client.email ? (
                <button
                  onClick={onEmail}
                  className="text-brand-600 hover:text-brand-700 font-medium hover:underline"
                >
                  {client.email}
                </button>
              ) : (
                <p className="text-stone-400 italic">No registrado</p>
              )}
            </div>
          </div>

          {client.address && (
            <div className="flex items-start gap-3 md:col-span-2">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <MapPin className="w-5 h-5 text-stone-400" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Direccion</p>
                <p className="text-stone-900">{client.address}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Student Info */}
      {(client.student_name || client.student_grade) && (
        <div className="bg-stone-50 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
            Informacion del Estudiante
          </h3>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <GraduationCap className="w-5 h-5 text-stone-400" />
            </div>
            <div>
              <p className="text-stone-900 font-medium">
                {client.student_name || 'Nombre no registrado'}
              </p>
              {client.student_grade && (
                <p className="text-sm text-stone-500">{client.student_grade}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {client.notes && (
        <div className="bg-stone-50 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
            Notas
          </h3>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <StickyNote className="w-5 h-5 text-stone-400" />
            </div>
            <p className="text-stone-700 whitespace-pre-wrap">{client.notes}</p>
          </div>
        </div>
      )}

      {/* Historial agregado */}
      <div className="bg-stone-50 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
          Historial de Operaciones
        </h3>
        {loadingSummary ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
            <span className="ml-2 text-stone-500">Cargando historial...</span>
          </div>
        ) : summaryError ? (
          <div className="flex items-center gap-2 text-red-500 py-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{summaryError}</span>
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingBag className="w-4 h-4 text-brand-500" />
                <span className="text-xs text-stone-500">Compras</span>
              </div>
              <p className="text-xl font-bold text-stone-900">{summary.total_purchases}</p>
            </div>

            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-green-500" />
                <span className="text-xs text-stone-500">Total Gastado</span>
              </div>
              <p className="text-xl font-bold text-stone-900">{formatMoney(summary.total_spent)}</p>
            </div>

            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-stone-500">Pendientes</span>
              </div>
              <p className="text-xl font-bold text-stone-900">{summary.pending_orders}</p>
            </div>

            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-purple-500" />
                <span className="text-xs text-stone-500">Última Compra</span>
              </div>
              <p className="text-sm font-medium text-stone-900">
                {summary.last_purchase_date ? formatDate(summary.last_purchase_date) : 'Sin compras'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-stone-400 italic text-sm">Sin datos disponibles</p>
        )}

        {summary && summary.schools && summary.schools.length > 0 && (
          <div className="mt-4 pt-3 border-t border-stone-200">
            <p className="text-xs text-stone-500 mb-2">Colegios donde ha comprado:</p>
            <div className="flex flex-wrap gap-2">
              {summary.schools.map((school, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-brand-100 text-brand-700 text-xs rounded-full"
                >
                  {school}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Portal Activation */}
      {client.email && (
        <div className="bg-stone-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
            Estado del Portal Web
          </h3>
          <div className="flex items-center justify-between">
            <span
              className={`px-3 py-1.5 text-sm font-semibold rounded-full flex items-center gap-1.5 ${activationStatus.color}`}
            >
              <StatusIcon className="w-4 h-4" />
              {activationStatus.label}
            </span>
            {!(client.is_verified && client.has_password) && (
              <button
                onClick={onResendActivation}
                disabled={resendingEmail}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition disabled:opacity-50"
              >
                {resendingEmail ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {client.welcome_email_sent ? 'Reenviar' : 'Enviar'} activacion
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

interface ListContainerProps {
  loading: boolean;
  error: string | null;
  empty: boolean | undefined;
  emptyLabel: string;
  showAllAction?: () => void;
  children: React.ReactNode;
}

function ListContainer({ loading, error, empty, emptyLabel, showAllAction, children }: ListContainerProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
        <span className="ml-2 text-stone-500">Cargando...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-500 py-4">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }
  if (empty) {
    return <p className="text-stone-400 italic text-sm py-8 text-center">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2">
      {children}
      {showAllAction && (
        <button
          onClick={showAllAction}
          className="w-full mt-3 py-2 text-sm text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition flex items-center justify-center gap-1.5"
        >
          Ver todos en la pagina completa
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] || 'bg-stone-100 text-stone-600';
  const label = STATUS_LABEL[status] || status;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
}

interface ClickableProps {
  onClick?: () => void;
}

function SaleRow({ sale, onClick }: { sale: SaleListItem } & ClickableProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white border border-stone-200 rounded-lg p-3 hover:border-brand-400 hover:bg-brand-50/30 transition group"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-stone-900">{sale.code}</span>
            <StatusBadge status={sale.status} />
            {sale.is_historical && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">historica</span>
            )}
          </div>
          <p className="text-xs text-stone-500">
            {formatDate(sale.sale_date)} · {sale.items_count} {sale.items_count === 1 ? 'item' : 'items'}
            {sale.school_name && <> · {sale.school_name}</>}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-stone-900">{formatMoney(sale.total)}</p>
          {sale.paid_amount < sale.total && (
            <p className="text-xs text-orange-600">Pagado: {formatMoney(sale.paid_amount)}</p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-brand-500 transition shrink-0" />
      </div>
    </button>
  );
}

function OrderRow({ order, onClick }: { order: OrderListItem } & ClickableProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white border border-stone-200 rounded-lg p-3 hover:border-brand-400 hover:bg-brand-50/30 transition group"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-stone-900">{order.code}</span>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-xs text-stone-500">
            Entrega: {formatDate(order.delivery_date)} · {order.items_delivered}/{order.items_total} items
            {order.school_name && <> · {order.school_name}</>}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-stone-900">{formatMoney(order.total)}</p>
          {order.balance > 0 && (
            <p className="text-xs text-orange-600">Saldo: {formatMoney(order.balance)}</p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-brand-500 transition shrink-0" />
      </div>
    </button>
  );
}

function AlterationRow({ alteration, onClick }: { alteration: AlterationListItem } & ClickableProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white border border-stone-200 rounded-lg p-3 hover:border-brand-400 hover:bg-brand-50/30 transition group"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-stone-900">{alteration.code}</span>
            <StatusBadge status={alteration.status} />
          </div>
          <p className="text-xs text-stone-500 truncate">
            {alteration.garment_name} · {formatDate(alteration.received_date)}
            {alteration.estimated_delivery_date && (
              <> · entrega {formatDate(alteration.estimated_delivery_date)}</>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-stone-900">{formatMoney(alteration.cost)}</p>
          {alteration.balance > 0 && (
            <p className="text-xs text-orange-600">Saldo: {formatMoney(alteration.balance)}</p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-brand-500 transition shrink-0" />
      </div>
    </button>
  );
}

function ReceivableRow({ receivable }: { receivable: AccountsReceivableListItem }) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-3 hover:border-brand-300 transition">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-stone-900 truncate">{receivable.description || 'Cuenta por cobrar'}</span>
            {receivable.is_paid ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Pagada</span>
            ) : receivable.is_overdue ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Vencida</span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">Pendiente</span>
            )}
          </div>
          <p className="text-xs text-stone-500">
            Emitida: {formatDate(receivable.invoice_date)}
            {receivable.due_date && <> · Vence: {formatDate(receivable.due_date)}</>}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-stone-900">{formatMoney(receivable.amount)}</p>
          {receivable.balance > 0 && (
            <p className="text-xs text-orange-600">Saldo: {formatMoney(receivable.balance)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
