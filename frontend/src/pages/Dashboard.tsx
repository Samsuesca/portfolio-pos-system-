/**
 * Dashboard Page - Main overview with GLOBAL aggregated statistics
 *
 * This dashboard does NOT depend on the school selector.
 * It shows aggregated stats from ALL schools the user has access to.
 *
 * Features:
 * - Role-based content (admin+ sees finance and alterations)
 * - Urgent alerts with expanded lists
 * - Quick actions based on permissions
 */
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSchoolStore } from '../stores/schoolStore';
import {
  Package,
  Users,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  Building2,
  RefreshCw,
  DollarSign,
  MessageSquare,
  Mail,
  Clock,
  Wallet,
  Scissors,
} from 'lucide-react';
import Layout from '../components/Layout';
import { dashboardService } from '../services/dashboardService';
import { saleService } from '../services/saleService';
import { productService } from '../services/productService';
import { contactService, type Contact } from '../services/contactService';
import { orderService } from '../services/orderService';
import { alterationService } from '../services/alterationService';
import { globalAccountingService, type DailyFlowResponse } from '../services/globalAccountingService';
import type { GlobalDashboardStats, SchoolSummaryItem } from '../services/dashboardService';
import type { SaleListItem, Product, OrderListItem, AlterationsSummary } from '../types/api';
import { formatCurrency } from '../utils/formatting';

// Dashboard components
import {
  StatCard,
  UrgentAlertsSection,
  processOrdersForAlerts,
  processCriticalStock,
  type AlertsData,
  UpcomingOrdersWidget,
  DailyFinanceWidget,
  AlterationsSummaryWidget,
  DashboardWidget,
  QuickActionsGrid,
  StatCardSkeleton,
} from '../components/dashboard';

