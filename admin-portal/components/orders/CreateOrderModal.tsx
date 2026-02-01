'use client';

/**
 * CreateOrderModal - Create new orders (encargos) with 3 order types
 * - Catalog: Select product from catalog
 * - Yomber: Custom measurements required
 * - Custom: Manual price for special items
 * Supports multi-school: allows adding items from different schools in a single transaction.
 */
import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Loader2,
  Package,
  AlertCircle,
  Calendar,
  ShoppingBag,
  Ruler,
  Settings,
  Building2,
  Minimize2,
  Truck,
  MapPin,
} from 'lucide-react';
import { useAdminAuth } from '@/lib/adminAuth';
import schoolService from '@/lib/services/schoolService';
import productService from '@/lib/services/productService';
import ordersService from '@/lib/services/ordersService';
import deliveryZoneService from '@/lib/services/deliveryZoneService';
import {
  useDraftStore,
  type OrderDraft,
  type DraftItem,
} from '@/lib/stores/draftStore';
import ProductGroupSelector from '@/components/vendor/ProductGroupSelector';
import type { Product, GlobalProduct, GarmentType, School, Client, DeliveryZone } from '@/lib/api';

import CatalogTab from './CatalogTab';
import YomberTab from './YomberTab';
import CustomTab from './CustomTab';
import OrderItemsList from './OrderItemsList';
import PaymentSection from './PaymentSection';
import SuccessModal from './SuccessModal';
import ClientSelector from './ClientSelector';
import {
  type OrderItemForm,
  type OrderResult,
  type TabType,
  type PaymentMethod,
  type YomberMeasurements,
  validateYomberMeasurements,
} from './types';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialSchoolId?: string;
  draftId?: string | null;
  onMinimize?: () => void;
}

