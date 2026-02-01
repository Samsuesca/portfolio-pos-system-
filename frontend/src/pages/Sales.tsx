/**
 * Sales Page - List and manage sales (Multi-school view)
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import SaleModal from '../components/SaleModal';
import { RequirePermission } from '../components/RequirePermission';
import { ShoppingCart, Plus, Search, AlertCircle, Loader2, Eye, Calendar, User, DollarSign, Building2, History, ChevronDown } from 'lucide-react';
import { formatDateTimeSpanish } from '../components/DatePicker';
import DateFilter, { DateRange } from '../components/DateFilter';
import { saleService } from '../services/saleService';
import { useSchoolStore } from '../stores/schoolStore';
import { useDebounce } from '../hooks/useDebounce';
import type { SaleListItem } from '../types/api';

// Type for location state when navigating from DraftsBar or Quick Actions
interface LocationState {
  draftId?: string;
  draftType?: 'sale' | 'order';
  openNew?: boolean;
}

export default function Sales() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  const { currentSchool, availableSchools, loadSchools } = useSchoolStore();
  const [sales, setSales] = useState<SaleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({});

  // Debounce search term for backend search
  const debouncedSearch = useDebounce(searchTerm, 300);
  const LIMIT = 50;

  // For creating new sales, use current school or first available
  const schoolIdForCreate = currentSchool?.id || availableSchools[0]?.id || '';

  // Handle draft from location state (coming from DraftsBar) or openNew from Quick Actions
  useEffect(() => {
    if (locationState?.draftId && locationState?.draftType === 'sale') {
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

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setActiveDraftId(null);
  };

  const handleSuccess = () => {
    loadSales();
  };

  useEffect(() => {
    // Load schools if not already loaded
    if (availableSchools.length === 0) {
      loadSchools();
    }
  }, []);

  // Reload when filters or debounced search changes
  useEffect(() => {
    loadSales();
  }, [schoolFilter, statusFilter, debouncedSearch, dateRange]);

  const loadSales = useCallback(async (append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const skip = append ? sales.length : 0;

      // Load sales with backend search and pagination
      const salesData = await saleService.getAllSales({
        school_id: schoolFilter || undefined,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
        limit: LIMIT,
        skip: skip,
        include_historical: false
      });

      if (append) {
        setSales(prev => [...prev, ...salesData]);
      } else {
        setSales(salesData);
      }
      setHasMore(salesData.length === LIMIT);
    } catch (err: any) {
      console.error('Error loading sales:', err);
      setError(err.response?.data?.detail || 'Error al cargar ventas');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [schoolFilter, statusFilter, debouncedSearch, dateRange, sales.length]);

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

  const getHistoricalBadge = (isHistorical: boolean | undefined) => {
    if (!isHistorical) return null;
    return (
      <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700 flex items-center gap-1 inline-flex">
        <History className="w-3 h-3" />
        Histórica
      </span>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Pagada';
      case 'completed':
        return 'Completada';
      case 'pending':
        return 'Pendiente';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  };

  const getPaymentMethodText = (method: string | null | undefined) => {
    if (!method) return 'Sin registrar';
    // Normalize to lowercase to handle any case variations
    const normalizedMethod = method.toLowerCase();
    switch (normalizedMethod) {
      case 'cash':
        return 'Efectivo';
      case 'nequi':
        return 'Nequi';
      case 'transfer':
        return 'Transferencia';
      case 'card':
        return 'Tarjeta';
      case 'credit':
        return 'Crédito';
      default:
        return method;
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Fecha no disponible';
    const formatted = formatDateTimeSpanish(dateString);
    return formatted === '-' ? 'Fecha inválida' : formatted;
  };

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Ventas</h1>
          <p className="text-gray-600 mt-1">
            {loading ? 'Cargando...' : `${sales.length} ventas encontradas`}
            {schoolFilter && availableSchools.length > 1 && (
              <span className="ml-2 text-blue-600">
                • Filtrado por colegio
              </span>
            )}
          </p>
        </div>
        <RequirePermission permission="sales.create">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nueva Venta
          </button>
        </RequirePermission>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por código o cliente..."
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
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="completed">Completadas</option>
            <option value="paid">Pagadas</option>
            <option value="pending">Pendientes</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <DateFilter value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Cargando ventas...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error al cargar ventas</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                onClick={() => loadSales()}
                className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales Table */}
      {!loading && !error && sales.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
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
                  Vendedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Método Pago
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center flex-wrap gap-1">
                      {sale.code}
                      {getSourceBadge(sale.source)}
                      {getHistoricalBadge(sale.is_historical)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                      {formatDate(sale.sale_date)}
                    </div>
                  </td>
                  {availableSchools.length > 1 && (
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center">
                        <Building2 className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                        <span className="truncate max-w-[250px]" title={sale.school_name || ''}>
                          {sale.school_name || 'Sin colegio'}
                        </span>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-2 text-gray-400" />
                      {sale.client_name || 'Venta directa'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {sale.user_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    <div className="flex items-center">
                      <DollarSign className="w-4 h-4 mr-1 text-gray-400" />
                      ${Number(sale.total).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getPaymentMethodText(sale.payment_method)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(sale.status)}`}>
                      {getStatusText(sale.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => navigate(`/sales/${sale.id}`)}
                      className="text-blue-600 hover:text-blue-800 flex items-center transition"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Load More Button */}
          {hasMore && sales.length > 0 && (
            <div className="p-4 border-t border-gray-200 text-center">
              <button
                onClick={() => { loadSales(true); }}
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
                    Cargar mas ventas
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && sales.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-12 text-center">
          <ShoppingCart className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-blue-900 mb-2">
            {debouncedSearch || statusFilter || schoolFilter || dateRange.start_date || dateRange.end_date ? 'No se encontraron ventas' : 'No hay ventas registradas'}
          </h3>
          <p className="text-blue-700 mb-4">
            {debouncedSearch || statusFilter || schoolFilter || dateRange.start_date || dateRange.end_date
              ? 'Intenta ajustar los filtros de busqueda o consulta el historico en Reportes'
              : 'Comienza creando tu primera venta'
            }
          </p>
          {!debouncedSearch && !statusFilter && !schoolFilter && !dateRange.start_date && !dateRange.end_date && (
            <RequirePermission permission="sales.create">
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg inline-flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Nueva Venta
              </button>
            </RequirePermission>
          )}
        </div>
      )}

      {/* Sale Modal - now supports multi-school selection internally and drafts */}
      <SaleModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        initialSchoolId={schoolIdForCreate}
        draftId={activeDraftId}
        onMinimize={() => setActiveDraftId(null)}
      />
    </Layout>
  );
}
