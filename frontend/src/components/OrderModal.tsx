/**
 * Order Modal - Create new orders (encargos) with 3 order types
 * - Catalog: Select product from catalog (for out of stock items)
 * - Yomber: Custom measurements required
 * - Custom: Manual price for special items
 * Supports multi-school: allows adding items from different schools in a single transaction.
 * Creates separate orders (one per school) when items span multiple schools.
 */
import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Package, AlertCircle, Calendar, ShoppingBag, Ruler, Settings, Building2, Minimize2 } from 'lucide-react';
import thermalPrinterService from '../services/thermalPrinterService';
import DatePicker from './DatePicker';
import ClientSelector from './ClientSelector';
import ProductGroupSelector from './ProductGroupSelector';
import { orderService } from '../services/orderService';
import { productService } from '../services/productService';
import { useSchoolStore } from '../stores/schoolStore';
import { useDraftStore, type OrderDraft, type DraftItem } from '../stores/draftStore';
import { validateYomberMeasurements } from './YomberMeasurementsForm';
import type { GarmentType, OrderItemCreate, Product, GlobalProduct, YomberMeasurements } from '../types/api';

// Import modular components
import {
  CatalogTab,
  YomberTab,
  CustomTab,
  ItemsList,
  PaymentSection,
  SuccessModal,
  type OrderItemForm,
  type OrderResult,
  type TabType,
} from './OrderModal/index';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialSchoolId?: string;  // Optional - modal can manage school selection internally
  initialProduct?: Product;  // Optional - pre-load a product (catalog tab)
  draftId?: string | null;   // Optional - restore from draft
  onMinimize?: () => void;   // Callback when minimizing (to close modal without resetting)
}

