/**
 * Email Logs Page - Email audit trail and statistics
 */
import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import {
  Mail, CheckCircle, XCircle, Clock,
  Loader2, AlertCircle, RefreshCw,
  ChevronLeft, ChevronRight, Search, Eye
} from 'lucide-react';
import {
  emailLogService,
  type EmailLog,
  type EmailStatsResponse,
  type EmailType,
  type EmailStatus,
  EMAIL_TYPE_LABELS,
  EMAIL_STATUS_LABELS,
  EMAIL_STATUS_COLORS,
  EMAIL_TYPE_COLORS,
} from '../services/emailLogService';
import BarChart from '../components/BarChart';

// Preset date ranges
type DatePreset = 'today' | 'week' | 'month' | 'all';

// Helper to format date as YYYY-MM-DD
const formatDateForAPI = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Helper to get preset date ranges
const getPresetDates = (preset: DatePreset): { startDate?: string; endDate?: string } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'today':
      return {
        startDate: formatDateForAPI(today),
        endDate: formatDateForAPI(today)
      };
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      return {
        startDate: formatDateForAPI(weekAgo),
        endDate: formatDateForAPI(today)
      };
    }
    case 'month': {
      const monthAgo = new Date(today);
      monthAgo.setDate(today.getDate() - 30);
      return {
        startDate: formatDateForAPI(monthAgo),
        endDate: formatDateForAPI(today)
      };
    }
    case 'all':
    default:
      return {};
  }
};

