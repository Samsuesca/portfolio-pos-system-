/**
 * Settings Page - Application and school settings
 * Full admin panel for superusers
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import {
  Settings as SettingsIcon, School, User, Bell, Lock, Server,
  CheckCircle, XCircle, X, Plus, Edit2, Users,
  Building2, Loader2, AlertCircle, Eye, EyeOff, Save, Truck, Printer, Mail,
  Store, Phone, MapPin, Clock, Globe, Zap, Hand, Volume2, VolumeX, Wifi, Wallet
} from 'lucide-react';
import PrinterSettingsModal from '../components/PrinterSettingsModal';
import UserManagementPanel from '../components/UserManagementPanel';
import RoleBadge from '../components/RoleBadge';
import SchoolModal from '../components/SchoolModal';
// Note: permissionService and getUserDisplayRole are now used in UserManagementPanel
import { usePrinterStore } from '../stores/printerStore';
import { usePrintQueueStore } from '../stores/printQueueStore';
import { useAuthStore } from '../stores/authStore';
import { useConfigStore } from '../stores/configStore';
import { useBusinessInfoStore } from '../stores/businessInfoStore';
import { SYSTEM_VERSION, APP_VERSION } from '../config/version';
import { ENVIRONMENTS, ENVIRONMENT_LABELS, ENVIRONMENT_DESCRIPTIONS, type EnvironmentKey } from '../config/environments';
import { userService } from '../services/userService';
import { schoolService, type School as SchoolType } from '../services/schoolService';
import { deliveryZoneService, type DeliveryZone, type DeliveryZoneCreate, type DeliveryZoneUpdate } from '../services/deliveryZoneService';
import { businessInfoService, type BusinessInfo, type BusinessInfoUpdate } from '../services/businessInfoService';

type ModalType = 'editProfile' | 'changePassword' | 'changeEmail' | 'manageSchools' | 'createSchool' | 'editSchool' | 'manageDeliveryZones' | 'createDeliveryZone' | 'editDeliveryZone' | 'businessInfo' | null;

type BusinessInfoSection = 'general' | 'contact' | 'address' | 'hours' | 'web';

export default function Settings() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const { apiUrl, setApiUrl, isOnline } = useConfigStore();
  const { info: storedBusinessInfo } = useBusinessInfoStore();
  const { settings: printerSettings, isModalOpen: isPrinterModalOpen, openModal: openPrinterModal, closeModal: closePrinterModal } = usePrinterStore();
  const { settings: printQueueSettings, setSettings: setPrintQueueSettings, isConnected: printQueueConnected } = usePrintQueueStore();
  const [customUrl, setCustomUrl] = useState(apiUrl);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Profile edit state
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || ''
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Email change state
  const [emailForm, setEmailForm] = useState({ new_email: '' });
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_emailSuccess, setEmailSuccess] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Schools management state
  const [schools, setSchools] = useState<SchoolType[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<SchoolType | null>(null);
  const [showSchoolModal, setShowSchoolModal] = useState(false);

  // User Management Panel state
  const [showUserManagementPanel, setShowUserManagementPanel] = useState(false);

  // Delivery zones management state
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  const [zoneForm, setZoneForm] = useState<DeliveryZoneCreate>({
    name: '',
    description: '',
    delivery_fee: 0,
    estimated_days: 1
  });
  const [zoneSaving, setZoneSaving] = useState(false);
  const [zoneError, setZoneError] = useState<string | null>(null);

  // Business Info state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [businessInfoLoading, setBusinessInfoLoading] = useState(false);
  const [businessInfoSaving, setBusinessInfoSaving] = useState(false);
  const [businessInfoError, setBusinessInfoError] = useState<string | null>(null);
  const [businessInfoSuccess, setBusinessInfoSuccess] = useState(false);
  const [businessInfoForm, setBusinessInfoForm] = useState<BusinessInfoUpdate>({});
  const [businessInfoSection, setBusinessInfoSection] = useState<BusinessInfoSection>('general');
  const [businessInfoHasChanges, setBusinessInfoHasChanges] = useState(false);

  // Update profile form when user changes
  useEffect(() => {
    if (user) {
      setProfileForm({
        full_name: user.full_name || '',
        email: user.email || ''
      });
    }
  }, [user]);

  // Load schools when modal opens
  useEffect(() => {
    if (activeModal === 'manageSchools' || activeModal === 'createSchool' || activeModal === 'editSchool') {
      loadSchools();
    }
  }, [activeModal]);


  // Load delivery zones when modal opens
  useEffect(() => {
    if (activeModal === 'manageDeliveryZones' || activeModal === 'createDeliveryZone' || activeModal === 'editDeliveryZone') {
      loadDeliveryZones();
    }
  }, [activeModal]);

  // Load business info when modal opens
  useEffect(() => {
    if (activeModal === 'businessInfo') {
      loadBusinessInfo();
    }
  }, [activeModal]);

  const loadBusinessInfo = async () => {
    setBusinessInfoLoading(true);
    setBusinessInfoError(null);
    try {
      const data = await businessInfoService.getInfo();
      setBusinessInfo(data);
      setBusinessInfoForm(data);
      setBusinessInfoHasChanges(false);
    } catch (err: any) {
      console.error('Error loading business info:', err);
      setBusinessInfoError(err.response?.data?.detail || 'Error al cargar información');
    } finally {
      setBusinessInfoLoading(false);
    }
  };

  const handleBusinessInfoChange = (key: keyof BusinessInfo, value: string) => {
    setBusinessInfoForm(prev => ({ ...prev, [key]: value }));
    setBusinessInfoHasChanges(true);
    setBusinessInfoSuccess(false);
  };

  const handleSaveBusinessInfo = async () => {
    setBusinessInfoSaving(true);
    setBusinessInfoError(null);
    setBusinessInfoSuccess(false);

    try {
      const updated = await businessInfoService.updateInfo(businessInfoForm);
      setBusinessInfo(updated);
      setBusinessInfoForm(updated);
      setBusinessInfoHasChanges(false);
      setBusinessInfoSuccess(true);
      setTimeout(() => setBusinessInfoSuccess(false), 3000);
    } catch (err: any) {
      setBusinessInfoError(err.response?.data?.detail || 'Error al guardar información');
    } finally {
      setBusinessInfoSaving(false);
    }
  };

  const loadSchools = async () => {
    setSchoolsLoading(true);
    try {
      const data = await schoolService.getSchools(false);
      setSchools(data);
    } catch (err: any) {
      console.error('Error loading schools:', err);
    } finally {
      setSchoolsLoading(false);
    }
  };


  const loadDeliveryZones = async () => {
    setZonesLoading(true);
    try {
      const data = await deliveryZoneService.getZones(true);
      setDeliveryZones(data);
    } catch (err: any) {
      console.error('Error loading delivery zones:', err);
    } finally {
      setZonesLoading(false);
    }
  };

  // Profile handlers
  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileLoading(true);
    setProfileError(null);
    setProfileSuccess(false);

    try {
      const updated = await userService.updateProfile(user.id, {
        full_name: profileForm.full_name || undefined,
        email: profileForm.email
      });
      updateUser({ full_name: updated.full_name, email: updated.email });
      setProfileSuccess(true);
      setTimeout(() => {
        setActiveModal(null);
        setProfileSuccess(false);
      }, 1500);
    } catch (err: any) {
      setProfileError(err.response?.data?.detail || 'Error al actualizar perfil');
    } finally {
      setProfileLoading(false);
    }
  };

  // Password handlers
  const handleChangePassword = async () => {
    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('Las contraseñas no coinciden');
      setPasswordLoading(false);
      return;
    }

    if (passwordForm.new_password.length < 6) {
      setPasswordError('La nueva contraseña debe tener al menos 6 caracteres');
      setPasswordLoading(false);
      return;
    }

    try {
      await userService.changePassword({
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password
      });
      setPasswordSuccess(true);
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => {
        setActiveModal(null);
        setPasswordSuccess(false);
      }, 1500);
    } catch (err: any) {
      setPasswordError(err.response?.data?.detail || 'Error al cambiar contraseña');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Email change handlers
  const handleRequestEmailChange = async () => {
    setEmailLoading(true);
    setEmailError(null);
    setEmailSuccess(false);
    setEmailSent(false);

    if (!emailForm.new_email) {
      setEmailError('Ingresa el nuevo correo electronico');
      setEmailLoading(false);
      return;
    }

    if (emailForm.new_email.toLowerCase() === user?.email?.toLowerCase()) {
      setEmailError('El nuevo correo es igual al actual');
      setEmailLoading(false);
      return;
    }

    try {
      await userService.requestEmailChange(emailForm.new_email);
      setEmailSent(true);
      setEmailSuccess(true);
    } catch (err: any) {
      setEmailError(err.response?.data?.detail || 'Error al solicitar cambio de correo');
    } finally {
      setEmailLoading(false);
    }
  };

  // School handlers
  const handleOpenCreateSchool = () => {
    setSelectedSchool(null);
    setShowSchoolModal(true);
  };

  const handleOpenEditSchool = (school: SchoolType) => {
    setSelectedSchool(school);
    setShowSchoolModal(true);
  };

  const handleSchoolModalClose = () => {
    setShowSchoolModal(false);
    setSelectedSchool(null);
  };

  const handleSchoolSaved = () => {
    loadSchools();
  };

  const handleToggleSchoolActive = async (school: SchoolType) => {
    try {
      if (school.is_active) {
        await schoolService.deleteSchool(school.id);
      } else {
        await schoolService.activateSchool(school.id);
      }
      await loadSchools();
    } catch (err: any) {
      console.error('Error toggling school:', err);
    }
  };

  // Delivery zone handlers
  const handleOpenEditZone = (zone: DeliveryZone) => {
    setSelectedZone(zone);
    setZoneForm({
      name: zone.name,
      description: zone.description || '',
      delivery_fee: zone.delivery_fee,
      estimated_days: zone.estimated_days
    });
    setActiveModal('editDeliveryZone');
  };

  const handleSaveZone = async () => {
    setZoneSaving(true);
    setZoneError(null);

    try {
      if (activeModal === 'createDeliveryZone') {
        await deliveryZoneService.createZone(zoneForm);
      } else if (selectedZone) {
        const updateData: DeliveryZoneUpdate = {
          name: zoneForm.name,
          description: zoneForm.description || undefined,
          delivery_fee: zoneForm.delivery_fee,
          estimated_days: zoneForm.estimated_days
        };
        await deliveryZoneService.updateZone(selectedZone.id, updateData);
      }
      await loadDeliveryZones();
      setActiveModal('manageDeliveryZones');
      setZoneForm({ name: '', description: '', delivery_fee: 0, estimated_days: 1 });
      setSelectedZone(null);
    } catch (err: any) {
      setZoneError(err.response?.data?.detail || 'Error al guardar zona');
    } finally {
      setZoneSaving(false);
    }
  };

  const handleToggleZoneActive = async (zone: DeliveryZone) => {
    try {
      if (zone.is_active) {
        await deliveryZoneService.deleteZone(zone.id);
      } else {
        await deliveryZoneService.updateZone(zone.id, { is_active: true });
      }
      await loadDeliveryZones();
    } catch (err: any) {
      console.error('Error toggling zone:', err);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setProfileError(null);
    setPasswordError(null);
    setEmailError(null);
    setZoneError(null);
    setBusinessInfoError(null);
    setProfileSuccess(false);
    setPasswordSuccess(false);
    setEmailSuccess(false);
    setEmailSent(false);
    setBusinessInfoSuccess(false);
    setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
    setEmailForm({ new_email: '' });
    setZoneForm({ name: '', description: '', delivery_fee: 0, estimated_days: 1 });
    setSelectedZone(null);
    setBusinessInfoHasChanges(false);
    setBusinessInfoSection('general');
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Configuración</h1>
        <p className="text-gray-600 mt-1">Administra la configuración del sistema</p>
      </div>

      {/* Server Configuration - Full Width */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Server className="w-5 h-5 text-purple-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-800">Configuración del Servidor</h2>
          </div>
          <div className="flex items-center">
            {isOnline ? (
              <div className="flex items-center text-green-600">
                <CheckCircle className="w-4 h-4 mr-1" />
                <span className="text-sm">Conectado</span>
              </div>
            ) : (
              <div className="flex items-center text-red-600">
                <XCircle className="w-4 h-4 mr-1" />
                <span className="text-sm">Desconectado</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Selecciona el servidor al que deseas conectarte.
          </p>

          {/* Environment Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Entorno</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(Object.keys(ENVIRONMENTS) as EnvironmentKey[]).map((env) => (
                <button
                  key={env}
                  onClick={() => {
                    const url = ENVIRONMENTS[env];
                    setApiUrl(url);
                    setCustomUrl(url);
                  }}
                  className={`p-4 border-2 rounded-lg text-left transition ${
                    apiUrl === ENVIRONMENTS[env]
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="font-semibold text-gray-800 mb-1">{ENVIRONMENT_LABELS[env]}</div>
                  <div className="text-xs text-gray-600">{ENVIRONMENT_DESCRIPTIONS[env]}</div>
                  <div className="text-xs text-gray-500 mt-2 font-mono break-all">{ENVIRONMENTS[env]}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">URL Personalizada</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="http://192.168.1.100:8000"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={() => setApiUrl(customUrl)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
              >
                Aplicar
              </button>
            </div>
          </div>

          {/* Current URL Display */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm font-medium text-gray-700">Servidor Actual:</div>
            <div className="text-sm text-gray-600 font-mono mt-1">{apiUrl}/api/v1</div>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Profile */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center mb-4">
            <User className="w-5 h-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-800">Perfil de Usuario</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-600">Nombre de usuario</label>
              <p className="text-gray-800 font-medium">{user?.username}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Nombre completo</label>
              <p className="text-gray-800 font-medium">{user?.full_name || 'No especificado'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Email</label>
              <p className="text-gray-800 font-medium">{user?.email}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Rol</label>
              <p className="text-gray-800 font-medium mt-1">
                {user?.is_superuser ? (
                  <RoleBadge role="superuser" />
                ) : (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">Usuario regular</span>
                )}
              </p>
            </div>
            <button
              onClick={() => setActiveModal('editProfile')}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Editar Perfil
            </button>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center mb-4">
            <Lock className="w-5 h-5 text-red-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-800">Seguridad</h2>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Cambia tu contrasena o correo electronico.</p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setActiveModal('changePassword')}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center"
              >
                <Lock className="w-4 h-4 mr-2" />
                Cambiar Contrasena
              </button>
              <button
                onClick={() => setActiveModal('changeEmail')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition flex items-center"
              >
                <Mail className="w-4 h-4 mr-2" />
                Cambiar Correo
              </button>
            </div>
          </div>
        </div>

        {/* School Settings (only for superusers) */}
        {user?.is_superuser && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center mb-4">
              <School className="w-5 h-5 text-green-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-800">Colegios</h2>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Gestiona los colegios registrados en el sistema.</p>
              <button
                onClick={() => setActiveModal('manageSchools')}
                className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center"
              >
                <Building2 className="w-4 h-4 mr-2" />
                Administrar Colegios
              </button>
            </div>
          </div>
        )}

        {/* User Management (only for superusers) */}
        {user?.is_superuser && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center mb-4">
              <Users className="w-5 h-5 text-indigo-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-800">Usuarios</h2>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Gestiona los usuarios del sistema y sus permisos por colegio.</p>
              <button
                onClick={() => setShowUserManagementPanel(true)}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center"
              >
                <Users className="w-4 h-4 mr-2" />
                Administrar Usuarios
              </button>
            </div>
          </div>
        )}

        {/* Delivery Zones (only for superusers) */}
        {user?.is_superuser && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center mb-4">
              <Truck className="w-5 h-5 text-blue-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-800">Zonas de Envio</h2>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Configura las zonas de envio y sus costos para pedidos con domicilio.</p>
              <button
                onClick={() => setActiveModal('manageDeliveryZones')}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center"
              >
                <Truck className="w-4 h-4 mr-2" />
                Administrar Zonas
              </button>
            </div>
          </div>
        )}

        {/* Business Info (only for superusers) */}
        {user?.is_superuser && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center mb-4">
              <Store className="w-5 h-5 text-orange-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-800">Informacion del Negocio</h2>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Configura nombre, telefonos, direccion, horarios y datos de contacto del negocio.</p>
              <button
                onClick={() => setActiveModal('businessInfo')}
                className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition flex items-center"
              >
                <Store className="w-4 h-4 mr-2" />
                Editar Informacion
              </button>
            </div>
          </div>
        )}

        {/* Payment Accounts (only for superusers) */}
        {user?.is_superuser && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center mb-4">
              <Wallet className="w-5 h-5 text-violet-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-800">Cuentas de Pago</h2>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Configura las cuentas bancarias, Nequi y QR que se muestran a los clientes en el portal web.</p>
              <button
                onClick={() => navigate('/payment-accounts')}
                className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition flex items-center"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Administrar Cuentas
              </button>
            </div>
          </div>
        )}

        {/* Notifications */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center mb-4">
            <Bell className="w-5 h-5 text-yellow-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-800">Notificaciones</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Stock bajo</span>
              <input type="checkbox" className="w-4 h-4 text-blue-600" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Nuevas ventas</span>
              <input type="checkbox" className="w-4 h-4 text-blue-600" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Encargos listos</span>
              <input type="checkbox" className="w-4 h-4 text-blue-600" defaultChecked />
            </div>
          </div>
        </div>

        {/* Thermal Printer */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center mb-4">
            <Printer className="w-5 h-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-800">Impresora Termica</h2>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Configura la impresora termica para imprimir recibos de ventas y comprobantes de pedidos.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Estado:</span>
              {printerSettings.enabled && printerSettings.portName ? (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Configurada ({printerSettings.portName})
                </span>
              ) : (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                  No configurada
                </span>
              )}
            </div>
            <button
              onClick={openPrinterModal}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center"
            >
              <Printer className="w-4 h-4 mr-2" />
              Configurar Impresora
            </button>
          </div>
        </div>

        {/* Print Queue Sync - Only show if printer is configured */}
        {printerSettings.enabled && printerSettings.portName && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center mb-4">
              <Wifi className="w-5 h-5 text-teal-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-800">Sincronizacion de Caja</h2>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Recibe e imprime automaticamente las ventas en efectivo realizadas desde otros dispositivos (admin portal, celulares, otros PCs).
              </p>

              {/* Connection Status */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Estado:</span>
                {printQueueConnected ? (
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Conectado (SSE)
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    Desconectado
                  </span>
                )}
              </div>

              {/* Auto/Manual Mode Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  {printQueueSettings.autoMode ? (
                    <Zap className="w-5 h-5 text-teal-600" />
                  ) : (
                    <Hand className="w-5 h-5 text-gray-500" />
                  )}
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      {printQueueSettings.autoMode ? 'Modo Automatico' : 'Modo Manual'}
                    </span>
                    <p className="text-xs text-gray-500">
                      {printQueueSettings.autoMode
                        ? 'Imprime automaticamente al recibir venta'
                        : 'Muestra notificacion para imprimir manualmente'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPrintQueueSettings({ autoMode: !printQueueSettings.autoMode })}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    printQueueSettings.autoMode ? 'bg-teal-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      printQueueSettings.autoMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Auto Open Drawer (only visible in auto mode) */}
              {printQueueSettings.autoMode && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Abrir cajon automaticamente</span>
                    <p className="text-xs text-gray-500">Abre el cajon de dinero con cada impresion</p>
                  </div>
                  <button
                    onClick={() => setPrintQueueSettings({ autoOpenDrawer: !printQueueSettings.autoOpenDrawer })}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      printQueueSettings.autoOpenDrawer ? 'bg-teal-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        printQueueSettings.autoOpenDrawer ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Sound Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  {printQueueSettings.soundEnabled ? (
                    <Volume2 className="w-5 h-5 text-blue-600" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <span className="text-sm font-medium text-gray-700">Sonido de notificacion</span>
                    <p className="text-xs text-gray-500">Reproduce un sonido al recibir nueva venta</p>
                  </div>
                </div>
                <button
                  onClick={() => setPrintQueueSettings({ soundEnabled: !printQueueSettings.soundEnabled })}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    printQueueSettings.soundEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      printQueueSettings.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Info box */}
              <div className="p-3 bg-teal-50 rounded-lg border border-teal-100">
                <p className="text-xs text-teal-700">
                  <strong>Tip:</strong> Abre el panel de cola de impresion desde el icono{' '}
                  <Printer className="w-3 h-3 inline" /> en la barra superior para ver las ventas pendientes y controlar la impresion manualmente.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* System Info Card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 mt-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <img src="/icon.png" alt="Logo" className="h-14 w-14 object-contain" />
            <div>
              <h3 className="text-xl font-bold">
                {storedBusinessInfo.business_name || 'Sistema de Gestión'}
              </h3>
              {storedBusinessInfo.tagline && (
                <p className="text-slate-400 text-sm">{storedBusinessInfo.tagline}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="px-3 py-1 bg-brand-600 rounded-full text-xs font-semibold">
              v{SYSTEM_VERSION}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Connection Status */}
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300">Servidor</span>
            </div>
            <p className="font-mono text-sm truncate" title={apiUrl}>{apiUrl}</p>
            <div className="flex items-center gap-1.5 mt-2">
              {isOnline ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-green-400">Conectado</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-xs text-red-400">Sin conexión</span>
                </>
              )}
            </div>
          </div>

          {/* User Info */}
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300">Usuario</span>
            </div>
            <p className="font-medium">{user?.full_name || user?.username}</p>
            <div className="flex items-center gap-2 mt-2">
              {user?.is_superuser ? (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs font-medium">
                  Superusuario
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-slate-500/30 text-slate-300 rounded text-xs">
                  Usuario
                </span>
              )}
            </div>
          </div>

          {/* App Version */}
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <SettingsIcon className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300">Versión</span>
            </div>
            <p className="font-medium">Sistema v{SYSTEM_VERSION}</p>
            <p className="text-xs text-slate-400 mt-1">App v{APP_VERSION}</p>
          </div>
        </div>
      </div>

      {/* ========== MODALS ========== */}

      {/* Edit Profile Modal */}
      {activeModal === 'editProfile' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Editar Perfil</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {profileError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Perfil actualizado correctamente
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de usuario</label>
                <input
                  type="text"
                  value={user?.username || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">El nombre de usuario no se puede cambiar</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                <input
                  type="text"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Tu nombre completo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="tu@email.com"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={closeModal} className="px-4 py-2 text-gray-600 hover:text-gray-800 transition">
                Cancelar
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={profileLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center disabled:opacity-50"
              >
                {profileLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {activeModal === 'changePassword' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Cambiar Contraseña</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Contraseña cambiada correctamente
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordForm.old_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={closeModal} className="px-4 py-2 text-gray-600 hover:text-gray-800 transition">
                Cancelar
              </button>
              <button
                onClick={handleChangePassword}
                disabled={passwordLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center disabled:opacity-50"
              >
                {passwordLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                Cambiar Contraseña
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Email Modal */}
      {activeModal === 'changeEmail' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Cambiar Correo Electronico</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {emailError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {emailError}
                </div>
              )}
              {emailSent ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-green-600" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Correo de verificacion enviado</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Hemos enviado un enlace de verificacion a:
                  </p>
                  <p className="font-medium text-gray-900 mb-4">{emailForm.new_email}</p>
                  <p className="text-xs text-gray-500">
                    Revisa tu bandeja de entrada (y spam) y haz clic en el enlace para confirmar tu nuevo correo.
                    El enlace expira en 24 horas.
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                    <div className="flex items-start">
                      <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Verificacion requerida</p>
                        <p className="mt-1">Se enviara un enlace de verificacion al nuevo correo. Debes hacer clic en el enlace para completar el cambio.</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Correo actual</label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo correo electronico</label>
                    <input
                      type="email"
                      value={emailForm.new_email}
                      onChange={(e) => setEmailForm({ new_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder="nuevo@email.com"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={closeModal} className="px-4 py-2 text-gray-600 hover:text-gray-800 transition">
                {emailSent ? 'Cerrar' : 'Cancelar'}
              </button>
              {!emailSent && (
                <button
                  onClick={handleRequestEmailChange}
                  disabled={emailLoading || !emailForm.new_email}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition flex items-center disabled:opacity-50"
                >
                  {emailLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Enviar Verificacion
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manage Schools Modal */}
      {activeModal === 'manageSchools' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Administrar Colegios</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenCreateSchool}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Nuevo
                </button>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {schoolsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                  <span className="ml-2 text-gray-600">Cargando colegios...</span>
                </div>
              ) : schools.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No hay colegios registrados</div>
              ) : (
                <div className="space-y-3">
                  {schools.map((school) => (
                    <div key={school.id} className={`p-4 border rounded-lg ${school.is_active ? 'bg-white' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Logo */}
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {school.logo_url ? (
                              <img
                                src={`${apiUrl}${school.logo_url}`}
                                alt={school.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <School className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              {school.primary_color && (
                                <div
                                  className="w-3 h-3 rounded-full border border-gray-200"
                                  style={{ backgroundColor: school.primary_color }}
                                />
                              )}
                              <span className="font-medium text-gray-800">{school.name}</span>
                              <span className="text-xs text-gray-500 font-mono">{school.code}</span>
                              {!school.is_active && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">Inactivo</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {school.email && <span>{school.email}</span>}
                              {school.phone && <span className="ml-3">{school.phone}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditSchool(school)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleSchoolActive(school)}
                            className={`p-2 rounded-lg transition ${
                              school.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={school.is_active ? 'Desactivar' : 'Activar'}
                          >
                            {school.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* School Modal (Create/Edit) */}
      <SchoolModal
        isOpen={showSchoolModal}
        school={selectedSchool}
        onClose={handleSchoolModalClose}
        onSaved={handleSchoolSaved}
      />

      {/* Manage Delivery Zones Modal */}
      {activeModal === 'manageDeliveryZones' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Administrar Zonas de Envio</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setZoneForm({ name: '', description: '', delivery_fee: 0, estimated_days: 1 });
                    setActiveModal('createDeliveryZone');
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Nueva Zona
                </button>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {zonesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Cargando zonas...</span>
                </div>
              ) : deliveryZones.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No hay zonas de envio registradas</div>
              ) : (
                <div className="space-y-3">
                  {deliveryZones.map((zone) => (
                    <div key={zone.id} className={`p-4 border rounded-lg ${zone.is_active ? 'bg-white' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Truck className="w-5 h-5 text-blue-500" />
                            <span className="font-medium text-gray-800">{zone.name}</span>
                            {!zone.is_active && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">Inactiva</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1 ml-7">
                            {zone.description && <span>{zone.description}</span>}
                          </div>
                          <div className="flex items-center gap-4 mt-2 ml-7">
                            <span className="text-sm font-medium text-green-600">
                              ${zone.delivery_fee.toLocaleString()}
                            </span>
                            <span className="text-sm text-gray-500">
                              {zone.estimated_days} dia{zone.estimated_days > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditZone(zone)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleZoneActive(zone)}
                            className={`p-2 rounded-lg transition ${
                              zone.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={zone.is_active ? 'Desactivar' : 'Activar'}
                          >
                            {zone.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Delivery Zone Modal */}
      {(activeModal === 'createDeliveryZone' || activeModal === 'editDeliveryZone') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {activeModal === 'createDeliveryZone' ? 'Nueva Zona de Envio' : 'Editar Zona de Envio'}
              </h3>
              <button onClick={() => setActiveModal('manageDeliveryZones')} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {zoneError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {zoneError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: Zona Norte"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <textarea
                  value={zoneForm.description}
                  onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Ej: Barrios incluidos en esta zona"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Costo de Envio *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    min="0"
                    value={zoneForm.delivery_fee || ''}
                    onChange={(e) => setZoneForm({ ...zoneForm, delivery_fee: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="8000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dias Estimados *</label>
                <input
                  type="number"
                  min="1"
                  value={zoneForm.estimated_days || ''}
                  onChange={(e) => setZoneForm({ ...zoneForm, estimated_days: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setActiveModal('manageDeliveryZones')} className="px-4 py-2 text-gray-600 hover:text-gray-800 transition">
                Cancelar
              </button>
              <button
                onClick={handleSaveZone}
                disabled={zoneSaving || !zoneForm.name || zoneForm.delivery_fee < 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center disabled:opacity-50"
              >
                {zoneSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Business Info Modal */}
      {activeModal === 'businessInfo' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">Informacion del Negocio</h3>
                <p className="text-sm text-gray-500">Configura los datos que se muestran en toda la plataforma</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveBusinessInfo}
                  disabled={!businessInfoHasChanges || businessInfoSaving}
                  className={`px-4 py-2 rounded-lg font-medium transition flex items-center ${
                    businessInfoHasChanges && !businessInfoSaving
                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {businessInfoSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {businessInfoSaving ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Alerts */}
            {businessInfoError && (
              <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                {businessInfoError}
              </div>
            )}
            {businessInfoSuccess && (
              <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700 text-sm">
                <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                Informacion guardada correctamente
              </div>
            )}

            <div className="flex-1 overflow-hidden flex">
              {/* Sidebar */}
              <div className="w-48 border-r bg-gray-50 py-2">
                {[
                  { key: 'general' as BusinessInfoSection, label: 'General', icon: Store },
                  { key: 'contact' as BusinessInfoSection, label: 'Contacto', icon: Phone },
                  { key: 'address' as BusinessInfoSection, label: 'Ubicacion', icon: MapPin },
                  { key: 'hours' as BusinessInfoSection, label: 'Horarios', icon: Clock },
                  { key: 'web' as BusinessInfoSection, label: 'Web y Redes', icon: Globe },
                ].map((section) => {
                  const Icon = section.icon;
                  const isActive = businessInfoSection === section.key;
                  return (
                    <button
                      key={section.key}
                      onClick={() => setBusinessInfoSection(section.key)}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm transition ${
                        isActive
                          ? 'bg-orange-50 text-orange-700 border-l-4 border-orange-500'
                          : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {section.label}
                    </button>
                  );
                })}
              </div>

              {/* Form Content */}
              <div className="flex-1 p-6 overflow-y-auto">
                {businessInfoLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                  </div>
                ) : (
                  <>
                    {/* General Section */}
                    {businessInfoSection === 'general' && (
                      <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-gray-800 mb-4">Informacion General</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2 sm:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Negocio</label>
                            <input
                              type="text"
                              value={businessInfoForm.business_name || ''}
                              onChange={(e) => handleBusinessInfoChange('business_name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="Uniformes Consuelo Rios"
                            />
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Corto</label>
                            <input
                              type="text"
                              value={businessInfoForm.business_name_short || ''}
                              onChange={(e) => handleBusinessInfoChange('business_name_short', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="UCR"
                            />
                            <p className="text-xs text-gray-500 mt-1">Se usa en espacios reducidos</p>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Eslogan</label>
                            <input
                              type="text"
                              value={businessInfoForm.tagline || ''}
                              onChange={(e) => handleBusinessInfoChange('tagline', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="Sistema de Gestión"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Contact Section */}
                    {businessInfoSection === 'contact' && (
                      <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-gray-800 mb-4">Informacion de Contacto</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Telefono Principal</label>
                            <input
                              type="tel"
                              value={businessInfoForm.phone_main || ''}
                              onChange={(e) => handleBusinessInfoChange('phone_main', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="+57 300 123 4567"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Telefono Soporte</label>
                            <input
                              type="tel"
                              value={businessInfoForm.phone_support || ''}
                              onChange={(e) => handleBusinessInfoChange('phone_support', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="+57 301 568 7810"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                            <input
                              type="tel"
                              value={businessInfoForm.whatsapp_number || ''}
                              onChange={(e) => handleBusinessInfoChange('whatsapp_number', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="573001234567"
                            />
                            <p className="text-xs text-gray-500 mt-1">Sin + ni espacios (para links de WhatsApp)</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email de Contacto</label>
                            <input
                              type="email"
                              value={businessInfoForm.email_contact || ''}
                              onChange={(e) => handleBusinessInfoChange('email_contact', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="correo@ejemplo.com"
                            />
                            <p className="text-xs text-gray-500 mt-1">Email publico</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email de Envio</label>
                            <input
                              type="email"
                              value={businessInfoForm.email_noreply || ''}
                              onChange={(e) => handleBusinessInfoChange('email_noreply', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="noreply@ejemplo.com"
                            />
                            <p className="text-xs text-gray-500 mt-1">Para notificaciones</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Address Section */}
                    {businessInfoSection === 'address' && (
                      <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-gray-800 mb-4">Ubicacion</h4>
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Direccion Linea 1</label>
                            <input
                              type="text"
                              value={businessInfoForm.address_line1 || ''}
                              onChange={(e) => handleBusinessInfoChange('address_line1', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="Calle 56 D #26 BE 04"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Direccion Linea 2</label>
                            <input
                              type="text"
                              value={businessInfoForm.address_line2 || ''}
                              onChange={(e) => handleBusinessInfoChange('address_line2', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="Barrio, Sector"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                              <input
                                type="text"
                                value={businessInfoForm.city || ''}
                                onChange={(e) => handleBusinessInfoChange('city', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                placeholder="Medellín"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                              <input
                                type="text"
                                value={businessInfoForm.state || ''}
                                onChange={(e) => handleBusinessInfoChange('state', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                placeholder="Antioquia"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Pais</label>
                              <input
                                type="text"
                                value={businessInfoForm.country || ''}
                                onChange={(e) => handleBusinessInfoChange('country', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                placeholder="Colombia"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">URL Google Maps</label>
                            <input
                              type="url"
                              value={businessInfoForm.maps_url || ''}
                              onChange={(e) => handleBusinessInfoChange('maps_url', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="https://google.com/maps/..."
                            />
                            <p className="text-xs text-gray-500 mt-1">Link para abrir en Maps</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Hours Section */}
                    {businessInfoSection === 'hours' && (
                      <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-gray-800 mb-4">Horarios de Atencion</h4>
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Lunes a Viernes</label>
                            <input
                              type="text"
                              value={businessInfoForm.hours_weekday || ''}
                              onChange={(e) => handleBusinessInfoChange('hours_weekday', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="Lunes a Viernes: 8:00 AM - 6:00 PM"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sabados</label>
                            <input
                              type="text"
                              value={businessInfoForm.hours_saturday || ''}
                              onChange={(e) => handleBusinessInfoChange('hours_saturday', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="Sábados: 9:00 AM - 2:00 PM"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Domingos</label>
                            <input
                              type="text"
                              value={businessInfoForm.hours_sunday || ''}
                              onChange={(e) => handleBusinessInfoChange('hours_sunday', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="Domingos: Cerrado"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Web Section */}
                    {businessInfoSection === 'web' && (
                      <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-gray-800 mb-4">Web y Redes Sociales</h4>
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sitio Web</label>
                            <input
                              type="url"
                              value={businessInfoForm.website_url || ''}
                              onChange={(e) => handleBusinessInfoChange('website_url', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="https://ejemplo.com"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
                            <input
                              type="url"
                              value={businessInfoForm.social_facebook || ''}
                              onChange={(e) => handleBusinessInfoChange('social_facebook', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="https://facebook.com/..."
                            />
                            <p className="text-xs text-gray-500 mt-1">Dejar vacio si no aplica</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                            <input
                              type="url"
                              value={businessInfoForm.social_instagram || ''}
                              onChange={(e) => handleBusinessInfoChange('social_instagram', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="https://instagram.com/..."
                            />
                            <p className="text-xs text-gray-500 mt-1">Dejar vacio si no aplica</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Management Panel */}
      <UserManagementPanel
        isOpen={showUserManagementPanel}
        onClose={() => setShowUserManagementPanel(false)}
      />

      {/* Printer Settings Modal */}
      <PrinterSettingsModal
        isOpen={isPrinterModalOpen}
        onClose={closePrinterModal}
      />
    </Layout>
  );
}
