/**
 * Sale Modal - Create New Sale Form
 * Supports multi-school: allows adding items from different schools in a single transaction.
 * Creates separate sales (one per school) when items span multiple schools.
 */
import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, ShoppingCart, Building2, UserX, Package, Minimize2, AlertTriangle } from 'lucide-react';
import { saleService, type SaleCreate, type SalePaymentCreate } from '../services/saleService';
import { productService } from '../services/productService';
import ClientSelector, { NO_CLIENT_ID } from './ClientSelector';
import ProductGroupSelector from './ProductGroupSelector';
import { useSchoolStore } from '../stores/schoolStore';
import { useDraftStore, type SaleDraft, type DraftItem, type DraftPayment } from '../stores/draftStore';
import type { Product, GlobalProduct, GarmentType, OrderListItem } from '../types/api';
import { orderService } from '../services/orderService';

// Import sub-components
import {
  HistoricalSaleSection,
  ProductSourceTabs,
  ItemsList,
  PaymentsSection,
  SuccessModal,
  type PaymentLine,
  type SaleItemCreateExtended,
  type SaleResult,
  type SaleFormData,
  type CurrentItem,
} from './SaleModal/index';

interface SaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialSchoolId?: string;  // Optional - modal can manage school selection internally
  initialProduct?: Product;  // Pre-load product (for "Start Sale" from Products page)
  initialQuantity?: number;  // Initial quantity for pre-loaded product
  draftId?: string | null;   // Optional - restore from draft
  onMinimize?: () => void;   // Callback when minimizing (to close modal without resetting)
}

