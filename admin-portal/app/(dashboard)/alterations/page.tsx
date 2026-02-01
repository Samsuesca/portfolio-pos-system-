'use client';

/**
 * Alterations Page - List and manage alterations/repairs (Global view)
 */
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Scissors,
  Plus,
  Search,
  AlertCircle,
  Loader2,
  Eye,
  User,
  DollarSign,
  CheckCircle,
  Clock,
  Package,
  ChevronDown,
  X,
  Phone,
  Calendar,
  FileText,
  Wrench,
} from 'lucide-react';
import alterationService, {
  AlterationListItem,
  AlterationsSummary,
  AlterationStatus,
  AlterationType,
  AlterationCreate,
  ALTERATION_TYPE_LABELS,
  ALTERATION_STATUS_LABELS,
  ALTERATION_STATUS_COLORS,
} from '@/lib/services/alterationService';
import clientService from '@/lib/services/clientService';
import type { Client, PaymentMethod } from '@/lib/api';
import DatePicker from '@/components/ui/DatePicker';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function AlterationsPage() {
  const router = useRouter();
  const [alterations, setAlterations] = useState<AlterationListItem[]>([]);
  const [summary, setSummary] = useState<AlterationsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AlterationStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<AlterationType | ''>('');
  const [paymentFilter, setPaymentFilter] = useState<
    'all' | 'paid' | 'pending'
  >('all');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [savingAlteration, setSavingAlteration] = useState(false);

  // Create form state
  const [newAlteration, setNewAlteration] = useState<Partial<AlterationCreate>>(
    {
      alteration_type: 'hem',
      garment_name: '',
      description: '',
      cost: 0,
      received_date: new Date().toISOString().split('T')[0],
    }
  );
  const [clientType, setClientType] = useState<'existing' | 'external'>(
    'external'
  );
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [externalClientName, setExternalClientName] = useState('');
  const [externalClientPhone, setExternalClientPhone] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  const LIMIT = 50;

  useEffect(() => {
    loadData();
  }, [statusFilter, typeFilter, paymentFilter]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadData = async (append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const skip = append ? alterations.length : 0;

      const [alterationsData, summaryData] = await Promise.all([
        alterationService.list({
          status: statusFilter || undefined,
          type: typeFilter || undefined,
          is_paid:
            paymentFilter === 'all' ? undefined : paymentFilter === 'paid',
          search: searchTerm || undefined,
          limit: LIMIT,
          skip: skip,
        }),
        append ? Promise.resolve(summary) : alterationService.getSummary(),
      ]);

      if (append) {
        setAlterations((prev) => [...prev, ...alterationsData]);
      } else {
        setAlterations(alterationsData);
      }
      if (summaryData) setSummary(summaryData);
      setHasMore(alterationsData.length === LIMIT);
    } catch (err: any) {
      console.error('Error loading alterations:', err);
      setError(err.response?.data?.detail || 'Error al cargar arreglos');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadClients = async (search?: string) => {
    try {
      setLoadingClients(true);
      const data = await clientService.getClients({ search, limit: 20 });
      setClients(data);
    } catch (err) {
      console.error('Error loading clients:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
    loadClients();
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    resetForm();
  };

  const resetForm = () => {
    setNewAlteration({
      alteration_type: 'hem',
      garment_name: '',
      description: '',
      cost: 0,
      received_date: new Date().toISOString().split('T')[0],
    });
    setClientType('external');
    setSelectedClientId('');
    setExternalClientName('');
    setExternalClientPhone('');
    setClientSearch('');
  };

  const handleCreateAlteration = async () => {
    if (!newAlteration.garment_name || !newAlteration.description) {
      alert('Por favor complete los campos requeridos');
      return;
    }

    if (
      clientType === 'existing' &&
      !selectedClientId &&
      !externalClientName
    ) {
      alert('Por favor seleccione un cliente o ingrese los datos del cliente');
      return;
    }

    try {
      setSavingAlteration(true);

      const data: AlterationCreate = {
        alteration_type: newAlteration.alteration_type!,
        garment_name: newAlteration.garment_name!,
        description: newAlteration.description!,
        cost: newAlteration.cost || 0,
        received_date: newAlteration.received_date!,
        estimated_delivery_date: newAlteration.estimated_delivery_date,
        notes: newAlteration.notes,
        initial_payment: newAlteration.initial_payment,
        initial_payment_method: newAlteration.initial_payment_method,
      };

      if (clientType === 'existing' && selectedClientId) {
        data.client_id = selectedClientId;
      } else {
        data.external_client_name = externalClientName;
        data.external_client_phone = externalClientPhone;
      }

      await alterationService.create(data);
      handleCloseCreateModal();
      loadData();
    } catch (err: any) {
      console.error('Error creating alteration:', err);
      alert(err.response?.data?.detail || 'Error al crear arreglo');
    } finally {
      setSavingAlteration(false);
    }
  };

  // Filter clients based on search
  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const search = clientSearch.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.phone?.toLowerCase().includes(search)
    );
  }, [clients, clientSearch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Scissors className="w-7 h-7 text-brand-500" />
            Arreglos
          </h1>
          <p className="text-slate-500 mt-1">
            Gestiona arreglos y confecciones tercerizadas
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition"
        >
          <Plus className="w-5 h-5" />
          Nuevo Arreglo
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <Package className="w-4 h-4" />
              Total
            </div>
            <p className="text-2xl font-semibold text-slate-900">
              {summary.total_count}
            </p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 shadow-sm border border-yellow-100">
            <div className="flex items-center gap-2 text-yellow-700 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Pendientes
            </div>
            <p className="text-2xl font-semibold text-yellow-700">
              {summary.pending_count}
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 shadow-sm border border-blue-100">
            <div className="flex items-center gap-2 text-blue-700 text-sm mb-1">
              <Wrench className="w-4 h-4" />
              En Proceso
            </div>
            <p className="text-2xl font-semibold text-blue-700">
              {summary.in_progress_count}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 shadow-sm border border-green-100">
            <div className="flex items-center gap-2 text-green-700 text-sm mb-1">
              <CheckCircle className="w-4 h-4" />
              Listos
            </div>
            <p className="text-2xl font-semibold text-green-700">
              {summary.ready_count}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <DollarSign className="w-4 h-4" />
              Ingresos
            </div>
            <p className="text-xl font-semibold text-slate-900">
              {formatCurrency(summary.total_revenue)}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 shadow-sm border border-red-100">
            <div className="flex items-center gap-2 text-red-700 text-sm mb-1">
              <DollarSign className="w-4 h-4" />
              Por Cobrar
            </div>
            <p className="text-xl font-semibold text-red-700">
              {formatCurrency(summary.total_pending_payment)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por codigo, cliente o prenda..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as AlterationStatus | '')
            }
            className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          >
            <option value="">Todos los estados</option>
            {Object.entries(ALTERATION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as AlterationType | '')
            }
            className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          >
            <option value="">Todos los tipos</option>
            {Object.entries(ALTERATION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {/* Payment Filter */}
          <select
            value={paymentFilter}
            onChange={(e) =>
              setPaymentFilter(e.target.value as 'all' | 'paid' | 'pending')
            }
            className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          >
            <option value="all">Todos los pagos</option>
            <option value="paid">Pagados</option>
            <option value="pending">Con saldo</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      )}

      {/* Alterations Table */}
      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {alterations.length === 0 ? (
            <div className="text-center py-12">
              <Scissors className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">
                {searchTerm ||
                statusFilter ||
                typeFilter ||
                paymentFilter !== 'all'
                  ? 'No hay arreglos que coincidan con los filtros'
                  : 'No hay arreglos que mostrar'}
              </p>
              {!searchTerm &&
                !statusFilter &&
                !typeFilter &&
                paymentFilter === 'all' && (
                  <button
                    onClick={handleOpenCreateModal}
                    className="mt-4 text-brand-600 hover:text-brand-700 font-medium"
                  >
                    Crear primer arreglo
                  </button>
                )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                      Codigo
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                      Cliente
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                      Prenda
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                      Tipo
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                      Estado
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">
                      Costo
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">
                      Saldo
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                      Recibido
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                      Entrega Est.
                    </th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alterations.map((alteration) => (
                    <tr
                      key={alteration.id}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() =>
                        router.push(`/alterations/${alteration.id}`)
                      }
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-brand-600 font-medium">
                          {alteration.code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-900">
                            {alteration.client_display_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {alteration.garment_name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700">
                          {ALTERATION_TYPE_LABELS[alteration.alteration_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${ALTERATION_STATUS_COLORS[alteration.status]}`}
                        >
                          {ALTERATION_STATUS_LABELS[alteration.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatCurrency(alteration.cost)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {alteration.balance > 0 ? (
                          <span className="font-medium text-red-600">
                            {formatCurrency(alteration.balance)}
                          </span>
                        ) : (
                          <span className="text-green-600 flex items-center justify-end gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Pagado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">
                        {formatDate(alteration.received_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">
                        {alteration.estimated_delivery_date
                          ? formatDate(alteration.estimated_delivery_date)
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/alterations/${alteration.id}`);
                          }}
                          className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"
                          title="Ver detalle"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Load More Button */}
              {hasMore && alterations.length > 0 && (
                <div className="p-4 border-t border-slate-100 text-center">
                  <button
                    onClick={() => loadData(true)}
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
                        Cargar mas arreglos
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={handleCloseCreateModal}
          />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
                <h2 className="text-xl font-semibold text-slate-800 flex items-center">
                  <Scissors className="w-6 h-6 mr-2 text-brand-500" />
                  Nuevo Arreglo
                </h2>
                <button
                  onClick={handleCloseCreateModal}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Client Section */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">
                    Datos del Cliente
                  </h3>
                  <div className="flex gap-4 mb-4">
                    <button
                      onClick={() => setClientType('external')}
                      className={`flex-1 py-2 px-4 rounded-lg border text-sm ${
                        clientType === 'external'
                          ? 'bg-brand-50 border-brand-500 text-brand-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Cliente externo
                    </button>
                    <button
                      onClick={() => {
                        setClientType('existing');
                        loadClients();
                      }}
                      className={`flex-1 py-2 px-4 rounded-lg border text-sm ${
                        clientType === 'existing'
                          ? 'bg-brand-50 border-brand-500 text-brand-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Cliente registrado
                    </button>
                  </div>

                  {clientType === 'external' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">
                          Nombre *
                        </label>
                        <input
                          type="text"
                          value={externalClientName}
                          onChange={(e) =>
                            setExternalClientName(e.target.value)
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                          placeholder="Nombre del cliente"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">
                          Telefono
                        </label>
                        <input
                          type="tel"
                          value={externalClientPhone}
                          onChange={(e) =>
                            setExternalClientPhone(e.target.value)
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                          placeholder="300 123 4567"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">
                        Buscar cliente
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                          placeholder="Buscar por nombre o telefono..."
                        />
                      </div>
                      {loadingClients ? (
                        <div className="py-4 text-center">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto text-brand-500" />
                        </div>
                      ) : (
                        <div className="mt-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg">
                          {filteredClients.length === 0 ? (
                            <p className="p-4 text-sm text-slate-500 text-center">
                              No se encontraron clientes
                            </p>
                          ) : (
                            filteredClients.map((client) => (
                              <button
                                key={client.id}
                                onClick={() => setSelectedClientId(client.id)}
                                className={`w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 ${
                                  selectedClientId === client.id
                                    ? 'bg-brand-50'
                                    : ''
                                }`}
                              >
                                <User className="w-4 h-4 text-slate-400" />
                                <div>
                                  <p className="font-medium text-slate-900">
                                    {client.name}
                                  </p>
                                  {client.phone && (
                                    <p className="text-xs text-slate-500">
                                      {client.phone}
                                    </p>
                                  )}
                                </div>
                                {selectedClientId === client.id && (
                                  <CheckCircle className="w-4 h-4 text-brand-500 ml-auto" />
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Garment Section */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Tipo de arreglo *
                    </label>
                    <select
                      value={newAlteration.alteration_type}
                      onChange={(e) =>
                        setNewAlteration({
                          ...newAlteration,
                          alteration_type: e.target.value as AlterationType,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                    >
                      {Object.entries(ALTERATION_TYPE_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Prenda *
                    </label>
                    <input
                      type="text"
                      value={newAlteration.garment_name}
                      onChange={(e) =>
                        setNewAlteration({
                          ...newAlteration,
                          garment_name: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                      placeholder="Ej: Pantalon de uniforme"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Descripcion del trabajo *
                  </label>
                  <textarea
                    value={newAlteration.description}
                    onChange={(e) =>
                      setNewAlteration({
                        ...newAlteration,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none"
                    placeholder="Describe el arreglo a realizar..."
                  />
                </div>

                {/* Pricing & Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Costo *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={newAlteration.cost || ''}
                        onChange={(e) =>
                          setNewAlteration({
                            ...newAlteration,
                            cost: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Fecha de entrega estimada
                    </label>
                    <DatePicker
                      value={newAlteration.estimated_delivery_date || ''}
                      onChange={(date) =>
                        setNewAlteration({
                          ...newAlteration,
                          estimated_delivery_date: date,
                        })
                      }
                    />
                  </div>
                </div>

                {/* Initial Payment */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-3">
                    Pago inicial (opcional)
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">
                        Monto
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                          $
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={newAlteration.initial_payment || ''}
                          onChange={(e) =>
                            setNewAlteration({
                              ...newAlteration,
                              initial_payment: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">
                        Metodo de pago
                      </label>
                      <select
                        value={newAlteration.initial_payment_method || ''}
                        onChange={(e) =>
                          setNewAlteration({
                            ...newAlteration,
                            initial_payment_method:
                              (e.target.value as PaymentMethod) || undefined,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                      >
                        <option value="">Seleccionar...</option>
                        {PAYMENT_METHODS.map((pm) => (
                          <option key={pm.value} value={pm.value}>
                            {pm.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Notas
                  </label>
                  <textarea
                    value={newAlteration.notes || ''}
                    onChange={(e) =>
                      setNewAlteration({
                        ...newAlteration,
                        notes: e.target.value,
                      })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none"
                    placeholder="Notas adicionales..."
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-6 border-t border-slate-200 bg-white sticky bottom-0">
                <button
                  onClick={handleCloseCreateModal}
                  disabled={savingAlteration}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateAlteration}
                  disabled={
                    savingAlteration ||
                    !newAlteration.garment_name ||
                    !newAlteration.description ||
                    (clientType === 'external' && !externalClientName) ||
                    (clientType === 'existing' && !selectedClientId)
                  }
                  className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition disabled:opacity-50 flex items-center justify-center"
                >
                  {savingAlteration ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Crear Arreglo'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
