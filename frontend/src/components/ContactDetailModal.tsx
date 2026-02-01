/**
 * Contact Detail Modal - View and respond to PQRS messages
 *
 * Allows admin to:
 * - View full contact message details
 * - Change status (pending → in_review → resolved → closed)
 * - Write and send response
 * - Mark as read/unread
 */
import { useState, useEffect } from 'react';
import {
  X, Mail, Phone, Calendar, MessageSquare, User, Building2,
  Send, CheckCircle, AlertCircle, Loader2, MailOpen
} from 'lucide-react';
import { contactService, type Contact } from '../services/contactService';
import { formatDateTimeSpanish } from './DatePicker';

interface ContactDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact;
  onUpdated?: () => void;
}

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

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_review', label: 'En Revisión' },
  { value: 'resolved', label: 'Resuelto' },
  { value: 'closed', label: 'Cerrado' }
];

export default function ContactDetailModal({
  isOpen,
  onClose,
  contact,
  onUpdated
}: ContactDetailModalProps) {
  const [status, setStatus] = useState(contact.status);
  const [adminResponse, setAdminResponse] = useState(contact.admin_response || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStatus(contact.status);
      setAdminResponse(contact.admin_response || '');
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, contact]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await contactService.updateContact(contact.id, {
        status,
        admin_response: adminResponse || undefined,
        is_read: true
      });

      setSuccess('Mensaje actualizado correctamente');
      onUpdated?.();

      // Close after 1 second
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Error updating contact:', err);
      setError(err.response?.data?.detail || 'Error al actualizar el mensaje');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsRead = async () => {
    try {
      setSaving(true);
      setError(null);

      await contactService.updateContact(contact.id, {
        is_read: true
      });

      setSuccess('Marcado como leído');
      onUpdated?.();
    } catch (err: any) {
      console.error('Error marking as read:', err);
      setError(err.response?.data?.detail || 'Error al marcar como leído');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Detalle del Mensaje</h2>
              <p className="text-blue-100 text-sm">
                {CONTACT_TYPE_LABELS[contact.contact_type]} - {STATUS_LABELS[contact.status]}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 rounded-lg p-2 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Contact Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Nombre</p>
                  <p className="text-gray-900 font-medium">{contact.name}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-gray-900 font-medium">{contact.email}</p>
                </div>
              </div>

              {contact.phone && (
                <div className="flex items-start gap-2">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Teléfono</p>
                    <p className="text-gray-900 font-medium">{contact.phone}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Fecha</p>
                  <p className="text-gray-900 font-medium">
                    {formatDateTimeSpanish(new Date(contact.created_at))}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Colegio</p>
                  <p className="text-gray-900 font-medium">
                    {contact.school_id ? 'Ver colegio' : 'General'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                {contact.is_read ? (
                  <MailOpen className="w-5 h-5 text-green-500 mt-0.5" />
                ) : (
                  <Mail className="w-5 h-5 text-blue-500 mt-0.5" />
                )}
                <div>
                  <p className="text-sm text-gray-500">Estado de Lectura</p>
                  <p className="text-gray-900 font-medium">
                    {contact.is_read ? 'Leído' : 'No leído'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Subject */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Asunto
            </label>
            <div className="bg-gray-50 rounded-lg p-3 text-gray-900">
              {contact.subject}
            </div>
          </div>

          {/* Message */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje del Cliente
            </label>
            <div className="bg-gray-50 rounded-lg p-4 text-gray-900 whitespace-pre-wrap">
              {contact.message}
            </div>
          </div>

          {/* Previous Admin Response (if exists) */}
          {contact.admin_response && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-900">Respuesta Enviada</span>
                {contact.admin_response_date && (
                  <span className="text-sm text-blue-600">
                    - {formatDateTimeSpanish(new Date(contact.admin_response_date))}
                  </span>
                )}
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{contact.admin_response}</p>
            </div>
          )}

          {/* Status Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado del Mensaje
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Admin Response Textarea */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Respuesta Administrativa
            </label>
            <textarea
              value={adminResponse}
              onChange={(e) => setAdminResponse(e.target.value)}
              rows={6}
              placeholder="Escribe tu respuesta al cliente aquí..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Esta respuesta será visible para el equipo administrativo. Para contactar al cliente,
              usa su email: <span className="font-medium">{contact.email}</span>
            </p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              {success}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
          <div>
            {!contact.is_read && (
              <button
                onClick={handleMarkAsRead}
                disabled={saving}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
              >
                <MailOpen className="w-4 h-4" />
                Marcar como leído
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