export default function SaleModal({
  isOpen,
  onClose,
  onSuccess,
  initialSchoolId,
  initialProduct,
  initialQuantity = 1,
  draftId,
  onMinimize,
}: SaleModalProps) {
  // Multi-school support
  const { availableSchools, currentSchool } = useSchoolStore();
  const [selectedSchoolId, setSelectedSchoolId] = useState(
    initialSchoolId || currentSchool?.id || availableSchools[0]?.id || ''
  );
  const showSchoolSelector = availableSchools.length > 1;

  // Draft store for minimize/restore functionality
  const { addDraft, updateDraft, getDraft, removeDraft, setActiveDraft, canAddDraft } = useDraftStore();

  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [globalProducts, setGlobalProducts] = useState<GlobalProduct[]>([]);
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [productSource, setProductSource] = useState<'school' | 'global'>('school');

  // Calculate Yomber garment type IDs to exclude from sales selector
  const yomberGarmentTypeIds = useMemo(() => {
    return garmentTypes
      .filter(gt => gt.has_custom_measurements)
      .map(gt => gt.id);
  }, [garmentTypes]);

  // Product selector modal state
  const [productSelectorOpen, setProductSelectorOpen] = useState(false);

  // Multi-school success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [saleResults, setSaleResults] = useState<SaleResult[]>([]);

  const [formData, setFormData] = useState<SaleFormData>({
    client_id: '',
    notes: '',
    is_historical: false,
    sale_date: '',
    sale_day: '',
    sale_month: '',
    sale_year: '',
  });

  // Multiple payments support
  const [payments, setPayments] = useState<PaymentLine[]>([
    { id: '1', amount: 0, payment_method: '' }
  ]);

  // Pending orders warning state
  const [clientPendingOrders, setClientPendingOrders] = useState<OrderListItem[]>([]);
  const [pendingOrdersDismissed, setPendingOrdersDismissed] = useState(false);

  const [items, setItems] = useState<SaleItemCreateExtended[]>([]);
  const [currentItem, setCurrentItem] = useState<CurrentItem>({
    product_id: '',
    quantity: 1,
    unit_price: 0,
    is_global: false,
  });

  useEffect(() => {
    if (isOpen) {
      // Check if we're restoring from a draft
      if (draftId) {
        const draft = getDraft(draftId);
        if (draft && draft.type === 'sale') {
          // Restore state from draft
          const saleDraft = draft as SaleDraft;
          setSelectedSchoolId(saleDraft.schoolId);
          loadProducts(saleDraft.schoolId);
          setFormData({
            client_id: saleDraft.clientId,
            notes: saleDraft.notes,
            is_historical: saleDraft.isHistorical,
            sale_date: saleDraft.historicalDate || '',
            sale_day: saleDraft.historicalDate ? saleDraft.historicalDate.split('-')[2]?.split('T')[0] || '' : '',
            sale_month: saleDraft.historicalDate ? saleDraft.historicalDate.split('-')[1] || '' : '',
            sale_year: saleDraft.historicalDate ? saleDraft.historicalDate.split('-')[0] || '' : '',
          });
          // Convert draft items to SaleItemCreateExtended
          const restoredItems: SaleItemCreateExtended[] = saleDraft.items.map(item => ({
            product_id: item.productId || '',
            quantity: item.quantity,
            unit_price: item.unitPrice,
            is_global: item.isGlobal || false,
            display_name: item.productName,
            size: item.size,
            school_id: item.schoolId || saleDraft.schoolId,
            school_name: item.schoolName || '',
          }));
          setItems(restoredItems);
          // Convert draft payments to PaymentLine
          const restoredPayments: PaymentLine[] = saleDraft.payments.map(p => ({
            id: p.id,
            amount: p.amount,
            payment_method: p.paymentMethod as PaymentLine['payment_method'],
          }));
          setPayments(restoredPayments.length > 0 ? restoredPayments : [{ id: '1', amount: 0, payment_method: '' }]);
          setActiveDraft(draftId);
          return;
        }
      }
      // Normal opening - reset form
      setSelectedSchoolId(initialSchoolId || currentSchool?.id || availableSchools[0]?.id || '');
      loadProducts(initialSchoolId || currentSchool?.id || availableSchools[0]?.id || '');
      resetForm();
    }
  }, [isOpen, draftId]);

  // Pre-load product if initialProduct is provided (for "Start Sale" from Products page)
  useEffect(() => {
    if (isOpen && initialProduct) {
      // Auto-add the initial product to the cart
      const schoolName = getSchoolName(initialProduct.school_id);
      const newItem: SaleItemCreateExtended = {
        product_id: initialProduct.id,
        quantity: initialQuantity,
        unit_price: Number(initialProduct.price),
        is_global: false,
        display_name: initialProduct.name || '',
        size: initialProduct.size,
        school_id: initialProduct.school_id,
        school_name: schoolName,
      };
      setItems([newItem]);
    }
  }, [isOpen, initialProduct]);

  // Handler for school change - reload products but KEEP existing items from other schools
  const handleSchoolChange = async (newSchoolId: string) => {
    setSelectedSchoolId(newSchoolId);
    setCurrentItem({ product_id: '', quantity: 1, unit_price: 0, is_global: false });
    setError(null);
    await loadProducts(newSchoolId);
  };

  // Group items by school for display and submission
  const itemsBySchool = useMemo(() => {
    const grouped = new Map<string, SaleItemCreateExtended[]>();
    items.forEach(item => {
      if (!grouped.has(item.school_id)) {
        grouped.set(item.school_id, []);
      }
      grouped.get(item.school_id)!.push(item);
    });
    return grouped;
  }, [items]);

  // Get school name by id
  const getSchoolName = (schoolId: string) => {
    return availableSchools.find(s => s.id === schoolId)?.name || 'Colegio';
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      notes: '',
      is_historical: false,
      sale_date: '',
      sale_day: '',
      sale_month: '',
      sale_year: '',
    });
    setPayments([{ id: '1', amount: 0, payment_method: '' }]);
    setItems([]);
    setCurrentItem({
      product_id: '',
      quantity: 1,
      unit_price: 0,
      is_global: false,
    });
    setProductSource('school');
    setError(null);
    setShowSuccessModal(false);
    setSaleResults([]);
  };

  // Payment helpers
  const totalPayments = useMemo(() =>
    payments.reduce((sum, p) => sum + p.amount, 0),
    [payments]
  );

  const addPaymentLine = () => {
    setPayments([
      ...payments,
      { id: Date.now().toString(), amount: 0, payment_method: '' }
    ]);
  };

  const removePaymentLine = (id: string) => {
    if (payments.length === 1) return;
    setPayments(payments.filter(p => p.id !== id));
  };

  const updatePaymentAmount = (id: string, amount: number) => {
    setPayments(payments.map(p =>
      p.id === id ? { ...p, amount } : p
    ));
  };

  const updatePaymentMethod = (id: string, method: PaymentLine['payment_method']) => {
    setPayments(payments.map(p =>
      p.id === id ? { ...p, payment_method: method, amount_received: undefined } : p
    ));
  };

  const updateAmountReceived = (id: string, value: number) => {
    setPayments(payments.map(p =>
      p.id === id ? { ...p, amount_received: value || undefined } : p
    ));
  };

  // Auto-fill first payment with total when items change
  useEffect(() => {
    const total = calculateTotal();
    if (payments.length === 1 && total > 0) {
      const currentPayment = payments[0];
      if (currentPayment.amount === 0 || currentPayment.amount !== total) {
        setPayments([{ ...currentPayment, amount: total }]);
      }
    }
  }, [items]);

  // Check for pending orders when client changes
  useEffect(() => {
    const checkClientOrders = async () => {
      if (!formData.client_id || formData.client_id === NO_CLIENT_ID) {
        setClientPendingOrders([]);
        setPendingOrdersDismissed(false);
        return;
      }
      try {
        const orders = await orderService.getClientActiveOrders(formData.client_id);
        setClientPendingOrders(orders);
        setPendingOrdersDismissed(false);
      } catch (err) {
        console.error('Error checking client orders:', err);
        setClientPendingOrders([]);
      }
    };
    checkClientOrders();
  }, [formData.client_id]);

  const loadProducts = async (schoolIdToLoad?: string) => {
    const targetSchoolId = schoolIdToLoad || selectedSchoolId;
    if (!targetSchoolId) return;

    try {
      const [productsData, globalProductsData, garmentTypesData] = await Promise.all([
        productService.getProducts(targetSchoolId),
        productService.getGlobalProducts(true),
        productService.getGarmentTypes(targetSchoolId),
      ]);
      setProducts(productsData);
      setGlobalProducts(globalProductsData);
      setGarmentTypes(garmentTypesData);
    } catch (err: unknown) {
      console.error('Error loading products:', err);
      setError('Error al cargar productos');
    }
  };

  // Handler for ProductSelectorModal selection
  const handleProductSelectorSelect = (product: Product | GlobalProduct, quantity?: number, isGlobalParam?: boolean) => {
    const isGlobal = isGlobalParam ?? ('inventory_quantity' in product && !('school_id' in product));
    const schoolId = isGlobal ? selectedSchoolId : (product as Product).school_id;
    const schoolName = getSchoolName(schoolId);
    const requestedQty = quantity || 1;

    const availableStock = isGlobal
      ? (product as GlobalProduct).inventory_quantity ?? 0
      : (product as Product).inventory_quantity ?? (product as Product).stock ?? 0;

    const existingItem = items.find(
      item => item.product_id === product.id && item.is_global === isGlobal
    );
    const totalQuantity = (existingItem?.quantity || 0) + requestedQty;

    if (!formData.is_historical && totalQuantity > availableStock) {
      setError(`Stock insuficiente para ${product.name || product.code}. Disponible: ${availableStock}, solicitado: ${totalQuantity}`);
      return;
    }

    const newItem: SaleItemCreateExtended = {
      product_id: product.id,
      quantity: requestedQty,
      unit_price: Number(product.price),
      is_global: isGlobal,
      display_name: product.name || '',
      size: product.size,
      school_id: schoolId,
      school_name: schoolName,
    };

    const existingIndex = items.findIndex(
      item => item.product_id === product.id && item.is_global === isGlobal
    );

    if (existingIndex !== -1) {
      const updatedItems = [...items];
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        quantity: updatedItems[existingIndex].quantity + requestedQty,
      };
      setItems(updatedItems);
    } else {
      setItems([...items, newItem]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => total + (item.quantity * item.unit_price), 0);
  };

  const getProductName = (productId: string, isGlobal: boolean = false) => {
    if (isGlobal) {
      const product = globalProducts.find(p => p.id === productId);
      return product ? `🌐 ${product.name} - ${product.size} (${product.code})` : productId;
    }
    const product = products.find(p => p.id === productId);
    return product ? `${product.name} - ${product.size} (${product.code})` : productId;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.client_id) {
      setError('Selecciona un cliente o "Sin Cliente"');
      return;
    }

    if (items.length === 0) {
      setError('Agrega al menos un producto a la venta');
      return;
    }

    const total = calculateTotal();
    if (totalPayments !== total) {
      setError(`La suma de pagos ($${totalPayments.toLocaleString()}) no coincide con el total ($${total.toLocaleString()})`);
      return;
    }

    if (payments.every(p => p.amount <= 0)) {
      setError('Debes ingresar al menos un pago');
      return;
    }

    if (formData.is_historical) {
      if (!formData.sale_day || !formData.sale_month || !formData.sale_year) {
        setError('Para ventas históricas debes ingresar día, mes y año');
        return;
      }
      const day = parseInt(formData.sale_day);
      const month = parseInt(formData.sale_month);
      const year = parseInt(formData.sale_year);
      if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2020) {
        setError('La fecha ingresada no es válida');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const clientId = formData.client_id === NO_CLIENT_ID ? undefined : formData.client_id;

      let saleDateStr: string | undefined = undefined;
      if (formData.is_historical && formData.sale_day && formData.sale_month && formData.sale_year) {
        const day = formData.sale_day.padStart(2, '0');
        const month = formData.sale_month;
        const year = formData.sale_year;
        saleDateStr = `${year}-${month}-${day}T12:00:00`;
      }

      const paymentsData: SalePaymentCreate[] = payments
        .filter(p => p.amount > 0 && p.payment_method)
        .map(p => ({
          amount: p.amount,
          payment_method: p.payment_method as SalePaymentCreate['payment_method'],
          ...(p.payment_method === 'cash' && p.amount_received
            ? { amount_received: p.amount_received }
            : {}),
        }));

      if (paymentsData.length === 0) {
        setError('Debes agregar al menos un pago con monto mayor a 0');
        setLoading(false);
        return;
      }

      const results: SaleResult[] = [];

      for (const [schoolId, schoolItems] of itemsBySchool.entries()) {
        const schoolTotal = schoolItems.reduce(
          (sum, item) => sum + (item.quantity * item.unit_price),
          0
        );

        let schoolPayments: SalePaymentCreate[];
        if (itemsBySchool.size > 1) {
          const proportion = schoolTotal / total;
          schoolPayments = paymentsData.map(p => ({
            ...p,
            amount: Math.round(p.amount * proportion)
          }));
          const sumSchoolPayments = schoolPayments.reduce((s, p) => s + p.amount, 0);
          if (sumSchoolPayments !== schoolTotal && schoolPayments.length > 0) {
            schoolPayments[0].amount += (schoolTotal - sumSchoolPayments);
          }
        } else {
          schoolPayments = paymentsData;
        }

        const saleData: SaleCreate = {
          school_id: schoolId,
          client_id: clientId as string,
          items: schoolItems.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            is_global: item.is_global,
          })),
          payments: schoolPayments,
          notes: formData.notes || undefined,
          is_historical: formData.is_historical === true,
          sale_date: saleDateStr,
        };

        console.log(`Creating sale for school ${schoolId}:`, {
          is_historical: saleData.is_historical,
          sale_date: saleData.sale_date,
          items_count: saleData.items.length,
          payments: saleData.payments
        });

        const response = await saleService.createSale(schoolId, saleData);

        results.push({
          schoolName: schoolItems[0].school_name,
          saleCode: response.code,
          total: schoolTotal,
          saleId: response.id,
          paymentMethod: schoolPayments.length > 0
            ? schoolPayments.reduce((a, b) => a.amount > b.amount ? a : b).payment_method
            : 'cash',
        });
      }

      setSaleResults(results);
      setShowSuccessModal(true);

    } catch (err: unknown) {
      console.error('Error creating sale:', err);
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || 'Error al crear la venta');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSuccessModal = () => {
    if (draftId) {
      removeDraft(draftId);
    }
    setActiveDraft(null);
    setShowSuccessModal(false);
    setSaleResults([]);
    onSuccess();
    onClose();
  };

  const handleMinimize = () => {
    if (items.length === 0 && !formData.client_id) {
      onClose();
      return;
    }

    if (!draftId && !canAddDraft()) {
      alert('Has alcanzado el máximo de 5 borradores. Elimina uno para continuar.');
      return;
    }

    const total = calculateTotal();

    let historicalDate: string | undefined;
    if (formData.is_historical && formData.sale_day && formData.sale_month && formData.sale_year) {
      historicalDate = `${formData.sale_year}-${formData.sale_month}-${formData.sale_day.padStart(2, '0')}`;
    }

    const draftItems: DraftItem[] = items.map(item => ({
      tempId: `${item.product_id}-${Date.now()}`,
      productId: item.product_id,
      productName: item.display_name || '',
      size: item.size || '',
      quantity: item.quantity,
      unitPrice: item.unit_price,
      isGlobal: item.is_global,
      schoolId: item.school_id,
      schoolName: item.school_name,
    }));

    const draftPayments: DraftPayment[] = payments.map(p => ({
      id: p.id,
      amount: p.amount,
      paymentMethod: p.payment_method,
    }));

    const draftData = {
      type: 'sale' as const,
      schoolId: selectedSchoolId,
      clientId: formData.client_id,
      notes: formData.notes,
      isHistorical: formData.is_historical,
      historicalDate,
      items: draftItems,
      payments: draftPayments,
      total,
    };

    if (draftId) {
      updateDraft(draftId, draftData);
    } else {
      addDraft(draftData);
    }

    setActiveDraft(null);
    onMinimize?.();
    onClose();
  };

  const handleProductSourceChange = (source: 'school' | 'global') => {
    setProductSource(source);
    setCurrentItem({ ...currentItem, product_id: '', is_global: source === 'global' });
  };

  const handleFormDataChange = (data: Partial<SaleFormData>) => {
    setFormData({ ...formData, ...data });
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
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <ShoppingCart className="w-6 h-6 mr-2" />
              {draftId ? 'Continuar Venta' : 'Nueva Venta'}
              {draftId && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  Borrador
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              {(items.length > 0 || formData.client_id) && (
                <button
                  type="button"
                  onClick={handleMinimize}
                  className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition"
                  title="Minimizar y guardar como borrador"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* School Selector */}
              {showSchoolSelector && (
                <div className="md:col-span-2 mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Building2 className="w-4 h-4 inline mr-1" />
                    Colegio *
                  </label>
                  <select
                    value={selectedSchoolId}
                    onChange={(e) => handleSchoolChange(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-blue-50"
                  >
                    {availableSchools.map(school => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-blue-600">
                    Los productos y clientes se cargan del colegio seleccionado
                  </p>
                </div>
              )}

              {/* Client */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente
                </label>
                <ClientSelector
                  value={formData.client_id}
                  onChange={(clientId) => setFormData({ ...formData, client_id: clientId })}
                  schoolId={selectedSchoolId}
                  allowNoClient={true}
                  placeholder="Buscar cliente por nombre, teléfono..."
                />
                {formData.client_id === NO_CLIENT_ID && (
                  <p className="mt-1 text-xs text-orange-600 flex items-center">
                    <UserX className="w-3 h-3 mr-1" />
                    La venta se registrará sin cliente asociado
                  </p>
                )}
              </div>
            </div>

            {/* Pending Orders Warning */}
            {clientPendingOrders.length > 0 && !pendingOrdersDismissed && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-yellow-800">
                      Este cliente tiene {clientPendingOrders.length} encargo(s) pendiente(s)
                    </h4>
                    <p className="text-xs text-yellow-700 mt-1">
                      Verifique que no este comprando los mismos productos del encargo.
                    </p>
                    <div className="mt-2 space-y-1">
                      {clientPendingOrders.map(order => (
                        <div key={order.id} className="text-xs bg-yellow-100 rounded p-2 flex justify-between items-center gap-2">
                          <span className="font-mono font-medium">{order.code}</span>
                          <span>{order.items_count} items</span>
                          <span className="font-medium">${Number(order.total).toLocaleString()}</span>
                          <span className="text-yellow-600">
                            {new Date(order.created_at).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingOrdersDismissed(true)}
                        className="text-xs px-3 py-1 bg-yellow-200 hover:bg-yellow-300 text-yellow-800 rounded transition"
                      >
                        Continuar de todos modos
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const clientName = clientPendingOrders[0]?.client_name || '';
                          window.open(`/orders?search=${encodeURIComponent(clientName)}`, '_blank');
                        }}
                        className="text-xs px-3 py-1 bg-white border border-yellow-300 hover:bg-yellow-50 text-yellow-800 rounded transition"
                      >
                        Ver encargos
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Historical Sale Section */}
            <HistoricalSaleSection
              formData={formData}
              onFormDataChange={handleFormDataChange}
            />

            {/* Add Product Section */}
            <div className="border-t border-gray-200 pt-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Agregar Productos</h3>

              {/* Product Source Tabs */}
              <ProductSourceTabs
                productSource={productSource}
                onSourceChange={handleProductSourceChange}
                schoolProductCount={products.length}
                globalProductCount={globalProducts.length}
              />

              {/* Product Selector Button */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agregar Productos
                </label>
                <button
                  type="button"
                  onClick={() => setProductSelectorOpen(true)}
                  className="w-full px-6 py-4 border-2 border-dashed border-blue-400 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition flex flex-col items-center gap-2 group"
                >
                  <Package className="w-8 h-8 text-blue-500 group-hover:text-blue-600" />
                  <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700">
                    Buscar y agregar productos
                  </span>
                  <span className="text-xs text-gray-500">
                    Click para abrir el catálogo
                  </span>
                </button>
              </div>
            </div>

            {/* Items List */}
            {items.length > 0 && (
              <>
                <ItemsList
                  items={items}
                  itemsBySchool={itemsBySchool}
                  onRemoveItem={handleRemoveItem}
                  getProductName={getProductName}
                />

                {/* Payments Section */}
                <PaymentsSection
                  payments={payments}
                  totalAmount={calculateTotal()}
                  onAddPayment={addPaymentLine}
                  onRemovePayment={removePaymentLine}
                  onUpdateAmount={updatePaymentAmount}
                  onUpdateMethod={updatePaymentMethod}
                  onUpdateAmountReceived={updateAmountReceived}
                />
              </>
            )}

            {/* Notes */}
            <div className="mb-6 mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas (Opcional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Observaciones adicionales..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              />
            </div>

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
                disabled={loading || items.length === 0 || payments.some(p => !p.payment_method)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  itemsBySchool.size > 1 ? `Crear ${itemsBySchool.size} Ventas` : 'Crear Venta'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        results={saleResults}
        availableSchools={availableSchools}
        onClose={handleCloseSuccessModal}
      />

      {/* Product Group Selector */}
      <ProductGroupSelector
        isOpen={productSelectorOpen}
        onClose={() => setProductSelectorOpen(false)}
        onSelect={handleProductSelectorSelect}
        schoolId={selectedSchoolId}
        filterByStock={formData.is_historical ? 'all' : 'with_stock'}
        excludeProductIds={items.map(i => i.product_id)}
        excludeGarmentTypeIds={yomberGarmentTypeIds}
        allowGlobalProducts={true}
        initialProductSource={productSource}
        title="Seleccionar Producto"
        emptyMessage="No se encontraron productos disponibles"
        enforceStockLimit={!formData.is_historical}
      />
    </div>
  );
}