// Format datetime for display
const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function EmailLogs() {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<EmailStatsResponse | null>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [recentFailures, setRecentFailures] = useState<EmailLog[]>([]);

  // Filters
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [emailTypeFilter, setEmailTypeFilter] = useState<EmailType | ''>('');
  const [statusFilter, setStatusFilter] = useState<EmailStatus | ''>('');
  const [searchEmail, setSearchEmail] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Modal for error details
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  // Calculate date range
  const getDateRange = useCallback(() => {
    if (datePreset === 'all') {
      return {};
    }
    if (customStartDate && customEndDate) {
      return {
        startDate: formatDateForAPI(customStartDate),
        endDate: formatDateForAPI(customEndDate),
      };
    }
    return getPresetDates(datePreset);
  }, [datePreset, customStartDate, customEndDate]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const dateRange = getDateRange();

      // Fetch stats and logs in parallel
      const [statsData, logsData, failuresData] = await Promise.all([
        emailLogService.getEmailStatistics(dateRange.startDate, dateRange.endDate),
        emailLogService.getEmailLogs({
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
          email_type: emailTypeFilter || undefined,
          status: statusFilter || undefined,
          recipient_email: searchEmail || undefined,
          skip: (currentPage - 1) * pageSize,
          limit: pageSize,
        }),
        emailLogService.getRecentFailures(5),
      ]);

      setStats(statsData);
      setLogs(logsData.items);
      setTotalLogs(logsData.total);
      setRecentFailures(failuresData);
    } catch (err: any) {
      console.error('Error fetching email logs:', err);
      setError(err.response?.data?.detail || 'Error al cargar los logs de email');
    } finally {
      setLoading(false);
    }
  }, [getDateRange, emailTypeFilter, statusFilter, searchEmail, currentPage, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [datePreset, emailTypeFilter, statusFilter, searchEmail]);

  // Calculate pagination
  const totalPages = Math.ceil(totalLogs / pageSize);

  // Prepare chart data
  const chartData = stats?.by_day.slice().reverse().map(day => ({
    label: new Date(day.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
    value: day.total,
  })) || [];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Log de Emails</h1>
            <p className="text-gray-500">Historial y estadisticas de emails enviados</p>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Date preset */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Periodo
              </label>
              <div className="flex gap-1">
                {(['today', 'week', 'month', 'all'] as DatePreset[]).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setDatePreset(preset);
                      setCustomStartDate(null);
                      setCustomEndDate(null);
                    }}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                      datePreset === preset
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {preset === 'today' && 'Hoy'}
                    {preset === 'week' && '7 dias'}
                    {preset === 'month' && '30 dias'}
                    {preset === 'all' && 'Todo'}
                  </button>
                ))}
              </div>
            </div>

            {/* Email type filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Email
              </label>
              <select
                value={emailTypeFilter}
                onChange={(e) => setEmailTypeFilter(e.target.value as EmailType | '')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos</option>
                {Object.entries(EMAIL_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as EmailStatus | '')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos</option>
                {Object.entries(EMAIL_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar por Email
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  placeholder="ejemplo@email.com"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Enviados</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.total_sent}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Mail className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {stats.avg_per_day.toFixed(1)} emails/dia promedio
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Exitosos</p>
                  <p className="text-3xl font-bold text-green-600">{stats.total_success}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <p className="mt-2 text-sm text-green-600">
                {(stats.overall_success_rate * 100).toFixed(1)}% tasa de exito
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Fallidos</p>
                  <p className="text-3xl font-bold text-red-600">{stats.total_failed}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
              {stats.total_failed > 0 && (
                <p className="mt-2 text-sm text-red-600">Requiere atencion</p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Dev/Omitidos</p>
                  <p className="text-3xl font-bold text-gray-600">{stats.total_dev_skipped}</p>
                </div>
                <div className="p-3 bg-gray-100 rounded-full">
                  <Clock className="w-6 h-6 text-gray-600" />
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">En modo desarrollo</p>
            </div>
          </div>
        )}

        {/* Charts and Type Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Emails por Dia</h3>
            {chartData.length > 0 ? (
              <div className="h-64">
                <BarChart
                  data={chartData}
                  barColor="#3B82F6"
                  formatValue={(v) => v.toString()}
                />
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No hay datos para mostrar
              </div>
            )}
          </div>

          {/* Type Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Por Tipo de Email</h3>
            {stats && stats.by_type.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {stats.by_type.map((type) => (
                  <div key={type.email_type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${EMAIL_TYPE_COLORS[type.email_type]?.bg || 'bg-gray-100'} ${EMAIL_TYPE_COLORS[type.email_type]?.text || 'text-gray-700'}`}>
                        {type.email_type_label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-600">{type.total} total</span>
                      <span className="text-green-600">{type.success} ok</span>
                      {type.failed > 0 && (
                        <span className="text-red-600">{type.failed} fallidos</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No hay datos para mostrar
              </div>
            )}
          </div>
        </div>

        {/* Recent Failures Alert */}
        {recentFailures.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-red-800 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Emails Fallidos Recientes
            </h3>
            <div className="space-y-2">
              {recentFailures.map((log) => (
                <div key={log.id} className="flex items-center justify-between bg-white rounded p-3">
                  <div>
                    <span className="font-medium text-gray-900">{log.recipient_email}</span>
                    <span className="text-gray-500 mx-2">-</span>
                    <span className="text-gray-600">{log.email_type_label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">{formatDateTime(log.sent_at)}</span>
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Historial de Emails ({totalLogs} registros)
            </h3>
          </div>

          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No se encontraron emails con los filtros seleccionados
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Destinatario
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Referencia
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDateTime(log.sent_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs ${EMAIL_TYPE_COLORS[log.email_type]?.bg || 'bg-gray-100'} ${EMAIL_TYPE_COLORS[log.email_type]?.text || 'text-gray-700'}`}>
                            {log.email_type_label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                              {log.recipient_email}
                            </p>
                            {log.recipient_name && (
                              <p className="text-xs text-gray-500">{log.recipient_name}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs border ${EMAIL_STATUS_COLORS[log.status].bg} ${EMAIL_STATUS_COLORS[log.status].text} ${EMAIL_STATUS_COLORS[log.status].border}`}>
                            {EMAIL_STATUS_LABELS[log.status]}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {log.reference_code || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Mostrando {(currentPage - 1) * pageSize + 1} -{' '}
                    {Math.min(currentPage * pageSize, totalLogs)} de {totalLogs}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-2 text-sm">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4">
              <div
                className="fixed inset-0 bg-black bg-opacity-50"
                onClick={() => setSelectedLog(null)}
              />
              <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Detalles del Email
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Tipo</label>
                    <p className="text-gray-900">{selectedLog.email_type_label}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Destinatario</label>
                    <p className="text-gray-900">{selectedLog.recipient_email}</p>
                    {selectedLog.recipient_name && (
                      <p className="text-sm text-gray-500">{selectedLog.recipient_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Asunto</label>
                    <p className="text-gray-900">{selectedLog.subject}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Estado</label>
                    <p>
                      <span className={`px-2 py-1 rounded text-sm ${EMAIL_STATUS_COLORS[selectedLog.status].bg} ${EMAIL_STATUS_COLORS[selectedLog.status].text}`}>
                        {EMAIL_STATUS_LABELS[selectedLog.status]}
                      </span>
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Fecha de Envio</label>
                    <p className="text-gray-900">{formatDateTime(selectedLog.sent_at)}</p>
                  </div>

                  {selectedLog.reference_code && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Referencia</label>
                      <p className="text-gray-900">{selectedLog.reference_code}</p>
                    </div>
                  )}

                  {selectedLog.client_name && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Cliente</label>
                      <p className="text-gray-900">{selectedLog.client_name}</p>
                    </div>
                  )}

                  {selectedLog.triggered_by_name && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Disparado por</label>
                      <p className="text-gray-900">{selectedLog.triggered_by_name}</p>
                    </div>
                  )}

                  {selectedLog.error_message && (
                    <div>
                      <label className="text-sm font-medium text-red-500">Mensaje de Error</label>
                      <p className="text-red-700 bg-red-50 rounded p-2 text-sm font-mono">
                        {selectedLog.error_message}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