export default function OrderModal({
  isOpen,
  onClose,
  onSuccess,
  initialSchoolId,
  initialProduct,
  draftId,
  onMinimize,
}: OrderModalProps) {
  // Multi-school support
  const { availableSchools, currentSchool } = useSchoolStore();
  const [selectedSchoolId, setSelectedSchoolId] = useState(
    initialSchoolId || currentSchool?.id || availableSchools[0]?.id || ''
  );
  const showSchoolSelector = availableSchools.length > 1;

  // Draft store for minimize/restore functionality
  const { addDraft, updateDraft, getDraft, removeDraft, setActiveDraft, canAddDraft } = useDraftStore();

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Multi-school success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderResults, setOrderResults] = useState<OrderResult[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);

  // Form state
  const [clientId, setClientId] = useState('');
  const [selectedClientEmail, setSelectedClientEmail] = useState<string | null>(null);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [advancePayment, setAdvancePayment] = useState<number>(0);
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<'' | 'cash' | 'nequi' | 'transfer' | 'card'>('');
  const [advanceAmountReceived, setAdvanceAmountReceived] = useState<number>(0);
  const [items, setItems] = useState<OrderItemForm[]>([]);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('catalog');

  // Product selector modal states
  const [catalogProductSelectorOpen, setCatalogProductSelectorOpen] = useState(false);
  const [yomberProductSelectorOpen, setYomberProductSelectorOpen] = useState(false);

  // Catalog tab state (setters used for initial product and resetCatalogForm)
  const [, setCatalogProductId] = useState('');
  const [, setCatalogQuantity] = useState(1);
  const [, setCatalogGarmentFilter] = useState('');

  // Yomber tab state
  const [yomberProductId, setYomberProductId] = useState('');
  const [yomberQuantity, setYomberQuantity] = useState(1);
  const [yomberMeasurements, setYomberMeasurements] = useState<Partial<YomberMeasurements>>({});
  const [yomberAdditionalPrice, setYomberAdditionalPrice] = useState(0);
  const [yomberEmbroideryText, setYomberEmbroideryText] = useState('');

  // Custom tab state
  const [customGarmentTypeId, setCustomGarmentTypeId] = useState('');
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customSize, setCustomSize] = useState('');
  const [customColor, setCustomColor] = useState('');
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [customNotes, setCustomNotes] = useState('');
  const [customEmbroideryText, setCustomEmbroideryText] = useState('');

  // Get yomber garment type IDs (those with has_custom_measurements = true)
  const yomberGarmentTypeIds = useMemo(() => {
    return garmentTypes
      .filter(gt => gt.has_custom_measurements)
      .map(gt => gt.id);
  }, [garmentTypes]);

  // Filter yomber products - only products whose garment type has has_custom_measurements = true
  const yomberProducts = useMemo(() => {
    return products.filter(p => yomberGarmentTypeIds.includes(p.garment_type_id));
  }, [products, yomberGarmentTypeIds]);

  // Group items by school for display and submission
  const itemsBySchool = useMemo(() => {
    const grouped = new Map<string, OrderItemForm[]>();
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

  // Get selected school object
  const selectedSchool = availableSchools.find(s => s.id === selectedSchoolId);

  // Calculate total
  const calculateTotal = (): number => {
    return items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  };

  const total = calculateTotal();

  // Load data
  const loadData = async (schoolIdToLoad?: string) => {
    const targetSchoolId = schoolIdToLoad || selectedSchoolId;
    if (!targetSchoolId) return;

    try {
      setLoadingData(true);
      const [garmentTypesData, productsData] = await Promise.all([
        productService.getGarmentTypes(targetSchoolId),
        productService.getProducts(targetSchoolId),
      ]);
      setGarmentTypes(garmentTypesData);
      setProducts(productsData);
    } catch (err: unknown) {
      console.error('Error loading data:', err);
      setError('Error al cargar datos');
    } finally {
      setLoadingData(false);
    }
  };

  // Reset functions
  const resetCatalogForm = () => {
    setCatalogProductId('');
    setCatalogQuantity(1);
    setCatalogGarmentFilter('');
  };

  const resetYomberForm = () => {
    setYomberProductId('');
    setYomberQuantity(1);
    setYomberMeasurements({});
    setYomberAdditionalPrice(0);
    setYomberEmbroideryText('');
  };

  const resetCustomForm = () => {
    setCustomGarmentTypeId('');
    setCustomQuantity(1);
    setCustomSize('');
    setCustomColor('');
    setCustomPrice(0);
    setCustomNotes('');
    setCustomEmbroideryText('');
  };

  const resetForm = () => {
    setClientId('');
    setSelectedClientEmail(null);
    setDeliveryDate('');
    setNotes('');
    setAdvancePayment(0);
    setAdvancePaymentMethod('');
    setItems([]);
    setError(null);
    setActiveTab('catalog');
    resetCatalogForm();
    resetYomberForm();
    resetCustomForm();
    setShowSuccessModal(false);
    setOrderResults([]);
  };

  // Effects
  useEffect(() => {
    if (isOpen) {
      // Check if we're restoring from a draft
      if (draftId) {
        const draft = getDraft(draftId);
        if (draft && draft.type === 'order') {
          // Restore state from draft
          const orderDraft = draft as OrderDraft;
          setSelectedSchoolId(orderDraft.schoolId);
          loadData(orderDraft.schoolId);
          setClientId(orderDraft.clientId);
          setSelectedClientEmail(orderDraft.clientEmail || null);
          setDeliveryDate(orderDraft.deliveryDate);
          setNotes(orderDraft.notes);
          setAdvancePayment(orderDraft.advancePayment);
          setAdvancePaymentMethod(orderDraft.advancePaymentMethod as '' | 'cash' | 'nequi' | 'transfer' | 'card');
          setActiveTab(orderDraft.activeTab);
          // Convert draft items to OrderItemForm
          const restoredItems: OrderItemForm[] = orderDraft.items.map(item => ({
            tempId: item.tempId,
            order_type: item.orderType as 'catalog' | 'yomber' | 'custom',
            garment_type_id: item.garmentTypeId || '',
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            size: item.size,
            color: item.color,
            custom_measurements: item.measurements as unknown as YomberMeasurements,
            embroidery_text: item.embroideryText,
            additional_price: item.additionalPrice,
            notes: item.notes,
            displayName: item.productName,
            unitPrice: item.unitPrice,
            school_id: item.schoolId || orderDraft.schoolId,
            school_name: item.schoolName || '',
          }));
          setItems(restoredItems);
          setActiveDraft(draftId);
          return;
        }
      }
      // Normal opening - reset form
      setSelectedSchoolId(initialSchoolId || currentSchool?.id || availableSchools[0]?.id || '');
      loadData(initialSchoolId || currentSchool?.id || availableSchools[0]?.id || '');
      resetForm();
    }
  }, [isOpen, draftId]);

  // Pre-load product when initialProduct is provided
  useEffect(() => {
    if (isOpen && initialProduct && products.length > 0) {
      // Set to catalog tab
      setActiveTab('catalog');
      // Pre-select the product
      setCatalogProductId(initialProduct.id);
      // Auto-add to items with quantity 1
      handleCatalogProductSelect(initialProduct, 1);
    }
  }, [isOpen, initialProduct, products]);

  // Handlers
  const handleSchoolChange = async (newSchoolId: string) => {
    setSelectedSchoolId(newSchoolId);
    resetCatalogForm();
    resetYomberForm();
    resetCustomForm();
    setError(null);
    await loadData(newSchoolId);
  };

  const handleCatalogProductSelect = (product: Product | GlobalProduct, quantity?: number) => {
    const garmentType = garmentTypes.find(gt => gt.id === product.garment_type_id);
    const stockAvailable = product.inventory_quantity ?? (product as Product & { stock?: number }).stock ?? 0;
    const isGlobalProduct = !('school_id' in product) || !(product as Product).school_id;

    const item: OrderItemForm = {
      tempId: Date.now().toString(),
      order_type: 'catalog',
      garment_type_id: product.garment_type_id,
      product_id: isGlobalProduct ? undefined : product.id,
      global_product_id: isGlobalProduct ? product.id : undefined,
      is_global_product: isGlobalProduct,
      quantity: quantity || 1,
      size: product.size,
      color: product.color || undefined,
      displayName: `${garmentType?.name || 'Producto'} - ${product.size}${product.color ? ` (${product.color})` : ''}`,
      unitPrice: Number(product.price),
      school_id: selectedSchoolId,
      school_name: selectedSchool?.name || getSchoolName(selectedSchoolId),
      reserve_stock: stockAvailable > 0,
      stock_available: stockAvailable,
    };

    setItems([...items, item]);
    setError(null);
  };

  const handleYomberProductSelect = (product: Product | GlobalProduct, quantity?: number) => {
    setYomberProductId(product.id);
    setYomberQuantity(quantity || 1);
    setError(null);
  };

  const handleAddYomberItem = () => {
    if (!yomberProductId) {
      setError('Selecciona un producto yomber para el precio base');
      return;
    }

    const validation = validateYomberMeasurements(yomberMeasurements);
    if (!validation.valid) {
      setError('Completa todas las medidas obligatorias del yomber');
      return;
    }

    const product = products.find(p => p.id === yomberProductId);
    if (!product) return;

    const basePrice = Number(product.price);
    const totalPrice = basePrice + yomberAdditionalPrice;

    const item: OrderItemForm = {
      tempId: Date.now().toString(),
      order_type: 'yomber',
      garment_type_id: product.garment_type_id,
      product_id: product.id,
      quantity: yomberQuantity,
      size: product.size,
      custom_measurements: yomberMeasurements as YomberMeasurements,
      additional_price: yomberAdditionalPrice > 0 ? yomberAdditionalPrice : undefined,
      embroidery_text: yomberEmbroideryText || undefined,
      displayName: `Yomber ${product.size} (sobre-medida)`,
      unitPrice: totalPrice,
      school_id: selectedSchoolId,
      school_name: selectedSchool?.name || getSchoolName(selectedSchoolId),
    };

    setItems([...items, item]);
    resetYomberForm();
    setError(null);
  };

  const handleAddCustomItem = () => {
    if (!customGarmentTypeId) {
      setError('Selecciona un tipo de prenda');
      return;
    }

    if (!customPrice || customPrice <= 0) {
      setError('Ingresa un precio valido');
      return;
    }

    const garmentType = garmentTypes.find(gt => gt.id === customGarmentTypeId);

    const item: OrderItemForm = {
      tempId: Date.now().toString(),
      order_type: 'custom',
      garment_type_id: customGarmentTypeId,
      quantity: customQuantity,
      unit_price: customPrice,
      size: customSize || undefined,
      color: customColor || undefined,
      embroidery_text: customEmbroideryText || undefined,
      notes: customNotes || undefined,
      displayName: `${garmentType?.name || 'Personalizado'}${customSize ? ` - ${customSize}` : ''}${customColor ? ` (${customColor})` : ''}`,
      unitPrice: customPrice,
      school_id: selectedSchoolId,
      school_name: selectedSchool?.name || getSchoolName(selectedSchoolId),
    };

    setItems([...items, item]);
    resetCustomForm();
    setError(null);
  };

  const handleRemoveItem = (tempId: string) => {
    setItems(items.filter(item => item.tempId !== tempId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId) {
      setError('Selecciona un cliente');
      return;
    }

    if (!selectedClientEmail) {
      setError('El cliente debe tener email para recibir notificaciones del encargo. Por favor selecciona un cliente con email o crea uno nuevo con email.');
      return;
    }

    if (items.length === 0) {
      setError('Agrega al menos un item al encargo');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results: OrderResult[] = [];
      const grandTotal = calculateTotal();

      for (const [schoolId, schoolItems] of itemsBySchool.entries()) {
        const schoolTotal = schoolItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        const schoolAdvance = grandTotal > 0
          ? Math.round((schoolTotal / grandTotal) * advancePayment)
          : 0;

        const orderItems: OrderItemCreate[] = schoolItems.map(item => ({
          garment_type_id: item.garment_type_id,
          quantity: item.quantity,
          order_type: item.order_type,
          product_id: item.product_id,
          global_product_id: item.global_product_id,
          is_global_product: item.is_global_product,
          unit_price: item.unit_price,
          additional_price: item.additional_price,
          size: item.size,
          color: item.color,
          gender: item.gender,
          custom_measurements: item.custom_measurements,
          embroidery_text: item.embroidery_text,
          notes: item.notes,
          reserve_stock: item.reserve_stock,
        }));

        console.log(`Creating order for school ${schoolId}:`, {
          items_count: orderItems.length,
          total: schoolTotal,
          advance: schoolAdvance,
        });

        const response = await orderService.createOrder(schoolId, {
          school_id: schoolId,
          client_id: clientId,
          delivery_date: deliveryDate || undefined,
          notes: notes || undefined,
          items: orderItems,
          advance_payment: schoolAdvance > 0 ? schoolAdvance : undefined,
          advance_payment_method: schoolAdvance > 0 && advancePaymentMethod ? advancePaymentMethod : undefined,
          advance_amount_received: schoolAdvance > 0 && advancePaymentMethod === 'cash' && advanceAmountReceived > 0
            ? advanceAmountReceived
            : undefined,
        });

        results.push({
          schoolName: schoolItems[0].school_name,
          orderCode: response.code,
          total: schoolTotal,
          orderId: response.id,
        });
      }

      setOrderResults(results);
      setShowSuccessModal(true);

    } catch (err: unknown) {
      console.error('Error creating order:', err);
      let errorMessage = 'Error al crear el encargo';
      const error = err as { response?: { data?: { detail?: string | Array<{ msg?: string; message?: string }> } } };
      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          errorMessage = error.response.data.detail.map((e) => e.msg || e.message || JSON.stringify(e)).join(', ');
        }
      }
      setError(errorMessage);
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
    setOrderResults([]);
    onSuccess();
    onClose();
  };

  const handlePrintReceipts = async () => {
    if (orderResults.length === 0) return;

    setIsPrinting(true);
    try {
      for (const result of orderResults) {
        const school = availableSchools.find(s => s.name === result.schoolName);
        if (school) {
          await thermalPrinterService.printOrderReceipt(school.id, result.orderId, school.name);
        }
      }
    } catch (error) {
      console.error('Error printing receipts:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleMinimize = () => {
    if (items.length === 0 && !clientId) {
      onClose();
      return;
    }

    if (!draftId && !canAddDraft()) {
      alert('Has alcanzado el maximo de 5 borradores. Elimina uno para continuar.');
      return;
    }

    const draftItems: DraftItem[] = items.map(item => ({
      tempId: item.tempId,
      productId: item.product_id,
      productName: item.displayName || '',
      size: item.size || '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      isGlobal: false,
      schoolId: item.school_id,
      schoolName: item.school_name,
      orderType: item.order_type,
      garmentTypeId: item.garment_type_id,
      garmentTypeName: garmentTypes.find(gt => gt.id === item.garment_type_id)?.name,
      measurements: item.custom_measurements as Record<string, number>,
      embroideryText: item.embroidery_text,
      color: item.color,
      notes: item.notes,
      additionalPrice: item.additional_price,
    }));

    const draftData = {
      type: 'order' as const,
      schoolId: selectedSchoolId,
      clientId: clientId,
      clientEmail: selectedClientEmail || undefined,
      deliveryDate: deliveryDate,
      notes: notes,
      advancePayment: advancePayment,
      advancePaymentMethod: advancePaymentMethod,
      activeTab: activeTab,
      items: draftItems,
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
        <div className="relative bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <Package className="w-6 h-6 mr-2 text-blue-600" />
              {draftId ? 'Continuar Encargo' : 'Nuevo Encargo'}
              {draftId && (
                <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                  Borrador
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              {(items.length > 0 || clientId) && (
                <button
                  type="button"
                  onClick={handleMinimize}
                  className="p-2 hover:bg-purple-100 rounded-lg text-purple-600 transition"
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

          {/* Loading Data */}
          {loadingData && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Cargando datos...</span>
            </div>
          )}

          {/* Form */}
          {!loadingData && (
            <form onSubmit={handleSubmit} className="p-6">
              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* School Selector */}
              {showSchoolSelector && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    Los productos, tipos de prenda y clientes se cargan del colegio seleccionado
                  </p>
                </div>
              )}

              {/* Client Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cliente *
                </label>
                <ClientSelector
                  value={clientId}
                  onChange={(id, client) => {
                    setClientId(id);
                    setSelectedClientEmail(client?.email || null);
                  }}
                  schoolId={selectedSchoolId}
                  allowNoClient={false}
                  requireEmail={true}
                  placeholder="Buscar cliente por nombre, telefono..."
                />
                {clientId && !selectedClientEmail && (
                  <p className="mt-1 text-xs text-orange-600">
                    Este cliente no tiene email. Los encargos requieren email para notificaciones.
                  </p>
                )}
              </div>

              {/* Delivery Date */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Fecha de Entrega
                </label>
                <DatePicker
                  value={deliveryDate}
                  onChange={(value) => setDeliveryDate(value)}
                  minDate={new Date().toISOString().split('T')[0]}
                  placeholder="Selecciona fecha de entrega"
                />
              </div>

              {/* Order Type Tabs */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Agregar Items al Encargo
                </label>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab('catalog')}
                    className={`flex items-center px-4 py-2 text-sm font-medium border-b-2 transition ${
                      activeTab === 'catalog'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Catalogo
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('yomber')}
                    className={`flex items-center px-4 py-2 text-sm font-medium border-b-2 transition ${
                      activeTab === 'yomber'
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Ruler className="w-4 h-4 mr-2" />
                    Yomber
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('custom')}
                    className={`flex items-center px-4 py-2 text-sm font-medium border-b-2 transition ${
                      activeTab === 'custom'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Personalizado
                  </button>
                </div>

                {/* Tab Content */}
                <div className="bg-gray-50 rounded-lg p-4">
                  {activeTab === 'catalog' && (
                    <CatalogTab onOpenSelector={() => setCatalogProductSelectorOpen(true)} />
                  )}

                  {activeTab === 'yomber' && (
                    <YomberTab
                      products={products}
                      garmentTypes={garmentTypes}
                      yomberProducts={yomberProducts}
                      yomberProductId={yomberProductId}
                      yomberQuantity={yomberQuantity}
                      yomberMeasurements={yomberMeasurements}
                      yomberAdditionalPrice={yomberAdditionalPrice}
                      yomberEmbroideryText={yomberEmbroideryText}
                      onOpenSelector={() => setYomberProductSelectorOpen(true)}
                      onQuantityChange={setYomberQuantity}
                      onMeasurementsChange={setYomberMeasurements}
                      onAdditionalPriceChange={setYomberAdditionalPrice}
                      onEmbroideryTextChange={setYomberEmbroideryText}
                      onAddItem={handleAddYomberItem}
                    />
                  )}

                  {activeTab === 'custom' && (
                    <CustomTab
                      garmentTypes={garmentTypes}
                      customGarmentTypeId={customGarmentTypeId}
                      customQuantity={customQuantity}
                      customSize={customSize}
                      customColor={customColor}
                      customPrice={customPrice}
                      customNotes={customNotes}
                      customEmbroideryText={customEmbroideryText}
                      onGarmentTypeChange={setCustomGarmentTypeId}
                      onQuantityChange={setCustomQuantity}
                      onSizeChange={setCustomSize}
                      onColorChange={setCustomColor}
                      onPriceChange={setCustomPrice}
                      onNotesChange={setCustomNotes}
                      onEmbroideryTextChange={setCustomEmbroideryText}
                      onAddItem={handleAddCustomItem}
                    />
                  )}
                </div>
              </div>

              {/* Items List */}
              <ItemsList
                items={items}
                itemsBySchool={itemsBySchool}
                onRemoveItem={handleRemoveItem}
              />

              {/* Payment Section */}
              {items.length > 0 && (
                <PaymentSection
                  total={total}
                  advancePayment={advancePayment}
                  advancePaymentMethod={advancePaymentMethod}
                  advanceAmountReceived={advanceAmountReceived}
                  onAdvancePaymentChange={setAdvancePayment}
                  onPaymentMethodChange={setAdvancePaymentMethod}
                  onAmountReceivedChange={setAdvanceAmountReceived}
                />
              )}

              {/* Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas del Encargo
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Notas adicionales sobre el encargo..."
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
                  disabled={loading || items.length === 0 || (advancePayment > 0 && !advancePaymentMethod)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    itemsBySchool.size > 1 ? `Crear ${itemsBySchool.size} Encargos` : 'Crear Encargo'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Product Group Selector for Catalog Tab */}
      <ProductGroupSelector
        isOpen={catalogProductSelectorOpen}
        onClose={() => setCatalogProductSelectorOpen(false)}
        onSelect={handleCatalogProductSelect}
        schoolId={selectedSchoolId}
        filterByStock="all"
        allowGlobalProducts={true}
        excludeProductIds={items.map(i => i.product_id || '')}
        excludeGarmentTypeIds={yomberGarmentTypeIds}
        title="Seleccionar Producto del Catalogo"
        emptyMessage="No hay productos disponibles para encargar"
      />

      {/* Product Group Selector for Yomber Tab */}
      <ProductGroupSelector
        isOpen={yomberProductSelectorOpen}
        onClose={() => setYomberProductSelectorOpen(false)}
        onSelect={handleYomberProductSelect}
        schoolId={selectedSchoolId}
        filterByStock="all"
        allowGlobalProducts={true}
        includeGarmentTypeIds={yomberGarmentTypeIds}
        excludeProductIds={yomberProductId ? [yomberProductId] : []}
        title="Seleccionar Producto Yomber"
        emptyMessage="No hay productos Yomber configurados"
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        orderResults={orderResults}
        availableSchools={availableSchools}
        isPrinting={isPrinting}
        onPrintReceipts={handlePrintReceipts}
        onClose={handleCloseSuccessModal}
      />
    </div>
  );
}
