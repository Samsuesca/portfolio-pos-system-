'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Truck,
  Calendar,
  DollarSign,
  Upload,
  Globe,
  Store,
  CreditCard,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import {
  useClientAuth,
  getStatusLabel,
  getStatusColor,
  getSourceLabel,
  type ClientOrder,
} from '@/lib/clientAuth';
import { formatNumber } from '@/lib/utils';
import { paymentsApi } from '@/lib/api';
import UploadPaymentProofModal from '@/components/UploadPaymentProofModal';

// ---------------------------------------------------------------------------
// Status stepper configuration
// ---------------------------------------------------------------------------

const ORDER_STEPS = [
  { key: 'pending', label: 'Pendiente', icon: Clock },
  { key: 'in_production', label: 'En Produccion', icon: AlertCircle },
  { key: 'ready', label: 'Listo', icon: CheckCircle },
  { key: 'delivered', label: 'Entregado', icon: Truck },
] as const;

function getStepIndex(status: string): number {
  const idx = ORDER_STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? -1 : idx;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusStepper({ status }: { status: string }) {
  const isCancelled = status === 'cancelled';
  const currentIdx = getStepIndex(status);

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-red-100">
          <XCircle className="w-4 h-4 text-red-600" />
        </div>
        <span className="text-sm font-medium text-red-700">Pedido Cancelado</span>
      </div>
    );
  }

  return (
    <div className="flex items-center w-full py-2">
      {ORDER_STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isPending = idx > currentIdx;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            {/* Dot */}
            <div className="flex flex-col items-center">
              <div
                className={`
                  flex items-center justify-center w-7 h-7 rounded-full border-2 transition-colors
                  ${isCompleted ? 'bg-brand-500 border-brand-500' : ''}
                  ${isCurrent ? 'bg-brand-50 border-brand-500' : ''}
                  ${isPending ? 'bg-stone-100 border-stone-300' : ''}
                `}
              >
                {isCompleted ? (
                  <CheckCircle className="w-4 h-4 text-white" />
                ) : (
                  <step.icon
                    className={`w-3.5 h-3.5 ${
                      isCurrent ? 'text-brand-600' : 'text-stone-400'
                    }`}
                  />
                )}
              </div>
              <span
                className={`text-[10px] mt-1 leading-tight text-center whitespace-nowrap ${
                  isCurrent
                    ? 'font-semibold text-brand-700'
                    : isCompleted
                    ? 'font-medium text-brand-600'
                    : 'text-stone-400'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {idx < ORDER_STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1.5 mt-[-14px] rounded-full ${
                  idx < currentIdx ? 'bg-brand-500' : 'bg-stone-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PaymentProgressBar({
  total,
  balance,
}: {
  total: number;
  balance: number;
}) {
  const paid = total - balance;
  const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
  const isFullyPaid = balance <= 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-stone-500">
          Pagado: <span className="font-semibold text-stone-700">${formatNumber(paid)}</span>
          {' / '}
          <span className="text-stone-600">${formatNumber(total)}</span>
        </span>
        {isFullyPaid ? (
          <span className="font-semibold text-green-600 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Completo
          </span>
        ) : (
          <span className="font-medium text-amber-600">
            Pendiente: ${formatNumber(balance)}
          </span>
        )}
      </div>
      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isFullyPaid ? 'bg-green-500' : pct > 50 ? 'bg-brand-500' : 'bg-amber-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ItemsPreview({
  items,
}: {
  items: ClientOrder['items'];
}) {
  const preview = items.slice(0, 3);
  const remaining = items.length - preview.length;

  return (
    <div className="flex flex-wrap gap-2">
      {preview.map((item, i) => (
        <span
          key={item.id || i}
          className="inline-flex items-center gap-1 text-xs bg-stone-50 text-stone-600 px-2 py-1 rounded-md border border-stone-200"
        >
          <span className="font-medium">{item.quantity}x</span>
          <span className="text-stone-400 mx-0.5">-</span>
          <span>${formatNumber(item.unit_price)}</span>
          {item.size && (
            <>
              <span className="text-stone-300">|</span>
              <span>T.{item.size}</span>
            </>
          )}
        </span>
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center text-xs text-stone-400 px-2 py-1">
          +{remaining} mas
        </span>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  bgColor,
  iconColor,
  valueColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  bgColor: string;
  iconColor: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200/80">
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 ${bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}
        >
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className={`text-xl font-bold font-tabular ${valueColor || 'text-stone-800'}`}>
            {value}
          </p>
          <p className="text-stone-500 text-xs">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function MiCuentaPage() {
  const router = useRouter();
  const { client, isAuthenticated, logout, getOrders } = useClientAuth();
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ClientOrder | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedOrderForUpload, setSelectedOrderForUpload] = useState<string | null>(null);
  const [wompiEnabled, setWompiEnabled] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // -----------------------------------------------------------------------
  // Effects (preserved exactly as original)
  // -----------------------------------------------------------------------

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.push('/?login=required');
    }
  }, [mounted, isAuthenticated, router]);

  useEffect(() => {
    paymentsApi.getConfig().then(config => {
      setWompiEnabled(config.enabled);
    }).catch(() => {});
  }, []);

  const handlePayOnline = async (orderId: string) => {
    setPayingOrderId(orderId);
    try {
      const session = await paymentsApi.createSession({ order_id: orderId });
      const checkoutUrl = paymentsApi.buildCheckoutUrl(session);
      window.location.href = checkoutUrl;
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al iniciar pago');
      setPayingOrderId(null);
    }
  };

  useEffect(() => {
    if (mounted && isAuthenticated) {
      loadOrders();
    }
  }, [mounted, isAuthenticated]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      // Sync any pending payments with Wompi before loading orders
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      await fetch(`${API_BASE_URL}/api/v1/payments/sync-pending`, { method: 'POST' }).catch(() => {});

      const ordersList = await getOrders();
      setOrders(ordersList);
    } catch (error) {
      console.error('[MiCuenta] Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // Helpers (preserved)
  // -----------------------------------------------------------------------

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5" />;
      case 'in_production':
        return <AlertCircle className="w-5 h-5" />;
      case 'ready':
        return <CheckCircle className="w-5 h-5" />;
      case 'delivered':
        return <Truck className="w-5 h-5" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5" />;
      default:
        return <Package className="w-5 h-5" />;
    }
  };

  const toggleExpanded = (orderId: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // -----------------------------------------------------------------------
  // Computed values
  // -----------------------------------------------------------------------

  // Web portal orders without payment are not "effective" — exclude from stats
  const isEffectiveOrder = (o: ClientOrder) =>
    o.source !== 'web_portal' || o.paid_amount > 0;

  const effectiveOrders = orders.filter(isEffectiveOrder);
  const totalInvested = effectiveOrders.reduce((sum, o) => sum + o.total, 0);
  const totalPendingBalance = effectiveOrders.reduce(
    (sum, o) => sum + (o.balance > 0 ? o.balance : 0),
    0
  );
  const inProgressCount = effectiveOrders.filter((o) =>
    ['pending', 'in_production'].includes(o.status)
  ).length;
  const deliveredCount = effectiveOrders.filter((o) => o.status === 'delivered').length;

  // -----------------------------------------------------------------------
  // Guards
  // -----------------------------------------------------------------------

  if (!mounted) {
    return null;
  }

  if (!isAuthenticated || !client) {
    return null;
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ================================================================ */}
      {/* Header                                                          */}
      {/* ================================================================ */}
      <header className="bg-stone-900 text-white">
        {/* Top bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al inicio</span>
            </button>
            <button
              onClick={logout}
              className="px-4 py-1.5 bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-sm text-stone-300 hover:text-white"
            >
              Cerrar Sesion
            </button>
          </div>
        </div>

        {/* Profile section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-brand-500/20 rounded-full flex items-center justify-center ring-2 ring-brand-500/30">
              <User className="w-7 h-7 text-brand-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-white">
                {client.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1">
                <p className="text-stone-400 text-sm">{client.email}</p>
                {client.phone && (
                  <p className="text-stone-500 text-sm">{client.phone}</p>
                )}
              </div>
              {client.last_login && (
                <p className="text-stone-600 text-xs mt-1">
                  Miembro desde{' '}
                  {new Date(client.last_login).toLocaleDateString('es-CO', {
                    year: 'numeric',
                    month: 'long',
                    timeZone: 'America/Bogota',
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ================================================================ */}
      {/* Main Content                                                    */}
      {/* ================================================================ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* -------------------------------------------------------------- */}
        {/* Stats Cards                                                    */}
        {/* -------------------------------------------------------------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <StatCard
            icon={ShoppingBag}
            label="Total Pedidos"
            value={effectiveOrders.length}
            bgColor="bg-brand-50"
            iconColor="text-brand-600"
          />
          <StatCard
            icon={Clock}
            label="En Proceso"
            value={inProgressCount}
            bgColor="bg-amber-50"
            iconColor="text-amber-600"
          />
          <StatCard
            icon={Wallet}
            label="Monto Total Invertido"
            value={`$${formatNumber(totalInvested)}`}
            bgColor="bg-brand-50"
            iconColor="text-brand-700"
            valueColor="text-brand-700"
          />
          <StatCard
            icon={DollarSign}
            label="Saldo Pendiente"
            value={
              totalPendingBalance > 0
                ? `$${formatNumber(totalPendingBalance)}`
                : '$0'
            }
            bgColor={totalPendingBalance > 0 ? 'bg-red-50' : 'bg-green-50'}
            iconColor={totalPendingBalance > 0 ? 'text-red-600' : 'text-green-600'}
            valueColor={totalPendingBalance > 0 ? 'text-red-700' : 'text-green-700'}
          />
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Section heading                                                */}
        {/* -------------------------------------------------------------- */}
        <div className="mb-5">
          <h2 className="text-xl font-display font-bold text-stone-800">
            Mis Pedidos
          </h2>
          <p className="text-stone-500 text-sm mt-0.5">
            Historial completo de tus pedidos
          </p>
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Orders                                                         */}
        {/* -------------------------------------------------------------- */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-brand-200 border-t-brand-600" />
            <p className="mt-4 text-stone-500">Cargando pedidos...</p>
          </div>
        ) : orders.length === 0 ? (
          /* ---- Empty state ---- */
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 py-20 px-6 text-center">
            <div className="mx-auto w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-5">
              <ShoppingBag className="w-10 h-10 text-stone-300" />
            </div>
            <h3 className="text-lg font-display font-semibold text-stone-700">
              No tienes pedidos aun
            </h3>
            <p className="text-stone-400 text-sm mt-2 max-w-sm mx-auto">
              Tus pedidos apareceran aqui cuando hagas una compra. Explora
              nuestro catalogo para encontrar lo que necesitas.
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors font-semibold text-sm"
            >
              <ShoppingBag className="w-4 h-4" />
              Explorar Catalogo
            </button>
          </div>
        ) : (
          /* ---- Order cards ---- */
          <div className="space-y-4">
            {orders.map((order) => {
              const isExpanded = expandedOrders.has(order.id);
              const paid = order.total - order.balance;
              const isWebUnpaid = order.source === 'web_portal' && order.paid_amount <= 0;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden transition-shadow hover:shadow-md"
                >
                  {/* Card top section */}
                  <div className="p-5 sm:p-6">
                    {/* Row 1: Code, badges, total */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                        <h3 className="font-display font-bold text-stone-800 text-base">
                          {order.code}
                        </h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(
                            order.status
                          )}`}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1 ${
                            order.source === 'web_portal'
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-stone-100 text-stone-500'
                          }`}
                        >
                          {order.source === 'web_portal' ? (
                            <Globe className="w-3 h-3" />
                          ) : (
                            <Store className="w-3 h-3" />
                          )}
                          {getSourceLabel(order.source)}
                        </span>
                        {isWebUnpaid && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Pendiente de pago
                          </span>
                        )}
                      </div>
                      <p className="text-lg font-bold text-stone-800 font-tabular whitespace-nowrap">
                        ${formatNumber(order.total)}
                      </p>
                    </div>

                    {/* Web unpaid banner */}
                    {isWebUnpaid && (
                      <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
                        <p className="text-sm text-amber-800">
                          Este pedido <span className="font-semibold">requiere pago en linea</span> para ser procesado.
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePayOnline(order.id);
                          }}
                          disabled={payingOrderId === order.id}
                          className="flex-shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-green-600 rounded-lg px-4 py-2 hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <CreditCard className="w-4 h-4" />
                          {payingOrderId === order.id ? 'Redirigiendo...' : 'Pagar ahora'}
                        </button>
                      </div>
                    )}

                    {/* Row 2: Status Stepper */}
                    <div className="mb-4">
                      <StatusStepper status={order.status} />
                    </div>

                    {/* Row 3: Payment progress */}
                    <div className="mb-4">
                      <PaymentProgressBar total={order.total} balance={order.balance} />
                    </div>

                    {/* Row 4: Meta info line */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500 mb-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(order.created_at).toLocaleDateString('es-CO', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          timeZone: 'America/Bogota',
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" />
                        {order.items_count}{' '}
                        {order.items_count === 1 ? 'producto' : 'productos'}
                      </span>
                      {order.delivery_date && (
                        <span className="flex items-center gap-1 text-brand-700 font-medium">
                          <Truck className="w-3.5 h-3.5" />
                          Entrega estimada:{' '}
                          {new Date(order.delivery_date).toLocaleDateString(
                            'es-CO',
                            {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              timeZone: 'America/Bogota',
                            }
                          )}
                        </span>
                      )}
                    </div>

                    {/* Row 5: Items preview */}
                    {order.items && order.items.length > 0 && (
                      <div className="mb-4">
                        <ItemsPreview items={order.items} />
                      </div>
                    )}


                    {/* Row 7: Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Pay online (non-web orders — web orders have the prominent banner) */}
                      {!isWebUnpaid &&
                        wompiEnabled &&
                        order.balance > 0 &&
                        order.status !== 'cancelled' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePayOnline(order.id);
                            }}
                            disabled={payingOrderId === order.id}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg px-3.5 py-2 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            {payingOrderId === order.id
                              ? 'Redirigiendo...'
                              : 'Pagar en linea'}
                          </button>
                        )}

                      {/* Upload proof (non-web orders only) */}
                      {order.source !== 'web_portal' &&
                        order.balance > 0 &&
                        order.status !== 'cancelled' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrderForUpload(order.id);
                              setShowUploadModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 bg-stone-100 border border-stone-200 rounded-lg px-3 py-2 hover:bg-stone-200 transition-colors"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Subir comprobante
                          </button>
                        )}

                      {/* Expand/collapse details */}
                      <button
                        onClick={() => toggleExpanded(order.id)}
                        className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-700 transition-colors py-2 px-2"
                      >
                        {isExpanded ? (
                          <>
                            Ocultar detalle
                            <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            Ver detalle
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-stone-100 bg-stone-50/50 p-5 sm:p-6">
                      <h4 className="text-sm font-semibold text-stone-700 mb-3">
                        Detalle del Pedido
                      </h4>
                      <div className="space-y-2">
                        {order.items.map((item, index) => (
                          <div
                            key={item.id || index}
                            className="flex items-center justify-between bg-white rounded-xl p-3.5 border border-stone-200"
                          >
                            <div>
                              <p className="font-medium text-stone-800 text-sm">
                                {item.quantity}x Producto
                              </p>
                              <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                                <span>
                                  ${formatNumber(item.unit_price)} c/u
                                </span>
                                {item.size && (
                                  <>
                                    <span className="text-stone-300">|</span>
                                    <span>Talla: {item.size}</span>
                                  </>
                                )}
                                {item.color && (
                                  <>
                                    <span className="text-stone-300">|</span>
                                    <span>Color: {item.color}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <p className="font-semibold text-stone-800 text-sm font-tabular">
                              ${formatNumber(item.subtotal)}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Summary row */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone-200">
                        <span className="text-sm text-stone-500">Total</span>
                        <span className="text-base font-bold text-stone-800 font-tabular">
                          ${formatNumber(order.total)}
                        </span>
                      </div>

                      {/* Delivery date callout */}
                      {order.delivery_date && (
                        <div className="mt-4 p-3.5 bg-brand-50 rounded-xl border border-brand-200">
                          <p className="text-sm text-stone-700">
                            <span className="font-semibold">
                              Fecha de entrega estimada:
                            </span>{' '}
                            {new Date(order.delivery_date).toLocaleDateString(
                              'es-CO',
                              {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                timeZone: 'America/Bogota',
                              }
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/* Help Section                                                   */}
        {/* -------------------------------------------------------------- */}
        <div className="mt-10 bg-brand-50 rounded-2xl p-6 border border-brand-200">
          <h3 className="font-display font-bold text-stone-800 mb-1.5">
            Necesitas ayuda?
          </h3>
          <p className="text-stone-600 text-sm mb-4">
            Si tienes preguntas sobre tus pedidos o necesitas hacer cambios,
            contactanos.
          </p>
          <button
            onClick={() => router.push('/soporte')}
            className="px-5 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors text-sm font-semibold"
          >
            Ir a Soporte
          </button>
        </div>
      </main>

      {/* ================================================================ */}
      {/* Upload Payment Proof Modal                                      */}
      {/* ================================================================ */}
      {selectedOrderForUpload && (
        <UploadPaymentProofModal
          isOpen={showUploadModal}
          onClose={() => {
            setShowUploadModal(false);
            setSelectedOrderForUpload(null);
          }}
          orderId={selectedOrderForUpload}
          onUploadSuccess={() => {
            console.log('[MiCuenta] Upload success callback triggered');
            // Force immediate reload
            loadOrders();
            setShowUploadModal(false);
            setSelectedOrderForUpload(null);
          }}
        />
      )}
    </div>
  );
}
