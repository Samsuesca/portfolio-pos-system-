/**
 * Order Change Modal - Request product changes/returns for orders (encargos)
 * Supports both school products and global products
 * Adapted from SaleChangeModal for order-specific flows
 */
import { useState, useEffect } from 'react';
import { X, Loader2, RefreshCw, AlertCircle, Globe, AlertTriangle } from 'lucide-react';
import { orderChangeService } from '../services/orderChangeService';
import { productService } from '../services/productService';
import type { OrderItem, Product, GlobalProduct, ChangeType, OrderChangeCreate } from '../types/api';

interface OrderChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schoolId: string;
  orderId: string;
  orderItems: OrderItem[];
}

export default function OrderChangeModal({
  isOpen,
  onClose,
  onSuccess,
  schoolId,
  orderId,
  orderItems,
}: OrderChangeModalProps) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [globalProducts, setGlobalProducts] = useState<GlobalProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    original_item_id: '',
    change_type: 'size_change' as ChangeType,
    new_product_id: '',
    is_new_global_product: false,
    returned_quantity: 1,
    new_quantity: 1,
    reason: '',
    payment_method: 'cash' as 'cash' | 'nequi' | 'transfer' | 'card',
    new_size: '',
    new_color: '',
    new_embroidery_text: '',
    new_custom_measurements: '' as string, // JSON string for custom measurements
  });

  // Filter out CANCELLED items - they cannot be changed
  const availableItems = orderItems.filter(
    (item) => item.item_status !== 'cancelled'
  );

  useEffect(() => {
    if (isOpen) {
      loadProducts();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setFormData({
      original_item_id: '',
      change_type: 'size_change',
      new_product_id: '',
      is_new_global_product: false,
      returned_quantity: 1,
      new_quantity: 1,
      reason: '',
      payment_method: 'cash',
      new_size: '',
      new_color: '',
      new_embroidery_text: '',
      new_custom_measurements: '',
    });
    setError(null);
  };

  const loadProducts = async () => {
    try {
      const [schoolData, globalData] = await Promise.all([
        productService.getProducts(schoolId),
        productService.getGlobalProducts(true, 500),
      ]);
      setProducts(schoolData);
      setGlobalProducts(globalData);
    } catch (err: any) {
      console.error('Error loading products:', err);
      setError('Error al cargar productos');
    }
  };

  const getItemDisplayName = (item: OrderItem) => {
    const parts: string[] = [];
    parts.push(item.garment_type_name || 'Prenda');
    if (item.size) parts.push(`Talla: ${item.size}`);
    if (item.color) parts.push(`Color: ${item.color}`);
    if (item.embroidery_text) parts.push(`Bordado: ${item.embroidery_text}`);
    return parts.join(' - ');
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'in_production': return 'En Produccion';
      case 'ready': return 'Listo';
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_production': return 'bg-blue-100 text-blue-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'delivered': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Handle product selection (parse the value to extract ID and isGlobal flag)
  const handleNewProductChange = (value: string) => {
    if (!value) {
      setFormData({ ...formData, new_product_id: '', is_new_global_product: false });
      return;
    }
    const [type, id] = value.split(':');
    setFormData({
      ...formData,
      new_product_id: id,
      is_new_global_product: type === 'global',
    });
  };

  const getSelectedProductValue = () => {
    if (!formData.new_product_id) return '';
    return formData.is_new_global_product
      ? `global:${formData.new_product_id}`
      : `school:${formData.new_product_id}`;
  };

  const selectedItem = availableItems.find(
    (item) => item.id === formData.original_item_id
  );
  const maxReturnQty = selectedItem?.quantity || 1;

  // Get garment_type_id from selected item to filter replacement products
  const getOriginalGarmentTypeId = (): string | null => {
    if (!selectedItem) return null;
    return selectedItem.garment_type_id || null;
  };

  const originalGarmentTypeId = getOriginalGarmentTypeId();

  // Only filter by garment_type for SIZE CHANGE
  const shouldFilterByGarmentType =
    formData.change_type === 'size_change' && !!originalGarmentTypeId;

  const filteredProducts = shouldFilterByGarmentType
    ? products.filter((p) => p.garment_type_id === originalGarmentTypeId)
    : products;

  const filteredGlobalProducts = shouldFilterByGarmentType
    ? globalProducts.filter((p) => p.garment_type_id === originalGarmentTypeId)
    : globalProducts;

  const isNonReturnType = formData.change_type !== 'return';

  // Show order-specific fields for size/product changes
  const showOrderFields = isNonReturnType;

  const getChangeTypeLabel = (type: ChangeType) => {
    switch (type) {
      case 'size_change': return 'Cambio de Talla';
      case 'product_change': return 'Cambio de Producto';
      case 'return': return 'Devolucion (Reembolso)';
      case 'defect': return 'Producto Defectuoso';
      default: return type;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.original_item_id) {
      setError('Selecciona el item del encargo a cambiar/devolver');
      return;
    }

    if (formData.reason.trim().length < 3) {
      setError('El motivo debe tener al menos 3 caracteres');
      return;
    }

    if (isNonReturnType && !formData.new_product_id) {
      setError('Selecciona el producto nuevo');
      return;
    }

    setLoading(true);
    setError(null);

    const changeData: OrderChangeCreate = {
      original_item_id: formData.original_item_id,
      change_type: formData.change_type,
      returned_quantity: formData.returned_quantity,
      reason: formData.reason.trim(),
      new_quantity: isNonReturnType ? formData.new_quantity : 0,
    };

    // Only include new_product_id for non-return changes
    if (isNonReturnType && formData.new_product_id) {
      changeData.new_product_id = formData.new_product_id;
      changeData.is_new_global_product = formData.is_new_global_product;
    }

    // Include payment method for price adjustments
    if (isNonReturnType) {
      changeData.payment_method = formData.payment_method;
    }

    // Include order-specific fields when applicable
    if (showOrderFields) {
      if (formData.new_size.trim()) {
        changeData.new_size = formData.new_size.trim();
      }
      if (formData.new_color.trim()) {
        changeData.new_color = formData.new_color.trim();
      }
      if (formData.new_embroidery_text.trim()) {
        changeData.new_embroidery_text = formData.new_embroidery_text.trim();
      }
      if (formData.new_custom_measurements.trim()) {
        try {
          changeData.new_custom_measurements = JSON.parse(
            formData.new_custom_measurements.trim()
          );
        } catch {
          setError(
            'Las medidas personalizadas deben estar en formato JSON valido, ej: {"pecho": 90, "cintura": 70}'
          );
          setLoading(false);
          return;
        }
      }
    }

    try {
      await orderChangeService.createChange(schoolId, orderId, changeData);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating order change:', err);
      const errorMessage =
        err.message ||
        err.response?.data?.detail ||
        'Error al crear la solicitud de cambio';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
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
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <RefreshCw className="w-6 h-6 mr-2" />
              Cambio o Devolucion de Encargo
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Change Type */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Cambio *
              </label>
              <select
                value={formData.change_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    change_type: e.target.value as ChangeType,
                  })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="size_change">
                  {getChangeTypeLabel('size_change')}
                </option>
                <option value="product_change">
                  {getChangeTypeLabel('product_change')}
                </option>
                <option value="return">
                  {getChangeTypeLabel('return')}
                </option>
                <option value="defect">
                  {getChangeTypeLabel('defect')}
                </option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {formData.change_type === 'return'
                  ? 'El cliente recibira un reembolso por el item del encargo'
                  : 'Se generara un nuevo item de encargo con las especificaciones indicadas'}
              </p>
            </div>

            {/* Original Item */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item del Encargo a Cambiar *
              </label>
              <select
                value={formData.original_item_id}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    original_item_id: e.target.value,
                    new_product_id: '',
                    is_new_global_product: false,
                  })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Selecciona un item</option>
                {availableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {getItemDisplayName(item)} - Cant: {item.quantity} - $
                    {Number(item.unit_price).toLocaleString()} [{getStatusLabel(item.item_status)}]
                  </option>
                ))}
              </select>
            </div>

            {/* Warning for DELIVERED items */}
            {selectedItem && selectedItem.item_status === 'delivered' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start">
                <AlertTriangle className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Cambio post-entrega
                  </p>
                  <p className="text-sm text-amber-700">
                    Este item ya fue entregado al cliente. El cambio requerira que el
                    cliente devuelva el producto fisicamente.
                  </p>
                </div>
              </div>
            )}

            {/* Warning for READY items */}
            {selectedItem && selectedItem.item_status === 'ready' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-start">
                <AlertTriangle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    Item listo para entrega
                  </p>
                  <p className="text-sm text-blue-700">
                    Este item esta marcado como listo. Al aprobar el cambio se
                    liberara el stock reservado.
                  </p>
                </div>
              </div>
            )}

            {/* Selected item status badge */}
            {selectedItem && (
              <div className="mb-4">
                <span className="text-xs text-gray-500 mr-2">Estado actual:</span>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(selectedItem.item_status)}`}
                >
                  {getStatusLabel(selectedItem.item_status)}
                </span>
                {selectedItem.reserved_from_stock && (
                  <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    Stock reservado: {selectedItem.quantity_reserved || 0}
                  </span>
                )}
              </div>
            )}

            {/* Returned Quantity */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad a Cambiar/Devolver *
              </label>
              <input
                type="number"
                min="1"
                max={maxReturnQty}
                value={formData.returned_quantity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    returned_quantity: parseInt(e.target.value) || 1,
                  })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              {selectedItem && (
                <p className="mt-1 text-xs text-gray-500">
                  Maximo: {maxReturnQty} unidades
                </p>
              )}
            </div>

            {/* New Product (only if not return) */}
            {isNonReturnType && (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Producto Nuevo *
                  </label>
                  {shouldFilterByGarmentType &&
                    (filteredProducts.length > 0 ||
                      filteredGlobalProducts.length > 0) && (
                      <p className="mb-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                        Mostrando solo productos del mismo tipo de prenda (cambio
                        de talla)
                      </p>
                    )}
                  {shouldFilterByGarmentType &&
                    filteredProducts.length === 0 &&
                    filteredGlobalProducts.length === 0 && (
                      <p className="mb-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                        No hay otros productos disponibles del mismo tipo de
                        prenda
                      </p>
                    )}
                  <select
                    value={getSelectedProductValue()}
                    onChange={(e) => handleNewProductChange(e.target.value)}
                    required
                    disabled={
                      shouldFilterByGarmentType &&
                      filteredProducts.length === 0 &&
                      filteredGlobalProducts.length === 0
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Selecciona un producto</option>

                    {/* School products */}
                    {filteredProducts.length > 0 && (
                      <optgroup label="Productos del Colegio">
                        {filteredProducts.map((product) => {
                          const stockQty =
                            product.stock ?? product.inventory_quantity ?? 0;
                          return (
                            <option
                              key={`school:${product.id}`}
                              value={`school:${product.id}`}
                            >
                              {product.name} - {product.size} - $
                              {Number(product.price).toLocaleString()}
                              {stockQty === 0
                                ? ' [Sin stock]'
                                : ` [Stock: ${stockQty}]`}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}

                    {/* Global products */}
                    {filteredGlobalProducts.length > 0 && (
                      <optgroup label="Productos Globales (Compartidos)">
                        {filteredGlobalProducts.map((product) => {
                          const stockQty =
                            product.stock ?? product.inventory_quantity ?? 0;
                          return (
                            <option
                              key={`global:${product.id}`}
                              value={`global:${product.id}`}
                            >
                              {product.name} - {product.size} - $
                              {Number(product.price).toLocaleString()}
                              {stockQty === 0
                                ? ' [Sin stock]'
                                : ` [Stock: ${stockQty}]`}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                  </select>
                  {formData.is_new_global_product && (
                    <p className="mt-1 text-xs text-blue-600 flex items-center">
                      <Globe className="w-3 h-3 mr-1" />
                      Producto global seleccionado - inventario compartido entre
                      colegios
                    </p>
                  )}
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cantidad Nueva *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.new_quantity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        new_quantity: parseInt(e.target.value) || 1,
                      })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </>
            )}

            {/* Order-specific fields (size, color, embroidery, measurements) */}
            {showOrderFields && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Especificaciones del nuevo item
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Estos campos son opcionales. Si se dejan vacios, se mantendran
                  las especificaciones del item original.
                </p>

                {/* New Size */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nueva Talla
                  </label>
                  <input
                    type="text"
                    value={formData.new_size}
                    onChange={(e) =>
                      setFormData({ ...formData, new_size: e.target.value })
                    }
                    placeholder={
                      selectedItem?.size
                        ? `Actual: ${selectedItem.size}`
                        : 'Ej: M, L, XL, 10, 12...'
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* New Color */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nuevo Color
                  </label>
                  <input
                    type="text"
                    value={formData.new_color}
                    onChange={(e) =>
                      setFormData({ ...formData, new_color: e.target.value })
                    }
                    placeholder={
                      selectedItem?.color
                        ? `Actual: ${selectedItem.color}`
                        : 'Ej: Azul, Blanco...'
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* New Embroidery Text */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nuevo Texto de Bordado
                  </label>
                  <input
                    type="text"
                    value={formData.new_embroidery_text}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        new_embroidery_text: e.target.value,
                      })
                    }
                    placeholder={
                      selectedItem?.embroidery_text
                        ? `Actual: ${selectedItem.embroidery_text}`
                        : 'Texto para bordado (si aplica)'
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* New Custom Measurements (JSON) */}
                {selectedItem?.has_custom_measurements && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nuevas Medidas Personalizadas (JSON)
                    </label>
                    <textarea
                      value={formData.new_custom_measurements}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          new_custom_measurements: e.target.value,
                        })
                      }
                      rows={3}
                      placeholder={
                        selectedItem.custom_measurements
                          ? `Actuales: ${JSON.stringify(selectedItem.custom_measurements)}`
                          : '{"pecho": 90, "cintura": 70, "cadera": 95}'
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none font-mono text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Formato JSON. Ejemplo: {`{"pecho": 90, "cintura": 70}`}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Reason (required, min 3 chars) */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo *
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                rows={3}
                required
                minLength={3}
                placeholder="Describe el motivo del cambio o devolucion (minimo 3 caracteres)..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                {formData.reason.trim().length}/3 caracteres minimos
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> La solicitud quedara en estado PENDIENTE y
                debera ser aprobada por un administrador. Al tratarse de un
                encargo, el nuevo item se procesara como parte del pedido existente.
              </p>
            </div>

            {/* Payment Method (for price adjustments) */}
            {isNonReturnType && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Metodo de Pago (para diferencia de precio)
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      payment_method: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="cash">Efectivo</option>
                  <option value="nequi">Nequi</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Se usara si hay diferencia de precio entre los productos
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
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
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Crear Solicitud'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