export default function CreateOrderModal({
  isOpen,
  onClose,
  onSuccess,
  initialSchoolId,
  draftId,
  onMinimize,
}: CreateOrderModalProps) {
  const { user } = useAdminAuth();

  // Multi-school support
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState(initialSchoolId || '');

  // Draft store
  const { addDraft, updateDraft, getDraft, removeDraft, setActiveDraft, canAddDraft } = useDraftStore();

  // Data state
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderResults, setOrderResults] = useState<OrderResult[]>([]);

  // Form state
  const [clientId, setClientId] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedClientEmail, setSelectedClientEmail] = useState<string | null>(null);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryZoneId, setDeliveryZoneId] = useState('');
  const [notes, setNotes] = useState('');
  const [advancePayment, setAdvancePayment] = useState<number>(0);
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<PaymentMethod | ''>('');
  const [advanceAmountReceived, setAdvanceAmountReceived] = useState<number>(0);
  const [items, setItems] = useState<OrderItemForm[]>([]);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('catalog');

  // Product selector modal states
  const [catalogProductSelectorOpen, setCatalogProductSelectorOpen] = useState(false);
  const [yomberProductSelectorOpen, setYomberProductSelectorOpen] = useState(false);

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

  // Get accessible schools based on user roles
  const accessibleSchools = useMemo(() => {
    if (user?.is_superuser) {
      return schools.filter(s => s.is_active);
    }
    if (user?.school_roles) {
      const accessibleIds = user.school_roles.map(r => r.school_id);
      return schools.filter(s => s.is_active && accessibleIds.includes(s.id));
    }
    return [];
  }, [schools, user]);

  const showSchoolSelector = accessibleSchools.length > 1;

  // Get selected school object
  const selectedSchool = accessibleSchools.find(s => s.id === selectedSchoolId);

  // Get yomber garment type IDs
  const yomberGarmentTypeIds = useMemo(() => {
    return garmentTypes
      .filter(gt => gt.has_custom_measurements)
      .map(gt => gt.id);
  }, [garmentTypes]);

  // Filter yomber products
  const yomberProducts = useMemo(() => {
    return products.filter(p => yomberGarmentTypeIds.includes(p.garment_type_id));
  }, [products, yomberGarmentTypeIds]);

  // Group items by school
  const itemsBySchool = useMemo(() => {
    const grouped = new Map<string, OrderItemForm[]>();
    items.forEach(item => {
      if (!grouped.has(item.schoolId)) {
        grouped.set(item.schoolId, []);
      }
      grouped.get(item.schoolId)!.push(item);
    });
    return grouped;
  }, [items]);

  // Calculate total
  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  }, [items]);

  // Load initial data
  const loadSchools = async () => {
    try {
      const data = await schoolService.list();
      setSchools(data);
      if (!selectedSchoolId && data.length > 0) {
        const activeSchools = data.filter(s => s.is_active);
        if (activeSchools.length > 0) {
          setSelectedSchoolId(activeSchools[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading schools:', err);
    }
  };

  const loadSchoolData = async (schoolId: string) => {
    if (!schoolId) return;

    try {
      setLoadingData(true);
      const [garmentTypesData, productsData, zonesData] = await Promise.all([
        productService.getGarmentTypes(schoolId),
        productService.getProducts(schoolId, true),
        deliveryZoneService.list(),
      ]);
      setGarmentTypes(garmentTypesData);
      setProducts(productsData);
      setDeliveryZones(zonesData.filter(z => z.is_active));
    } catch (err) {
      console.error('Error loading school data:', err);
      setError('Error al cargar datos del colegio');
    } finally {
      setLoadingData(false);
    }
  };

  // Reset functions
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
    setDeliveryType('pickup');
    setDeliveryZoneId('');
    setNotes('');
    setAdvancePayment(0);
    setAdvancePaymentMethod('');
    setAdvanceAmountReceived(0);
    setItems([]);
    setError(null);
    setActiveTab('catalog');
    resetYomberForm();
    resetCustomForm();
    setShowSuccessModal(false);
    setOrderResults([]);
  };

  // Effects
  useEffect(() => {
    if (isOpen) {
      loadSchools();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && selectedSchoolId) {
      // Check if restoring from draft
      if (draftId) {
        const draft = getDraft(draftId);
        if (draft && draft.type === 'order') {
          const orderDraft = draft as OrderDraft;
          setSelectedSchoolId(orderDraft.schoolId);
          loadSchoolData(orderDraft.schoolId).then(() => {
            setClientId(orderDraft.clientId);
            setSelectedClientEmail(orderDraft.clientEmail || null);
            setDeliveryDate(orderDraft.deliveryDate);
            setDeliveryType(orderDraft.deliveryType || 'pickup');
            setDeliveryZoneId(orderDraft.deliveryZoneId || '');
            setNotes(orderDraft.notes);
            setAdvancePayment(orderDraft.advancePayment);
            setAdvancePaymentMethod(orderDraft.advancePaymentMethod as PaymentMethod | '');
            setAdvanceAmountReceived(orderDraft.advanceAmountReceived || 0);
            setActiveTab(orderDraft.activeTab);
            // Convert draft items to OrderItemForm
            const restoredItems: OrderItemForm[] = orderDraft.items.map(item => ({
              tempId: item.tempId,
              orderType: item.orderType as 'catalog' | 'yomber' | 'custom',
              garmentTypeId: item.garmentTypeId,
              garmentTypeName: item.garmentTypeName,
              productId: item.productId,
              globalProductId: item.globalProductId,
              isGlobalProduct: item.isGlobalProduct,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              size: item.size,
              color: item.color,
              customMeasurements: item.measurements as unknown as YomberMeasurements,
              embroideryText: item.embroideryText,
              additionalPrice: item.additionalPrice,
              notes: item.notes,
              stockAvailable: item.stockAvailable,
              reserveStock: item.reserveStock,
              schoolId: item.schoolId || orderDraft.schoolId,
              schoolName: item.schoolName || '',
            }));
            setItems(restoredItems);
          });
          setActiveDraft(draftId);
          return;
        }
      }
      // Normal opening
      loadSchoolData(selectedSchoolId);
      resetForm();
    }
  }, [isOpen, selectedSchoolId, draftId]);

  // Handlers
  const handleSchoolChange = async (newSchoolId: string) => {
    setSelectedSchoolId(newSchoolId);
    setClientId('');
    setSelectedClientEmail(null);
    resetYomberForm();
    resetCustomForm();
    setError(null);
    await loadSchoolData(newSchoolId);
  };

  const handleClientChange = (id: string, client?: Client) => {
    setClientId(id);
    setSelectedClient(client || null);
    setSelectedClientEmail(client?.email || null);
  };

  const handleCatalogProductSelect = (product: Product | GlobalProduct, quantity: number, isGlobal?: boolean) => {
    const garmentType = garmentTypes.find(gt => gt.id === product.garment_type_id);
    const stockAvailable = product.inventory_quantity ?? 0;

    const item: OrderItemForm = {
      tempId: Date.now().toString(),
      orderType: 'catalog',
      garmentTypeId: product.garment_type_id,
      garmentTypeName: garmentType?.name,
      productId: isGlobal ? undefined : product.id,
      globalProductId: isGlobal ? product.id : undefined,
      isGlobalProduct: isGlobal,
      productName: `${garmentType?.name || 'Producto'} - ${product.size}${product.color ? ` (${product.color})` : ''}`,
      productCode: product.code,
      quantity: quantity || 1,
      unitPrice: Number(product.price),
      size: product.size,
      color: product.color || undefined,
      reserveStock: stockAvailable > 0,
      stockAvailable,
      schoolId: selectedSchoolId,
      schoolName: selectedSchool?.name || '',
    };

    setItems([...items, item]);
    setError(null);
  };

  const handleYomberProductSelect = (product: Product | GlobalProduct) => {
    setYomberProductId(product.id);
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

    const garmentType = garmentTypes.find(gt => gt.id === product.garment_type_id);
    const basePrice = Number(product.price);
    const totalPrice = basePrice + yomberAdditionalPrice;

    const item: OrderItemForm = {
      tempId: Date.now().toString(),
      orderType: 'yomber',
      garmentTypeId: product.garment_type_id,
      garmentTypeName: garmentType?.name,
      productId: product.id,
      productName: `Yomber ${garmentType?.name || ''} - ${product.size} (sobre-medida)`,
      quantity: yomberQuantity,
      unitPrice: totalPrice,
      size: product.size,
      customMeasurements: yomberMeasurements as YomberMeasurements,
      additionalPrice: yomberAdditionalPrice > 0 ? yomberAdditionalPrice : undefined,
      embroideryText: yomberEmbroideryText || undefined,
      schoolId: selectedSchoolId,
      schoolName: selectedSchool?.name || '',
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
      orderType: 'custom',
      garmentTypeId: customGarmentTypeId,
      garmentTypeName: garmentType?.name,
      productName: `${garmentType?.name || 'Personalizado'}${customSize ? ` - ${customSize}` : ''}${customColor ? ` (${customColor})` : ''}`,
      quantity: customQuantity,
      unitPrice: customPrice,
      size: customSize || undefined,
      color: customColor || undefined,
      embroideryText: customEmbroideryText || undefined,
      notes: customNotes || undefined,
      schoolId: selectedSchoolId,
      schoolName: selectedSchool?.name || '',
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
      setError('El cliente debe tener email para recibir notificaciones del encargo.');
      return;
    }

    if (items.length === 0) {
      setError('Agrega al menos un item al encargo');
      return;
    }

    if (deliveryType === 'delivery' && !deliveryZoneId) {
      setError('Selecciona una zona de entrega');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results: OrderResult[] = [];

      for (const [schoolId, schoolItems] of itemsBySchool.entries()) {
        const schoolTotal = schoolItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        const schoolAdvance = total > 0
          ? Math.round((schoolTotal / total) * advancePayment)
          : 0;

        const orderItems = schoolItems.map(item => ({
          garment_type_id: item.garmentTypeId,
          quantity: item.quantity,
          order_type: item.orderType,
          product_id: item.productId,
          global_product_id: item.globalProductId,
          is_global_product: item.isGlobalProduct,
          unit_price: item.orderType === 'custom' ? item.unitPrice : undefined,
          additional_price: item.additionalPrice,
          size: item.size,
          color: item.color,
          gender: item.gender,
          custom_measurements: item.customMeasurements,
          embroidery_text: item.embroideryText,
          notes: item.notes,
          reserve_stock: item.reserveStock,
        }));

        const response = await ordersService.create(schoolId, {
          client_id: clientId,
          delivery_date: deliveryDate || undefined,
          delivery_type: deliveryType,
          delivery_zone_id: deliveryType === 'delivery' ? deliveryZoneId : undefined,
          notes: notes || undefined,
          items: orderItems,
          advance_payment: schoolAdvance > 0 ? schoolAdvance : undefined,
          advance_payment_method: schoolAdvance > 0 && advancePaymentMethod ? advancePaymentMethod : undefined,
        });

        results.push({
          schoolName: schoolItems[0].schoolName,
          orderCode: response.code,
          total: schoolTotal,
          orderId: response.id,
        });
      }

      setOrderResults(results);
      setShowSuccessModal(true);

    } catch (err: any) {
      console.error('Error creating order:', err);
      let errorMessage = 'Error al crear el encargo';
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ');
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
      productId: item.productId,
      productName: item.productName || '',
      size: item.size || '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      isGlobal: item.isGlobalProduct,
      schoolId: item.schoolId,
      schoolName: item.schoolName,
      orderType: item.orderType,
      garmentTypeId: item.garmentTypeId,
      garmentTypeName: item.garmentTypeName,
      measurements: item.customMeasurements as unknown as Record<string, number>,
      embroideryText: item.embroideryText,
      color: item.color,
      notes: item.notes,
      additionalPrice: item.additionalPrice,
      stockAvailable: item.stockAvailable,
      reserveStock: item.reserveStock,
      globalProductId: item.globalProductId,
      isGlobalProduct: item.isGlobalProduct,
    }));

    const draftData = {
      type: 'order' as const,
      schoolId: selectedSchoolId,
      clientId: clientId,
      clientName: selectedClient?.name || selectedClient?.student_name,
      clientEmail: selectedClientEmail || undefined,
      deliveryDate: deliveryDate,
      deliveryType: deliveryType,
      deliveryZoneId: deliveryZoneId || undefined,
      notes: notes,
      advancePayment: advancePayment,
      advancePaymentMethod: advancePaymentMethod,
      advanceAmountReceived: advanceAmountReceived,
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
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
            <h2 className="text-xl font-semibold text-slate-800 flex items-center">
              <Package className="w-6 h-6 mr-2 text-brand-600" />
              {draftId ? 'Continuar Encargo' : 'Nuevo Encargo'}
              {draftId && (
                <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                  Borrador
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              {(items.length > 0 || clientId) && onMinimize && (
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
                className="text-slate-400 hover:text-slate-600 transition p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Loading Data */}
          {loadingData && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
              <span className="ml-3 text-slate-600">Cargando datos...</span>
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Building2 className="w-4 h-4 inline mr-1" />
                    Colegio *
                  </label>
                  <select
                    value={selectedSchoolId}
                    onChange={(e) => handleSchoolChange(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-blue-50"
                  >
                    {accessibleSchools.map(school => (
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
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Cliente *
                </label>
                <ClientSelector
                  value={clientId}
                  onChange={handleClientChange}
                  requireEmail={true}
                  placeholder="Buscar cliente por nombre, teléfono o email..."
                  error={clientId && !selectedClientEmail ? 'Este cliente no tiene email. Los encargos requieren email para notificaciones.' : undefined}
                />
              </div>

              {/* Delivery Date */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Fecha de Entrega
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Delivery Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo de Entrega
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="deliveryType"
                      value="pickup"
                      checked={deliveryType === 'pickup'}
                      onChange={() => setDeliveryType('pickup')}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <Package className="w-4 h-4 text-slate-500" />
                    <span className="text-sm">Recoger en tienda</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="deliveryType"
                      value="delivery"
                      checked={deliveryType === 'delivery'}
                      onChange={() => setDeliveryType('delivery')}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <Truck className="w-4 h-4 text-slate-500" />
                    <span className="text-sm">Domicilio</span>
                  </label>
                </div>
              </div>

              {/* Delivery Zone */}
              {deliveryType === 'delivery' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Zona de Entrega *
                  </label>
                  <select
                    value={deliveryZoneId}
                    onChange={(e) => setDeliveryZoneId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  >
                    <option value="">Selecciona una zona...</option>
                    {deliveryZones.map(zone => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name} - ${zone.delivery_fee.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Order Type Tabs */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Agregar Items al Encargo
                </label>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 mb-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab('catalog')}
                    className={`flex items-center px-4 py-2 text-sm font-medium border-b-2 transition ${
                      activeTab === 'catalog'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
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
                        : 'border-transparent text-slate-500 hover:text-slate-700'
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
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Personalizado
                  </button>
                </div>

                {/* Tab Content */}
                <div className="bg-slate-50 rounded-lg p-4">
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
              <OrderItemsList
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
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notas del Encargo
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Notas adicionales sobre el encargo..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none"
                />
              </div>

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
                  disabled={loading || items.length === 0 || (advancePayment > 0 && !advancePaymentMethod)}
                  className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition disabled:opacity-50 flex items-center justify-center"
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
        excludeProductIds={items.map(i => i.productId || '')}
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
        onClose={handleCloseSuccessModal}
      />
    </div>
  );
}
