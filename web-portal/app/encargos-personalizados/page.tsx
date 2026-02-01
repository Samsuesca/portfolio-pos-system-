'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, ShoppingCart, Plus, X, Trash2 } from 'lucide-react';
import { schoolsApi, type School, type Product } from '@/lib/api';
import { useCartStore } from '@/lib/store';
import { formatNumber } from '@/lib/utils';

// Garment type options
const GARMENT_TYPES = [
  'Camisa',
  'Pantalón',
  'Falda',
  'Chompa',
  'Sudadera',
  'Yomber',
  'Zapatos',
  'Medias',
  'Otro'
] as const;

// Gender options
const GENDER_OPTIONS = [
  { value: 'unisex', label: 'Unisex' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' }
] as const;

// Custom product interface
interface CustomProduct {
  id: string;
  garmentType: string;
  description: string;
  color?: string;
  size?: string;
  gender: string;
  quantity: number;
  customMeasurements?: string;
  notes?: string;
}

export default function CustomOrdersPage() {
  const router = useRouter();
  const { addItem, getTotalItems } = useCartStore();

  const [schools, setSchools] = useState<School[]>([]);
  const [schoolName, setSchoolName] = useState<string>('');
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const [customProducts, setCustomProducts] = useState<CustomProduct[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    garmentType: 'Camisa',
    description: '',
    color: '',
    size: '',
    gender: 'unisex',
    quantity: 1,
    customMeasurements: '',
    notes: ''
  });

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load schools
  useEffect(() => {
    loadSchools();
  }, []);

  const loadSchools = async () => {
    try {
      setLoading(true);
      const response = await schoolsApi.list();
      const activeSchools = response.data.filter(s => s.is_active);
      setSchools(activeSchools);
    } catch (error) {
      console.error('Error loading schools:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddCustomProduct = () => {
    // Validation
    if (!formData.description.trim()) {
      alert('Por favor ingresa una descripción del producto');
      return;
    }
    if (formData.quantity < 1) {
      alert('La cantidad debe ser al menos 1');
      return;
    }

    // Create custom product
    const newProduct: CustomProduct = {
      id: `custom-${Date.now()}`,
      garmentType: formData.garmentType,
      description: formData.description,
      color: formData.color || undefined,
      size: formData.size || undefined,
      gender: formData.gender,
      quantity: formData.quantity,
      customMeasurements: formData.customMeasurements || undefined,
      notes: formData.notes || undefined
    };

    setCustomProducts(prev => [...prev, newProduct]);

    // Reset form
    setFormData({
      garmentType: 'Camisa',
      description: '',
      color: '',
      size: '',
      gender: 'unisex',
      quantity: 1,
      customMeasurements: '',
      notes: ''
    });

    setShowModal(false);
  };

  const handleRemoveCustomProduct = (id: string) => {
    setCustomProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleAddToCart = () => {
    // Validation
    if (!schoolName.trim()) {
      alert('Por favor ingresa el nombre del colegio');
      return;
    }
    if (customProducts.length === 0) {
      alert('Por favor agrega al menos un producto personalizado');
      return;
    }

    // Store school name in localStorage for checkout
    localStorage.setItem('custom_order_school_name', schoolName.trim());

    // Create temporary school object for custom orders
    const tempSchool: School = {
      id: 'pending-quotation',
      name: schoolName.trim(),
      slug: 'encargos-personalizados',
      is_active: true
    };

    // Convert custom products to Product format and add to cart
    customProducts.forEach(customProduct => {
      // Create a Product object from custom product
      const product: Product = {
        id: customProduct.id,
        school_id: 'pending-quotation', // Special ID for custom orders
        garment_type_id: customProduct.id, // Use custom ID
        name: `${customProduct.garmentType} - ${customProduct.description}`,
        code: customProduct.id,
        description: [
          customProduct.color && `Color: ${customProduct.color}`,
          customProduct.customMeasurements && `Medidas: ${customProduct.customMeasurements}`,
          customProduct.notes && `Notas: ${customProduct.notes}`
        ].filter(Boolean).join(' | '),
        size: customProduct.size,
        gender: customProduct.gender,
        color: customProduct.color,
        price: 0, // Price is 0 - needs quotation
        is_active: true
      };

      // Add multiple times for quantity
      for (let i = 0; i < customProduct.quantity; i++) {
        addItem(product, tempSchool, true); // isOrder = true for custom products
      }
    });

    // Clear custom products and school name
    setCustomProducts([]);
    setSchoolName('');

    // Show success message
    alert('✅ Productos agregados al carrito exitosamente!\n\nHaz clic en el ícono del carrito 🛒 (arriba a la derecha) para proceder al checkout.');
  };

  const getFilteredSchools = () => {
    if (!schoolName.trim()) return [];
    return schools.filter(s =>
      s.name.toLowerCase().includes(schoolName.toLowerCase())
    ).slice(0, 5); // Limit to 5 suggestions
  };

  const getProductEmoji = (garmentType: string): string => {
    const type = garmentType.toLowerCase();
    if (type.includes('camisa')) return '👕';
    if (type.includes('pantalón') || type.includes('falda')) return '👖';
    if (type.includes('chompa') || type.includes('sudadera')) return '🧥';
    if (type.includes('yomber')) return '✂️';
    if (type.includes('zapato')) return '👟';
    if (type.includes('media')) return '🧦';
    return '👔';
  };

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-white border-b border-surface-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/')}
              className="flex items-center text-slate-600 hover:text-purple-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Volver
            </button>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Package className="w-6 h-6 text-purple-600" />
                <h1 className="text-2xl font-bold text-purple-600 font-display">
                  Encargos Personalizados
                </h1>
              </div>
              <p className="text-sm text-slate-500">
                Crea uniformes a medida
              </p>
            </div>
            <button
              onClick={() => {
                // Navigate to checkout with the temp school slug
                if (getTotalItems() > 0) {
                  router.push('/encargos-personalizados/checkout');
                } else {
                  alert('El carrito está vacío');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors relative"
            >
              <ShoppingCart className="w-5 h-5" />
              {mounted && getTotalItems() > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {getTotalItems()}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Instructions */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold text-purple-900 mb-2">
            ¿Cómo funciona?
          </h2>
          <ol className="text-sm text-purple-700 space-y-1 ml-4">
            <li>1. Selecciona el colegio para el cual necesitas el uniforme</li>
            <li>2. Agrega los productos personalizados con sus especificaciones</li>
            <li>3. Revisa tu lista y el total</li>
            <li>4. Agrega al carrito y procede al checkout</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* School Name Input */}
            <div className="bg-white rounded-xl border border-surface-200 p-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nombre del Colegio <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => {
                    setSchoolName(e.target.value);
                    setShowSchoolSuggestions(true);
                  }}
                  onFocus={() => setShowSchoolSuggestions(true)}
                  placeholder="Escribe el nombre del colegio..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {/* Autocomplete suggestions */}
                {showSchoolSuggestions && getFilteredSchools().length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {getFilteredSchools().map((school) => (
                      <button
                        key={school.id}
                        type="button"
                        onClick={() => {
                          setSchoolName(school.name);
                          setShowSchoolSuggestions(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-purple-50 transition-colors"
                      >
                        {school.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                💡 Si el colegio no existe en nuestra lista, se creará automáticamente al procesar tu pedido
              </p>
            </div>

            {/* Add Product Button */}
            <div className="bg-white rounded-xl border border-purple-200 p-6">
              <button
                onClick={() => setShowModal(true)}
                className="w-full flex items-center justify-center gap-2 py-4 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold"
              >
                <Plus className="w-5 h-5" />
                Agregar Producto Personalizado
              </button>
            </div>

            {/* Custom Products List */}
            {customProducts.length > 0 && (
              <div className="bg-white rounded-xl border border-surface-200 p-6">
                <h2 className="text-lg font-bold text-purple-600 font-display mb-4">
                  Productos Agregados
                </h2>
                <div className="space-y-4">
                  {customProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-start gap-4 p-4 rounded-lg bg-purple-50 border border-purple-200"
                    >
                      {/* Product Icon */}
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center flex-shrink-0">
                        <span className="text-3xl">{getProductEmoji(product.garmentType)}</span>
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-purple-900">
                          {product.garmentType} - {product.description}
                        </h3>
                        <div className="text-sm text-purple-700 mt-1 space-y-0.5">
                          {product.color && (
                            <p>Color: {product.color}</p>
                          )}
                          {product.size && (
                            <p>Talla: {product.size}</p>
                          )}
                          <p>Género: {product.gender}</p>
                          <p>Cantidad: {product.quantity}</p>
                          {product.customMeasurements && (
                            <p>Medidas: {product.customMeasurements}</p>
                          )}
                          {product.notes && (
                            <p>Notas: {product.notes}</p>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-orange-600 mt-2 bg-orange-50 px-2 py-1 rounded inline-block">
                          💰 Precio pendiente de cotización
                        </p>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemoveCustomProduct(product.id)}
                        className="text-red-500 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-purple-200 p-6 sticky top-24">
              <h2 className="text-lg font-bold text-purple-600 font-display mb-4">
                Resumen
              </h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Productos:</span>
                  <span className="font-medium text-purple-600">
                    {customProducts.length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Unidades totales:</span>
                  <span className="font-medium text-purple-600">
                    {customProducts.reduce((sum, p) => sum + p.quantity, 0)}
                  </span>
                </div>
                <div className="border-t border-purple-200 pt-3">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-orange-800 mb-1">
                      💰 Precio Total
                    </p>
                    <p className="text-xs text-orange-700">
                      El precio se asignará después de la cotización
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={customProducts.length === 0 || !schoolName.trim()}
                className="w-full py-4 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-bold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Agregar al Carrito
              </button>

              <p className="text-xs text-slate-500 text-center mt-4">
                Los productos personalizados requieren tiempo de confección
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Add Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowModal(false)}
          />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              {/* Close button */}
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-6 h-6 text-purple-600" />
                  <h3 className="text-xl font-bold text-purple-600 font-display">
                    Agregar Producto Personalizado
                  </h3>
                </div>
                <p className="text-sm text-slate-600">
                  Completa los detalles del producto a medida
                </p>
              </div>

              {/* Form */}
              <div className="space-y-4">
                {/* Garment Type */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Tipo de Prenda <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.garmentType}
                    onChange={(e) => handleFormChange('garmentType', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {GARMENT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Descripción <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    placeholder="Ej: Camisa blanca manga larga con logo bordado"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Color and Size (2 columns) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Color
                    </label>
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => handleFormChange('color', e.target.value)}
                      placeholder="Ej: Azul marino"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Talla
                    </label>
                    <input
                      type="text"
                      value={formData.size}
                      onChange={(e) => handleFormChange('size', e.target.value)}
                      placeholder="Ej: M, 10, 36"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Género <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleFormChange('gender', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {GENDER_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Cantidad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => handleFormChange('quantity', parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Custom Measurements */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Medidas Personalizadas
                  </label>
                  <textarea
                    value={formData.customMeasurements}
                    onChange={(e) => handleFormChange('customMeasurements', e.target.value)}
                    placeholder="Ej: Talle: 90cm, Largo: 65cm, Manga: 55cm"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Notas Adicionales
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    placeholder="Cualquier detalle adicional importante"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Quotation Notice */}
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <p className="text-sm font-semibold text-orange-800 mb-1">
                    💰 Información de Precio
                  </p>
                  <p className="text-xs text-orange-700">
                    El precio de este producto se asignará después de una cotización personalizada según tus especificaciones.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 border border-gray-300 text-slate-600 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddCustomProduct}
                  className="flex-1 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold"
                >
                  Agregar Producto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
