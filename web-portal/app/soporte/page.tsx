'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Phone, MapPin, Send, MessageSquare, AlertCircle, HelpCircle, MessageCircle, Clock, Wrench, Search, Eye, CheckCircle, XCircle, HourglassIcon } from 'lucide-react';
import { useClientAuth } from '@/lib/clientAuth';

type ContactStatus = 'pending' | 'in_progress' | 'resolved' | 'closed';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  contact_type: string;
  subject: string;
  message: string;
  status: ContactStatus;
  admin_response: string | null;
  created_at: string;
  updated_at: string;
}

export default function SoportePage() {
  const router = useRouter();
  const { client, isAuthenticated } = useClientAuth();
  const [activeTab, setActiveTab] = useState<'new' | 'my-pqrs'>('new');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    type: 'consulta',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // My PQRS state
  const [searchEmail, setSearchEmail] = useState('');
  const [myContacts, setMyContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Auto-populate form data if user is authenticated
  useEffect(() => {
    if (isAuthenticated && client) {
      setFormData(prev => ({
        ...prev,
        name: client.name,
        email: client.email,
        phone: client.phone || '',
      }));
      setSearchEmail(client.email);
    }
  }, [isAuthenticated, client]);

  // Map form types to backend ContactType enum
  const mapTypeToBackend = (type: string): string => {
    const typeMap: Record<string, string> = {
      'consulta': 'inquiry',
      'peticion': 'request',
      'queja': 'complaint',
      'reclamo': 'claim',
      'sugerencia': 'suggestion'
    };
    return typeMap[type] || 'inquiry';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Call Next.js API proxy to avoid CORS issues
      const apiUrl = '/api/contacts/submit';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          contact_type: mapTypeToBackend(formData.type),
          subject: formData.subject,
          message: formData.message,
          school_id: null,
          client_id: client?.id || null  // Include client_id if authenticated
        })
      });

     if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', response.status, errorData);

        // Si el error es una lista de validaciones de Pydantic (array)
        if (Array.isArray(errorData.detail)) {
            // Unimos los mensajes de error para mostrarlos al usuario
            const messages = errorData.detail.map((err: any) =>
                `El campo ${err.loc[1]} tiene un error: ${err.msg}`
            ).join('. ');
            throw new Error(messages);
        }

        // Si es un error genérico (string)
        throw new Error(errorData.detail || 'Error al enviar el mensaje');
      }

      setSuccess(true);

      // Reset form after 3 seconds (but keep user data if authenticated)
      setTimeout(() => {
        if (isAuthenticated && client) {
          // Keep user data, only reset message fields
          setFormData(prev => ({
            ...prev,
            type: 'consulta',
            subject: '',
            message: '',
          }));
        } else {
          // Clear all fields for non-authenticated users
          setFormData({
            name: '',
            email: '',
            phone: '',
            type: 'consulta',
            subject: '',
            message: '',
          });
        }
        setSuccess(false);
      }, 3000);

    } catch (err: any) {
      console.error('Error submitting contact:', err);
      setError(err.message || 'Error al enviar el mensaje. Por favor intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearchContacts = async () => {
    if (!searchEmail.trim()) {
      setContactsError('Por favor ingresa tu correo electrónico');
      return;
    }

    setLoadingContacts(true);
    setContactsError(null);
    setMyContacts([]);

    try {
      const response = await fetch(`/api/contacts/by-email?email=${encodeURIComponent(searchEmail)}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error al buscar PQRS');
      }

      const data = await response.json();
      setMyContacts(data);

      if (data.length === 0) {
        setContactsError('No se encontraron PQRS para este correo electrónico');
      }
    } catch (err: any) {
      console.error('Error fetching contacts:', err);
      setContactsError(err.message || 'Error al buscar tus PQRS. Por favor intenta de nuevo.');
    } finally {
      setLoadingContacts(false);
    }
  };

  // Auto-load PQRS when switching to "Mis PQRS" tab if authenticated
  useEffect(() => {
    if (activeTab === 'my-pqrs' && isAuthenticated && client && client.email) {
      // Automatically fetch PQRS for authenticated user
      handleSearchContacts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAuthenticated, client]);

  const getStatusBadge = (status: ContactStatus) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pendiente', icon: HourglassIcon },
      in_progress: { color: 'bg-blue-100 text-blue-800', label: 'En Progreso', icon: MessageCircle },
      resolved: { color: 'bg-green-100 text-green-800', label: 'Resuelto', icon: CheckCircle },
      closed: { color: 'bg-gray-100 text-gray-800', label: 'Cerrado', icon: XCircle },
    };

    const badge = badges[status];
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    const types: Record<string, { label: string; color: string }> = {
      inquiry: { label: 'Consulta', color: 'bg-blue-100 text-blue-800' },
      request: { label: 'Petición', color: 'bg-green-100 text-green-800' },
      complaint: { label: 'Queja', color: 'bg-yellow-100 text-yellow-800' },
      claim: { label: 'Reclamo', color: 'bg-red-100 text-red-800' },
      suggestion: { label: 'Sugerencia', color: 'bg-purple-100 text-purple-800' },
    };

    const typeInfo = types[type] || { label: type, color: 'bg-gray-100 text-gray-800' };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${typeInfo.color}`}>
        {typeInfo.label}
      </span>
    );
  };

  const pqrsTypes = [
    { value: 'consulta', label: 'Consulta', icon: HelpCircle, color: 'blue' },
    { value: 'peticion', label: 'Petición', icon: MessageSquare, color: 'green' },
    { value: 'queja', label: 'Queja', icon: AlertCircle, color: 'yellow' },
    { value: 'reclamo', label: 'Reclamo', icon: AlertCircle, color: 'red' },
    { value: 'sugerencia', label: 'Sugerencia', icon: MessageSquare, color: 'purple' },
  ];

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-white border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center text-slate-600 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Volver al Inicio
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary font-display mb-4">
            Centro de Soporte
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Estamos aquí para ayudarte. Contáctanos por cualquier consulta sobre uniformes, pedidos o soporte técnico.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-lg border border-surface-200 p-1 bg-white">
            <button
              onClick={() => setActiveTab('new')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'new'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Nueva PQRS
              </div>
            </button>
            <button
              onClick={() => setActiveTab('my-pqrs')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'my-pqrs'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Mis PQRS
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'new' ? (
          <>
            {/* Quick Contact Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Business Support */}
          <div className="bg-white rounded-2xl border border-surface-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-7 h-7 text-brand-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-primary mb-1">Atención al Cliente</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Consultas sobre uniformes, pedidos, encargos personalizados y medidas.
                </p>
                <div className="space-y-2">
                  <a
                    href="https://wa.me/573001234567?text=Hola, necesito información sobre uniformes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp: +57 300 123 4567
                  </a>
                  <a
                    href="tel:+573001234567"
                    className="flex items-center gap-2 text-brand-600 hover:text-brand-700 font-medium"
                  >
                    <Phone className="w-4 h-4" />
                    Llamar: +57 300 123 4567
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Support */}
          <div className="bg-white rounded-2xl border border-surface-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Wrench className="w-7 h-7 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-primary mb-1">Soporte Técnico</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Problemas con la página web, tu cuenta o el proceso de compra.
                </p>
                <div className="space-y-2">
                  <a
                    href="https://wa.me/573015687810?text=Hola, necesito soporte técnico con la web de uniformes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp: +57 301 568 7810
                  </a>
                  <a
                    href="tel:+573015687810"
                    className="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
                  >
                    <Phone className="w-4 h-4" />
                    Llamar: +57 301 568 7810
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Información de Contacto */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl border border-surface-200 p-6">
              <h2 className="text-xl font-bold text-primary font-display mb-4">
                Información General
              </h2>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-700 mb-1">Email</h3>
                    <a href="mailto:contact@example.com" className="text-brand-600 hover:underline text-sm">
                      contact@example.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-700 mb-1">Ubicación</h3>
                    <p className="text-slate-600 text-sm">
                      Medellin, Colombia
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-brand-50 rounded-xl border border-brand-200 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-brand-900">Horario de Atención</h3>
              </div>
              <div className="text-sm text-brand-800 space-y-1">
                <p><span className="font-medium">Lunes a Viernes:</span> 8:00 AM - 6:00 PM</p>
                <p><span className="font-medium">Sábados:</span> 9:00 AM - 2:00 PM</p>
                <p><span className="font-medium">Domingos:</span> Cerrado</p>
              </div>
            </div>
          </div>

          {/* Formulario PQRS */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-surface-200 p-8">
              <h2 className="text-2xl font-bold text-primary font-display mb-2">
                Formulario PQRS
              </h2>
              <p className="text-slate-600 mb-6">
                Peticiones, Quejas, Reclamos y Sugerencias
              </p>

              {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <Send className="w-5 h-5" />
                    <span className="font-semibold">¡Mensaje enviado exitosamente!</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    Nos pondremos en contacto contigo pronto a tu correo electrónico.
                  </p>
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-semibold">Error al enviar mensaje</span>
                  </div>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Tipo de PQRS */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Tipo de Solicitud *
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {pqrsTypes.map((type) => {
                      const Icon = type.icon;
                      const isSelected = formData.type === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, type: type.value })}
                          className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'border-brand-500 bg-brand-50'
                              : 'border-surface-200 hover:border-surface-300'
                          }`}
                        >
                          <Icon className={`w-6 h-6 ${isSelected ? 'text-brand-600' : 'text-slate-400'}`} />
                          <span className={`text-xs font-medium ${isSelected ? 'text-brand-700' : 'text-slate-600'}`}>
                            {type.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Información Personal */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Nombre Completo *
                      {isAuthenticated && (
                        <span className="ml-2 text-xs text-green-600 font-normal">(Auto-completado)</span>
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={isAuthenticated}
                      className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Email *
                      {isAuthenticated && (
                        <span className="ml-2 text-xs text-green-600 font-normal">(Auto-completado)</span>
                      )}
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      disabled={isAuthenticated}
                      className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Telefono
                    {isAuthenticated && formData.phone && (
                      <span className="ml-2 text-xs text-green-600 font-normal">(Auto-completado)</span>
                    )}
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    disabled={isAuthenticated && !!formData.phone}
                    placeholder="3001234567"
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed ${
                      formData.phone && formData.phone.length > 0 && (formData.phone.length !== 10 || !formData.phone.startsWith('3'))
                        ? 'border-red-300'
                        : 'border-surface-200'
                    }`}
                  />
                  {formData.phone && formData.phone.length > 0 && (formData.phone.length !== 10 || !formData.phone.startsWith('3')) && (
                    <p className="text-xs text-red-500 mt-1">Debe ser 10 digitos e iniciar con 3</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Asunto *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={5}  // <--- Validación mínima de caracteres
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    placeholder="Ej: Duda sobre tallas"
                  />
                  <p className="text-xs text-slate-500 mt-1">Mínimo 5 caracteres</p> {/* <--- Texto de ayuda opcional */}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Mensaje *
                  </label>
                  <textarea
                    required
                    minLength={10} // <--- CAMBIO CRÍTICO: Validador de HTML5
                    rows={6}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all resize-none"
                    placeholder="Describe tu consulta, petición, queja, reclamo o sugerencia..."
                  />
                  <p className="text-xs text-slate-500 mt-1">Mínimo 10 caracteres</p> {/* <--- Texto de ayuda opcional */}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors font-bold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>Enviando...</>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Enviar Mensaje
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
          </>
        ) : (
          /* My PQRS Tab */
          <div className="max-w-4xl mx-auto">
            {/* Search Section - Only show if not authenticated */}
            {!isAuthenticated && (
              <div className="bg-white rounded-xl border border-surface-200 p-8 mb-6">
                <h2 className="text-2xl font-bold text-primary font-display mb-2">
                  Consultar mis PQRS
                </h2>
                <p className="text-slate-600 mb-6">
                  Ingresa tu correo electrónico para ver el estado de tus solicitudes
                </p>

                <div className="flex gap-4">
                  <input
                    type="email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchContacts()}
                    placeholder="tu@email.com"
                    className="flex-1 px-4 py-3 rounded-xl border border-surface-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                  />
                  <button
                    onClick={handleSearchContacts}
                    disabled={loadingContacts}
                    className="px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loadingContacts ? (
                      <>Buscando...</>
                    ) : (
                      <>
                        <Search className="w-5 h-5" />
                        Buscar
                      </>
                    )}
                  </button>
                </div>

                {contactsError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-semibold">{contactsError}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Authenticated User Info */}
            {isAuthenticated && client && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h3 className="text-lg font-bold text-green-900">
                    Mostrando tus PQRS
                  </h3>
                </div>
                <p className="text-sm text-green-800">
                  Cuenta: <span className="font-semibold">{client.name}</span> ({client.email})
                </p>
              </div>
            )}

            {/* Loading State */}
            {loadingContacts && (
              <div className="bg-white rounded-xl border border-surface-200 p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-brand-200 border-t-brand-600 mb-4"></div>
                <p className="text-slate-600">Cargando tus PQRS...</p>
              </div>
            )}

            {/* Results Section */}
            {myContacts.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900">
                  Se encontraron {myContacts.length} solicitud(es)
                </h3>

                {myContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="bg-white rounded-xl border border-surface-200 p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-bold text-slate-900">
                            {contact.subject}
                          </h4>
                          {getTypeBadge(contact.contact_type)}
                        </div>
                        <p className="text-sm text-slate-500">
                          Creado: {new Date(contact.created_at).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div>
                        {getStatusBadge(contact.status)}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm font-medium text-slate-700 mb-1">Tu mensaje:</p>
                      <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                        {contact.message}
                      </p>
                    </div>

                    {contact.admin_response && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-green-900 mb-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Respuesta del equipo:
                        </p>
                        <p className="text-sm text-green-800">
                          {contact.admin_response}
                        </p>
                        <p className="text-xs text-green-600 mt-2">
                          Actualizado: {new Date(contact.updated_at).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    )}

                    {!contact.admin_response && contact.status === 'pending' && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm text-yellow-800 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Tu solicitud está en cola. Te responderemos pronto a tu correo electrónico.
                        </p>
                      </div>
                    )}

                    {!contact.admin_response && contact.status === 'in_progress' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800 flex items-center gap-2">
                          <MessageCircle className="w-4 h-4" />
                          Estamos trabajando en tu solicitud. Te contactaremos pronto.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-surface-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-slate-600 text-sm">
            <p>© {new Date().getFullYear()} Uniformes Consuelo Rios. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
