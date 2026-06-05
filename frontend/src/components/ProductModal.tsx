/**
 * Product Modal - Create/Edit Product Form
 */
import { useState, useEffect } from 'react';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import { productService } from '../services/productService';
import { extractErrorMessage } from '../utils/api-client';
import QuickGarmentTypeModal from './QuickGarmentTypeModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { RequirePermission } from './RequirePermission';
import type { Product, GarmentType } from '../types/api';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schoolId: string;
  schoolName?: string;
  product?: Product | null;
  /** Pre-selects a garment type when creating a new product (e.g. "+ Variante" from the catalog tree). */
  initialGarmentTypeId?: string;
}

export default function ProductModal({ isOpen, onClose, onSuccess, schoolId, schoolName, product, initialGarmentTypeId }: ProductModalProps) {
  // When editing, always use the product's own school_id to avoid "Product not found"
  const effectiveSchoolId = product?.school_id || schoolId;
  const [loading, setLoading] = useState(false);
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showQuickTypeModal, setShowQuickTypeModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [formData, setFormData] = useState({
    garment_type_id: '',
    name: '',
    size: '',
    color: '',
    gender: 'unisex',
    price: '',
    cost: '',
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
          cost: product.cost?.toString() || '',
          is_active: product.is_active ?? true,
        });
      } else {
        // Create mode - reset form (pre-selecting the garment type when given)
        setFormData({
          garment_type_id: initialGarmentTypeId || '',
          name: '',
          size: '',
          color: '',
          gender: 'unisex',
          price: '',
          cost: '',
          is_active: true,
        });
      }
      setError(null);
    }
  }, [isOpen, product, initialGarmentTypeId]);

  const loadGarmentTypes = async () => {
    try {
      const types = await productService.getGarmentTypes(effectiveSchoolId);
      setGarmentTypes(types);
    } catch (err: unknown) {
      console.error('Error loading garment types:', err);
      setError('Error al cargar tipos de prenda');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // === VALIDACIONES FRONTEND ===
    if (!effectiveSchoolId) {
      setError('Debes seleccionar un colegio primero');
      return;
    }
    if (!formData.garment_type_id) {
      setError('⚠️ Selecciona un tipo de prenda');
      return;
    }
    if (!formData.name?.trim()) {
      setError('⚠️ El nombre del producto es requerido');
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
      setError('⚠️ El costo debe ser un número válido mayor o igual a 0');
      return;
    }

    setLoading(true);

    try {
      // No enviar cost para prendas manufacturadas: su costo es la suma del
      // desglose por componentes y se recalcula en backend al guardar el breakdown.
      const manufactured =
        garmentTypes.find(g => g.id === formData.garment_type_id)?.cost_type !== 'purchased'
        && !!formData.garment_type_id;
      const { cost: _formCost, ...rest } = formData;
      const data = {
        ...rest,
        price,
        ...(manufactured ? {} : { cost }),
      };

      if (product) {
        // Update existing product - use product's own school_id
        await productService.updateProduct(effectiveSchoolId, product.id, data);
      } else {
        // Create new product
        await productService.createProduct(effectiveSchoolId, data);
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error saving product:', err);
      setError(extractErrorMessage(err));
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

  // Para prendas manufacturadas el costo es la suma del desglose por componentes
  // (fuente de verdad). El input manual queda read-only para no pisar ese valor.
  const isManufactured =
    garmentTypes.find(g => g.id === formData.garment_type_id)?.cost_type !== 'purchased'
    && !!formData.garment_type_id;

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
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-stone-200">
            <div>
              <h2 className="text-xl font-semibold text-stone-800">
                {product ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              {(product?.school_name || schoolName) && (
                <p className="text-sm text-brand-600 mt-0.5">
                  {product?.school_name || schoolName}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 transition"
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

            {/* Garment Type */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Tipo de Prenda *
              </label>
              <div className="flex gap-2">
                <select
                  name="garment_type_id"
                  value={formData.garment_type_id}
                  onChange={handleChange}
                  required
                  className="flex-1 px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
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
                  className="px-3 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-lg transition flex items-center justify-center"
                  title="Crear nuevo tipo de prenda"
                >
                  <Plus className="w-5 h-5 text-stone-600" />
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
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Nombre del Producto *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Ej: Camisa Polo Azul"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
              />
            </div>

            {/* Size and Color */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Talla *
                </label>
                <input
                  type="text"
                  name="size"
                  value={formData.size}
                  onChange={handleChange}
                  required
                  placeholder="Ej: M, 14, 32"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Color
                </label>
                <input
                  type="text"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  placeholder="Ej: Azul"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Género
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
              >
                <option value="unisex">Unisex</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
              </select>
            </div>

            {/* Price & Cost */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Precio de Venta *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-500">
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
                    className="w-full pl-7 pr-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Costo de Produccion
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-500">
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
                    readOnly={isManufactured}
                    disabled={isManufactured}
                    className={`w-full pl-7 pr-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none ${isManufactured ? 'bg-stone-100 text-stone-500 cursor-not-allowed' : ''}`}
                  />
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  {isManufactured
                    ? 'Costo derivado del desglose por componentes. Edítalo en Gestionar Costos → Ver desglose.'
                    : 'Opcional - Para calculo de margen'}
                </p>
              </div>
            </div>
            {/* Margin indicator */}
            {formData.price && formData.cost && parseFloat(formData.price) > 0 && parseFloat(formData.cost) > 0 && (
              <div className="text-xs text-stone-500 bg-stone-50 px-3 py-2 rounded-lg">
                Margen estimado: {((1 - parseFloat(formData.cost) / parseFloat(formData.price)) * 100).toFixed(1)}%
                {' '}({new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(parseFloat(formData.price) - parseFloat(formData.cost))} por unidad)
              </div>
            )}

            {/* Active Status - Only show when editing */}
            {product && (
              <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-200 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
                <div>
                  <span className="text-sm font-medium text-stone-700">
                    {formData.is_active ? 'Producto Activo' : 'Producto Inactivo'}
                  </span>
                  <p className="text-xs text-stone-500">
                    {formData.is_active
                      ? 'El producto está visible y disponible para ventas'
                      : 'El producto está oculto y no se puede vender'}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              {product && (
                <RequirePermission permission="products.delete">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={loading}
                    title="Eliminar producto"
                    className="px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition disabled:opacity-50 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </RequirePermission>
              )}
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition disabled:opacity-50 flex items-center justify-center"
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
        schoolId={effectiveSchoolId}
      />

      {/* Delete confirmation (soft-deletes if the product has sales/order history) */}
      {product && (
        <DeleteConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="Eliminar producto"
          entityName={`${product.name || product.code}${product.size ? ` — Talla ${product.size}` : ''}`}
          onConfirm={async () => {
            const result = await productService.deleteProduct(effectiveSchoolId, product.id);
            setShowDeleteConfirm(false);
            onSuccess();
            onClose();
            return result;
          }}
        />
      )}
    </div>
  );
}
