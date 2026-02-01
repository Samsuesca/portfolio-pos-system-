/**
 * Sale & Order Changes Page - Create and manage change/return requests
 * Supports both Sale Changes (Ventas) and Order Changes (Encargos) via tabs
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import SaleChangeModal from '../components/SaleChangeModal';
import SaleChangeDetailModal from '../components/SaleChangeDetailModal';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, Loader2, Eye, Search, Plus, ShoppingCart, Package, ClipboardList, Info } from 'lucide-react';
import { formatDateTimeSpanish } from '../components/DatePicker';
import DateFilter, { DateRange } from '../components/DateFilter';
import { saleChangeService } from '../services/saleChangeService';
import { saleService } from '../services/saleService';
import { orderChangeService } from '../services/orderChangeService';
import { orderService } from '../services/orderService';
import type { SaleChangeListItem, SaleListItem, SaleWithItems, OrderChangeListItem, OrderListItem } from '../types/api';

type ActiveTab = 'sales' | 'orders';

export default function SaleChanges() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>('sales');

  // === SALE CHANGES STATE ===
  const [changes, setChanges] = useState<SaleChangeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>({});

  // Search for sales to create changes
  const [showSaleSearch, setShowSaleSearch] = useState(false);
  const [saleSearchTerm, setSaleSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SaleListItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Modal for creating change
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null);
  const [loadingSale, setLoadingSale] = useState(false);

  // Approval modal with payment method selection
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveChangeData, setApproveChangeData] = useState<{ saleId: string; changeId: string; priceAdjustment: number } | null>(null);
  const [approvePaymentMethod, setApprovePaymentMethod] = useState<'cash' | 'nequi' | 'transfer' | 'card'>('cash');

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectChangeData, setRejectChangeData] = useState<{ saleId: string; changeId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Mapeo sale_id -> school_id para operaciones que requieren school_id
  const [saleSchoolMap, setSaleSchoolMap] = useState<Record<string, string>>({});

  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [selectedChange, setSelectedChange] = useState<SaleChangeListItem | null>(null);

  // === ORDER CHANGES STATE ===
  const [orderChanges, setOrderChanges] = useState<OrderChangeListItem[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderProcessingId, setOrderProcessingId] = useState<string | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('');

  // Search for orders
  const [showOrderSearch, setShowOrderSearch] = useState(false);
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [orderSearchResults, setOrderSearchResults] = useState<OrderListItem[]>([]);
  const [orderSearchLoading, setOrderSearchLoading] = useState(false);

  // Order approval modal
  const [showOrderApproveModal, setShowOrderApproveModal] = useState(false);
  const [orderApproveChangeData, setOrderApproveChangeData] = useState<{ orderId: string; changeId: string; schoolId: string; priceAdjustment: number } | null>(null);
  const [orderApprovePaymentMethod, setOrderApprovePaymentMethod] = useState<'cash' | 'nequi' | 'transfer' | 'card'>('cash');

  // Order rejection modal
  const [showOrderRejectModal, setShowOrderRejectModal] = useState(false);
  const [orderRejectChangeData, setOrderRejectChangeData] = useState<{ orderId: string; changeId: string; schoolId: string } | null>(null);
  const [orderRejectReason, setOrderRejectReason] = useState('');

  // === SALE CHANGES: Load on mount ===
  useEffect(() => {
    loadAllChanges();
  }, []);

  // === ORDER CHANGES: Load when tab switches to orders ===
  useEffect(() => {
    if (activeTab === 'orders' && orderChanges.length === 0 && !orderLoading) {
      loadAllOrderChanges();
    }
  }, [activeTab]);

  // Buscar ventas en backend con debounce - SOLO cuando el modal de busqueda esta abierto
  useEffect(() => {
    // No buscar si el modal no esta abierto
    if (!showSaleSearch) {
      return;
    }

    const searchSales = async () => {
      try {
        setSearchLoading(true);
        // Busqueda en backend - encuentra ventas en TODA la base de datos
        const results = await saleService.getAllSales({
          status: 'completed',
          search: saleSearchTerm.trim() || undefined,
          limit: 50,
          include_historical: false
        });
        setSearchResults(results);

        // Actualizar mapeo sale_id -> school_id con los resultados
        setSaleSchoolMap(prev => {
          const newMap = { ...prev };
          results.forEach(sale => {
            if (sale.school_id) newMap[sale.id] = sale.school_id;
          });
          return newMap;
        });
      } catch (err) {
        console.error('Error searching sales:', err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    };

    // Debounce: esperar 300ms despues de que el usuario deje de escribir
    const timeoutId = setTimeout(searchSales, 300);
    return () => clearTimeout(timeoutId);
  }, [saleSearchTerm, showSaleSearch]);

  // Buscar encargos en backend con debounce
  useEffect(() => {
    if (!showOrderSearch) {
      return;
    }

    const searchOrders = async () => {
      try {
        setOrderSearchLoading(true);
        const results = await orderService.getAllOrders({
          search: orderSearchTerm.trim() || undefined,
          limit: 50,
        });
        setOrderSearchResults(results);
      } catch (err) {
        console.error('Error searching orders:', err);
        setOrderSearchResults([]);
      } finally {
        setOrderSearchLoading(false);
      }
    };

    const timeoutId = setTimeout(searchOrders, 300);
    return () => clearTimeout(timeoutId);
  }, [orderSearchTerm, showOrderSearch]);

  // === SALE CHANGES HANDLERS ===

  const handleSelectSale = async (sale: SaleListItem) => {
    try {
      setLoadingSale(true);
      // Usar endpoint global que no requiere school_id
      const fullSale = await saleService.getSaleDetails(sale.id);
      setSelectedSale(fullSale);
      setShowSaleSearch(false);
      setSaleSearchTerm('');
      setSearchResults([]);
      setShowChangeModal(true);
    } catch (err: any) {
      console.error('Error loading sale details:', err);
      alert('Error al cargar los detalles de la venta');
    } finally {
      setLoadingSale(false);
    }
  };

  const handleChangeCreated = () => {
    setShowChangeModal(false);
    setSelectedSale(null);
    loadAllChanges();
  };

  const loadAllChanges = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar todos los cambios de una sola vez usando el endpoint global
      // Esto es mucho mas eficiente que cargar cambios por cada venta
      const allChanges = await saleChangeService.getAllChanges({ limit: 500 });
      setChanges(allChanges);

      // Cargar el mapeo sale_id -> school_id para las operaciones de aprobar/rechazar
      // Solo si hay cambios que necesitan esta informacion
      if (allChanges.length > 0) {
        const salesData = await saleService.getAllSales({
          status: 'completed',
          limit: 500,
          include_historical: false
        });
        const schoolMap: Record<string, string> = {};
        salesData.forEach(sale => {
          if (sale.school_id) schoolMap[sale.id] = sale.school_id;
        });
        setSaleSchoolMap(schoolMap);
      }
    } catch (err: any) {
      console.error('Error loading changes:', err);
      setError(err.response?.data?.detail || 'Error al cargar las solicitudes de cambio');
    } finally {
      setLoading(false);
    }
  };

  // Open approval modal - ALWAYS show modal for confirmation
  const handleApproveClick = (change: SaleChangeListItem) => {
    const priceAdjustment = Number(change.price_adjustment);
    // Always show modal for confirmation, regardless of price adjustment
    setApproveChangeData({
      saleId: change.sale_id,
      changeId: change.id,
      priceAdjustment
    });
    setApprovePaymentMethod('cash');
    setShowApproveModal(true);
  };

  const handleApprove = async (saleId: string, changeId: string, paymentMethod?: 'cash' | 'nequi' | 'transfer' | 'card') => {
    // Obtener school_id del mapeo
    const saleSchoolId = saleSchoolMap[saleId];
    if (!saleSchoolId) {
      setError('No se encontro el colegio de la venta');
      return;
    }

    // Confirmation is handled by the modal, no need for additional confirm()
    try {
      setProcessingId(changeId);
      setError(null);
      setShowApproveModal(false);
      await saleChangeService.approveChange(saleSchoolId, saleId, changeId, paymentMethod);
      setApproveChangeData(null);
      await loadAllChanges();
    } catch (err: any) {
      console.error('Error approving change:', err);
      setError(err.response?.data?.detail || 'Error al aprobar el cambio');
    } finally {
      setProcessingId(null);
    }
  };

  // Open rejection modal
  const handleRejectClick = (saleId: string, changeId: string) => {
    setRejectChangeData({ saleId, changeId });
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!rejectChangeData) return;

    const { saleId, changeId } = rejectChangeData;

    // Obtener school_id del mapeo
    const saleSchoolId = saleSchoolMap[saleId];
    if (!saleSchoolId) {
      setError('No se encontro el colegio de la venta');
      return;
    }

    if (!rejectReason.trim()) {
      setError('Debes proporcionar un motivo de rechazo');
      return;
    }

    try {
      setProcessingId(changeId);
      setError(null);
      setShowRejectModal(false);
      await saleChangeService.rejectChange(saleSchoolId, saleId, changeId, rejectReason.trim());
      setRejectChangeData(null);
      setRejectReason('');
      await loadAllChanges();
    } catch (err: any) {
      console.error('Error rejecting change:', err);
      setError(err.response?.data?.detail || 'Error al rechazar el cambio');
    } finally {
      setProcessingId(null);
    }
  };

  // Open detail modal
  const handleViewDetail = (change: SaleChangeListItem) => {
    setSelectedChangeId(change.id);
    setSelectedChange(change);
    setShowDetailModal(true);
  };

  // === ORDER CHANGES HANDLERS ===

  const loadAllOrderChanges = async () => {
    try {
      setOrderLoading(true);
      setOrderError(null);
      const allOrderChanges = await orderChangeService.getAllChanges({ limit: 500 });
      setOrderChanges(allOrderChanges);
    } catch (err: any) {
      console.error('Error loading order changes:', err);
      setOrderError(err.response?.data?.detail || 'Error al cargar los cambios de encargos');
    } finally {
      setOrderLoading(false);
    }
  };

  const handleOrderApproveClick = (change: OrderChangeListItem) => {
    const priceAdjustment = Number(change.price_adjustment);
    setOrderApproveChangeData({
      orderId: change.order_id,
      changeId: change.id,
      schoolId: change.school_id || '',
      priceAdjustment
    });
    setOrderApprovePaymentMethod('cash');
    setShowOrderApproveModal(true);
  };

  const handleOrderApprove = async () => {
    if (!orderApproveChangeData) return;
    const { orderId, changeId, schoolId } = orderApproveChangeData;

    if (!schoolId) {
      setOrderError('No se encontro el colegio del encargo');
      return;
    }

    try {
      setOrderProcessingId(changeId);
      setOrderError(null);
      setShowOrderApproveModal(false);
      await orderChangeService.approveChange(schoolId, orderId, changeId, orderApprovePaymentMethod);
      setOrderApproveChangeData(null);
      await loadAllOrderChanges();
    } catch (err: any) {
      console.error('Error approving order change:', err);
      setOrderError(err.response?.data?.detail || 'Error al aprobar el cambio de encargo');
    } finally {
      setOrderProcessingId(null);
    }
  };

  const handleOrderRejectClick = (change: OrderChangeListItem) => {
    setOrderRejectChangeData({
      orderId: change.order_id,
      changeId: change.id,
      schoolId: change.school_id || ''
    });
    setOrderRejectReason('');
    setShowOrderRejectModal(true);
  };

  const handleOrderReject = async () => {
    if (!orderRejectChangeData) return;
    const { orderId, changeId, schoolId } = orderRejectChangeData;

    if (!schoolId) {
      setOrderError('No se encontro el colegio del encargo');
      return;
    }

    if (!orderRejectReason.trim()) {
      setOrderError('Debes proporcionar un motivo de rechazo');
      return;
    }

    try {
      setOrderProcessingId(changeId);
      setOrderError(null);
      setShowOrderRejectModal(false);
      await orderChangeService.rejectChange(schoolId, orderId, changeId, orderRejectReason.trim());
      setOrderRejectChangeData(null);
      setOrderRejectReason('');
      await loadAllOrderChanges();
    } catch (err: any) {
      console.error('Error rejecting order change:', err);
      setOrderError(err.response?.data?.detail || 'Error al rechazar el cambio de encargo');
    } finally {
      setOrderProcessingId(null);
    }
  };

  const handleSelectOrder = (order: OrderListItem) => {
    setShowOrderSearch(false);
    setOrderSearchTerm('');
    setOrderSearchResults([]);
    // Navigate to order detail page where changes can be created
    navigate(`/orders/${order.id}`);
  };

  // === SHARED HELPERS ===

  const formatDate = (dateString: string) => {
    return formatDateTimeSpanish(dateString);
  };

  const getChangeTypeLabel = (type: string) => {
    switch (type) {
      case 'size_change': return 'Cambio de Talla';
      case 'product_change': return 'Cambio de Producto';
      case 'return': return 'Devolucion';
      case 'defect': return 'Producto Defectuoso';
      default: return type;
    }
  };

  const getChangeStatusColor = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'pending_stock': return 'bg-amber-100 text-amber-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getChangeStatusIcon = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'pending_stock': return <Package className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusLabel = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'approved': return 'Aprobado';
      case 'pending': return 'Pendiente';
      case 'pending_stock': return 'Esperando Stock';
      case 'rejected': return 'Rechazado';
      default: return status;
    }
  };

  // === SALE CHANGES: Filtering & Sorting ===
  const filteredChanges = changes.filter(change => {
    const matchesStatus = statusFilter === '' || change.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesType = typeFilter === '' || change.change_type === typeFilter;
    let matchesDate = true;
    if (dateRange.start_date || dateRange.end_date) {
      const changeDate = change.change_date.split('T')[0];
      if (dateRange.start_date && changeDate < dateRange.start_date) matchesDate = false;
      if (dateRange.end_date && changeDate > dateRange.end_date) matchesDate = false;
    }
    return matchesStatus && matchesType && matchesDate;
  });

  const sortedChanges = [...filteredChanges].sort((a, b) =>
    new Date(b.change_date).getTime() - new Date(a.change_date).getTime()
  );

  const pendingCount = changes.filter(c => c.status.toLowerCase() === 'pending').length;
  const pendingStockCount = changes.filter(c => c.status.toLowerCase() === 'pending_stock').length;
  const approvedCount = changes.filter(c => c.status.toLowerCase() === 'approved').length;
  const rejectedCount = changes.filter(c => c.status.toLowerCase() === 'rejected').length;

  // === ORDER CHANGES: Filtering & Sorting ===
  const filteredOrderChanges = orderChanges.filter(change => {
    const matchesStatus = orderStatusFilter === '' || change.status.toLowerCase() === orderStatusFilter.toLowerCase();
    const matchesType = orderTypeFilter === '' || change.change_type === orderTypeFilter;
    let matchesDate = true;
    if (dateRange.start_date || dateRange.end_date) {
      const changeDate = change.change_date.split('T')[0];
      if (dateRange.start_date && changeDate < dateRange.start_date) matchesDate = false;
      if (dateRange.end_date && changeDate > dateRange.end_date) matchesDate = false;
    }
    return matchesStatus && matchesType && matchesDate;
  });

  const sortedOrderChanges = [...filteredOrderChanges].sort((a, b) =>
    new Date(b.change_date).getTime() - new Date(a.change_date).getTime()
  );

  const orderPendingCount = orderChanges.filter(c => c.status.toLowerCase() === 'pending').length;
  const orderPendingStockCount = orderChanges.filter(c => c.status.toLowerCase() === 'pending_stock').length;
  const orderApprovedCount = orderChanges.filter(c => c.status.toLowerCase() === 'approved').length;
  const orderRejectedCount = orderChanges.filter(c => c.status.toLowerCase() === 'rejected').length;

  // Active tab stats
  const activePendingCount = activeTab === 'sales' ? pendingCount : orderPendingCount;
  const activeApprovedCount = activeTab === 'sales' ? approvedCount : orderApprovedCount;
  const activeRejectedCount = activeTab === 'sales' ? rejectedCount : orderRejectedCount;
  const activeFilteredCount = activeTab === 'sales' ? filteredChanges.length : filteredOrderChanges.length;
  const activeLoading = activeTab === 'sales' ? loading : orderLoading;
  const activeError = activeTab === 'sales' ? error : orderError;

  const handleRefresh = () => {
    if (activeTab === 'sales') {
      loadAllChanges();
    } else {
      loadAllOrderChanges();
    }
  };

  return (
    <Layout>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <RefreshCw className="w-8 h-8 mr-3 text-blue-600" />
              Gestion de Cambios y Devoluciones
            </h1>
            <p className="text-gray-600 mt-1">
              {activeLoading ? 'Cargando...' : `${activeFilteredCount} solicitudes encontradas`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={activeLoading}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center transition disabled:opacity-50"
              title="Actualizar lista"
            >
              <RefreshCw className={`w-5 h-5 ${activeLoading ? 'animate-spin' : ''}`} />
            </button>
            {activeTab === 'sales' ? (
              <button
                onClick={() => setShowSaleSearch(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition"
              >
                <Plus className="w-5 h-5 mr-2" />
                Nuevo Cambio/Devolucion
              </button>
            ) : (
              <button
                onClick={() => setShowOrderSearch(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition"
              >
                <Plus className="w-5 h-5 mr-2" />
                Nuevo Cambio de Encargo
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'sales'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Ventas
            {pendingCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'orders'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            Encargos
            {orderPendingCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">
                {orderPendingCount}
              </span>
            )}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-900">{activePendingCount}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Aprobadas</p>
                <p className="text-2xl font-bold text-green-900">{activeApprovedCount}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700">Rechazadas</p>
                <p className="text-2xl font-bold text-red-900">{activeRejectedCount}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filtros:</span>
            </div>
            {activeTab === 'sales' ? (
              <>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Todos los estados</option>
                  <option value="pending">Pendientes ({pendingCount})</option>
                  <option value="pending_stock">Esperando Stock ({pendingStockCount})</option>
                  <option value="approved">Aprobadas ({approvedCount})</option>
                  <option value="rejected">Rechazadas ({rejectedCount})</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Todos los tipos</option>
                  <option value="size_change">Cambio de Talla</option>
                  <option value="product_change">Cambio de Producto</option>
                  <option value="return">Devolucion</option>
                  <option value="defect">Producto Defectuoso</option>
                </select>
              </>
            ) : (
              <>
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Todos los estados</option>
                  <option value="pending">Pendientes ({orderPendingCount})</option>
                  <option value="pending_stock">Esperando Stock ({orderPendingStockCount})</option>
                  <option value="approved">Aprobadas ({orderApprovedCount})</option>
                  <option value="rejected">Rechazadas ({orderRejectedCount})</option>
                </select>

                <select
                  value={orderTypeFilter}
                  onChange={(e) => setOrderTypeFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Todos los tipos</option>
                  <option value="size_change">Cambio de Talla</option>
                  <option value="product_change">Cambio de Producto</option>
                  <option value="return">Devolucion</option>
                  <option value="defect">Producto Defectuoso</option>
                </select>
              </>
            )}
          </div>

          {/* Date Filter */}
          <div className="border-t border-gray-200 pt-3 mt-3">
            <DateFilter value={dateRange} onChange={setDateRange} />
          </div>
        </div>
      </div>

      {/* === SALE SEARCH MODAL === */}
      {showSaleSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <ShoppingCart className="w-6 h-6 mr-2 text-blue-600" />
                  Buscar Venta
                </h2>
                <button
                  onClick={() => {
                    setShowSaleSearch(false);
                    setSaleSearchTerm('');
                    setSearchResults([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por codigo, cliente o colegio..."
                  value={saleSearchTerm}
                  onChange={(e) => setSaleSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-[50vh]">
              {(loadingSale || searchLoading) && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                  <span>{loadingSale ? 'Cargando detalles de la venta...' : 'Buscando ventas...'}</span>
                </div>
              )}

              {!loadingSale && !searchLoading && searchResults.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No se encontraron ventas completadas</p>
                  <p className="text-sm mt-1">Escribe el codigo o nombre del cliente para buscar</p>
                </div>
              )}

              {!loadingSale && !searchLoading && searchResults.map(sale => (
                <button
                  key={sale.id}
                  onClick={() => handleSelectSale(sale)}
                  className="w-full p-4 border-b border-gray-100 hover:bg-blue-50 text-left transition flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">{sale.code}</p>
                    <p className="text-sm text-gray-600">
                      {sale.client_name || 'Sin cliente'} - {sale.items_count} items
                    </p>
                    {sale.school_name && (
                      <p className="text-xs text-blue-600 font-medium">
                        {sale.school_name}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {formatDate(sale.sale_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      ${Number(sale.total).toLocaleString()}
                    </p>
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                      Completada
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-600 text-center">
                Selecciona una venta para crear un cambio o devolucion
              </p>
            </div>
          </div>
        </div>
      )}

      {/* === ORDER SEARCH MODAL === */}
      {showOrderSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <ClipboardList className="w-6 h-6 mr-2 text-blue-600" />
                  Buscar Encargo
                </h2>
                <button
                  onClick={() => {
                    setShowOrderSearch(false);
                    setOrderSearchTerm('');
                    setOrderSearchResults([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por codigo, cliente o colegio..."
                  value={orderSearchTerm}
                  onChange={(e) => setOrderSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-[50vh]">
              {orderSearchLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                  <span>Buscando encargos...</span>
                </div>
              )}

              {!orderSearchLoading && orderSearchResults.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No se encontraron encargos</p>
                  <p className="text-sm mt-1">Escribe el codigo o nombre del cliente para buscar</p>
                </div>
              )}

              {!orderSearchLoading && orderSearchResults.map(order => (
                <button
                  key={order.id}
                  onClick={() => handleSelectOrder(order)}
                  className="w-full p-4 border-b border-gray-100 hover:bg-blue-50 text-left transition flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">{order.code}</p>
                    <p className="text-sm text-gray-600">
                      {order.client_name || 'Sin cliente'} - {order.items_count} items
                    </p>
                    {order.school_name && (
                      <p className="text-xs text-blue-600 font-medium">
                        {order.school_name}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      ${Number(order.total).toLocaleString()}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                      order.status === 'ready' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'in_production' ? 'bg-purple-100 text-purple-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.status === 'delivered' ? 'Entregado' :
                       order.status === 'ready' ? 'Listo' :
                       order.status === 'in_production' ? 'En Produccion' :
                       order.status === 'pending' ? 'Pendiente' :
                       order.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-600 text-center">
                Selecciona un encargo para ir a su detalle y crear un cambio
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Change Modal (Sales only) */}
      {showChangeModal && selectedSale && (
        <SaleChangeModal
          isOpen={showChangeModal}
          onClose={() => {
            setShowChangeModal(false);
            setSelectedSale(null);
          }}
          saleId={selectedSale.id}
          saleItems={selectedSale.items}
          schoolId={selectedSale.school_id}
          onSuccess={handleChangeCreated}
        />
      )}

      {/* Loading State */}
      {activeLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Cargando solicitudes...</span>
        </div>
      )}

      {/* Error State */}
      {activeError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{activeError}</p>
              <button
                onClick={handleRefresh}
                className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === SALES CHANGES TABLE === */}
      {activeTab === 'sales' && !loading && sortedChanges.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Venta
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Producto Original
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Producto Nuevo
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ajuste
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedChanges.map((change) => {
                const isProcessing = processingId === change.id;
                const isPending = change.status.toLowerCase() === 'pending';

                return (
                  <tr key={change.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/sales/${change.sale_id}`)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        {change.sale_code}
                      </button>
                      <p className="text-xs text-gray-400">{formatDate(change.change_date)}</p>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(change.change_date).split(' ')[0]}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{getChangeTypeLabel(change.change_type)}</span>
                      {change.user_username && (
                        <p className="text-xs text-gray-400">Por: {change.user_username}</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 max-w-[200px]">
                        {change.original_product_code ? (
                          <>
                            <span className="font-medium">{change.original_product_code}</span>
                            {change.original_product_name && (
                              <span className="text-gray-600"> {change.original_product_name}</span>
                            )}
                            {change.original_product_size && (
                              <span className="text-gray-500 text-xs ml-1">({change.original_product_size})</span>
                            )}
                            <p className="text-xs text-gray-400">
                              Cant: {change.returned_quantity}
                              {change.original_unit_price && ` @ $${Number(change.original_unit_price).toLocaleString()}`}
                            </p>
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 max-w-[200px]">
                        {change.new_product_code ? (
                          <>
                            <span className="font-medium">{change.new_product_code}</span>
                            {change.new_product_name && (
                              <span className="text-gray-600"> {change.new_product_name}</span>
                            )}
                            {change.new_product_size && (
                              <span className="text-gray-500 text-xs ml-1">({change.new_product_size})</span>
                            )}
                            <p className="text-xs text-gray-400">
                              Cant: {change.new_quantity}
                              {change.new_unit_price && ` @ $${Number(change.new_unit_price).toLocaleString()}`}
                            </p>
                          </>
                        ) : (
                          <span className="text-gray-400 italic">Solo devolucion</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right">
                      <span className={Number(change.price_adjustment) >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        ${Number(change.price_adjustment).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-full ${getChangeStatusColor(change.status)}`}>
                        {getChangeStatusIcon(change.status)}
                        {getStatusLabel(change.status)}
                      </span>
                      {change.reason && (
                        <p className="text-xs text-gray-400 mt-1 max-w-[120px] truncate" title={change.reason}>
                          {change.reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Detail Button - Always visible */}
                        <button
                          onClick={() => handleViewDetail(change)}
                          className="text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50 transition"
                          title="Ver Detalle"
                        >
                          <Info className="w-5 h-5" />
                        </button>
                        {isPending && !isProcessing && (
                          <>
                            <button
                              onClick={() => handleApproveClick(change)}
                              className="text-green-600 hover:text-green-800 p-2 rounded hover:bg-green-50 transition"
                              title="Aprobar"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleRejectClick(change.sale_id, change.id)}
                              className="text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50 transition"
                              title="Rechazar"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        {isProcessing && (
                          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* === ORDER CHANGES TABLE === */}
      {activeTab === 'orders' && !orderLoading && sortedOrderChanges.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Encargo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Colegio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cant. Dev.
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cant. Nueva
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ajuste
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Motivo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedOrderChanges.map((change) => {
                const isProcessing = orderProcessingId === change.id;
                const isPending = change.status.toLowerCase() === 'pending';

                return (
                  <tr key={change.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/orders/${change.order_id}`)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        {change.order_code}
                        <Eye className="w-4 h-4 ml-1" />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {change.school_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(change.change_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getChangeTypeLabel(change.change_type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {change.returned_quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {change.new_quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className={Number(change.price_adjustment) >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        ${Number(change.price_adjustment).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-full ${getChangeStatusColor(change.status)}`}>
                        {getChangeStatusIcon(change.status)}
                        {getStatusLabel(change.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {change.reason || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {isPending && !isProcessing && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOrderApproveClick(change)}
                            className="text-green-600 hover:text-green-800 p-2 rounded hover:bg-green-50 transition"
                            title="Aprobar"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleOrderRejectClick(change)}
                            className="text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50 transition"
                            title="Rechazar"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                      {isProcessing && (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600 mx-auto" />
                      )}
                      {!isPending && !isProcessing && (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Empty State - Sales */}
      {activeTab === 'sales' && !loading && sortedChanges.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-12 text-center">
          <RefreshCw className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-blue-900 mb-2">
            {statusFilter || typeFilter || dateRange.start_date || dateRange.end_date ? 'No se encontraron solicitudes' : 'No hay solicitudes de cambio de ventas'}
          </h3>
          <p className="text-blue-700 mb-4">
            {statusFilter || typeFilter || dateRange.start_date || dateRange.end_date
              ? 'Intenta ajustar los filtros de busqueda'
              : 'Las solicitudes de cambio y devolucion de ventas apareceran aqui'
            }
          </p>
          {!statusFilter && !typeFilter && !dateRange.start_date && !dateRange.end_date && (
            <button
              onClick={() => setShowSaleSearch(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg inline-flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Crear Cambio/Devolucion
            </button>
          )}
        </div>
      )}

      {/* Empty State - Orders */}
      {activeTab === 'orders' && !orderLoading && sortedOrderChanges.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-12 text-center">
          <ClipboardList className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-blue-900 mb-2">
            {orderStatusFilter || orderTypeFilter || dateRange.start_date || dateRange.end_date ? 'No se encontraron solicitudes' : 'No hay solicitudes de cambio de encargos'}
          </h3>
          <p className="text-blue-700 mb-4">
            {orderStatusFilter || orderTypeFilter || dateRange.start_date || dateRange.end_date
              ? 'Intenta ajustar los filtros de busqueda'
              : 'Las solicitudes de cambio y devolucion de encargos apareceran aqui'
            }
          </p>
          {!orderStatusFilter && !orderTypeFilter && !dateRange.start_date && !dateRange.end_date && (
            <button
              onClick={() => setShowOrderSearch(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg inline-flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Crear Cambio de Encargo
            </button>
          )}
        </div>
      )}

      {/* === SALE: Approval Modal with Payment Method Selection === */}
      {showApproveModal && approveChangeData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <CheckCircle className="w-6 h-6 mr-2 text-green-600" />
                Aprobar Cambio
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {/* Price Adjustment Info - Only show if there's an adjustment */}
              {approveChangeData.priceAdjustment !== 0 ? (
                <>
                  <div className={`p-4 rounded-lg ${approveChangeData.priceAdjustment < 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                    <p className="text-sm font-medium mb-1">
                      {approveChangeData.priceAdjustment < 0 ? 'Reembolso al cliente:' : 'Cobro adicional:'}
                    </p>
                    <p className={`text-2xl font-bold ${approveChangeData.priceAdjustment < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${Math.abs(approveChangeData.priceAdjustment).toLocaleString()}
                    </p>
                  </div>

                  {/* Payment Method Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {approveChangeData.priceAdjustment < 0 ? 'Metodo de Reembolso:' : 'Metodo de Pago:'}
                    </label>
                    <select
                      value={approvePaymentMethod}
                      onChange={(e) => setApprovePaymentMethod(e.target.value as 'cash' | 'nequi' | 'transfer' | 'card')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    >
                      <option value="cash">Efectivo</option>
                      <option value="nequi">Nequi</option>
                      <option value="transfer">Transferencia</option>
                      <option value="card">Tarjeta</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      {approveChangeData.priceAdjustment < 0
                        ? 'Selecciona como se realizara el reembolso al cliente'
                        : 'Selecciona como pagara el cliente la diferencia'
                      }
                    </p>
                  </div>
                </>
              ) : (
                /* No price adjustment - simple confirmation */
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-sm font-medium text-blue-800 mb-1">
                    Cambio sin ajuste de precio
                  </p>
                  <p className="text-sm text-blue-700">
                    Este cambio no requiere reembolso ni cobro adicional al cliente.
                    El inventario se ajustara automaticamente al aprobar.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setApproveChangeData(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleApprove(approveChangeData.saleId, approveChangeData.changeId, approvePaymentMethod)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmar Aprobacion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === SALE: Rejection Modal === */}
      {showRejectModal && rejectChangeData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <XCircle className="w-6 h-6 mr-2 text-red-600" />
                Rechazar Cambio
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo del Rechazo *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Escribe el motivo por el cual se rechaza este cambio..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500">
                  Este motivo sera visible para el vendedor que solicito el cambio.
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectChangeData(null);
                  setRejectReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === ORDER: Approval Modal with Payment Method Selection === */}
      {showOrderApproveModal && orderApproveChangeData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <CheckCircle className="w-6 h-6 mr-2 text-green-600" />
                Aprobar Cambio de Encargo
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {orderApproveChangeData.priceAdjustment !== 0 ? (
                <>
                  <div className={`p-4 rounded-lg ${orderApproveChangeData.priceAdjustment < 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                    <p className="text-sm font-medium mb-1">
                      {orderApproveChangeData.priceAdjustment < 0 ? 'Reembolso al cliente:' : 'Cobro adicional:'}
                    </p>
                    <p className={`text-2xl font-bold ${orderApproveChangeData.priceAdjustment < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${Math.abs(orderApproveChangeData.priceAdjustment).toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {orderApproveChangeData.priceAdjustment < 0 ? 'Metodo de Reembolso:' : 'Metodo de Pago:'}
                    </label>
                    <select
                      value={orderApprovePaymentMethod}
                      onChange={(e) => setOrderApprovePaymentMethod(e.target.value as 'cash' | 'nequi' | 'transfer' | 'card')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    >
                      <option value="cash">Efectivo</option>
                      <option value="nequi">Nequi</option>
                      <option value="transfer">Transferencia</option>
                      <option value="card">Tarjeta</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      {orderApproveChangeData.priceAdjustment < 0
                        ? 'Selecciona como se realizara el reembolso al cliente'
                        : 'Selecciona como pagara el cliente la diferencia'
                      }
                    </p>
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-sm font-medium text-blue-800 mb-1">
                    Cambio sin ajuste de precio
                  </p>
                  <p className="text-sm text-blue-700">
                    Este cambio no requiere reembolso ni cobro adicional al cliente.
                    El inventario se ajustara automaticamente al aprobar.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowOrderApproveModal(false);
                  setOrderApproveChangeData(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleOrderApprove}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmar Aprobacion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === ORDER: Rejection Modal === */}
      {showOrderRejectModal && orderRejectChangeData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <XCircle className="w-6 h-6 mr-2 text-red-600" />
                Rechazar Cambio de Encargo
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo del Rechazo *
                </label>
                <textarea
                  value={orderRejectReason}
                  onChange={(e) => setOrderRejectReason(e.target.value)}
                  placeholder="Escribe el motivo por el cual se rechaza este cambio..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500">
                  Este motivo sera visible para el vendedor que solicito el cambio.
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowOrderRejectModal(false);
                  setOrderRejectChangeData(null);
                  setOrderRejectReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleOrderReject}
                disabled={!orderRejectReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === SALE CHANGE DETAIL MODAL === */}
      {showDetailModal && selectedChangeId && selectedChange && (
        <SaleChangeDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedChangeId(null);
            setSelectedChange(null);
          }}
          changeId={selectedChangeId}
          change={selectedChange}
        />
      )}
    </Layout>
  );
}
