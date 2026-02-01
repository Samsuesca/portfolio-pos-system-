'use client';

/**
 * School Product Modal - Create/Edit Product Form for School-Specific Products
 */
import { useState, useEffect } from 'react';
import { X, Loader2, Plus, Package, Building2 } from 'lucide-react';
import productService from '@/lib/services/productService';
import QuickGarmentTypeModal from './QuickGarmentTypeModal';
import type { Product, GarmentType } from '@/lib/api';

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

interface SchoolProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schoolId: string;
  schoolName?: string;
  product?: Product | null;
}

export default function SchoolProductModal({
  isOpen,
  onClose,
  onSuccess,
  schoolId,
  schoolName,
  product,
}: SchoolProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showQuickTypeModal, setShowQuickTypeModal] = useState(false);

  const [formData, setFormData] = useState({
    garment_type_id: '',
    name: '',
    size: '',
    color: '',
    gender: 'unisex' as 'unisex' | 'male' | 'female',
    price: '',
    is_active: true,
  });

  useEffect(() => {
    if (isOpen) {
      loadGarmentTypes();
      if (product) {
        // Edit mode
        setFormData({
          garment_type_id: product.garment_type_id || '',
          name: product.name || '',
          size: product.size,
          color: product.color || '',
          gender: product.gender || 'unisex',
          price: product.price.toString(),
          is_active: product.is_active ?? true,
        });
      } else {
        // Create mode - reset form
        setFormData({
          garment_type_id: '',
          name: '',
          size: '',
          color: '',
          gender: 'unisex',
          price: '',
          is_active: true,
        });
      }
      setError(null);
    }
  }, [isOpen, product, schoolId]);

  const loadGarmentTypes = async () => {
    try {
      const types = await productService.listGarmentTypes(schoolId);
      setGarmentTypes(types.filter(t => t.is_active));
    } catch (err: any) {
      console.error('Error loading garment types:', err);
      setError('Error al cargar tipos de prenda');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!schoolId) {
      setError('Debes seleccionar un colegio primero');
      return;
    }
    if (!formData.garment_type_id) {
      setError('Selecciona un tipo de prenda');
      return;
    }
    if (!formData.name?.trim()) {
      setError('El nombre del producto es requerido');
      return;
    }
    if (!formData.size?.trim()) {
      setError('La talla es requerida');
      return;
    }
    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
      setError('El precio debe ser un numero mayor a 0');
      return;
    }

    setLoading(true);

    try {
      const data = {
        garment_type_id: formData.garment_type_id,
        name: formData.name.trim(),
        size: formData.size.trim(),
        color: formData.color.trim() || undefined,
        gender: formData.gender,
        price,
        is_active: formData.is_active,
      };

      if (product) {
        // Update existing product
        await productService.update(schoolId, product.id, data);
      } else {
        // Create new product
        await productService.create(schoolId, data);
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error saving product:', err);
      setError(getErrorMessage(err, 'Error al guardar producto'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (!isOpen) return null;

  const genderLabels: Record<string, string> = {
    unisex: 'Unisex',
    male: 'Masculino',
    female: 'Femenino',
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
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">
                  {product ? 'Editar Producto' : 'Nuevo Producto'}
                </h2>
                {schoolName && (
                  <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3" />
                    {schoolName}
                  </p>
                )}
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

            {/* Garment Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tipo de Prenda <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  name="garment_type_id"
                  value={formData.garment_type_id}
                  onChange={handleChange}
                  required
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Selecciona un tipo</option>
                  {garmentTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowQuickTypeModal(true)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition flex items-center justify-center"
                  title="Crear nuevo tipo de prenda"
                >
                  <Plus className="w-5 h-5 text-slate-600" />
                </button>
              </div>
              {garmentTypes.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No hay tipos de prenda. Crea uno con el boton +
                </p>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre del Producto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Ej: Camisa Polo Azul"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Size and Color */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Talla <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="size"
                  value={formData.size}
                  onChange={handleChange}
                  required
                  placeholder="Ej: M, 14, 32"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Color
                </label>
                <input
                  type="text"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  placeholder="Ej: Azul"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Genero
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="unisex">Unisex</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
              </select>
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Precio <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500">
                  $
                </span>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  required
                  min="0"
                  step="100"
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Active Status - Only show when editing */}
            {product && (
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700">
                    {formData.is_active ? 'Producto Activo' : 'Producto Inactivo'}
                  </span>
                  <p className="text-xs text-slate-500">
                    {formData.is_active
                      ? 'Visible y disponible para ventas'
                      : 'Oculto, no se puede vender'}
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
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  product ? 'Actualizar' : 'Crear Producto'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Quick Garment Type Modal */}
      <QuickGarmentTypeModal
        isOpen={showQuickTypeModal}
        onClose={() => setShowQuickTypeModal(false)}
        onSuccess={(newType) => {
          // Add the new type to the list and select it
          setGarmentTypes(prev => [...prev, newType]);
          setFormData(prev => ({ ...prev, garment_type_id: newType.id }));
        }}
        schoolId={schoolId}
      />
    </div>
  );
}
