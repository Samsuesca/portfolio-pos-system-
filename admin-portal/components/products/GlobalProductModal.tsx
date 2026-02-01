'use client';

/**
 * Global Product Modal - Create/Edit Global Product Form
 * For products shared across all schools (Tennis, Zapatos, Medias, etc.)
 * Only accessible by superusers
 */
import { useState, useEffect } from 'react';
import { X, Loader2, Globe, Package } from 'lucide-react';
import productService from '@/lib/services/productService';
import type { GlobalProduct, GlobalGarmentType } from '@/lib/api';

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

interface GlobalProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: GlobalProduct | null;
}

export default function GlobalProductModal({
  isOpen,
  onClose,
  onSuccess,
  product,
}: GlobalProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [garmentTypes, setGarmentTypes] = useState<GlobalGarmentType[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    garment_type_id: '',
    name: '',
    size: '',
    color: '',
    gender: 'unisex' as 'unisex' | 'male' | 'female',
    price: '',
    cost: '',
    description: '',
    image_url: '',
    is_active: true,
  });

  useEffect(() => {
    if (isOpen) {
      loadGlobalGarmentTypes();
      if (product) {
        // Edit mode
        setFormData({
          garment_type_id: product.garment_type_id || '',
          name: product.name || '',
          size: product.size,
          color: product.color || '',
          gender: product.gender || 'unisex',
          price: product.price.toString(),
          cost: product.cost?.toString() || '',
          description: product.description || '',
          image_url: product.image_url || '',
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
          cost: '',
          description: '',
          image_url: '',
          is_active: true,
        });
      }
      setError(null);
    }
  }, [isOpen, product]);

  const loadGlobalGarmentTypes = async () => {
    try {
      const types = await productService.listGlobalGarmentTypes();
      setGarmentTypes(types.filter(t => t.is_active));
    } catch (err: any) {
      console.error('Error loading global garment types:', err);
      setError('Error al cargar tipos de prenda globales');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!formData.garment_type_id) {
      setError('Selecciona un tipo de prenda global');
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
    const cost = formData.cost.trim() ? parseFloat(formData.cost) : null;
    if (cost !== null && (isNaN(cost) || cost < 0)) {
      setError('El costo debe ser un numero valido');
      return;
    }

    setLoading(true);

    try {
      const data: Record<string, unknown> = {
        garment_type_id: formData.garment_type_id,
        size: formData.size.trim(),
        price,
      };

      // Optional fields
      if (formData.name.trim()) data.name = formData.name.trim();
      if (formData.color.trim()) data.color = formData.color.trim();
      if (formData.gender) data.gender = formData.gender;
      if (cost !== null) data.cost = cost;
      if (formData.description.trim()) data.description = formData.description.trim();
      if (formData.image_url.trim()) data.image_url = formData.image_url.trim();
      if (product) data.is_active = formData.is_active;

      if (product) {
        // Update existing product
        await productService.updateGlobal(product.id, data as any);
      } else {
        // Create new product
        await productService.createGlobal(data as any);
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error saving global product:', err);
      setError(getErrorMessage(err, 'Error al guardar producto global'));
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

  // Calculate margin
  const margin = formData.price && formData.cost && parseFloat(formData.cost) > 0
    ? parseFloat(formData.price) - parseFloat(formData.cost)
    : null;
  const marginPercent = margin !== null && parseFloat(formData.price) > 0
    ? (margin / parseFloat(formData.price)) * 100
    : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 flex items-center justify-between p-6 border-b border-purple-200 bg-purple-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Globe className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">
                  {product ? 'Editar Producto Global' : 'Nuevo Producto Global'}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Compartido entre todos los colegios
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

            {/* Code info - shown only in edit mode */}
            {product && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm text-purple-700">
                  <span className="font-medium">Codigo:</span> {product.code}
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  Generado automaticamente
                </p>
              </div>
            )}

            {/* Garment Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tipo de Prenda Global <span className="text-red-500">*</span>
              </label>
              <select
                name="garment_type_id"
                value={formData.garment_type_id}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              >
                <option value="">Selecciona un tipo</option>
                {garmentTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              {garmentTypes.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No hay tipos de prenda globales. Crea uno primero en la tab de Tipos.
                </p>
              )}
            </div>

            {/* Name - Optional */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre del Producto
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Opcional - Se genera automaticamente"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
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
                  maxLength={20}
                  placeholder="Ej: T27-T34, Unica, L"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
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
                  placeholder="Ej: Negro, Azul"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              >
                <option value="unisex">Unisex</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
              </select>
            </div>

            {/* Price and Cost */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Precio de Venta <span className="text-red-500">*</span>
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
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Costo de Compra
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500">
                    $
                  </span>
                  <input
                    type="number"
                    name="cost"
                    value={formData.cost}
                    onChange={handleChange}
                    min="0"
                    step="100"
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Margin indicator */}
            {margin !== null && marginPercent !== null && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-700">
                  <span className="font-medium">Margen:</span>{' '}
                  ${margin.toLocaleString('es-CO')} ({marginPercent.toFixed(1)}%)
                </p>
              </div>
            )}

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
                placeholder="Descripcion opcional"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
              />
            </div>

            {/* Active Status - Only show when editing */}
            {product && (
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
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
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center"
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
    </div>
  );
}
