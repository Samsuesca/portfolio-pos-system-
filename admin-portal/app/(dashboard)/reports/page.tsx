'use client';

/**
 * Reports Page - Business analytics and reporting
 */
import { useEffect, useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Package,
  DollarSign,
  Loader2,
  AlertCircle,
  ShoppingBag,
  RefreshCw,
  Calendar,
  Filter,
  Users,
  Building2,
  PieChart,
  Wallet,
  Receipt,
} from 'lucide-react';
import reportsService, {
  GlobalSalesSummary,
  GlobalTopProduct,
  GlobalTopClient,
  MonthlySalesReport,
  DateFilters,
} from '@/lib/services/reportsService';
import schoolService from '@/lib/services/schoolService';
import type { School } from '@/lib/api';
import DatePicker from '@/components/ui/DatePicker';
import { formatCurrency, formatDateForAPI } from '@/lib/utils';

type DatePreset = 'today' | 'week' | 'month' | 'year' | 'custom' | 'all';
type ReportTab = 'sales' | 'products' | 'clients';

const getPresetDates = (preset: DatePreset): DateFilters => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'today':
      return {
        startDate: formatDateForAPI(today),
        endDate: formatDateForAPI(today),
      };
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      return {
        startDate: formatDateForAPI(weekAgo),
        endDate: formatDateForAPI(today),
      };
    }
    case 'month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: formatDateForAPI(monthStart),
        endDate: formatDateForAPI(today),
      };
    }
    case 'year': {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return {
        startDate: formatDateForAPI(yearStart),
        endDate: formatDateForAPI(today),
      };
    }
    case 'all':
    default:
      return {};
  }
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  nequi: 'Nequi',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  credit: 'Credito',
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');

  // Date filter state
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [activeFilters, setActiveFilters] = useState<DateFilters>(() =>
    getPresetDates('month')
  );

  // School filter
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('');

  // Data
  const [salesSummary, setSalesSummary] = useState<GlobalSalesSummary | null>(
    null
  );
  const [topProducts, setTopProducts] = useState<GlobalTopProduct[]>([]);
  const [topClients, setTopClients] = useState<GlobalTopClient[]>([]);
  const [monthlySales, setMonthlySales] = useState<MonthlySalesReport | null>(
    null
  );

  useEffect(() => {
    loadSchools();
  }, []);

  useEffect(() => {
    loadData();
  }, [activeFilters, selectedSchool]);

  const loadSchools = async () => {
    try {
      const data = await schoolService.list();
      setSchools(data);
    } catch (err) {
      console.error('Error loading schools:', err);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters = {
        ...activeFilters,
        schoolId: selectedSchool || undefined,
      };

      const [summary, products, clients, monthly] = await Promise.all([
        reportsService.getGlobalSalesSummary(filters),
        reportsService.getGlobalTopProducts(10, filters),
        reportsService.getGlobalTopClients(10, filters),
        reportsService.getMonthlySalesBreakdown(filters),
      ]);

      setSalesSummary(summary);
      setTopProducts(products);
      setTopClients(clients);
      setMonthlySales(monthly);
    } catch (err: any) {
      console.error('Error loading reports:', err);
      setError(err.response?.data?.detail || 'Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      setActiveFilters(getPresetDates(preset));
    }
  };

  const applyCustomDates = () => {
    if (customStartDate && customEndDate) {
      setActiveFilters({
        startDate: customStartDate,
        endDate: customEndDate,
      });
    }
  };

  // Sales by payment method chart data
  const paymentData = useMemo(() => {
    if (!salesSummary?.sales_by_payment) return [];
    return Object.entries(salesSummary.sales_by_payment).map(
      ([method, data]) => ({
        method: PAYMENT_METHOD_LABELS[method] || method,
        count: data.count,
        total: data.total,
      })
    );
  }, [salesSummary]);

  // Sales by school chart data
  const schoolData = useMemo(() => {
    if (!salesSummary?.sales_by_school) return [];
    return salesSummary.sales_by_school.map((s) => ({
      name: s.school_name,
      count: s.sales_count,
      revenue: s.revenue,
    }));
  }, [salesSummary]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-brand-500" />
            Reportes
          </h1>
          <p className="text-slate-500 mt-1">
            Analisis de ventas y rendimiento del negocio
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Date Preset */}
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Periodo</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'today', label: 'Hoy' },
                { value: 'week', label: 'Semana' },
                { value: 'month', label: 'Mes' },
                { value: 'year', label: 'Año' },
                { value: 'all', label: 'Todo' },
                { value: 'custom', label: 'Personalizado' },
              ].map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetChange(preset.value as DatePreset)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition ${
                    datePreset === preset.value
                      ? 'bg-brand-100 text-brand-700 border border-brand-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* School Filter */}
          <div className="min-w-[200px]">
            <label className="block text-xs text-slate-500 mb-1">Colegio</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              >
                <option value="">Todos los colegios</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Custom Date Range */}
        {datePreset === 'custom' && (
          <div className="flex gap-4 mt-4 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Desde</label>
              <DatePicker
                value={customStartDate}
                onChange={setCustomStartDate}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Hasta</label>
              <DatePicker value={customEndDate} onChange={setCustomEndDate} />
            </div>
            <div className="flex items-end">
              <button
                onClick={applyCustomDates}
                disabled={!customStartDate || !customEndDate}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
              >
                Aplicar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      )}

      {/* Content */}
      {!loading && salesSummary && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-slate-600">Total Ventas</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {salesSummary.total_sales}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-slate-600">Ingresos</span>
              </div>
              <p className="text-3xl font-bold text-green-600">
                {formatCurrency(salesSummary.total_revenue)}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-slate-600">Ticket Promedio</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {formatCurrency(salesSummary.average_ticket)}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-slate-600">Colegios</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {salesSummary.sales_by_school?.length || 0}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="border-b border-slate-200 px-4">
              <div className="flex gap-4">
                {[
                  { key: 'sales', label: 'Ventas por Colegio', icon: Building2 },
                  {
                    key: 'products',
                    label: 'Productos Top',
                    icon: Package,
                  },
                  { key: 'clients', label: 'Clientes Top', icon: Users },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as ReportTab)}
                    className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
                      activeTab === tab.key
                        ? 'border-brand-500 text-brand-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {/* Sales by School Tab */}
              {activeTab === 'sales' && (
                <div className="space-y-6">
                  {/* Payment Methods Summary */}
                  <div>
                    <h3 className="font-medium text-slate-800 mb-4">
                      Ventas por Metodo de Pago
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {paymentData.map((pm) => (
                        <div
                          key={pm.method}
                          className="bg-slate-50 rounded-lg p-4"
                        >
                          <p className="text-sm text-slate-600">{pm.method}</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {pm.count} ventas
                          </p>
                          <p className="text-sm text-green-600">
                            {formatCurrency(pm.total)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sales by School */}
                  <div>
                    <h3 className="font-medium text-slate-800 mb-4">
                      Ventas por Colegio
                    </h3>
                    {schoolData.length === 0 ? (
                      <p className="text-slate-500 text-center py-8">
                        No hay datos disponibles
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {schoolData.map((school, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-brand-600" />
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">
                                  {school.name}
                                </p>
                                <p className="text-sm text-slate-500">
                                  {school.count} ventas
                                </p>
                              </div>
                            </div>
                            <p className="text-lg font-semibold text-green-600">
                              {formatCurrency(school.revenue)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Top Products Tab */}
              {activeTab === 'products' && (
                <div>
                  {topProducts.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">
                      No hay datos de productos disponibles
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                              #
                            </th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                              Producto
                            </th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                              Colegio
                            </th>
                            <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">
                              Unidades
                            </th>
                            <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">
                              Ingresos
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {topProducts.map((product, idx) => (
                            <tr key={product.product_id}>
                              <td className="px-4 py-3 text-slate-500">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-slate-900">
                                    {product.product_name}
                                  </p>
                                  <p className="text-sm text-slate-500">
                                    {product.product_code} - {product.product_size}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-700">
                                {product.school_name}
                              </td>
                              <td className="px-4 py-3 text-center font-medium">
                                {product.units_sold}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-green-600">
                                {formatCurrency(product.total_revenue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Top Clients Tab */}
              {activeTab === 'clients' && (
                <div>
                  {topClients.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">
                      No hay datos de clientes disponibles
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                              #
                            </th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                              Cliente
                            </th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                              Colegio
                            </th>
                            <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">
                              Compras
                            </th>
                            <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">
                              Total Gastado
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {topClients.map((client, idx) => (
                            <tr key={client.client_id}>
                              <td className="px-4 py-3 text-slate-500">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-slate-900">
                                    {client.client_name}
                                  </p>
                                  <p className="text-sm text-slate-500">
                                    {client.client_code}
                                    {client.client_phone &&
                                      ` - ${client.client_phone}`}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-700">
                                {client.school_name}
                              </td>
                              <td className="px-4 py-3 text-center font-medium">
                                {client.total_purchases}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-green-600">
                                {formatCurrency(client.total_spent)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Monthly Breakdown */}
          {monthlySales && monthlySales.months.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-medium text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-brand-500" />
                Evolucion Mensual
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                        Mes
                      </th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">
                        Ventas
                      </th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">
                        Ingresos
                      </th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">
                        Ticket Prom.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlySales.months.map((month) => (
                      <tr key={month.period}>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {month.period_label}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {month.sales_count}
                        </td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">
                          {formatCurrency(month.total_revenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatCurrency(month.average_ticket)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100">
                    <tr>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        Total
                      </td>
                      <td className="px-4 py-3 text-center font-bold">
                        {monthlySales.totals.sales_count}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">
                        {formatCurrency(monthlySales.totals.total_revenue)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700">
                        {formatCurrency(monthlySales.totals.average_ticket)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
