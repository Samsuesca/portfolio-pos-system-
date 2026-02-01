'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  Globe,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  User,
  Lock,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import businessSettingsService, { type BusinessInfo } from '@/lib/services/businessSettingsService';
import { extractErrorMessage } from '@/lib/api';
import { useAdminAuth } from '@/lib/adminAuth';
import apiClient from '@/lib/api';

type SectionKey = 'profile' | 'password' | 'general' | 'contact' | 'address' | 'hours' | 'web';

export default function SettingsPage() {
  const { user } = useAdminAuth();
  const [settings, setSettings] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>('profile');
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<BusinessInfo>>({});

  // Profile state
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password state
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false,
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Initialize profile form
  useEffect(() => {
    if (user) {
      setProfileForm({
        full_name: user.full_name || '',
        email: user.email || '',
      });
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await businessSettingsService.getInfo();
      setSettings(data);
      setFormData(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleChange = (key: keyof BusinessInfo, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSuccess(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const updated = await businessSettingsService.updateInfo(formData);
      setSettings(updated);
      setFormData(updated);
      setHasChanges(false);
      setSuccess('Configuración guardada exitosamente');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Save profile
  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(false);

    try {
      const response = await apiClient.patch(`/users/${user.id}`, {
        full_name: profileForm.full_name || undefined,
        email: profileForm.email,
      });
      // Profile updated successfully
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      setProfileError(extractErrorMessage(err));
    } finally {
      setProfileSaving(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('Las contrasenas no coinciden');
      setPasswordSaving(false);
      return;
    }

    if (passwordForm.new_password.length < 6) {
      setPasswordError('La nueva contrasena debe tener al menos 6 caracteres');
      setPasswordSaving(false);
      return;
    }

    try {
      await apiClient.post('/users/me/change-password', {
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      });
      setPasswordSuccess(true);
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(extractErrorMessage(err));
    } finally {
      setPasswordSaving(false);
    }
  };

  const sections: { key: SectionKey; label: string; icon: typeof Settings; superuserOnly?: boolean }[] = [
    { key: 'profile', label: 'Mi Perfil', icon: User },
    { key: 'password', label: 'Contrasena', icon: Lock },
    { key: 'general', label: 'General', icon: Building2, superuserOnly: true },
    { key: 'contact', label: 'Contacto', icon: Phone, superuserOnly: true },
    { key: 'address', label: 'Ubicacion', icon: MapPin, superuserOnly: true },
    { key: 'hours', label: 'Horarios', icon: Clock, superuserOnly: true },
    { key: 'web', label: 'Web y Redes', icon: Globe, superuserOnly: true },
  ];

  const visibleSections = sections.filter(
    (s) => !s.superuserOnly || user?.is_superuser
  );

  const renderField = (
    label: string,
    key: keyof BusinessInfo,
    placeholder: string,
    type: 'text' | 'url' | 'email' | 'tel' = 'text',
    helpText?: string
  ) => (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={formData[key] || ''}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
      />
      {helpText && <p className="text-xs text-slate-500">{helpText}</p>}
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">Mi Perfil</h3>

            {profileError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4" />
                {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                <CheckCircle className="w-4 h-4" />
                Perfil actualizado exitosamente
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Nombre Completo</label>
                <input
                  type="text"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Tu nombre completo"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Correo Electronico</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50"
              >
                {profileSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Guardar Perfil
              </button>
            </div>
          </div>
        );

      case 'password':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">Cambiar Contrasena</h3>

            {passwordError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4" />
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                <CheckCircle className="w-4 h-4" />
                Contrasena cambiada exitosamente
              </div>
            )}

            <div className="max-w-md space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Contrasena Actual</label>
                <div className="relative">
                  <input
                    type={showPasswords.old ? 'text' : 'password'}
                    value={passwordForm.old_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="Tu contrasena actual"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, old: !showPasswords.old })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPasswords.old ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Nueva Contrasena</label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="Nueva contrasena (min 6 caracteres)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Confirmar Nueva Contrasena</label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="Repite la nueva contrasena"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleChangePassword}
                  disabled={passwordSaving || !passwordForm.old_password || !passwordForm.new_password || !passwordForm.confirm_password}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50"
                >
                  {passwordSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  Cambiar Contrasena
                </button>
              </div>
            </div>
          </div>
        );

      case 'general':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">Información General</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderField('Nombre del Negocio', 'business_name', 'Uniformes Consuelo Rios')}
              {renderField('Nombre Corto', 'business_name_short', 'UCR', 'text', 'Se usa en espacios reducidos')}
              {renderField('Eslogan', 'tagline', 'Sistema de Gestión', 'text', 'Subtítulo o descripción corta')}
            </div>
          </div>
        );

      case 'contact':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">Información de Contacto</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderField('Teléfono Principal', 'phone_main', '+57 300 123 4567', 'tel')}
              {renderField('Teléfono Soporte', 'phone_support', '+57 301 568 7810', 'tel')}
              {renderField('WhatsApp', 'whatsapp_number', '573001234567', 'tel', 'Sin + ni espacios (para links)')}
              {renderField('Email de Contacto', 'email_contact', 'correo@ejemplo.com', 'email', 'Email público')}
              {renderField('Email de Envío', 'email_noreply', 'noreply@ejemplo.com', 'email', 'Para notificaciones')}
            </div>
          </div>
        );

      case 'address':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">Ubicación</h3>
            <div className="grid grid-cols-1 gap-4">
              {renderField('Dirección Línea 1', 'address_line1', 'Calle 56 D #26 BE 04')}
              {renderField('Dirección Línea 2', 'address_line2', 'Barrio, Sector')}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderField('Ciudad', 'city', 'Medellín')}
                {renderField('Departamento', 'state', 'Antioquia')}
                {renderField('País', 'country', 'Colombia')}
              </div>
              {renderField('URL Google Maps', 'maps_url', 'https://google.com/maps/...', 'url', 'Link para abrir en Maps')}
            </div>
          </div>
        );

      case 'hours':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">Horarios de Atención</h3>
            <div className="grid grid-cols-1 gap-4">
              {renderField('Lunes a Viernes', 'hours_weekday', 'Lunes a Viernes: 8:00 AM - 6:00 PM')}
              {renderField('Sábados', 'hours_saturday', 'Sábados: 9:00 AM - 2:00 PM')}
              {renderField('Domingos', 'hours_sunday', 'Domingos: Cerrado')}
            </div>
          </div>
        );

      case 'web':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">Web y Redes Sociales</h3>
            <div className="grid grid-cols-1 gap-4">
              {renderField('Sitio Web', 'website_url', 'https://ejemplo.com', 'url')}
              {renderField('Facebook', 'social_facebook', 'https://facebook.com/...', 'url', 'Dejar vacío si no aplica')}
              {renderField('Instagram', 'social_instagram', 'https://instagram.com/...', 'url', 'Dejar vacío si no aplica')}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-7 h-7 text-brand-500" />
            Configuracion
          </h1>
          <p className="text-slate-600">Administra tu perfil y la configuracion del sistema</p>
        </div>
        {['general', 'contact', 'address', 'hours', 'web'].includes(activeSection) && (
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              hasChanges && !saving
                ? 'bg-brand-500 text-white hover:bg-brand-600'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <nav className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.key;
              return (
                <button
                  key={section.key}
                  onClick={() => setActiveSection(section.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-600 border-l-4 border-brand-500'
                      : 'text-slate-600 hover:bg-slate-50 border-l-4 border-transparent'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{section.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Form Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            {renderSection()}
          </div>
        </div>
      </div>
    </div>
  );
}
