/**
 * Global Product Modal - Create/Edit Global Product Form
 * For products shared across all schools (Tennis, Zapatos, Medias, etc.)
 * Only accessible by superusers
 */
import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { productService } from '../services/productService';
import { extractErrorMessage } from '../utils/api-client';
import type { GlobalProduct, GlobalGarmentType } from '../types/api';

interface GlobalProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: GlobalProduct | null;
}

export default function GlobalProductModal({ isOpen, onClose, onSuccess, product }: GlobalProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [garmentTypes, setGarmentTypes] = useState<GlobalGarmentType[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
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
      const types = await productService.getGlobalGarmentTypes();
      setGarmentTypes(types);
    } catch (err: any) {
      console.error('Error loading global garment types:', err);
      setError('Error al cargar tipos de prenda globales');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // === VALIDACIONES FRONTEND ===
    if (!formData.garment_type_id) {
      setError('⚠️ Selecciona un tipo de prenda global');
      return;
    }
    if (!formData.size?.trim()) {
      setError('⚠️ La talla es requerida');
      return;
    }
    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
      setError('⚠️ El precio debe ser un número mayor a 0');
      return;
    }
    const cost = formData.cost.trim() ? parseFloat(formData.cost) : null;
    if (cost !== null && (isNaN(cost) || cost < 0)) {
      setError('⚠️ El costo debe ser un número válido');
      return;
    }

    setLoading(true);

    try {
      const data: Record<string, unknown> = {
        garment_type_id: formData.garment_type_id,
        size: formData.size,
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
        await productService.updateGlobalProduct(product.id, data);
      } else {
        // Create new product
        await productService.createGlobalProduct(data);
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error saving global product:', err);
      setError(extractErrorMessage(err));
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                {product ? 'Editar Producto Global' : 'Nuevo Producto Global'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Producto compartido entre todos los colegios
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
              </div>
            )}

            {/* Code info - shown only in edit mode */}
            {product && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">Código:</span> {product.code}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  El código se genera automáticamente y no se puede modificar
                </p>
              </div>
            )}

            {/* Garment Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Prenda Global *
              </label>
              <select
                name="garment_type_id"
                value={formData.garment_type_id}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="">Selecciona un tipo</option>
                {garmentTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Ej: Tennis, Zapatos, Medias, Jean, Blusa
              </p>
            </div>

            {/* Name - Optional, auto-generated */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Producto
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Opcional - Se genera automáticamente si se deja vacío"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Size and Color */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Talla *
                </label>
                <input
                  type="text"
                  name="size"
                  value={formData.size}
                  onChange={handleChange}
                  required
                  maxLength={20}
                  placeholder="Ej: T27-T34, Única, L"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <input
                  type="text"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  placeholder="Ej: Negro, Azul"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Género
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="unisex">Unisex</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
              </select>
            </div>

            {/* Price and Cost */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio de Venta *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Costo de Produccion
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <input
                    type="number"
                    name="cost"
                    value={formData.cost}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Opcional - Para cálculo de margen
                </p>
              </div>
            </div>

            {/* Show margin if both price and cost are provided */}
            {formData.price && formData.cost && parseFloat(formData.cost) > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-700">
                  <span className="font-medium">Margen de ganancia:</span>{' '}
                  ${(parseFloat(formData.price) - parseFloat(formData.cost)).toFixed(2)} (
                  {(((parseFloat(formData.price) - parseFloat(formData.cost)) / parseFloat(formData.price)) * 100).toFixed(1)}%)
                </p>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Descripción opcional del producto"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
              />
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL de Imagen
              </label>
              <input
                type="url"
                name="image_url"
                value={formData.image_url}
                onChange={handleChange}
                placeholder="https://ejemplo.com/imagen.jpg"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Active Status - Only show when editing */}
            {product && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
                <div>
                  <span className="text-sm font-medium text-gray-700">
                    {formData.is_active ? 'Producto Activo' : 'Producto Inactivo'}
                  </span>
                  <p className="text-xs text-gray-500">
                    {formData.is_active
                      ? 'El producto está visible y disponible para ventas'
                      : 'El producto está oculto y no se puede vender'}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  product ? 'Actualizar' : 'Crear Producto Global'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
