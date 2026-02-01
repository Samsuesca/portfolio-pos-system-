'use client';

/**
 * GarmentType Modal - Create/Edit Garment Type Form
 * Handles both school-specific and global garment types
 * Access: Admin (school) or Superuser (global)
 * Note: Simplified version without image gallery
 */
import { useState, useEffect } from 'react';
import { X, Loader2, Tag, Globe, Building2 } from 'lucide-react';
import productService from '@/lib/services/productService';
import type { GarmentType, GlobalGarmentType } from '@/lib/api';

// Helper to extract error message from API responses (handles Pydantic validation errors)
function getErrorMessage(err: unknown, defaultMsg: string): string {
  if (!err || typeof err !== 'object') return defaultMsg;
  const axiosErr = err as { response?: { data?: { detail?: unknown } } };
  const detail = axiosErr.response?.data?.detail;
  if (!detail) return defaultMsg;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((e: { msg?: string }) => e.msg || 'Error de validación').join(', ');
  }
  return defaultMsg;
}

interface GarmentTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  garmentType?: GarmentType | GlobalGarmentType | null;
  isGlobal: boolean;
  schoolId?: string;
}

export default function GarmentTypeModal({
  isOpen,
  onClose,
  onSuccess,
  garmentType,
  isGlobal,
  schoolId,
}: GarmentTypeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '' as '' | 'uniforme_diario' | 'uniforme_deportivo' | 'accesorios',
    requires_embroidery: false,
    has_custom_measurements: false,
    is_active: true,
  });

  useEffect(() => {
    if (isOpen) {
      if (garmentType) {
        // Edit mode
        setFormData({
          name: garmentType.name || '',
          description: garmentType.description || '',
          category: garmentType.category || '',
          requires_embroidery: garmentType.requires_embroidery || false,
          has_custom_measurements: garmentType.has_custom_measurements || false,
          is_active: garmentType.is_active ?? true,
        });
      } else {
        // Create mode - reset form
        setFormData({
          name: '',
          description: '',
          category: '',
          requires_embroidery: false,
          has_custom_measurements: false,
          is_active: true,
        });
      }
      setError(null);
    }
  }, [isOpen, garmentType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (formData.name.trim().length < 3) {
      setError('El nombre debe tener al menos 3 caracteres');
      setLoading(false);
      return;
    }

    try {
      const data: any = {
        name: formData.name.trim(),
      };

      // Optional fields
      if (formData.description.trim()) data.description = formData.description.trim();
      if (formData.category) data.category = formData.category;
      data.requires_embroidery = formData.requires_embroidery;
      data.has_custom_measurements = formData.has_custom_measurements;
      if (garmentType) data.is_active = formData.is_active;

      if (isGlobal) {
        // Global garment type
        if (garmentType) {
          await productService.updateGlobalGarmentType(garmentType.id, data);
        } else {
          await productService.createGlobalGarmentType(data);
        }
      } else {
        // School-specific garment type
        if (!schoolId) {
          throw new Error('School ID is required for school-specific garment types');
        }

        if (garmentType) {
          await productService.updateGarmentType(schoolId, garmentType.id, data);
        } else {
          await productService.createGarmentType(schoolId, data);
        }
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error saving garment type:', err);
      setError(getErrorMessage(err, 'Error al guardar tipo de prenda'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (!isOpen) return null;

  const categoryLabels: Record<string, string> = {
    uniforme_diario: 'Uniforme Diario',
    uniforme_deportivo: 'Uniforme Deportivo',
    accesorios: 'Accesorios',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full">
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${isGlobal ? 'border-purple-200 bg-purple-50' : 'border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isGlobal ? 'bg-purple-100' : 'bg-blue-100'}`}>
                <Tag className={`w-5 h-5 ${isGlobal ? 'text-purple-600' : 'text-blue-600'}`} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">
                  {garmentType ? 'Editar Tipo de Prenda' : 'Nuevo Tipo de Prenda'}
                </h2>
                <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                  {isGlobal ? (
                    <>
                      <Globe className="w-3 h-3" />
                      Tipo Global
                    </>
                  ) : (
                    <>
                      <Building2 className="w-3 h-3" />
                      Tipo del Colegio
                    </>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                minLength={3}
                maxLength={100}
                placeholder="Ej: Camisa, Pantalon, Zapatos"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Entre 3 y 100 caracteres
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Descripcion
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                placeholder="Descripcion opcional del tipo de prenda"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Categoria
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Sin categoria</option>
                <option value="uniforme_diario">Uniforme Diario</option>
                <option value="uniforme_deportivo">Uniforme Deportivo</option>
                <option value="accesorios">Accesorios</option>
              </select>
            </div>

            {/* Boolean Flags */}
            <div className="space-y-3">
              {/* Requires Embroidery */}
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={formData.requires_embroidery}
                  onChange={(e) => setFormData({ ...formData, requires_embroidery: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700">
                    Requiere bordado
                  </span>
                  <p className="text-xs text-slate-500">
                    Los productos de este tipo necesitan personalizacion
                  </p>
                </div>
              </label>

              {/* Has Custom Measurements */}
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={formData.has_custom_measurements}
                  onChange={(e) => setFormData({ ...formData, has_custom_measurements: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700">
                    Medidas personalizadas
                  </span>
                  <p className="text-xs text-slate-500">
                    Requiere medidas especificas del cliente (ej: Yomber)
                  </p>
                </div>
              </label>
            </div>

            {/* Active Status - Only show when editing */}
            {garmentType && (
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700">
                    {formData.is_active ? 'Tipo Activo' : 'Tipo Inactivo'}
                  </span>
                  <p className="text-xs text-slate-500">
                    {formData.is_active
                      ? 'Visible y disponible para crear productos'
                      : 'Oculto, no se puede usar para nuevos productos'}
                  </p>
                </div>
              </label>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center ${
                  isGlobal
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  garmentType ? 'Actualizar Tipo' : 'Crear Tipo'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
