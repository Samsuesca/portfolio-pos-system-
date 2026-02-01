/**
 * Clients Page - List and manage clients with full CRUD
 */
import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import Layout from '../components/Layout';

// Type for location state when navigating from Quick Actions
interface LocationState {
  openNew?: boolean;
}
import { Users, Plus, Search, AlertCircle, Loader2, Mail, Phone, User, Edit2, Trash2, X, Save, CheckCircle, Clock, Send, MessageCircle } from 'lucide-react';
import { clientService } from '../services/clientService';
import { useSchoolStore } from '../stores/schoolStore';
import type { Client } from '../types/api';
import ClientDetailModal from '../components/ClientDetailModal';
import PhoneInput from '../components/PhoneInput';
import { openWhatsApp, DEFAULT_WHATSAPP_MESSAGE, isValidColombianPhone } from '../utils/whatsapp';
import { useDebounce } from '../hooks/useDebounce';

interface ClientFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  student_name: string;
  student_grade: string;
  notes: string;
}

const emptyFormData: ClientFormData = {
  name: '',
  phone: '',
  email: '',
  address: '',
  student_name: '',
  student_grade: '',
  notes: '',
};

const LIMIT = 50;

export default function Clients() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as LocationState | null;
  const { currentSchool } = useSchoolStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<ClientFormData>(emptyFormData);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Resend activation email
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);

  // Detail modal
  const [detailClient, setDetailClient] = useState<Client | null>(null);

  const schoolId = currentSchool?.id || '';

  // Load clients with pagination support
  const loadClients = useCallback(async (append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      const skip = append ? clients.length : 0;
      const data = await clientService.getClients(schoolId, {
        search: debouncedSearch || undefined,
        skip,
        limit: LIMIT,
      });

      if (append) {
        setClients(prev => [...prev, ...data]);
      } else {
        setClients(data);
      }

      setHasMore(data.length === LIMIT);
    } catch (err: any) {
      console.error('Error loading clients:', err);
      setError(err.response?.data?.detail || 'Error al cargar clientes');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [schoolId, clients.length, debouncedSearch]);

  // Initial load and reload when search changes
  useEffect(() => {
    loadClients(false);
  }, [debouncedSearch, schoolId]);

  // Handle openNew from Quick Actions
  useEffect(() => {
    if (locationState?.openNew) {
      handleOpenCreate();
      // Clear the location state to prevent re-opening on navigation
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [locationState]);

  // Open modal for create
  const handleOpenCreate = () => {
    setModalMode('create');
    setSelectedClient(null);
    setFormData(emptyFormData);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (client: Client) => {
    setModalMode('edit');
    setSelectedClient(client);
    setFormData({
      name: client.name || '',
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      student_name: client.student_name || '',
      student_grade: client.student_grade || '',
      notes: client.notes || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedClient(null);
    setFormData(emptyFormData);
    setFormError(null);
  };

  // Handle form input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setFormError('El nombre es obligatorio');
      return;
    }

    if (formData.name.trim().length < 3) {
      setFormError('El nombre debe tener al menos 3 caracteres');
      return;
    }

    // Validate phone if provided
    if (formData.phone.trim() && !isValidColombianPhone(formData.phone)) {
      setFormError('El telefono debe ser 10 digitos e iniciar con 3 (ej: 3001234567)');
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      const dataToSend = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        student_name: formData.student_name.trim() || null,
        student_grade: formData.student_grade.trim() || null,
        notes: formData.notes.trim() || null,
      };

      if (modalMode === 'create') {
        await clientService.createClient(schoolId, dataToSend);

        // Notify if activation email was sent
        if (dataToSend.email) {
          toast.success(
            `Cliente creado. Email de activación enviado a ${dataToSend.email}`,
            { duration: 5000 }
          );
        } else {
          toast.success('Cliente creado exitosamente');
        }
      } else if (selectedClient) {
        await clientService.updateClient(schoolId, selectedClient.id, dataToSend);
        toast.success('Cliente actualizado exitosamente');
      }

      handleCloseModal();
      await loadClients();
    } catch (err: any) {
      console.error('Error saving client:', err);
      let errorMessage = 'Error al guardar el cliente';
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail.map((e: any) => e.msg || e.message).join(', ');
        }
      }
      setFormError(errorMessage);
    } finally {
      setFormLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (clientId: string) => {
    setDeleteLoading(true);
    try {
      await clientService.deleteClient(schoolId, clientId);
      setDeleteConfirmId(null);
      await loadClients();
    } catch (err: any) {
      console.error('Error deleting client:', err);
      setError(err.response?.data?.detail || 'Error al eliminar el cliente');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle resend activation email
  const handleResendActivation = async (client: Client) => {
    if (!client.email) {
      toast.error('El cliente no tiene email registrado');
      return;
    }
    setResendingEmail(client.id);
    try {
      const result = await clientService.resendActivationEmail(client.id);
      toast.success(result.message);
      await loadClients();
    } catch (err: any) {
      console.error('Error resending activation:', err);
      toast.error(err.response?.data?.detail || 'Error al enviar el correo');
    } finally {
      setResendingEmail(null);
    }
  };

  // Get activation status for a client
  const getActivationStatus = (client: Client): { label: string; color: string; icon: typeof CheckCircle } => {
    if (client.is_verified && client.has_password) {
      return { label: 'Activado', color: 'text-green-600 bg-green-50', icon: CheckCircle };
    }
    if (client.welcome_email_sent) {
      return { label: 'Pendiente', color: 'text-yellow-600 bg-yellow-50', icon: Clock };
    }
    if (client.email) {
      return { label: 'Sin enviar', color: 'text-gray-500 bg-gray-50', icon: Mail };
    }
    return { label: 'Sin email', color: 'text-gray-400 bg-gray-50', icon: Mail };
  };

  return (
    <Layout>
      <Toaster position="top-right" />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
          <p className="text-gray-600 mt-1">
            {loading ? 'Cargando...' : `${clients.length} clientes encontrados`}
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Cliente
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono, email, estudiante, código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Cargando clientes...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error al cargar clientes</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                onClick={() => loadClients(false)}
                className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clients Grid */}
      {!loading && !error && clients.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client) => (
            <div
              key={client.id}
              onClick={() => setDetailClient(client)}
              className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
            >
              {/* Client Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-800">{client.name}</h3>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {client.code}
                    </span>
                  </div>
                  {client.student_name && (
                    <div className="flex items-center mt-1 text-sm text-gray-600">
                      <User className="w-4 h-4 mr-1" />
                      <span>{client.student_name}</span>
                      {client.student_grade && (
                        <span className="ml-1 text-gray-400">({client.student_grade})</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {client.phone && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openWhatsApp(client.phone!, DEFAULT_WHATSAPP_MESSAGE);
                      }}
                      className="p-2 text-green-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                      title="Abrir WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEdit(client);
                    }}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(client.id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                {client.phone && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="w-4 h-4 mr-2 text-gray-400" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
              </div>

              {/* Status Badges */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 text-xs leading-5 font-semibold rounded-full ${
                      client.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {client.is_active ? 'Activo' : 'Inactivo'}
                    </span>

                    {/* Portal Activation Status */}
                    {client.email && (() => {
                      const status = getActivationStatus(client);
                      const StatusIcon = status.icon;
                      return (
                        <span className={`px-2 py-1 text-xs leading-5 font-semibold rounded-full flex items-center gap-1 ${status.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Resend Button - only show if email exists and not activated */}
                  {client.email && !(client.is_verified && client.has_password) && (
                    <button
                      onClick={() => handleResendActivation(client)}
                      disabled={resendingEmail === client.id}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition disabled:opacity-50"
                      title="Reenviar correo de activación"
                    >
                      {resendingEmail === client.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      <span>Reenviar</span>
                    </button>
                  )}
                </div>
                {client.notes && (
                  <span className="text-xs text-gray-400 truncate block mt-2" title={client.notes}>
                    {client.notes}
                  </span>
                )}
              </div>

              {/* Delete Confirmation */}
              {deleteConfirmId === client.id && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 mb-3">¿Eliminar este cliente?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(client.id)}
                      disabled={deleteLoading}
                      className="flex-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleteLoading ? 'Eliminando...' : 'Sí, eliminar'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      disabled={deleteLoading}
                      className="flex-1 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Load More Button */}
      {!loading && !error && hasMore && clients.length > 0 && (
        <div className="mt-6 text-center">
          <button
            onClick={() => loadClients(true)}
            disabled={loadingMore}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition disabled:opacity-50"
          >
            {loadingMore ? (
              <span className="flex items-center justify-center">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cargando...
              </span>
            ) : (
              'Cargar mas clientes'
            )}
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && clients.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-12 text-center">
          <Users className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-blue-900 mb-2">
            {searchTerm ? 'No se encontraron clientes' : 'No hay clientes'}
          </h3>
          <p className="text-blue-700 mb-4">
            {searchTerm
              ? 'Intenta ajustar el término de búsqueda'
              : 'Comienza agregando tu primer cliente'
            }
          </p>
          {!searchTerm && (
            <button
              onClick={handleOpenCreate}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg inline-flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Agregar Cliente
            </button>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCloseModal}
          />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">
                  {modalMode === 'create' ? 'Nuevo Cliente' : 'Editar Cliente'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSubmit} className="p-6">
                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{formError}</p>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="Nombre completo del cliente"
                    />
                  </div>

                  {/* Phone */}
                  <PhoneInput
                    value={formData.phone}
                    onChange={(value) => setFormData(prev => ({ ...prev, phone: value }))}
                    label="Telefono"
                  />

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="cliente@email.com"
                    />
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dirección
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="Dirección del cliente"
                    />
                  </div>

                  {/* Student Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre del Estudiante
                      </label>
                      <input
                        type="text"
                        name="student_name"
                        value={formData.student_name}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        placeholder="Nombre del estudiante"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Grado
                      </label>
                      <input
                        type="text"
                        name="student_grade"
                        value={formData.student_grade}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        placeholder="Ej: 5° Primaria"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notas
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                      placeholder="Notas adicionales sobre el cliente..."
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={formLoading}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center"
                  >
                    {formLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {modalMode === 'create' ? 'Crear Cliente' : 'Guardar Cambios'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailClient && (
        <ClientDetailModal
          isOpen={!!detailClient}
          onClose={() => setDetailClient(null)}
          client={detailClient}
          onEdit={() => handleOpenEdit(detailClient)}
          onUpdated={loadClients}
        />
      )}
    </Layout>
  );
}
