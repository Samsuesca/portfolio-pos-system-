'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  School as SchoolIcon,
  AlertCircle,
  Upload,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

// Validate Colombian phone number (10 digits starting with 3)
function isValidColombianPhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  return /^3\d{9}$/.test(clean);
}

// Validate hex color
function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

import schoolService from '@/lib/services/schoolService';
import type { School, SchoolSettings } from '@/lib/api';

interface FormData {
  code: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  primary_color: string;
  secondary_color: string;
  settings: SchoolSettings;
}

const defaultSettings: SchoolSettings = {
  currency: 'COP',
  tax_rate: 19,
  commission_per_garment: 5000,
  allow_credit_sales: true,
  max_credit_days: 30,
};

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [formData, setFormData] = useState<FormData>({
    code: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    primary_color: '',
    secondary_color: '',
    settings: { ...defaultSettings },
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'branding' | 'settings'>('general');

  // Logo upload states
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSchools = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await schoolService.list({ include_inactive: true });
      setSchools(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al cargar colegios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  const filteredSchools = schools.filter((school) => {
    const matchesSearch =
      school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      school.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesActive = showInactive || school.is_active;
    return matchesSearch && matchesActive;
  });

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      email: '',
      phone: '',
      address: '',
      primary_color: '',
      secondary_color: '',
      settings: { ...defaultSettings },
    });
    setLogoFile(null);
    setLogoPreview(null);
    setActiveTab('general');
  };

  const openCreateModal = () => {
    setEditingSchool(null);
    resetForm();
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (school: School) => {
    setEditingSchool(school);
    setFormData({
      code: school.code,
      name: school.name,
      email: school.email || '',
      phone: school.phone || '',
      address: school.address || '',
      primary_color: school.primary_color || '',
      secondary_color: school.secondary_color || '',
      settings: school.settings || { ...defaultSettings },
    });
    setLogoFile(null);
    setLogoPreview(school.logo_url ? `${API_BASE_URL}${school.logo_url}` : null);
    setActiveTab('general');
    setFormError(null);
    setShowModal(true);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setFormError('El archivo debe ser una imagen');
        return;
      }
      // Validate file size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        setFormError('El logo no debe exceder 2MB');
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setFormError(null);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      // Prepare data
      const submitData: any = {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        primary_color: formData.primary_color || undefined,
        secondary_color: formData.secondary_color || undefined,
        settings: formData.settings,
      };

      let schoolId: string;

      if (editingSchool) {
        await schoolService.update(editingSchool.id, submitData);
        schoolId = editingSchool.id;
      } else {
        submitData.code = formData.code;
        const newSchool = await schoolService.create(submitData);
        schoolId = newSchool.id;
      }

      // Upload logo if selected
      if (logoFile) {
        setUploadingLogo(true);
        await schoolService.uploadLogo(schoolId, logoFile);
      } else if (editingSchool && !logoPreview && editingSchool.logo_url) {
        // Logo was removed
        await schoolService.deleteLogo(schoolId);
      }

      setShowModal(false);
      loadSchools();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
      setUploadingLogo(false);
    }
  };

  const handleToggleActive = async (school: School) => {
    try {
      if (school.is_active) {
        await schoolService.deactivate(school.id);
      } else {
        await schoolService.activate(school.id);
      }
      loadSchools();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al cambiar estado');
    }
  };

  const getLogoUrl = (school: School) => {
    if (!school.logo_url) return null;
    return `${API_BASE_URL}${school.logo_url}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            Colegios
          </h1>
          <p className="text-slate-600 mt-1">
            Gestiona los colegios registrados en el sistema
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Nuevo Colegio
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="admin-input pl-10"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
          />
          <span className="text-sm text-slate-600">Mostrar inactivos</span>
        </label>
        <button
          onClick={loadSchools}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Logo</th>
                <th>Código</th>
                <th>Nombre</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-brand-500"></div>
                  </td>
                </tr>
              ) : filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    <SchoolIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                    No se encontraron colegios
                  </td>
                </tr>
              ) : (
                filteredSchools.map((school) => (
                  <tr key={school.id}>
                    <td>
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                        {school.logo_url ? (
                          <img
                            src={getLogoUrl(school)!}
                            alt={school.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <SchoolIcon className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </td>
                    <td className="font-mono text-sm">{school.code}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        {school.primary_color && (
                          <div
                            className="w-3 h-3 rounded-full border border-slate-200"
                            style={{ backgroundColor: school.primary_color }}
                            title={`Color primario: ${school.primary_color}`}
                          />
                        )}
                        <span className="font-medium">{school.name}</span>
                      </div>
                    </td>
                    <td className="text-slate-600">{school.email || '-'}</td>
                    <td className="text-slate-600">{school.phone || '-'}</td>
                    <td>
                      <span
                        className={`badge ${
                          school.is_active ? 'badge-success' : 'badge-error'
                        }`}
                      >
                        {school.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(school)}
                          className="p-2 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(school)}
                          className={`p-2 rounded-lg transition-colors ${
                            school.is_active
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={school.is_active ? 'Desactivar' : 'Activar'}
                        >
                          {school.is_active ? (
                            <PowerOff className="w-4 h-4" />
                          ) : (
                            <Power className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-xl flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                {editingSchool ? 'Editar Colegio' : 'Nuevo Colegio'}
              </h2>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 px-6">
              <button
                onClick={() => setActiveTab('general')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'general'
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                General
              </button>
              <button
                onClick={() => setActiveTab('branding')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'branding'
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Marca
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'settings'
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Configuración
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                {/* General Tab */}
                {activeTab === 'general' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="admin-label">Código *</label>
                        <input
                          type="text"
                          value={formData.code}
                          onChange={(e) =>
                            setFormData({ ...formData, code: e.target.value.toUpperCase() })
                          }
                          className="admin-input"
                          required
                          disabled={!!editingSchool}
                          placeholder="CODIGO"
                        />
                        {editingSchool && (
                          <p className="text-xs text-slate-500 mt-1">El código no se puede cambiar</p>
                        )}
                      </div>
                      <div>
                        <label className="admin-label">Teléfono</label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
                          }
                          className={`admin-input ${
                            formData.phone && !isValidColombianPhone(formData.phone)
                              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                              : ''
                          }`}
                          placeholder="3001234567"
                        />
                        {formData.phone && !isValidColombianPhone(formData.phone) && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            10 dígitos, inicia con 3
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="admin-label">Nombre *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="admin-input"
                        required
                        placeholder="Nombre del colegio"
                      />
                    </div>

                    <div>
                      <label className="admin-label">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        className="admin-input"
                        placeholder="colegio@email.com"
                      />
                    </div>

                    <div>
                      <label className="admin-label">Dirección</label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                        className="admin-input"
                        placeholder="Dirección física"
                      />
                    </div>
                  </>
                )}

                {/* Branding Tab */}
                {activeTab === 'branding' && (
                  <>
                    {/* Logo Upload */}
                    <div>
                      <label className="admin-label">Logo del Colegio</label>
                      <div className="mt-2">
                        {logoPreview ? (
                          <div className="relative inline-block">
                            <img
                              src={logoPreview}
                              alt="Logo preview"
                              className="w-32 h-32 object-cover rounded-xl border border-slate-200"
                            />
                            <button
                              type="button"
                              onClick={handleRemoveLogo}
                              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-32 h-32 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors"
                          >
                            <Upload className="w-8 h-8 text-slate-400" />
                            <span className="text-sm text-slate-500 mt-2">Subir logo</span>
                          </div>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleLogoChange}
                          className="hidden"
                        />
                        <p className="text-xs text-slate-500 mt-2">
                          JPG, PNG o WebP. Máximo 2MB.
                        </p>
                      </div>
                    </div>

                    {/* Colors */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="admin-label">Color Primario</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={formData.primary_color || '#000000'}
                            onChange={(e) =>
                              setFormData({ ...formData, primary_color: e.target.value })
                            }
                            className="w-12 h-10 rounded border border-slate-300 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={formData.primary_color}
                            onChange={(e) =>
                              setFormData({ ...formData, primary_color: e.target.value })
                            }
                            className={`admin-input flex-1 ${
                              formData.primary_color && !isValidHexColor(formData.primary_color)
                                ? 'border-red-300'
                                : ''
                            }`}
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="admin-label">Color Secundario</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={formData.secondary_color || '#000000'}
                            onChange={(e) =>
                              setFormData({ ...formData, secondary_color: e.target.value })
                            }
                            className="w-12 h-10 rounded border border-slate-300 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={formData.secondary_color}
                            onChange={(e) =>
                              setFormData({ ...formData, secondary_color: e.target.value })
                            }
                            className={`admin-input flex-1 ${
                              formData.secondary_color && !isValidHexColor(formData.secondary_color)
                                ? 'border-red-300'
                                : ''
                            }`}
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Preview */}
                    {(formData.primary_color || formData.secondary_color) && (
                      <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                        <p className="text-sm text-slate-600 mb-2">Vista previa:</p>
                        <div className="flex items-center gap-3">
                          {logoPreview && (
                            <img src={logoPreview} alt="Logo" className="w-12 h-12 rounded-lg object-cover" />
                          )}
                          <div>
                            <p
                              className="font-semibold"
                              style={{ color: formData.primary_color || '#1e293b' }}
                            >
                              {formData.name || 'Nombre del Colegio'}
                            </p>
                            <p
                              className="text-sm"
                              style={{ color: formData.secondary_color || '#64748b' }}
                            >
                              Uniformes escolares
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="admin-label">Moneda</label>
                        <select
                          value={formData.settings.currency}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              settings: { ...formData.settings, currency: e.target.value },
                            })
                          }
                          className="admin-input"
                        >
                          <option value="COP">COP - Peso Colombiano</option>
                          <option value="USD">USD - Dólar</option>
                        </select>
                      </div>
                      <div>
                        <label className="admin-label">Tasa de Impuesto (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formData.settings.tax_rate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              settings: { ...formData.settings, tax_rate: parseFloat(e.target.value) || 0 },
                            })
                          }
                          className="admin-input"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="admin-label">Comisión por Prenda</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.settings.commission_per_garment}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              settings: {
                                ...formData.settings,
                                commission_per_garment: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                          className="admin-input"
                        />
                      </div>
                      <div>
                        <label className="admin-label">Días Máximos de Crédito</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.settings.max_credit_days}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              settings: {
                                ...formData.settings,
                                max_credit_days: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                          className="admin-input"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="allow_credit"
                        checked={formData.settings.allow_credit_sales}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            settings: { ...formData.settings, allow_credit_sales: e.target.checked },
                          })
                        }
                        className="w-4 h-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                      />
                      <label htmlFor="allow_credit" className="text-sm text-slate-700">
                        Permitir ventas a crédito
                      </label>
                    </div>
                  </>
                )}

                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {formError}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-200 bg-slate-50">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary flex-1"
                  >
                    {saving
                      ? uploadingLogo
                        ? 'Subiendo logo...'
                        : 'Guardando...'
                      : editingSchool
                      ? 'Guardar Cambios'
                      : 'Crear Colegio'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
