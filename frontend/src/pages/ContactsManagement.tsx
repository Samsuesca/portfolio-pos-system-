/**
 * Contacts Management Page - PQRS (Peticiones, Quejas, Reclamos, Sugerencias)
 *
 * Admin page to view, respond to, and manage contact messages from the web portal.
 */
import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import ContactDetailModal from '../components/ContactDetailModal';
import {
  MessageSquare, Search, Mail, MailOpen, Clock,
  AlertCircle, Loader2, Building2
} from 'lucide-react';
import { formatDateTimeSpanish } from '../components/DatePicker';
import { contactService } from '../services/contactService';
import { useSchoolStore } from '../stores/schoolStore';
import type { Contact } from '../services/contactService';

const CONTACT_TYPE_LABELS: Record<string, string> = {
  inquiry: 'Consulta',
  request: 'Petición',
  complaint: 'Queja',
  claim: 'Reclamo',
  suggestion: 'Sugerencia'
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_review: 'En Revisión',
  resolved: 'Resuelto',
  closed: 'Cerrado'
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_review: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-700'
};

export default function ContactsManagement() {
  const { availableSchools, loadSchools } = useSchoolStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await contactService.getContacts({
        page: 1,
        page_size: 100,
        school_id: schoolFilter || undefined,
        status_filter: statusFilter || undefined,
        contact_type_filter: typeFilter || undefined,
        unread_only: unreadOnly || undefined,
        search: searchTerm || undefined
      });

      setContacts(response.items);
    } catch (err: any) {
      console.error('Error loading contacts:', err);
      setError(err.response?.data?.detail || 'Error al cargar mensajes de contacto');
    } finally {
      setLoading(false);
    }
  }, [schoolFilter, statusFilter, typeFilter, unreadOnly, searchTerm]);

  useEffect(() => {
    if (availableSchools.length === 0) {
      loadSchools();
    }
  }, [availableSchools.length, loadSchools]);

  // Load contacts on mount and when filters change
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleViewContact = async (contact: Contact) => {
    setSelectedContact(contact);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedContact(null);
    // Reload to get updated read status
    loadContacts();
  };

  const handleContactUpdated = () => {
    // Reload contacts after update
    loadContacts();
  };

  // Filter locally by search
  const filteredContacts = contacts.filter(contact => {
    if (searchTerm === '') return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      contact.name.toLowerCase().includes(searchLower) ||
      contact.email.toLowerCase().includes(searchLower) ||
      contact.subject.toLowerCase().includes(searchLower) ||
      contact.message.toLowerCase().includes(searchLower)
    );
  });

  const unreadCount = contacts.filter(c => !c.is_read).length;

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-8 h-8 text-blue-600" />
                PQRS - Mensajes de Contacto
              </h1>
              <p className="text-gray-600 mt-1">
                Gestiona peticiones, quejas, reclamos y sugerencias del portal web
              </p>
            </div>
            {unreadCount > 0 && (
              <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg flex items-center gap-2">
                <Mail className="w-5 h-5" />
                <span className="font-semibold">{unreadCount} sin leer</span>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Nombre, email, asunto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* School Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Colegio
              </label>
              <select
                value={schoolFilter}
                onChange={(e) => setSchoolFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {availableSchools.map(school => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="inquiry">Consulta</option>
                <option value="request">Petición</option>
                <option value="complaint">Queja</option>
                <option value="claim">Reclamo</option>
                <option value="suggestion">Sugerencia</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="in_review">En Revisión</option>
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
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="unread-only" className="text-sm text-gray-700 flex items-center gap-1">
              <Mail className="w-4 h-4" />
              Solo mensajes sin leer
            </label>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        )}

        {/* Table */}
        {!loading && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado / Leído
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Asunto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Colegio
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No hay mensajes de contacto
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className={`hover:bg-gray-50 ${!contact.is_read ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${STATUS_COLORS[contact.status]}`}>
                            {STATUS_LABELS[contact.status]}
                          </span>
                          {contact.is_read ? (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                              <MailOpen className="w-3 h-3" />
                              Leído
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                              <Mail className="w-3 h-3" />
                              No leído
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-gray-400" />
                          {formatDateTimeSpanish(new Date(contact.created_at))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 font-medium">
                          {CONTACT_TYPE_LABELS[contact.contact_type]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{contact.name}</div>
                        <div className="text-sm text-gray-500">{contact.email}</div>
                        {contact.phone && (
                          <div className="text-xs text-gray-400">{contact.phone}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {contact.subject}
                        </div>
                        <div className="text-xs text-gray-500 max-w-xs truncate">
                          {contact.message}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {contact.school_id ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            {availableSchools.find(s => s.id === contact.school_id)?.name || 'Colegio'}
                          </div>
                        ) : (
                          <span className="text-gray-400">General</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewContact(contact)}
                          className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
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
        )}

        {/* Contact Detail Modal */}
        {selectedContact && (
          <ContactDetailModal
            isOpen={isDetailModalOpen}
            onClose={handleCloseDetailModal}
            contact={selectedContact}
            onUpdated={handleContactUpdated}
          />
        )}
      </div>
    </Layout>
  );
}
