/**
 * Client Detail Modal
 *
 * Displays full client information with actions:
 * - View contact info
 * - WhatsApp button
 * - Email link
 * - Student info
 * - Portal activation status
 * - Transaction history summary
 * - Edit/Delete actions
 */
import { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  GraduationCap,
  MessageCircle,
  Edit2,
  Send,
  CheckCircle,
  Clock,
  Loader2,
  StickyNote,
  ShoppingBag,
  DollarSign,
  Package,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import type { Client } from '../types/api';
import { openWhatsApp, DEFAULT_WHATSAPP_MESSAGE, formatPhoneDisplay } from '../utils/whatsapp';
import { clientService } from '../services/clientService';
import toast from 'react-hot-toast';

interface ClientSummary {
  total_purchases: number;
  total_spent: number;
  pending_orders: number;
  last_purchase_date: string | null;
  schools: string[];
}

interface ClientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  onEdit?: () => void;
  onUpdated?: () => void;
}

export default function ClientDetailModal({
  isOpen,
  onClose,
  client,
  onEdit,
  onUpdated,
}: ClientDetailModalProps) {
  const [resendingEmail, setResendingEmail] = useState(false);
  const [summary, setSummary] = useState<ClientSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Cargar resumen de operaciones cuando se abre el modal
  useEffect(() => {
    if (isOpen && client?.id) {
      setLoadingSummary(true);
      setSummaryError(null);
      clientService.getClientSummary(client.id)
        .then((data) => {
          setSummary(data);
        })
        .catch((err) => {
          console.error('Error loading client summary:', err);
          setSummaryError('No se pudo cargar el historial');
        })
        .finally(() => {
          setLoadingSummary(false);
        });
    }
  }, [isOpen, client?.id]);

  if (!isOpen) return null;

  // Get activation status
  const getActivationStatus = (): {
    label: string;
    color: string;
    icon: typeof CheckCircle;
  } => {
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

  const handleWhatsApp = () => {
    if (client.phone) {
      openWhatsApp(client.phone, DEFAULT_WHATSAPP_MESSAGE);
    }
  };

  const handleEmail = () => {
    if (client.email) {
      window.location.href = `mailto:${client.email}`;
    }
  };

  const handleResendActivation = async () => {
    if (!client.email) {
      toast.error('El cliente no tiene email registrado');
      return;
    }
    setResendingEmail(true);
    try {
      const result = await clientService.resendActivationEmail(client.id);
      toast.success(result.message);
      onUpdated?.();
    } catch (err: any) {
      console.error('Error resending activation:', err);
      toast.error(err.response?.data?.detail || 'Error al enviar el correo');
    } finally {
      setResendingEmail(false);
    }
  };

  const activationStatus = getActivationStatus();
  const StatusIcon = activationStatus.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">{client.name}</h2>
              <p className="text-blue-100 text-sm flex items-center gap-2">
                <span className="bg-blue-500 px-2 py-0.5 rounded text-xs">
                  {client.code}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    client.is_active ? 'bg-green-500' : 'bg-gray-500'
                  }`}
                >
                  {client.is_active ? 'Activo' : 'Inactivo'}
                </span>
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
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Informacion de Contacto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Phone */}
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Phone className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Telefono</p>
                  {client.phone ? (
                    <div className="flex items-center gap-2">
                      <p className="text-gray-900 font-medium">
                        {formatPhoneDisplay(client.phone)}
                      </p>
                      <button
                        onClick={handleWhatsApp}
                        className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition"
                        title="Abrir WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-400 italic">No registrado</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Mail className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Email</p>
                  {client.email ? (
                    <button
                      onClick={handleEmail}
                      className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                    >
                      {client.email}
                    </button>
                  ) : (
                    <p className="text-gray-400 italic">No registrado</p>
                  )}
                </div>
              </div>

              {/* Address */}
              {client.address && (
                <div className="flex items-start gap-3 md:col-span-2">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <MapPin className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Direccion</p>
                    <p className="text-gray-900">{client.address}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Student Info */}
          {(client.student_name || client.student_grade) && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Informacion del Estudiante
              </h3>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <GraduationCap className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-gray-900 font-medium">
                    {client.student_name || 'Nombre no registrado'}
                  </p>
                  {client.student_grade && (
                    <p className="text-sm text-gray-500">{client.student_grade}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {client.notes && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Notas
              </h3>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <StickyNote className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{client.notes}</p>
              </div>
            </div>
          )}

          {/* Historial de Operaciones */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Historial de Operaciones
            </h3>
            {loadingSummary ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-500">Cargando historial...</span>
              </div>
            ) : summaryError ? (
              <div className="flex items-center gap-2 text-red-500 py-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{summaryError}</span>
              </div>
            ) : summary ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total Compras */}
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingBag className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-gray-500">Compras</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{summary.total_purchases}</p>
                </div>

                {/* Total Gastado */}
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-gray-500">Total Gastado</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    ${summary.total_spent.toLocaleString('es-CO')}
                  </p>
                </div>

                {/* Pedidos Pendientes */}
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-4 h-4 text-orange-500" />
                    <span className="text-xs text-gray-500">Pendientes</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{summary.pending_orders}</p>
                </div>

                {/* Ultima Compra */}
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-purple-500" />
                    <span className="text-xs text-gray-500">Última Compra</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {summary.last_purchase_date
                      ? new Date(summary.last_purchase_date).toLocaleDateString('es-CO', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Sin compras'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 italic text-sm">Sin datos disponibles</p>
            )}

            {/* Colegios donde ha comprado */}
            {summary && summary.schools && summary.schools.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Colegios donde ha comprado:</p>
                <div className="flex flex-wrap gap-2">
                  {summary.schools.map((school, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                    >
                      {school}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Portal Activation Status */}
          {client.email && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Estado del Portal Web
              </h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1.5 text-sm font-semibold rounded-full flex items-center gap-1.5 ${activationStatus.color}`}
                  >
                    <StatusIcon className="w-4 h-4" />
                    {activationStatus.label}
                  </span>
                </div>
                {!(client.is_verified && client.has_password) && (
                  <button
                    onClick={handleResendActivation}
                    disabled={resendingEmail}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"
                  >
                    {resendingEmail ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {client.welcome_email_sent ? 'Reenviar' : 'Enviar'} activacion
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
          <div className="flex gap-2">
            {client.phone && (
              <button
                onClick={handleWhatsApp}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition"
            >
              Cerrar
            </button>
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