// Hooks
import { useDashboardConfig } from '../hooks/useDashboardConfig';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { availableSchools, loadSchools } = useSchoolStore();

  // Core data
  const [stats, setStats] = useState<GlobalDashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<SaleListItem[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [recentContacts, setRecentContacts] = useState<Contact[]>([]);
  const [unreadContactsCount, setUnreadContactsCount] = useState(0);

  // Additional data for enhanced dashboard
  const [allOrders, setAllOrders] = useState<OrderListItem[]>([]);
  const [alterationsSummary, setAlterationsSummary] = useState<AlterationsSummary | null>(null);
  const [dailyFinance, setDailyFinance] = useState<DailyFlowResponse | null>(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate urgent orders context
  const alertsData = useMemo((): AlertsData => {
    const orderAlerts = processOrdersForAlerts(allOrders);
    const stockAlerts = processCriticalStock(allProducts);

    return {
      orders_overdue: orderAlerts.overdue,
      orders_today: orderAlerts.today,
      orders_tomorrow: orderAlerts.tomorrow,
      critical_stock_count: stockAlerts.criticalCount,
      out_of_stock_products: stockAlerts.outOfStock,
      out_of_stock_count: stockAlerts.outOfStockCount,
      low_stock_count: stockAlerts.lowStockCount,
      alterations_ready: alterationsSummary?.ready_count ?? 0,
    };
  }, [allOrders, allProducts, alterationsSummary]);

  const hasUrgentOrders =
    alertsData.orders_overdue.length > 0 || alertsData.orders_today.length > 0;

  // Check if it's end of day (after 5 PM)
  const isEndOfDay = new Date().getHours() >= 17;

  // Get dashboard config based on user permissions
  const dashboardConfig = useDashboardConfig({ hasUrgentOrders, isEndOfDay });

  useEffect(() => {
    if (availableSchools.length === 0) {
      loadSchools();
    }
  }, [availableSchools.length, loadSchools]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Phase 1: Critical data (stats, orders for alerts, products for stock)
      const [globalStats, ordersData, productsData] = await Promise.all([
        dashboardService.getGlobalStats(),
        orderService.getAllOrders({ limit: 100 }).catch(() => []),
        productService.getAllProducts({ with_stock: true, limit: 500 }).catch(() => []),
      ]);

      setStats(globalStats);
      setAllOrders(ordersData);
      setAllProducts(productsData);

      // Phase 2: Secondary data (sales, contacts)
      const [salesData, contactsData] = await Promise.all([
        saleService.getAllSales({ limit: 5 }).catch(() => []),
        contactService
          .getContacts({ page: 1, page_size: 5, unread_only: false })
          .catch(() => ({ items: [], total: 0, page: 1, page_size: 5, total_pages: 0 })),
      ]);

      setRecentSales(salesData);
      setRecentContacts(contactsData.items);
      setUnreadContactsCount(contactsData.items.filter((c) => !c.is_read).length);

      // Phase 3: Permission-specific data (loaded only if user has micropermiso)
      if (dashboardConfig.permissions.canViewAlterations) {
        alterationService
          .getSummary()
          .then(setAlterationsSummary)
          .catch(() => setAlterationsSummary(null));
      }

      if (dashboardConfig.permissions.canViewCash || dashboardConfig.permissions.canViewExpenses || dashboardConfig.permissions.canViewDailyFlow) {
        globalAccountingService
          .getDailyAccountFlow()
          .then(setDailyFinance)
          .catch(() => setDailyFinance(null));
      }
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setError(err.response?.data?.detail || 'Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Low stock products for widget (consistent with Products.tsx logic)
  const lowStockProducts = useMemo(() => {
    // Separar productos sin stock y con stock bajo
    // Use same logic as Products.tsx: check both stock and inventory_quantity
    const outOfStock = allProducts.filter((p) => {
      const stock = (p as any).stock ?? p.inventory_quantity ?? 0;
      return stock === 0;
    });

    const lowStock = allProducts.filter((p) => {
      const stock = (p as any).stock ?? p.inventory_quantity ?? 0;
      const minStock = (p as any).min_stock ?? p.inventory_min_stock ?? 5;
      return stock > 0 && stock <= minStock;
    });

    // Mostrar primero los sin stock, luego los con stock bajo
    return [...outOfStock, ...lowStock].slice(0, 5);
  }, [allProducts]);

  const getTimeAgo = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    return `Hace ${diffDays}d`;
  };

  return (
    <Layout>
      {/* Welcome Section */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-primary tracking-tight">
            ¡Bienvenido, {user?.full_name || user?.username}!
          </h1>
          <p className="text-slate-500 mt-1 md:mt-2 text-base md:text-lg">
            {stats?.school_count === 1
              ? `Resumen de ${stats.schools_summary[0]?.school_name || 'tu colegio'}`
              : stats?.school_count
              ? `Resumen global de ${stats.school_count} colegios`
              : 'Cargando resumen...'}
          </p>
        </div>
        <button
          onClick={loadDashboardData}
          disabled={loading}
          className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error al cargar el dashboard</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                onClick={loadDashboardData}
                className="mt-3 text-sm text-red-700 hover:text-red-800 underline font-medium"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid - Permission-based visibility */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            {dashboardConfig.stats.sales && (
              <StatCard
                title="Ventas Totales"
                value={stats ? stats.totals.total_sales.toLocaleString() : '-'}
                subtitle={stats ? `${formatCurrency(stats.totals.sales_amount_month)} este mes` : undefined}
                icon={ShoppingCart}
                color="text-green-600"
                bgColor="bg-green-100"
                onClick={() => navigate('/sales')}
              />
            )}
            {dashboardConfig.stats.orders && (
              <StatCard
                title="Encargos Pendientes"
                value={stats ? stats.totals.pending_orders.toLocaleString() : '-'}
                subtitle={stats ? `${stats.totals.total_orders} encargos totales` : undefined}
                icon={Clock}
                color="text-orange-600"
                bgColor="bg-orange-100"
                onClick={() => navigate('/orders')}
              />
            )}
            {dashboardConfig.stats.clients && (
              <StatCard
                title="Clientes"
                value={stats ? stats.totals.total_clients.toLocaleString() : '-'}
                subtitle={
                  stats && stats.school_count > 1 ? `en ${stats.school_count} colegios` : undefined
                }
                icon={Users}
                color="text-blue-600"
                bgColor="bg-blue-100"
                onClick={() => navigate('/clients')}
              />
            )}
            {dashboardConfig.stats.products && (
              <StatCard
                title="Productos"
                value={stats ? stats.totals.total_products.toLocaleString() : '-'}
                subtitle={
                  stats && stats.school_count > 1 ? `en ${stats.school_count} colegios` : undefined
                }
                icon={Package}
                color="text-purple-600"
                bgColor="bg-purple-100"
                onClick={() => navigate('/products')}
              />
            )}
          </>
        )}
      </div>

      {/* Additional Stats - Permission-based (accounting, alterations) */}
      {(dashboardConfig.stats.cashBalance || dashboardConfig.stats.alterations) && !loading && (
        <div className="grid grid-cols-2 gap-4 md:gap-6 mb-6">
          {dashboardConfig.stats.cashBalance && (
            <StatCard
              title="Caja del Dia"
              value={dailyFinance ? formatCurrency(dailyFinance.totals.closing_balance) : '-'}
              subtitle={
                dailyFinance
                  ? `${dailyFinance.totals.net_flow >= 0 ? '+' : ''}${formatCurrency(dailyFinance.totals.net_flow)} hoy`
                  : undefined
              }
              icon={Wallet}
              color="text-emerald-600"
              bgColor="bg-emerald-100"
              onClick={() => navigate('/accounting')}
            />
          )}
          {dashboardConfig.stats.alterations && (
            <StatCard
              title="Arreglos Activos"
              value={
                alterationsSummary
                  ? (
                      alterationsSummary.pending_count +
                      alterationsSummary.in_progress_count +
                      alterationsSummary.ready_count
                    ).toLocaleString()
                  : '-'
              }
              subtitle={
                alterationsSummary
                  ? `${alterationsSummary.ready_count} listos para entregar`
                  : undefined
              }
              icon={Scissors}
              color="text-pink-600"
              bgColor="bg-pink-100"
              onClick={() => navigate('/alterations')}
            />
          )}
        </div>
      )}

      {/* Urgent Alerts Section - Permission-based */}
      <UrgentAlertsSection
        data={alertsData}
        showAlterationAlerts={dashboardConfig.alerts.alterationsReady}
        showOrderAlerts={dashboardConfig.alerts.todayOrders}
        showStockAlerts={dashboardConfig.alerts.criticalStock}
        loading={loading}
      />

      {/* Stats by School (only if multiple schools and user can see both sales and orders) */}
      {!loading && stats && stats.school_count > 1 && dashboardConfig.widgets.schoolSummary && (
        <div className="bg-white rounded-xl shadow-sm border border-surface-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-brand-600" />
            Resumen por Colegio
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Colegio
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ventas (mes)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto Ventas
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Encargos Pend.
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.schools_summary.map((school: SchoolSummaryItem) => (
                  <tr key={school.school_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{school.school_name}</div>
                      <div className="text-xs text-gray-500">{school.school_code}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                      {school.sales_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-green-600">
                      {formatCurrency(school.sales_amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                      <span
                        className={
                          school.pending_orders > 0 ? 'text-orange-600 font-medium' : 'text-gray-900'
                        }
                      >
                        {school.pending_orders}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Widgets Grid - Permission-based */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Recent Sales - requires sales.view */}
        {dashboardConfig.widgets.recentSales && (
          <DashboardWidget
            title="Ventas Recientes"
            icon={TrendingUp}
            iconColor="text-green-600"
            headerAction={{
              label: 'Ver todas',
              onClick: () => navigate('/sales'),
            }}
            loading={loading}
            emptyState={{
              icon: ShoppingCart,
              message: 'No hay ventas recientes',
            }}
          >
            {recentSales.length > 0 && (
              <div className="space-y-3">
                {recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    onClick={() => navigate(`/sales/${sale.id}`)}
                    className="flex items-center justify-between py-3 px-3 -mx-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{sale.code}</span>
                        {sale.school_name && availableSchools.length > 1 && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {sale.school_name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        {sale.client_name || 'Venta directa'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="font-semibold text-gray-800 flex items-center justify-end">
                        <DollarSign className="w-4 h-4 text-green-500" />
                        {Number(sale.total).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">{getTimeAgo(sale.sale_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardWidget>
        )}

        {/* Upcoming Orders - requires orders.view */}
        {dashboardConfig.widgets.upcomingOrders && (
          <UpcomingOrdersWidget orders={allOrders} loading={loading} />
        )}

        {/* Conditional: Alterations (if permission) or Low Stock */}
        {dashboardConfig.widgets.alterations ? (
          <AlterationsSummaryWidget data={alterationsSummary} loading={loading} />
        ) : dashboardConfig.widgets.lowStock ? (
          <DashboardWidget
            title="Alertas de Stock Bajo"
            icon={AlertCircle}
            iconColor="text-orange-600"
            headerAction={{
              label: 'Ver productos',
              onClick: () => navigate('/products'),
            }}
            loading={loading}
            emptyState={{
              icon: Package,
              message: 'No hay alertas de stock bajo',
              submessage: '¡Todo en orden!',
            }}
          >
            {lowStockProducts.length > 0 && (
              <div className="space-y-3">
                {lowStockProducts.map((product) => {
                  const stock = product.inventory_quantity ?? 0;
                  const isOutOfStock = stock === 0;
                  return (
                    <div
                      key={product.id}
                      onClick={() => navigate('/products')}
                      className="flex items-center justify-between py-3 px-3 -mx-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 truncate">
                            {product.name || product.code}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {product.code} - Talla {product.size}
                        </p>
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            isOutOfStock
                              ? 'bg-red-100 text-red-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {isOutOfStock ? 'Sin stock' : `${stock} uds`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DashboardWidget>
        ) : null}
      </div>

      {/* Second row of widgets - Permission-based */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Daily Finance - requires accounting.view_cash or accounting.view_expenses */}
        {dashboardConfig.widgets.dailyFinance && (
          <DailyFinanceWidget data={dailyFinance} loading={loading} />
        )}

        {/* Low Stock (shows here if alterations widget is in first row) */}
        {dashboardConfig.widgets.alterations && dashboardConfig.widgets.lowStock && (
          <DashboardWidget
            title="Alertas de Stock Bajo"
            icon={AlertCircle}
            iconColor="text-orange-600"
            headerAction={{
              label: 'Ver productos',
              onClick: () => navigate('/products'),
            }}
            loading={loading}
            emptyState={{
              icon: Package,
              message: 'No hay alertas de stock bajo',
              submessage: '¡Todo en orden!',
            }}
          >
            {lowStockProducts.length > 0 && (
              <div className="space-y-3">
                {lowStockProducts.map((product) => {
                  const stock = product.inventory_quantity ?? 0;
                  const isOutOfStock = stock === 0;
                  return (
                    <div
                      key={product.id}
                      onClick={() => navigate('/products')}
                      className="flex items-center justify-between py-3 px-3 -mx-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 truncate">
                            {product.name || product.code}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {product.code} - Talla {product.size}
                        </p>
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            isOutOfStock
                              ? 'bg-red-100 text-red-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {isOutOfStock ? 'Sin stock' : `${stock} uds`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DashboardWidget>
        )}

        {/* PQRS Messages - always visible */}
        {dashboardConfig.widgets.pqrs && (
          <DashboardWidget
            title="Mensajes PQRS"
            icon={MessageSquare}
            iconColor="text-blue-600"
            headerAction={{
              label: 'Ver todos',
              onClick: () => navigate('/contacts'),
            }}
            loading={loading}
            emptyState={{
              icon: MessageSquare,
              message: 'No hay mensajes PQRS',
            }}
          >
            {recentContacts.length > 0 && (
              <>
                <div className="space-y-3">
                  {recentContacts.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => navigate('/contacts')}
                      className="flex items-center justify-between py-3 px-3 -mx-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 truncate">{contact.name}</span>
                          {!contact.is_read && (
                            <span className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">{contact.subject}</p>
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        {contact.is_read ? (
                          <span className="text-xs text-gray-400">Leido</span>
                        ) : (
                          <Mail className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {unreadContactsCount > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                      <Mail className="w-4 h-4" />
                      <span className="font-medium">
                        {unreadContactsCount} mensaje{unreadContactsCount !== 1 ? 's' : ''} sin leer
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </DashboardWidget>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-6">
        <QuickActionsGrid actions={dashboardConfig.quickActions} />
      </div>
    </Layout>
  );
}
