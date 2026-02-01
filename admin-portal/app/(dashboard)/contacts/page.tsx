'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Search,
  Mail,
  MailOpen,
  Clock,
  AlertCircle,
  Loader2,
  Building2,
  RefreshCw,
  X,
  Send,
  CheckCircle,
} from 'lucide-react';
import { useAdminAuth } from '@/lib/adminAuth';
import schoolService from '@/lib/services/schoolService';
import contactService, {
  Contact,
  ContactStatus,
  ContactType,
  CONTACT_TYPE_LABELS,
  CONTACT_STATUS_LABELS,
  CONTACT_STATUS_COLORS,
  CONTACT_TYPE_COLORS,
} from '@/lib/services/contactService';
import type { School } from '@/lib/api';

// Helper to format date
const formatDateTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Helper to extract error message
const getErrorMessage = (err: any, defaultMsg: string): string => {
  const detail = err.response?.data?.detail;
  if (!detail) return defaultMsg;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ');
  }
  if (typeof detail === 'object' && detail.msg) return detail.msg;
  return defaultMsg;
};

export default function ContactsPage() {
  const { user } = useAdminAuth();

  // Data state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Modal state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [newStatus, setNewStatus] = useState<ContactStatus>('pending');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Load schools on mount
  useEffect(() => {
    const loadSchools = async () => {
      try {
        const data = await schoolService.list();
        setSchools(data);
      } catch (err) {
        console.error('Error loading schools:', err);
      }
    };
    loadSchools();
  }, []);

  // Load contacts
  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await contactService.list({
        page: 1,
        page_size: 100,
        school_id: schoolFilter || undefined,
        status_filter: statusFilter || undefined,
        contact_type_filter: typeFilter || undefined,
        unread_only: unreadOnly || undefined,
        search: searchTerm || undefined,
      });

      setContacts(response.items);
    } catch (err: any) {
      console.error('Error loading contacts:', err);
      setError(getErrorMessage(err, 'Error al cargar mensajes de contacto'));
    } finally {
      setLoading(false);
    }
  }, [schoolFilter, statusFilter, typeFilter, unreadOnly, searchTerm]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Open detail modal
  const handleViewContact = async (contact: Contact) => {
    try {
      // Get full contact (marks as read)
      const fullContact = await contactService.getById(contact.id);
      setSelectedContact(fullContact);
      setResponseText(fullContact.admin_response || '');
      setNewStatus(fullContact.status);
      setModalError(null);
      setShowDetailModal(true);

      // Reload list to update read status
      loadContacts();
    } catch (err) {
      setError(getErrorMessage(err, 'Error al cargar detalles'));
    }
  };

  // Close modal
  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedContact(null);
    setResponseText('');
    setModalError(null);
  };

  // Submit response
  const handleSubmitResponse = async () => {
    if (!selectedContact) return;

    setIsSubmitting(true);
    setModalError(null);

    try {
      await contactService.update(selectedContact.id, {
        status: newStatus,
        admin_response: responseText || undefined,
      });

      handleCloseModal();
      loadContacts();
    } catch (err) {
      setModalError(getErrorMessage(err, 'Error al guardar respuesta'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter locally by search
  const filteredContacts = contacts.filter((contact) => {
    if (searchTerm === '') return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      contact.name.toLowerCase().includes(searchLower) ||
      contact.email.toLowerCase().includes(searchLower) ||
      contact.subject.toLowerCase().includes(searchLower) ||
      contact.message.toLowerCase().includes(searchLower)
    );
  });

  const unreadCount = contacts.filter((c) => !c.is_read).length;

  // Check access
  const canAccess =
    user?.is_superuser || user?.school_roles?.some((r) => r.role === 'admin' || r.role === 'owner');

  if (!canAccess) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <div className="flex items-start">
          <AlertCircle className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Acceso Restringido</h3>
            <p className="mt-1 text-sm text-yellow-700">
              No tienes permisos para acceder a los mensajes de contacto.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-brand-500" />
            PQRS - Mensajes de Contacto
          </h1>
          <p className="text-slate-500 mt-1">
            Gestiona peticiones, quejas, reclamos y sugerencias del portal web
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg flex items-center gap-2">
              <Mail className="w-5 h-5" />
              <span className="font-semibold">{unreadCount} sin leer</span>
            </div>
          )}
          <button
            onClick={loadContacts}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Nombre, email, asunto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* School Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Colegio</label>
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
            >
              <option value="">Todos</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
            >
              <option value="">Todos</option>
              <option value="inquiry">Consulta</option>
              <option value="request">Peticion</option>
              <option value="complaint">Queja</option>
              <option value="claim">Reclamo</option>
              <option value="suggestion">Sugerencia</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
            >
              <option value="">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="in_review">En Revision</option>
              <option value="resolved">Resuelto</option>
              <option value="closed">Cerrado</option>
            </select>
          </div>
        </div>

        {/* Unread Only Toggle */}
        <div className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="unread-only"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
          />
          <label htmlFor="unread-only" className="text-sm text-slate-700 flex items-center gap-1">
            <Mail className="w-4 h-4" />
            Solo mensajes sin leer
          </label>
        </div>
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

      {/* Table */}
      {!loading && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Estado
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Fecha
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Tipo
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Contacto
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Asunto
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Colegio
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p>No hay mensajes de contacto</p>
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className={`hover:bg-slate-50 transition ${!contact.is_read ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${CONTACT_STATUS_COLORS[contact.status]}`}
                          >
                            {CONTACT_STATUS_LABELS[contact.status]}
                          </span>
                          {contact.is_read ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <MailOpen className="w-3 h-3" />
                              Leido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                              <Mail className="w-3 h-3" />
                              No leido
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-slate-400" />
                          {formatDateTime(contact.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${CONTACT_TYPE_COLORS[contact.contact_type]}`}
                        >
                          {CONTACT_TYPE_LABELS[contact.contact_type]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-800">{contact.name}</div>
                        <div className="text-sm text-slate-500">{contact.email}</div>
                        {contact.phone && (
                          <div className="text-xs text-slate-400">{contact.phone}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-800 max-w-xs truncate">
                          {contact.subject}
                        </div>
                        <div className="text-xs text-slate-500 max-w-xs truncate">
                          {contact.message}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {contact.school_id ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            {schools.find((s) => s.id === contact.school_id)?.name || 'Colegio'}
                          </div>
                        ) : (
                          <span className="text-slate-400">General</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleViewContact(contact)}
                          className="text-brand-600 hover:text-brand-800 text-sm font-medium inline-flex items-center gap-1"
                        >
                          Ver detalles
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={handleCloseModal} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">{selectedContact.subject}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${CONTACT_TYPE_COLORS[selectedContact.contact_type]}`}
                  >
                    {CONTACT_TYPE_LABELS[selectedContact.contact_type]}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${CONTACT_STATUS_COLORS[selectedContact.status]}`}
                  >
                    {CONTACT_STATUS_LABELS[selectedContact.status]}
                  </span>
                </div>
              </div>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {modalError}
              </div>
            )}

            <div className="p-6 space-y-6">
              {/* Contact info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500">Nombre</p>
                  <p className="font-medium text-slate-800">{selectedContact.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="font-medium text-slate-800">{selectedContact.email}</p>
                </div>
                {selectedContact.phone && (
                  <div>
                    <p className="text-xs text-slate-500">Telefono</p>
                    <p className="font-medium text-slate-800">{selectedContact.phone}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500">Fecha</p>
                  <p className="font-medium text-slate-800">
                    {formatDateTime(selectedContact.created_at)}
                  </p>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mensaje</label>
                <div className="p-4 bg-slate-50 rounded-lg text-slate-700 whitespace-pre-wrap">
                  {selectedContact.message}
                </div>
              </div>

              {/* Previous response */}
              {selectedContact.admin_response && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Respuesta Anterior
                  </label>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-slate-700 whitespace-pre-wrap">
                    {selectedContact.admin_response}
                  </div>
                  {selectedContact.admin_response_date && (
                    <p className="text-xs text-slate-500 mt-1">
                      Respondido el {formatDateTime(selectedContact.admin_response_date)}
                    </p>
                  )}
                </div>
              )}

              {/* Response form */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {selectedContact.admin_response ? 'Actualizar Respuesta' : 'Escribir Respuesta'}
                </label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  placeholder="Escribe tu respuesta..."
                />
              </div>

              {/* Status update */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Cambiar Estado
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as ContactStatus)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                >
                  <option value="pending">Pendiente</option>
                  <option value="in_review">En Revision</option>
                  <option value="resolved">Resuelto</option>
                  <option value="closed">Cerrado</option>
                </select>
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-50 flex justify-end gap-3 px-6 py-4 border-t">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitResponse}
                disabled={isSubmitting}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
