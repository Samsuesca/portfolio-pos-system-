'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  Plus,
  Eye,
  Edit,
  Trash2,
  Users2,
  Phone,
  Mail,
  MapPin,
  GraduationCap,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react';
import clientService, { ClientCreate, ClientUpdate } from '@/lib/services/clientService';
import type { Client } from '@/lib/api';

// Helper to extract error message
const getErrorMessage = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as { response?: { data?: { detail?: unknown } } };
    const detail = axiosErr.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(', ');
    }
  }
  return fallback;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Form state
  const [formData, setFormData] = useState<ClientCreate>({
    name: '',
    phone: '',
    email: '',
    student_name: '',
    student_grade: '',
    address: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientService.getClients({ search: searchTerm || undefined });
      setClients(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Error al cargar clientes'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadClients();
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('El nombre es requerido');
      return;
    }

    try {
      setSaving(true);
      setFormError(null);
      await clientService.createClient(formData);
      setShowCreateModal(false);
      resetForm();
      loadClients();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Error al crear cliente'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    if (!formData.name.trim()) {
      setFormError('El nombre es requerido');
      return;
    }

    try {
      setSaving(true);
      setFormError(null);
      await clientService.updateClient(selectedClient.id, formData as ClientUpdate);
      setShowEditModal(false);
      resetForm();
      loadClients();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Error al actualizar cliente'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = async (client: Client) => {
    if (!window.confirm(`¿Eliminar el cliente "${client.name}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      await clientService.deleteClient(client.id);
      loadClients();
    } catch (err) {
      alert(getErrorMessage(err, 'Error al eliminar cliente'));
    }
  };

  const openEditModal = (client: Client) => {
    setSelectedClient(client);
    setFormData({
      name: client.name,
      phone: client.phone || '',
      email: client.email || '',
      student_name: client.student_name || '',
      student_grade: client.student_grade || '',
      address: client.address || '',
      notes: client.notes || '',
    });
    setFormError(null);
    setShowEditModal(true);
  };

  const openDetailModal = (client: Client) => {
    setSelectedClient(client);
    setShowDetailModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      student_name: '',
      student_grade: '',
      address: '',
      notes: '',
    });
    setFormError(null);
    setSelectedClient(null);
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.student_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users2 className="w-7 h-7 text-brand-500" />
            Clientes
          </h1>
          <p className="text-slate-500 mt-1">Gestión de clientes del sistema</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition"
        >
          <Plus className="w-5 h-5" />
          Nuevo Cliente
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono, email o estudiante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
            />
          </div>
          <button
            type="button"
            onClick={loadClients}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
            title="Recargar"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      )}

      {/* Clients Table */}
      {!loading && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Cliente
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Contacto
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Estudiante
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      No se encontraron clientes
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-800">{client.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{client.code}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {client.phone && (
                            <div className="flex items-center gap-1 text-sm text-slate-600">
                              <Phone className="w-3.5 h-3.5" />
                              {client.phone}
                            </div>
                          )}
                          {client.email && (
                            <div className="flex items-center gap-1 text-sm text-slate-600">
                              <Mail className="w-3.5 h-3.5" />
                              {client.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {client.student_name ? (
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <GraduationCap className="w-4 h-4" />
                            <span>{client.student_name}</span>
                            {client.student_grade && (
                              <span className="text-slate-400">({client.student_grade})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openDetailModal(client)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(client)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClient(client)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredClients.length > 0 && (
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-sm text-slate-500">
              Mostrando {filteredClients.length} cliente{filteredClients.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => {
            setShowCreateModal(false);
            setShowEditModal(false);
            resetForm();
          }} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                {showCreateModal ? 'Nuevo Cliente' : 'Editar Cliente'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  resetForm();
                }}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={showCreateModal ? handleCreateClient : handleUpdateClient} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  placeholder="Nombre completo del cliente"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <Phone className="w-3.5 h-3.5 inline mr-1" />
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                    placeholder="300 123 4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <Mail className="w-3.5 h-3.5 inline mr-1" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <GraduationCap className="w-3.5 h-3.5 inline mr-1" />
                    Nombre Estudiante
                  </label>
                  <input
                    type="text"
                    value={formData.student_name}
                    onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                    placeholder="Nombre del estudiante"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Grado
                  </label>
                  <input
                    type="text"
                    value={formData.student_grade}
                    onChange={(e) => setFormData({ ...formData, student_grade: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                    placeholder="ej: 5° Primaria"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <MapPin className="w-3.5 h-3.5 inline mr-1" />
                  Dirección
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  placeholder="Dirección de entrega"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none"
                  placeholder="Notas adicionales..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {showCreateModal ? 'Crear Cliente' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowDetailModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Detalles del Cliente</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center">
                  <Users2 className="w-8 h-8 text-brand-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-800">{selectedClient.name}</h3>
                  <p className="text-sm text-slate-500 font-mono">{selectedClient.code}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Teléfono</p>
                  <p className="text-slate-700 flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {selectedClient.phone || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Email</p>
                  <p className="text-slate-700 flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {selectedClient.email || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Estudiante</p>
                  <p className="text-slate-700 flex items-center gap-1">
                    <GraduationCap className="w-4 h-4" />
                    {selectedClient.student_name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Grado</p>
                  <p className="text-slate-700">
                    {selectedClient.student_grade || '-'}
                  </p>
                </div>
              </div>

              {selectedClient.address && (
                <div className="pt-2">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Dirección</p>
                  <p className="text-slate-700 flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {selectedClient.address}
                  </p>
                </div>
              )}

              {selectedClient.notes && (
                <div className="pt-2">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Notas</p>
                  <p className="text-slate-700">{selectedClient.notes}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    openEditModal(selectedClient);
                  }}
                  className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition flex items-center justify-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
