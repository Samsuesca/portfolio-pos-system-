/**
 * Orders Page - List and manage custom orders (encargos) - Multi-school view
 *
 * Features:
 * - Clickable stats cards for quick filtering
 * - Product demand statistics
 * - Yomber indicator
 * - Refresh button
 * - Draft support for minimized orders
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import OrderModal from '../components/OrderModal';
import _PaymentVerificationModal from '../components/PaymentVerificationModal';
import { RequirePermission } from '../components/RequirePermission';
import { FileText, Plus, Search, AlertCircle, Loader2, Calendar, Package, Clock, CheckCircle, XCircle, Truck, Eye, Building2, RefreshCw, Ruler, BarChart3, TrendingUp, X, Wrench, Receipt, ChevronDown, Filter, ArrowUpDown, Globe } from 'lucide-react';
import { formatDateSpanish } from '../components/DatePicker';
import DateFilter, { DateRange } from '../components/DateFilter';
import { orderService } from '../services/orderService';
import { useSchoolStore } from '../stores/schoolStore';
import { useDebounce } from '../hooks/useDebounce';
import ProductDemandModal from '../components/ProductDemandModal';
import type { OrderListItem, OrderStatus, OrderItemStatus, ProductDemandItem, ProductDemandResponse, ProductDemandFilters } from '../types/api';
import { formatCurrency } from '../utils/formatting';

// Type for location state when navigating from DraftsBar or Quick Actions
interface LocationState {
  draftId?: string;
  draftType?: 'sale' | 'order';
  openNew?: boolean;
}

// Yomber item for confeccionista view
interface YomberItem {
  id: string;
  order_id: string;
  order_code: string;
  order_status: string;
  item_status: OrderItemStatus;  // Individual item status for independent tracking
  school_id: string;
  client_name: string;
  student_name: string | null;
  delivery_date: string | null;
  garment_type_name: string;
  quantity: number;
  size: string | null;
  color: string | null;
  gender: string | null;
  custom_measurements: Record<string, number>;
  notes: string | null;
  created_at: string;
}

export default function Orders() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  const { currentSchool, availableSchools, loadSchools } = useSchoolStore();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  // Payment verification state (PaymentVerificationModal is commented out, only setter used)
  const [, setSelectedOrderForPayment] = useState<OrderListItem | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({});

  // Debounce search term for backend search
  const debouncedSearch = useDebounce(searchTerm, 300);
  const LIMIT = 50;

  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    inProduction: 0,
    ready: 0,
    delivered: 0,
    yombers: 0,
  });

  // Product demand statistics - improved version
  const [demandResponse, setDemandResponse] = useState<ProductDemandResponse | null>(null);
  const [productDemand, setProductDemand] = useState<ProductDemandItem[]>([]);
  const [showProductStats, setShowProductStats] = useState(false);
  const [loadingProductStats, setLoadingProductStats] = useState(false);
  const [demandFilters, setDemandFilters] = useState<ProductDemandFilters>({
    type_filter: 'all',
    sort_by: 'quantity',
    sort_order: 'desc',
  });
  const [selectedDemandItem, setSelectedDemandItem] = useState<ProductDemandItem | null>(null);
  const [showDemandModal, setShowDemandModal] = useState(false);

  // Yombers modal for confeccionista
  const [showYombersModal, setShowYombersModal] = useState(false);
  const [yomberItems, setYomberItems] = useState<YomberItem[]>([]);
  const [loadingYombers, setLoadingYombers] = useState(false);
  const [yomberStatusFilter, setYomberStatusFilter] = useState<'all' | 'pending' | 'in_production' | 'ready'>('all');
  const [updatingYomberStatus, setUpdatingYomberStatus] = useState<string | null>(null);

  // Measurement labels in Spanish
  const measurementLabels: Record<string, string> = {
    delantero: 'Delantero',
    trasero: 'Trasero',
    cintura: 'Cintura',
    largo: 'Largo',
    espalda: 'Espalda',
    cadera: 'Cadera',
    hombro: 'Hombro',
    pierna: 'Pierna',
    entrepierna: 'Entrepierna',
    manga: 'Manga',
    cuello: 'Cuello',
    pecho: 'Pecho',
    busto: 'Busto',
    tiro: 'Tiro',
  };

  // For creating new orders, use current school or first available
  const schoolIdForCreate = currentSchool?.id || availableSchools[0]?.id || '';

  // Handle draft from location state (coming from DraftsBar) or openNew from Quick Actions
  useEffect(() => {
    if (locationState?.draftId && locationState?.draftType === 'order') {
      setActiveDraftId(locationState.draftId);
      setIsModalOpen(true);
      // Clear the location state to prevent re-opening on navigation
      navigate(location.pathname, { replace: true, state: null });
    } else if (locationState?.openNew) {
      setIsModalOpen(true);
      // Clear the location state to prevent re-opening on navigation
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [locationState]);

  useEffect(() => {
    // Load schools if not already loaded
    if (availableSchools.length === 0) {
      loadSchools();
    }
  }, []);

  // Reload when filters or debounced search changes
  useEffect(() => {
    loadOrders();
  }, [statusFilter, schoolFilter, debouncedSearch, dateRange]);

  const handleSuccess = () => {
    loadOrders();
  };

  const loadOrders = useCallback(async (append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const skip = append ? orders.length : 0;

      // Load orders with backend search and pagination
      const data = await orderService.getAllOrders({
        school_id: schoolFilter || undefined,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        source_filter: 'exclude_web_portal',
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
        limit: LIMIT,
        skip: skip
      });

      if (append) {
        setOrders(prev => [...prev, ...data]);
      } else {
        setOrders(data);
      }
      setHasMore(data.length === LIMIT);

      // Calculate stats (only on initial load, not on append)
      if (!append) {
        const statsData = await orderService.getAllOrders({
          school_id: schoolFilter || undefined,
          source_filter: 'exclude_web_portal',
          start_date: dateRange.start_date,
          end_date: dateRange.end_date,
          limit: 500
        });
        setStats({
          pending: statsData.filter(o => o.status === 'pending').length,
          inProduction: statsData.filter(o => o.status === 'in_production').length,
          ready: statsData.filter(o => o.status === 'ready').length,
          delivered: statsData.filter(o => o.status === 'delivered').length,
          yombers: 0, // Will be calculated when loading product stats
        });
      }
    } catch (err: any) {
      console.error('Error loading orders:', err);
      setError(err.response?.data?.detail || 'Error al cargar encargos');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [schoolFilter, statusFilter, debouncedSearch, dateRange, orders.length]);

  // Load product demand statistics - optimized version using backend endpoint
  const loadProductDemand = async () => {
    try {
      setLoadingProductStats(true);
      const response = await orderService.getProductDemand({
        school_id: schoolFilter || undefined,
        ...demandFilters,
      });
      setDemandResponse(response);
      setProductDemand(response.items);
      setStats(prev => ({ ...prev, yombers: response.yomber_quantity }));
    } catch (err) {
      console.error('Error loading product demand:', err);
    } finally {
      setLoadingProductStats(false);
    }
  };

  // Handle demand row click - open modal
  const handleDemandRowClick = (item: ProductDemandItem) => {
    setSelectedDemandItem(item);
    setShowDemandModal(true);
  };

  // Navigate to order from demand modal
  const handleNavigateToOrderFromDemand = (orderId: string, schoolId: string) => {
    setShowDemandModal(false);
    navigate(`/orders/${orderId}?school_id=${schoolId}`);
  };

  // Load product demand when showing the panel or filters change
  useEffect(() => {
    if (showProductStats) {
      loadProductDemand();
    }
  }, [showProductStats, demandFilters, schoolFilter]);

  // Load all yomber items for confeccionista view
  const loadYomberItems = async () => {
    try {
      setLoadingYombers(true);
      const yombers: YomberItem[] = [];

      // Get orders that are not delivered/cancelled (active production)
      const activeOrders = orders.filter(o =>
        o.status === 'pending' || o.status === 'in_production' || o.status === 'ready'
      );

      for (const order of activeOrders) {
        try {
          const fullOrder = await orderService.getOrder(order.school_id || '', order.id);
          for (const item of fullOrder.items) {
            // Only include items with custom measurements (Yombers) that are not delivered/cancelled
            if (item.custom_measurements &&
                typeof item.custom_measurements === 'object' &&
                Object.keys(item.custom_measurements).length > 0 &&
                !['delivered', 'cancelled'].includes(item.item_status)) {
              yombers.push({
                id: item.id,
                order_id: order.id,
                order_code: order.code,
                order_status: order.status,
                item_status: item.item_status,
                school_id: order.school_id || '',
                client_name: fullOrder.client_name || 'Sin cliente',
                student_name: fullOrder.student_name,
                delivery_date: order.delivery_date,
                garment_type_name: item.garment_type_name,
                quantity: item.quantity,
                size: item.size,
                color: item.color,
                gender: item.gender,
                custom_measurements: item.custom_measurements as Record<string, number>,
                notes: item.notes,
                created_at: order.created_at,
              });
            }
          }
        } catch (err) {
          console.error(`Error loading order ${order.id}:`, err);
        }
      }

      // Sort by item_status (pending first), then by delivery date, then by created date
      yombers.sort((a, b) => {
        // Prioritize by item_status: pending > in_production > ready
        const statusOrder: Record<string, number> = { pending: 0, in_production: 1, ready: 2 };
        const statusDiff = (statusOrder[a.item_status] ?? 3) - (statusOrder[b.item_status] ?? 3);
        if (statusDiff !== 0) return statusDiff;

        // Then by delivery date
        if (a.delivery_date && b.delivery_date) {
          return new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime();
        }
        if (a.delivery_date) return -1;
        if (b.delivery_date) return 1;

        // Finally by created date
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      setYomberItems(yombers);
      setStats(prev => ({ ...prev, yombers: yombers.reduce((sum, y) => sum + y.quantity, 0) }));
    } catch (err) {
      console.error('Error loading yomber items:', err);
    } finally {
      setLoadingYombers(false);
    }
  };

  // Load yombers when opening modal
  useEffect(() => {
    if (showYombersModal && yomberItems.length === 0 && orders.length > 0) {
      loadYomberItems();
    }
  }, [showYombersModal, orders]);

  // Filter yomber items by item_status (individual item tracking)
  const filteredYomberItems = yomberItems.filter(item => {
    if (yomberStatusFilter === 'all') return true;
    return item.item_status === yomberStatusFilter;
  });

  // Yomber stats based on item_status
  const yomberStats = {
    pending: yomberItems.filter(y => y.item_status === 'pending').length,
    in_production: yomberItems.filter(y => y.item_status === 'in_production').length,
    ready: yomberItems.filter(y => y.item_status === 'ready').length,
    total: yomberItems.length,
    totalQuantity: yomberItems.reduce((sum, y) => sum + y.quantity, 0),
  };

  // Handle yomber item status change
  const handleYomberStatusChange = async (yomber: YomberItem, newStatus: OrderItemStatus) => {
    try {
      setUpdatingYomberStatus(yomber.id);
      await orderService.updateItemStatus(yomber.school_id, yomber.order_id, yomber.id, newStatus);
      // Reload yombers to get updated statuses
      setYomberItems([]);
      await loadYomberItems();
    } catch (err: any) {
      console.error('Error updating yomber status:', err);
    } finally {
      setUpdatingYomberStatus(null);
    }
  };

  const getSourceBadge = (source: string | null | undefined) => {
    if (!source) return null;
    const sourceConfig: Record<string, { label: string; color: string }> = {
      desktop_app: { label: 'Desktop', color: 'bg-blue-100 text-blue-700' },
      web_portal: { label: 'Web', color: 'bg-purple-100 text-purple-700' },
      api: { label: 'API', color: 'bg-gray-100 text-gray-700' }
    };
    const config = sourceConfig[source] || { label: source, color: 'bg-gray-100 text-gray-700' };
    return (
      <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Sin fecha';
    return formatDateSpanish(dateString);
  };

  const getStatusConfig = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Pendiente',
          color: 'bg-yellow-100 text-yellow-800',
          icon: <Clock className="w-4 h-4" />,
        };
      case 'in_production':
        return {
          label: 'En Producción',
          color: 'bg-blue-100 text-blue-800',
          icon: <Package className="w-4 h-4" />,
        };
      case 'ready':
        return {
          label: 'Listo',
          color: 'bg-green-100 text-green-800',
          icon: <CheckCircle className="w-4 h-4" />,
        };
      case 'delivered':
        return {
          label: 'Entregado',
          color: 'bg-gray-100 text-gray-800',
          icon: <Truck className="w-4 h-4" />,
        };
      case 'cancelled':
        return {
          label: 'Cancelado',
          color: 'bg-red-100 text-red-800',
          icon: <XCircle className="w-4 h-4" />,
        };
      default:
        return {
          label: status,
          color: 'bg-gray-100 text-gray-800',
          icon: null,
        };
    }
  };

  const handleViewOrder = (orderId: string, schoolId: string) => {
    navigate(`/orders/${orderId}?school_id=${schoolId}`);
  };

  // NOTE: Payment approval handlers were removed as unused (PaymentVerificationModal is commented out).
  // They can be re-added when implementing the payment verification feature.

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Encargos</h1>
          <p className="text-gray-600 mt-1">
            {loading ? 'Cargando...' : `${orders.length} encargos encontrados`}
            {schoolFilter && availableSchools.length > 1 && (
              <span className="ml-2 text-blue-600">
                • Filtrado por colegio
              </span>
            )}
            {statusFilter && (
              <span className="ml-2 text-purple-600">
                • Filtrado por estado
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={() => {
              loadOrders();
              if (showProductStats) {
                setProductDemand([]);
                loadProductDemand();
              }
            }}
            disabled={loading}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg flex items-center transition disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Product Stats Toggle */}
          <button
            onClick={() => setShowProductStats(!showProductStats)}
            className={`px-3 py-2 rounded-lg flex items-center transition ${
              showProductStats
                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            title="Estadísticas de productos"
          >
            <BarChart3 className="w-5 h-5" />
          </button>

          {/* New Order Button */}
          <RequirePermission permission="orders.create">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nuevo Encargo
            </button>
          </RequirePermission>
        </div>
      </div>

      {/* Order Modal - now supports multi-school selection internally and drafts */}
      <OrderModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setActiveDraftId(null);
        }}
        onSuccess={handleSuccess}
        initialSchoolId={schoolIdForCreate}
        draftId={activeDraftId}
        onMinimize={() => setActiveDraftId(null)}
      />

      {/* Stats - Clickable for filtering */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
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
              <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'in_production' ? '' : 'in_production')}
          className={`text-left rounded-lg p-4 transition-all ${
            statusFilter === 'in_production'
              ? 'bg-blue-200 border-2 border-blue-500 ring-2 ring-blue-300'
              : 'bg-blue-50 border border-blue-200 hover:border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700">En Producción</p>
              <p className="text-2xl font-bold text-blue-900">{stats.inProduction}</p>
            </div>
            <Package className="w-8 h-8 text-blue-600" />
          </div>
        </button>

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
              <p className="text-2xl font-bold text-green-900">{stats.ready}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </button>

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
              <p className="text-2xl font-bold text-gray-900">{stats.delivered}</p>
            </div>
            <Truck className="w-8 h-8 text-gray-600" />
          </div>
        </button>

        {/* Yombers count - clickable to open confeccionista view */}
        <button
          onClick={() => setShowYombersModal(true)}
          className="text-left bg-purple-50 border border-purple-200 rounded-lg p-4 hover:bg-purple-100 hover:border-purple-400 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700">Yombers</p>
              <p className="text-2xl font-bold text-purple-900">
                {loadingYombers ? '...' : stats.yombers}
              </p>
            </div>
            <Ruler className="w-8 h-8 text-purple-600" />
          </div>
          <p className="text-xs text-purple-500 mt-1">Click para ver detalle</p>
        </button>
      </div>

      {/* Clear filter button */}
      {statusFilter && (
        <div className="mb-4">
          <button
            onClick={() => setStatusFilter('')}
            className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
          >
            <XCircle className="w-4 h-4" />
            Limpiar filtro de estado
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por código, cliente, estudiante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* School Filter - Only show if user has multiple schools */}
          {availableSchools.length > 1 && (
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Todos los colegios</option>
              {availableSchools.map(school => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | '')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="in_production">En Producción</option>
            <option value="ready">Listo</option>
            <option value="delivered">Entregado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <DateFilter value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Product Demand Statistics Panel - Improved */}
      {showProductStats && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          {/* Header with filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
              Demanda de Productos (Pendientes + En Producción)
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Type filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={demandFilters.type_filter || 'all'}
                  onChange={(e) => setDemandFilters(prev => ({ ...prev, type_filter: e.target.value as 'all' | 'yomber' | 'standard' }))}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="all">Todos</option>
                  <option value="yomber">Yomber</option>
                  <option value="standard">Estándar</option>
                </select>
              </div>
              {/* Sort by */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-gray-400" />
                <select
                  value={demandFilters.sort_by || 'quantity'}
                  onChange={(e) => setDemandFilters(prev => ({ ...prev, sort_by: e.target.value as 'quantity' | 'delivery_date' | 'order_count' }))}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="quantity">Por cantidad</option>
                  <option value="delivery_date">Por fecha entrega</option>
                  <option value="order_count">Por # encargos</option>
                </select>
              </div>
              {/* Refresh button */}
              <button
                onClick={loadProductDemand}
                disabled={loadingProductStats}
                className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
              >
                <RefreshCw className={`w-4 h-4 ${loadingProductStats ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>
          </div>

          {/* Summary stats */}
          {demandResponse && !loadingProductStats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Total Unidades</p>
                <p className="text-xl font-bold text-gray-900">{demandResponse.total_quantity}</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <p className="text-xs text-yellow-700">Pendientes</p>
                <p className="text-xl font-bold text-yellow-900">{demandResponse.pending_quantity}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-700">En Producción</p>
                <p className="text-xl font-bold text-blue-900">{demandResponse.in_production_quantity}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-xs text-purple-700">Yomber</p>
                <p className="text-xl font-bold text-purple-900">{demandResponse.yomber_quantity}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-green-700">Encargos</p>
                <p className="text-xl font-bold text-green-900">{demandResponse.total_orders}</p>
              </div>
            </div>
          )}

          {loadingProductStats && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600 mr-2" />
              <span className="text-gray-600">Analizando encargos...</span>
            </div>
          )}

          {!loadingProductStats && productDemand.length === 0 && (
            <p className="text-gray-500 text-center py-4">
              No hay encargos pendientes o en producción para analizar.
            </p>
          )}

          {!loadingProductStats && productDemand.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Producto
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Talla
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Color
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                      Tipo
                    </th>
                    {availableSchools.length > 1 && (
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Colegio
                      </th>
                    )}
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Pendientes
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      En Prod.
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      # Encargos
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                      Entrega
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {productDemand.map((item, index) => (
                    <tr
                      key={`${item.garment_type_id}-${item.size}-${item.color}-${item.is_yomber}-${index}`}
                      className="hover:bg-purple-50 cursor-pointer transition"
                      onClick={() => handleDemandRowClick(item)}
                    >
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-1">
                          {item.is_global_product && (
                            <span title="Producto Global">
                              <Globe className="w-3.5 h-3.5 text-blue-500" />
                            </span>
                          )}
                          {item.garment_type_name}
                          {item.garment_type_category && (
                            <span className="text-xs text-gray-400 ml-1">({item.garment_type_category})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {item.size || '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {item.color || '-'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {item.is_yomber ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                            <Ruler className="w-3 h-3" />
                            Yomber
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Estándar</span>
                        )}
                      </td>
                      {availableSchools.length > 1 && (
                        <td className="px-4 py-2 text-left text-xs text-gray-600">
                          {item.school_names.length === 1 ? (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {item.school_names[0]}
                            </span>
                          ) : (
                            <span className="text-gray-400" title={item.school_names.join(', ')}>
                              {item.school_names.length} colegios
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-2 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {item.total_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={`text-sm font-medium ${item.pending_quantity > 0 ? 'text-yellow-700' : 'text-gray-500'}`}>
                          {item.pending_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={`text-sm font-medium ${item.in_production_quantity > 0 ? 'text-blue-700' : 'text-gray-500'}`}>
                          {item.in_production_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600">
                        {item.order_count}
                      </td>
                      <td className="px-4 py-2 text-center text-xs text-gray-500">
                        {item.earliest_delivery_date ? formatDateSpanish(item.earliest_delivery_date) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-500 text-center mt-3">
                Haz clic en una fila para ver los encargos que contienen este producto
              </p>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Cargando encargos...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error al cargar encargos</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                onClick={() => loadOrders()}
                className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orders Table */}
      {!loading && !error && orders.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código
                </th>
                {availableSchools.length > 1 && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Colegio
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entrega
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Saldo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Comprobante
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => {
                const statusConfig = getStatusConfig(order.status);
                const hasBalance = order.balance > 0;

                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{order.code}</span>
                      {getSourceBadge(order.source)}
                    </td>
                    {availableSchools.length > 1 && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="truncate max-w-[120px]" title={order.school_name || ''}>
                            {order.school_name || 'Sin colegio'}
                          </span>
                          {order.school_name?.startsWith('+') && (
                            <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded font-medium whitespace-nowrap">
                              +Colegio Nuevo
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{order.client_name || 'Sin cliente'}</div>
                      {order.student_name && (
                        <div className="text-xs text-gray-500">{order.student_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-full ${statusConfig.color}`}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                        {/* Partial delivery indicator */}
                        {order.items_delivered > 0 && order.items_delivered < order.items_total && (
                          <div className="flex items-center gap-1">
                            <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
                              Entrega Parcial
                            </span>
                            <span className="text-xs text-gray-500">
                              {order.items_delivered}/{order.items_total}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                        {formatDate(order.delivery_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(order.total)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-medium ${hasBalance ? 'text-red-600' : 'text-green-600'}`}>
                        {hasBalance ? formatCurrency(order.balance) : 'Pagado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm text-gray-600">{order.items_count}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {order.payment_proof_url ? (
                        <button
                          onClick={() => setSelectedOrderForPayment(order)}
                          className="text-green-600 hover:text-green-800 p-2 rounded hover:bg-green-50 transition inline-flex items-center gap-1"
                          title="Ver comprobante de pago"
                        >
                          <Receipt className="w-5 h-5" />
                          <span className="text-xs">Ver</span>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Sin comprobante</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleViewOrder(order.id, order.school_id || '')}
                        className="text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50 transition"
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
          {hasMore && orders.length > 0 && (
            <div className="p-4 border-t border-gray-200 text-center">
              <button
                onClick={() => { loadOrders(true); }}
                disabled={loadingMore}
                className="px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg inline-flex items-center transition disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Cargar mas encargos
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && orders.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-12 text-center">
          <FileText className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-blue-900 mb-2">
            {debouncedSearch || statusFilter || schoolFilter || dateRange.start_date || dateRange.end_date ? 'No se encontraron encargos' : 'No hay encargos'}
          </h3>
          <p className="text-blue-700 mb-4">
            {debouncedSearch || statusFilter || schoolFilter || dateRange.start_date || dateRange.end_date
              ? 'Intenta ajustar los filtros de busqueda'
              : 'Comienza creando tu primer encargo'
            }
          </p>
          {!debouncedSearch && !statusFilter && !schoolFilter && !dateRange.start_date && !dateRange.end_date && (
            <RequirePermission permission="orders.create">
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg inline-flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Nuevo Encargo
              </button>
            </RequirePermission>
          )}
        </div>
      )}

      {/* Payment Verification Modal - Not used in Orders (only in WebOrders) */}
      {/* {selectedOrderForPayment && (
        <PaymentVerificationModal
          order={selectedOrderForPayment}
          onClose={() => setSelectedOrderForPayment(null)}
          onApprove={handleApprovePayment}
          onReject={handleRejectPayment}
        />
      )} */}

      {/* Yombers Modal - Confeccionista View */}
      {showYombersModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowYombersModal(false)} />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-purple-50">
                <div>
                  <h2 className="text-xl font-bold text-purple-800 flex items-center">
                    <Ruler className="w-6 h-6 mr-2" />
                    Vista de Confección - Yombers
                  </h2>
                  <p className="text-sm text-purple-600 mt-1">
                    {yomberStats.total} yombers pendientes ({yomberStats.totalQuantity} unidades)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setYomberItems([]);
                      loadYomberItems();
                    }}
                    disabled={loadingYombers}
                    className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition"
                    title="Actualizar"
                  >
                    <RefreshCw className={`w-5 h-5 ${loadingYombers ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setShowYombersModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setYomberStatusFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      yomberStatusFilter === 'all'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:border-purple-400'
                    }`}
                  >
                    Todos ({yomberStats.total})
                  </button>
                  <button
                    onClick={() => setYomberStatusFilter('pending')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                      yomberStatusFilter === 'pending'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:border-yellow-400'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    Pendientes ({yomberStats.pending})
                  </button>
                  <button
                    onClick={() => setYomberStatusFilter('in_production')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                      yomberStatusFilter === 'in_production'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-400'
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                    En Producción ({yomberStats.in_production})
                  </button>
                  <button
                    onClick={() => setYomberStatusFilter('ready')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                      yomberStatusFilter === 'ready'
                        ? 'bg-green-500 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:border-green-400'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Listos ({yomberStats.ready})
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {loadingYombers ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    <span className="ml-3 text-gray-600">Cargando yombers...</span>
                  </div>
                ) : filteredYomberItems.length === 0 ? (
                  <div className="text-center py-12">
                    <Ruler className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">
                      {yomberItems.length === 0
                        ? 'No hay yombers en producción'
                        : 'No hay yombers con este filtro'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredYomberItems.map((yomber) => {
                      const statusConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
                        pending: { label: 'Pendiente', color: 'text-yellow-700', bg: 'bg-yellow-100', icon: '🟡' },
                        in_production: { label: 'En Producción', color: 'text-blue-700', bg: 'bg-blue-100', icon: '🔵' },
                        ready: { label: 'Listo', color: 'text-green-700', bg: 'bg-green-100', icon: '🟢' },
                      };
                      const status = statusConfig[yomber.item_status] || statusConfig.pending;
                      const isUpdating = updatingYomberStatus === yomber.id;

                      return (
                        <div
                          key={yomber.id}
                          className="bg-white border border-purple-200 rounded-lg p-4 hover:shadow-md transition"
                        >
                          {/* Header Row */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono font-bold text-purple-700">{yomber.order_code}</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.bg} ${status.color}`}>
                                  {status.icon} {status.label}
                                </span>
                                <span className="text-sm text-gray-500">
                                  x{yomber.quantity}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">{yomber.garment_type_name}</span>
                                {yomber.size && ` - Talla ${yomber.size}`}
                                {yomber.color && ` - ${yomber.color}`}
                              </p>
                              <p className="text-sm text-gray-500">
                                Cliente: {yomber.client_name}
                                {yomber.student_name && ` (${yomber.student_name})`}
                              </p>
                            </div>
                            <div className="text-right">
                              {yomber.delivery_date && (
                                <p className="text-sm">
                                  <span className="text-gray-500">Entrega:</span>{' '}
                                  <span className="font-medium text-purple-700">
                                    {formatDateSpanish(yomber.delivery_date)}
                                  </span>
                                </p>
                              )}
                              <button
                                onClick={() => {
                                  setShowYombersModal(false);
                                  navigate(`/orders/${yomber.order_id}`);
                                }}
                                className="text-xs text-purple-600 hover:text-purple-800 mt-1"
                              >
                                Ver encargo →
                              </button>
                            </div>
                          </div>

                          {/* Measurements Grid */}
                          <div className="bg-purple-50 rounded-lg p-3">
                            <p className="text-xs text-purple-600 uppercase font-medium mb-2">Medidas</p>
                            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                              {/* Primary measurements first */}
                              {['delantero', 'trasero', 'cintura', 'largo'].map(key => {
                                const value = yomber.custom_measurements[key];
                                if (value === undefined) return null;
                                return (
                                  <div key={key} className="bg-white rounded px-2 py-1.5 text-center border border-purple-200">
                                    <span className="text-xs text-purple-600 block">{measurementLabels[key]}</span>
                                    <span className="text-lg font-bold text-purple-800">{value}</span>
                                  </div>
                                );
                              })}
                              {/* Secondary measurements */}
                              {Object.entries(yomber.custom_measurements)
                                .filter(([key]) => !['delantero', 'trasero', 'cintura', 'largo'].includes(key))
                                .map(([key, value]) => (
                                  <div key={key} className="bg-gray-50 rounded px-2 py-1.5 text-center">
                                    <span className="text-xs text-gray-500 block">{measurementLabels[key] || key}</span>
                                    <span className="text-sm font-semibold text-gray-700">{value}</span>
                                  </div>
                                ))
                              }
                            </div>
                          </div>

                          {/* Notes */}
                          {yomber.notes && (
                            <div className="mt-2 text-sm text-gray-600 bg-yellow-50 rounded px-3 py-2">
                              <span className="font-medium">Notas:</span> {yomber.notes}
                            </div>
                          )}

                          {/* Status Change Buttons */}
                          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                            {isUpdating ? (
                              <div className="flex items-center text-sm text-gray-500">
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Actualizando...
                              </div>
                            ) : (
                              <>
                                {yomber.item_status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleYomberStatusChange(yomber, 'in_production')}
                                      className="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition flex items-center gap-1"
                                    >
                                      <Wrench className="w-3 h-3" />
                                      Iniciar Producción
                                    </button>
                                    <button
                                      onClick={() => handleYomberStatusChange(yomber, 'ready')}
                                      className="px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition flex items-center gap-1"
                                    >
                                      <CheckCircle className="w-3 h-3" />
                                      Marcar Listo
                                    </button>
                                  </>
                                )}
                                {yomber.item_status === 'in_production' && (
                                  <>
                                    <button
                                      onClick={() => handleYomberStatusChange(yomber, 'ready')}
                                      className="px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition flex items-center gap-1"
                                    >
                                      <CheckCircle className="w-3 h-3" />
                                      Marcar Listo
                                    </button>
                                    <button
                                      onClick={() => handleYomberStatusChange(yomber, 'delivered')}
                                      className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-1"
                                    >
                                      <Truck className="w-3 h-3" />
                                      Entregar
                                    </button>
                                  </>
                                )}
                                {yomber.item_status === 'ready' && (
                                  <button
                                    onClick={() => handleYomberStatusChange(yomber, 'delivered')}
                                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-1"
                                  >
                                    <Truck className="w-3 h-3" />
                                    Marcar Entregado
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 text-center">
                <p className="text-sm text-gray-500">
                  Mostrando {filteredYomberItems.length} de {yomberItems.length} yombers
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Demand Modal */}
      <ProductDemandModal
        isOpen={showDemandModal}
        onClose={() => setShowDemandModal(false)}
        demandItem={selectedDemandItem}
        onNavigateToOrder={handleNavigateToOrderFromDemand}
      />
    </Layout>
  );
}
