/**
 * Sale Change Modal - Request product changes/returns
 * Supports both school products and global products
 */
import { useState, useEffect, useRef } from 'react';
import ModalWrapper from './common/ModalWrapper';
import { X, Loader2, RefreshCw, AlertCircle, Package, ShoppingCart } from 'lucide-react';
import { saleChangeService } from '../services/saleChangeService';
import { productService } from '../services/productService';
import type { SaleItem, Product, ChangeType, SaleChangeCreate } from '../types/api';

interface SaleChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schoolId: string;
  saleId: string;
  saleItems: SaleItem[];
}

// Prioriza el detail del backend sobre el mensaje genérico de axios.
function extractErrorMessage(err: unknown): string | null {
  if (typeof err === 'object' && err !== null) {
    const e = err as { response?: { data?: { detail?: unknown } }; message?: unknown };
    const detail = e.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (typeof e.message === 'string') return e.message;
  }
  return null;
}


export default function SaleChangeModal({
  isOpen,
  onClose,
  onSuccess,
  schoolId,
  saleId,
  saleItems
}: SaleChangeModalProps) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [globalProducts, setGlobalProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const errorBannerRef = useRef<HTMLDivElement | null>(null);

  // Banner de error visible y con scroll automático para evitar silencio cuando
  // el usuario está abajo del formulario.
  const reportError = (message: string) => {
    setError(message);
    requestAnimationFrame(() => {
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  // State for "no stock" confirmation dialog
  const [showNoStockConfirm, setShowNoStockConfirm] = useState(false);
  const [noStockProductCode, setNoStockProductCode] = useState<string>('');
  const [pendingChangeData, setPendingChangeData] = useState<SaleChangeCreate | null>(null);

  const [formData, setFormData] = useState({
    original_item_id: '',
    change_type: 'size_change' as ChangeType,
    new_product_id: '',
    returned_quantity: 1,
    new_quantity: 1,
    reason: '',
    payment_method: 'cash' as 'cash' | 'nequi' | 'transfer' | 'card',
  });

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
      returned_quantity: 1,
      new_quantity: 1,
      reason: '',
      payment_method: 'cash',
    });
    setError(null);
    setShowNoStockConfirm(false);
    setNoStockProductCode('');
    setPendingChangeData(null);
  };

  const loadProducts = async () => {
    try {
      const [schoolData, globalResult] = await Promise.all([
        productService.getProducts(schoolId),
        productService.getGlobalProducts(true, 500),
      ]);
      setProducts(schoolData);
      setGlobalProducts(globalResult.items);
    } catch (err: unknown) {
      console.error('Error loading products:', err);
      setError('Error al cargar productos');
    }
  };


  const getProductName = (productId: string | null) => {
    if (!productId) return 'Producto no especificado';
    const product = products.find(p => p.id === productId) || globalProducts.find(p => p.id === productId);
    return product ? `${product.name} - ${product.size}` : 'Producto no encontrado';
  };

  // Helper function to get item display name (handles global products)
  const getItemDisplayName = (item: SaleItem) => {
    return getProductName(item.product_id);
  };

  // Handle product selection (parse the value to extract ID and isGlobal flag)
  const handleNewProductChange = (value: string) => {
    if (!value) {
      setFormData({ ...formData, new_product_id: '' });
      return;
    }
    const [, id] = value.split(':');
    setFormData({ ...formData, new_product_id: id });
  };

  const getSelectedProductValue = () => {
    if (!formData.new_product_id) return '';
    const isGlobal = globalProducts.some(p => p.id === formData.new_product_id);
    return isGlobal
      ? `global:${formData.new_product_id}`
      : `school:${formData.new_product_id}`;
  };

  const selectedItem = saleItems.find(item => item.id === formData.original_item_id);
  const maxReturnQty = selectedItem?.quantity || 1;

  // Get garment_type_id from selected item to filter replacement products
  const getOriginalGarmentTypeId = (): string | null => {
    if (!selectedItem?.product_id) return null;
    const product = products.find(p => p.id === selectedItem.product_id) || globalProducts.find(p => p.id === selectedItem.product_id);
    return product?.garment_type_id || null;
  };

  const originalGarmentTypeId = getOriginalGarmentTypeId();

  // Only filter by garment_type for SIZE CHANGE (same product, different size)
  // For PRODUCT CHANGE, DEFECT, etc. - show ALL products
  const shouldFilterByGarmentType = formData.change_type === 'size_change' && !!originalGarmentTypeId;

  const filteredProducts = shouldFilterByGarmentType
    ? products.filter(p => p.garment_type_id === originalGarmentTypeId)
    : products;

  const filteredGlobalProducts = shouldFilterByGarmentType
    ? globalProducts.filter(p => p.garment_type_id === originalGarmentTypeId)
    : globalProducts;

  const handleSubmit = async (e: React.FormEvent, createOrderIfNoStock = false): Promise<void> => {
    e.preventDefault();

    if (!formData.original_item_id) {
      reportError('Selecciona el producto a cambiar/devolver');
      return;
    }

    if (formData.change_type !== 'return' && !formData.new_product_id) {
      reportError('Selecciona el producto nuevo');
      return;
    }

    setLoading(true);
    setError(null);

    // Build the payload based on change type (outside try so it's accessible in catch)
    const changeData: SaleChangeCreate = {
      original_item_id: formData.original_item_id,
      change_type: formData.change_type,
      returned_quantity: formData.returned_quantity,
      reason: formData.reason.trim() || 'Sin motivo especificado',
      new_quantity: formData.change_type === 'return' ? 0 : formData.new_quantity,
    };

    // Only include new_product_id for non-return changes
    if (formData.change_type !== 'return' && formData.new_product_id) {
      changeData.new_product_id = formData.new_product_id;
    }

    // If user confirmed to create order when no stock
    if (createOrderIfNoStock) {
      changeData.create_order_if_no_stock = true;
      changeData.payment_method = formData.payment_method;
    }

    try {
      await saleChangeService.createChange(schoolId, saleId, changeData);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error creating change:', err);
      // Priorizar el detail del backend sobre el mensaje genérico de axios.
      const errorMessage = extractErrorMessage(err) ?? 'Error al crear la solicitud de cambio';

      // Check if error is about insufficient stock
      if (errorMessage.toLowerCase().includes('stock insuficiente') ||
          errorMessage.toLowerCase().includes('insufficient')) {
        // Extract product code from error message
        const match = errorMessage.match(/producto\s+(\S+)/i);
        const productCode = match ? match[1] : 'seleccionado';
        setNoStockProductCode(productCode);
        setPendingChangeData({
          ...changeData,
          create_order_if_no_stock: true,
          payment_method: formData.payment_method,
        });
        setShowNoStockConfirm(true);
        setLoading(false);
        return;
      }

      reportError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle confirmation to create order when no stock
  const handleConfirmCreateOrder = async () => {
    if (!pendingChangeData) return;

    setLoading(true);
    setError(null);
    setShowNoStockConfirm(false);

    try {
      await saleChangeService.createChange(schoolId, saleId, pendingChangeData);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error creating change with order:', err);
      const errorMessage = extractErrorMessage(err) ?? 'Error al crear el cambio con encargo';
      reportError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelNoStockConfirm = () => {
    setShowNoStockConfirm(false);
    setPendingChangeData(null);
    setNoStockProductCode('');
  };

  const getChangeTypeLabel = (type: ChangeType) => {
    switch (type) {
      case 'size_change': return 'Cambio de Talla';
      case 'product_change': return 'Cambio de Producto';
      case 'return': return 'Devolución (Reembolso)';
      case 'defect': return 'Producto Defectuoso';
      default: return type;
    }
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl">
      <div className="max-h-[90vh] overflow-y-auto rounded-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-stone-200 sticky top-0 bg-white z-10">
            <h2 className="text-xl font-semibold text-stone-800 flex items-center">
              <RefreshCw className="w-6 h-6 mr-2" />
              Solicitar Cambio o Devolución
            </h2>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            {/* Error Message */}
            {error && (
              <div
                ref={errorBannerRef}
                role="alert"
                aria-live="assertive"
                className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start"
              >
                <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
              </div>
            )}

            {/* Change Type */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Tipo de Cambio *
              </label>
              <select
                value={formData.change_type}
                onChange={(e) => setFormData({ ...formData, change_type: e.target.value as ChangeType })}
                required
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
              >
                <option value="size_change">{getChangeTypeLabel('size_change')}</option>
                <option value="product_change">{getChangeTypeLabel('product_change')}</option>
                <option value="return">{getChangeTypeLabel('return')}</option>
                <option value="defect">{getChangeTypeLabel('defect')}</option>
              </select>
              <p className="mt-1 text-xs text-stone-500">
                {formData.change_type === 'return'
                  ? 'El cliente recibirá un reembolso por el producto devuelto'
                  : 'El cliente recibirá un producto de reemplazo'}
              </p>
            </div>

            {/* Original Item */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Producto Original a Devolver *
              </label>
              <select
                value={formData.original_item_id}
                onChange={(e) => setFormData({
                  ...formData,
                  original_item_id: e.target.value,
                  new_product_id: '',
                })}
                required
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
              >
                <option value="">Selecciona un producto</option>
                {saleItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {getItemDisplayName(item)} - Cantidad: {item.quantity} - ${Number(item.unit_price).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            {/* Returned Quantity */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Cantidad a Devolver *
              </label>
              <input
                type="number"
                min="1"
                max={maxReturnQty}
                value={formData.returned_quantity}
                onChange={(e) => setFormData({ ...formData, returned_quantity: parseInt(e.target.value) || 1 })}
                required
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
              />
              {selectedItem && (
                <p className="mt-1 text-xs text-stone-500">
                  Máximo: {maxReturnQty} unidades
                </p>
              )}
            </div>

            {/* New Product (only if not return) */}
            {formData.change_type !== 'return' && (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Producto Nuevo *
                  </label>
                  {/* Info message about filtering - only for size_change */}
                  {shouldFilterByGarmentType && (filteredProducts.length > 0 || filteredGlobalProducts.length > 0) && (
                    <p className="mb-2 text-xs text-brand-600 bg-brand-50 p-2 rounded">
                      Mostrando solo productos del mismo tipo de prenda (cambio de talla)
                    </p>
                  )}
                  {shouldFilterByGarmentType && filteredProducts.length === 0 && filteredGlobalProducts.length === 0 && (
                    <p className="mb-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      No hay otros productos disponibles del mismo tipo de prenda
                    </p>
                  )}
                  <select
                    value={getSelectedProductValue()}
                    onChange={(e) => handleNewProductChange(e.target.value)}
                    required
                    disabled={shouldFilterByGarmentType && filteredProducts.length === 0 && filteredGlobalProducts.length === 0}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none disabled:bg-stone-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Selecciona un producto</option>

                    {/* School products - filtered by garment type */}
                    {filteredProducts.length > 0 && (
                      <optgroup label="📦 Productos del Colegio">
                        {filteredProducts.map((product) => {
                          // Backend returns 'stock', frontend type also has 'inventory_quantity' as alias
                          const stockQty = product.stock ?? product.inventory_quantity ?? 0;
                          return (
                            <option key={`school:${product.id}`} value={`school:${product.id}`}>
                              {product.name} - {product.size} - ${Number(product.price).toLocaleString()}
                              {stockQty === 0 ? ' [Sin stock]' : ` [Stock: ${stockQty}]`}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}

                    {/* Global products - filtered by garment type */}
                    {filteredGlobalProducts.length > 0 && (
                      <optgroup label="🌐 Productos Globales (Compartidos)">
                        {filteredGlobalProducts.map((product) => {
                          // Backend returns 'stock', frontend type also has 'inventory_quantity' as alias
                          const stockQty = product.stock ?? product.inventory_quantity ?? 0;
                          return (
                            <option key={`global:${product.id}`} value={`global:${product.id}`}>
                              {product.name} - {product.size} - ${Number(product.price).toLocaleString()}
                              {stockQty === 0 ? ' [Sin stock]' : ` [Stock: ${stockQty}]`}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                  </select>
                  <p className="mt-1 text-xs text-stone-500">
                    Nota: El inventario se ajustará automáticamente al aprobar el cambio (se devolverá el producto original y se descontará el nuevo).
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Cantidad Nueva *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.new_quantity}
                    onChange={(e) => setFormData({ ...formData, new_quantity: parseInt(e.target.value) || 1 })}
                    required
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
                  />
                </div>
              </>
            )}

            {/* Reason */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Motivo (Opcional)
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={3}
                placeholder="Describe el motivo del cambio o devolución..."
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none resize-none"
              />
            </div>

            {/* Info Box */}
            <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-brand-700">
                <strong>Nota:</strong> La solicitud quedará en estado PENDIENTE y deberá ser aprobada
                por un administrador antes de que se ajuste el inventario.
              </p>
            </div>

            {/* Payment Method (for price adjustments when creating order) */}
            {formData.change_type !== 'return' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Método de Pago (para diferencia de precio)
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
                >
                  <option value="cash">Efectivo</option>
                  <option value="nequi">Nequi</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                </select>
                <p className="mt-1 text-xs text-stone-500">
                  Se usará si hay diferencia de precio entre los productos
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-stone-200">
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
                    Procesando...
                  </>
                ) : (
                  'Crear Solicitud'
                )}
              </button>
            </div>
          </form>
        </div>

      {/* No Stock Confirmation Dialog */}
      {showNoStockConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleCancelNoStockConfirm} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mr-4">
                <ShoppingCart className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-900">Stock Insuficiente</h3>
                <p className="text-sm text-stone-500">Producto: {noStockProductCode}</p>
              </div>
            </div>

            <p className="text-stone-600 mb-4">
              No hay stock disponible del producto seleccionado. ¿Desea crear un <strong>encargo</strong> automático?
            </p>

            <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-brand-700">
                <strong>Al crear el encargo:</strong>
              </p>
              <ul className="text-sm text-brand-700 list-disc list-inside mt-1">
                <li>El producto original se devolverá al inventario inmediatamente</li>
                <li>Se registrará la diferencia de precio (si aplica)</li>
                <li>Se creará un pedido para el producto nuevo</li>
                <li>El cambio quedará pendiente hasta que llegue el producto</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelNoStockConfirm}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateOrder}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4 mr-2" />
                    Crear Encargo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalWrapper>
  );
}
