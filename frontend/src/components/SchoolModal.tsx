/**
 * SchoolModal - Modal for creating/editing schools with logo upload, colors and settings
 */
import { useState, useRef, useEffect } from 'react';
import {
  X, Save, Loader2, AlertCircle, Upload,
  Building2, Palette, Settings as SettingsIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { schoolService, type School, type SchoolCreate, type SchoolUpdate, type SchoolSettings } from '../services/schoolService';
import { useConfigStore } from '../stores/configStore';

interface SchoolModalProps {
  isOpen: boolean;
  school: School | null; // null for create, School for edit
  onClose: () => void;
  onSaved: () => void;
}

type TabType = 'general' | 'branding' | 'settings';

const defaultSettings: SchoolSettings = {
  currency: 'COP',
  tax_rate: 19,
  commission_per_garment: 5000,
  allow_credit_sales: true,
  max_credit_days: 30,
};

// Validate Colombian phone number (10 digits starting with 3)
function isValidColombianPhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  return clean === '' || /^3\d{9}$/.test(clean);
}

// Validate hex color
function isValidHexColor(color: string): boolean {
  return color === '' || /^#[0-9A-Fa-f]{6}$/.test(color);
}

export default function SchoolModal({ isOpen, school, onClose, onSaved }: SchoolModalProps) {
  const { apiUrl } = useConfigStore();
  const isEditing = !!school;

  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [settings, setSettings] = useState<SchoolSettings>({ ...defaultSettings });

  // Logo state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (school) {
        setCode(school.code);
        setName(school.name);
        setEmail(school.email || '');
        setPhone(school.phone || '');
        setAddress(school.address || '');
        setPrimaryColor(school.primary_color || '');
        setSecondaryColor(school.secondary_color || '');
        setSettings(school.settings || { ...defaultSettings });
        setLogoPreview(school.logo_url ? `${apiUrl}${school.logo_url}` : null);
      } else {
        setCode('');
        setName('');
        setEmail('');
        setPhone('');
        setAddress('');
        setPrimaryColor('');
        setSecondaryColor('');
        setSettings({ ...defaultSettings });
        setLogoPreview(null);
      }
      setLogoFile(null);
      setLogoRemoved(false);
      setActiveTab('general');
      setError(null);
    }
  }, [isOpen, school, apiUrl]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('El archivo debe ser una imagen');
        return;
      }
      // Validate file size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError('El logo no debe exceder 2MB');
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setLogoRemoved(false);
      setError(null);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoRemoved(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setError(null);

    // Validation
    if (!code.trim() || !name.trim()) {
      setError('El codigo y nombre son requeridos');
      return;
    }

    if (phone && !isValidColombianPhone(phone)) {
      setError('El telefono debe tener 10 digitos y comenzar con 3');
      return;
    }

    if (primaryColor && !isValidHexColor(primaryColor)) {
      setError('El color primario debe ser un color hexadecimal valido (#RRGGBB)');
      return;
    }

    if (secondaryColor && !isValidHexColor(secondaryColor)) {
      setError('El color secundario debe ser un color hexadecimal valido (#RRGGBB)');
      return;
    }

    setSaving(true);

    try {
      let schoolId: string;

      if (isEditing && school) {
        // Update school
        const updateData: SchoolUpdate = {
          name,
          email: email || undefined,
          phone: phone || undefined,
          address: address || undefined,
          primary_color: primaryColor || undefined,
          secondary_color: secondaryColor || undefined,
          settings,
        };
        await schoolService.updateSchool(school.id, updateData);
        schoolId = school.id;
      } else {
        // Create school
        const createData: SchoolCreate = {
          code,
          name,
          email: email || undefined,
          phone: phone || undefined,
          address: address || undefined,
          primary_color: primaryColor || undefined,
          secondary_color: secondaryColor || undefined,
          settings,
        };
        const newSchool = await schoolService.createSchool(createData);
        schoolId = newSchool.id;
      }

      // Handle logo
      if (logoFile) {
        setUploadingLogo(true);
        await schoolService.uploadLogo(schoolId, logoFile);
      } else if (logoRemoved && isEditing && school?.logo_url) {
        await schoolService.deleteLogo(schoolId);
      }

      toast.success(isEditing ? 'Colegio actualizado exitosamente' : 'Colegio creado exitosamente');
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Error al guardar el colegio';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
      setUploadingLogo(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">
            {isEditing ? 'Editar Colegio' : 'Nuevo Colegio'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-4">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'general'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Building2 className="w-4 h-4 inline mr-2" />
            General
          </button>
          <button
            onClick={() => setActiveTab('branding')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'branding'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Palette className="w-4 h-4 inline mr-2" />
            Marca
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'settings'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <SettingsIcon className="w-4 h-4 inline mr-2" />
            Configuracion
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Codigo *</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    disabled={isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                      isEditing ? 'bg-gray-100 text-gray-500' : ''
                    }`}
                    placeholder="COL-001"
                  />
                  {isEditing && (
                    <p className="text-xs text-gray-500 mt-1">El codigo no se puede cambiar</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                      phone && !isValidColombianPhone(phone)
                        ? 'border-red-300'
                        : 'border-gray-300'
                    }`}
                    placeholder="3001234567"
                  />
                  {phone && !isValidColombianPhone(phone) && (
                    <p className="text-xs text-red-500 mt-1">10 digitos, inicia con 3</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Colegio San Jose"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="contacto@colegio.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Direccion</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Calle 123 #45-67"
                />
              </div>
            </div>
          )}

          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Logo del Colegio</label>
                <div className="flex items-start gap-4">
                  {logoPreview ? (
                    <div className="relative">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition"
                    >
                      <Upload className="w-8 h-8 text-gray-400" />
                      <span className="text-sm text-gray-500 mt-2">Subir logo</span>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <div className="text-sm text-gray-500">
                    <p>Formatos: JPG, PNG, WebP</p>
                    <p>Maximo: 2MB</p>
                    {logoPreview && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 text-green-600 hover:text-green-700"
                      >
                        Cambiar imagen
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color Primario</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={primaryColor || '#000000'}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                        primaryColor && !isValidHexColor(primaryColor)
                          ? 'border-red-300'
                          : 'border-gray-300'
                      }`}
                      placeholder="#000000"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color Secundario</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={secondaryColor || '#000000'}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                        secondaryColor && !isValidHexColor(secondaryColor)
                          ? 'border-red-300'
                          : 'border-gray-300'
                      }`}
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              {(primaryColor || secondaryColor || logoPreview) && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Vista previa:</p>
                  <div className="flex items-center gap-3">
                    {logoPreview && (
                      <img src={logoPreview} alt="Logo" className="w-12 h-12 rounded-lg object-cover" />
                    )}
                    <div>
                      <p
                        className="font-semibold"
                        style={{ color: primaryColor || '#1e293b' }}
                      >
                        {name || 'Nombre del Colegio'}
                      </p>
                      <p
                        className="text-sm"
                        style={{ color: secondaryColor || '#64748b' }}
                      >
                        Uniformes escolares
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                  <select
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="COP">COP - Peso Colombiano</option>
                    <option value="USD">USD - Dolar</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tasa de Impuesto (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.tax_rate}
                    onChange={(e) => setSettings({ ...settings, tax_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comision por Prenda</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      min="0"
                      value={settings.commission_per_garment}
                      onChange={(e) => setSettings({ ...settings, commission_per_garment: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dias Max. de Credito</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.max_credit_days}
                    onChange={(e) => setSettings({ ...settings, max_credit_days: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="allow_credit"
                  checked={settings.allow_credit_sales}
                  onChange={(e) => setSettings({ ...settings, allow_credit_sales: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <label htmlFor="allow_credit" className="text-sm text-gray-700">
                  Permitir ventas a credito
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !code.trim() || !name.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {uploadingLogo ? 'Subiendo logo...' : 'Guardando...'}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
