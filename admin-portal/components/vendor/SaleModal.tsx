'use client';

/**
 * Sale Modal - Create New Sale Form
 * Supports multi-school: allows adding items from different schools in a single transaction.
 * Creates separate sales (one per school) when items span multiple schools.
 */
import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Loader2,
  Plus,
  Trash2,
  ShoppingCart,
  Globe,
  Building,
  UserX,
  Calendar,
  History,
  Building2,
  CheckCircle,
  Package,
  CreditCard,
  DollarSign,
  Minimize2,
} from 'lucide-react';
import salesService from '@/lib/services/salesService';
import productService from '@/lib/services/productService';
import ClientSelector, { NO_CLIENT_ID } from './ClientSelector';
import ProductGroupSelector from './ProductGroupSelector';
import { useSchoolStore } from '@/lib/stores/schoolStore';
import {
  useDraftStore,
  type SaleDraft,
  type DraftItem,
  type DraftPayment,
} from '@/lib/stores/draftStore';
import type { Product, GlobalProduct, GarmentType, PaymentMethod } from '@/lib/api';

// Payment line for multiple payments
interface PaymentLine {
  id: string;
  amount: number;
  payment_method: PaymentMethod | '';
}

interface SaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialSchoolId?: string;
  initialProduct?: Product;
  initialQuantity?: number;
  draftId?: string | null;
  onMinimize?: () => void;
}

// Extended type for sale items with global flag AND school info
interface SaleItemCreateExtended {
  product_id: string;
  quantity: number;
  unit_price: number;
  is_global: boolean;
  display_name?: string;
  size?: string;
  school_id: string;
  school_name: string;
}

// Result of creating a sale
interface SaleResult {
  schoolName: string;
  saleCode: string;
  total: number;
  saleId: string;
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
  const { availableSchools, currentSchool, loadSchools, isLoading: schoolsLoading } = useSchoolStore();
  const [selectedSchoolId, setSelectedSchoolId] = useState(
    initialSchoolId || currentSchool?.id || availableSchools[0]?.id || ''
  );
  const showSchoolSelector = availableSchools.length > 1;

  // Load schools on mount if not loaded
  useEffect(() => {
    if (isOpen && availableSchools.length === 0) {
      loadSchools();
    }
  }, [isOpen, availableSchools.length, loadSchools]);

  // Draft store for minimize/restore functionality
  const { addDraft, updateDraft, getDraft, removeDraft, setActiveDraft, canAddDraft } =
    useDraftStore();

  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [globalProducts, setGlobalProducts] = useState<GlobalProduct[]>([]);
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [productSource, setProductSource] = useState<'school' | 'global'>('school');

  // Yomber garment type IDs to exclude from sales
  const yomberGarmentTypeIds = useMemo(() => {
    return garmentTypes.filter((gt) => gt.has_custom_measurements).map((gt) => gt.id);
  }, [garmentTypes]);

  // Product selector modal state
  const [productSelectorOpen, setProductSelectorOpen] = useState(false);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [saleResults, setSaleResults] = useState<SaleResult[]>([]);

  const [formData, setFormData] = useState({
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
    { id: '1', amount: 0, payment_method: '' },
  ]);

  const [items, setItems] = useState<SaleItemCreateExtended[]>([]);

  useEffect(() => {
    if (isOpen && availableSchools.length > 0) {
      if (draftId) {
        const draft = getDraft(draftId);
        if (draft && draft.type === 'sale') {
          const saleDraft = draft as SaleDraft;
          setSelectedSchoolId(saleDraft.schoolId);
          loadProducts(saleDraft.schoolId);
          setFormData({
            client_id: saleDraft.clientId,
            notes: saleDraft.notes,
            is_historical: saleDraft.isHistorical,
            sale_date: saleDraft.historicalDate || '',
            sale_day: saleDraft.historicalDate
              ? saleDraft.historicalDate.split('-')[2]?.split('T')[0] || ''
              : '',
            sale_month: saleDraft.historicalDate
              ? saleDraft.historicalDate.split('-')[1] || ''
              : '',
            sale_year: saleDraft.historicalDate
              ? saleDraft.historicalDate.split('-')[0] || ''
              : '',
          });
          const restoredItems: SaleItemCreateExtended[] = saleDraft.items.map((item) => ({
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
          const restoredPayments: PaymentLine[] = saleDraft.payments.map((p) => ({
            id: p.id,
            amount: p.amount,
            payment_method: p.paymentMethod as PaymentMethod,
          }));
          setPayments(
            restoredPayments.length > 0
              ? restoredPayments
              : [{ id: '1', amount: 0, payment_method: '' }]
          );
          setActiveDraft(draftId);
          return;
        }
      }
      const schoolId = initialSchoolId || currentSchool?.id || availableSchools[0]?.id || '';
      if (schoolId) {
        setSelectedSchoolId(schoolId);
        loadProducts(schoolId);
      }
      resetForm();
    }
  }, [isOpen, draftId, availableSchools.length]);

  // Pre-load product if initialProduct is provided
  useEffect(() => {
    if (isOpen && initialProduct) {
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

  const handleSchoolChange = async (newSchoolId: string) => {
    setSelectedSchoolId(newSchoolId);
    setError(null);
    await loadProducts(newSchoolId);
  };

  // Group items by school
  const itemsBySchool = useMemo(() => {
    const grouped = new Map<string, SaleItemCreateExtended[]>();
    items.forEach((item) => {
      if (!grouped.has(item.school_id)) {
        grouped.set(item.school_id, []);
      }
      grouped.get(item.school_id)!.push(item);
    });
    return grouped;
  }, [items]);

  const getSchoolName = (schoolId: string) => {
    return availableSchools.find((s) => s.id === schoolId)?.name || 'Colegio';
  };

  const selectedSchool = availableSchools.find((s) => s.id === selectedSchoolId);

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
    setProductSource('school');
    setError(null);
    setShowSuccessModal(false);
    setSaleResults([]);
  };

  // Payment helpers
  const totalPayments = useMemo(
    () => payments.reduce((sum, p) => sum + p.amount, 0),
    [payments]
  );

  const addPaymentLine = () => {
    setPayments([...payments, { id: Date.now().toString(), amount: 0, payment_method: '' }]);
  };

  const removePaymentLine = (id: string) => {
    if (payments.length === 1) return;
    setPayments(payments.filter((p) => p.id !== id));
  };

  const updatePaymentAmount = (id: string, amount: number) => {
    setPayments(payments.map((p) => (p.id === id ? { ...p, amount } : p)));
  };

  const updatePaymentMethod = (id: string, method: PaymentMethod) => {
    setPayments(payments.map((p) => (p.id === id ? { ...p, payment_method: method } : p)));
  };

  // Auto-fill first payment with total
  useEffect(() => {
    const total = calculateTotal();
    if (payments.length === 1 && total > 0) {
      const currentPayment = payments[0];
      if (currentPayment.amount === 0 || currentPayment.amount !== total) {
        setPayments([{ ...currentPayment, amount: total }]);
      }
    }
  }, [items]);

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
    } catch (err: any) {
      console.error('Error loading products:', err);
      setError('Error al cargar productos');
    }
  };

  // Handler for ProductSelector selection
  const handleProductSelectorSelect = (
    product: Product | GlobalProduct,
    quantity?: number,
    isGlobalParam?: boolean
  ) => {
    const isGlobal =
      isGlobalParam ?? ('inventory_quantity' in product && !('school_id' in product));
    const schoolId = isGlobal ? selectedSchoolId : (product as Product).school_id;
    const schoolName = getSchoolName(schoolId);

    const newItem: SaleItemCreateExtended = {
      product_id: product.id,
      quantity: quantity || 1,
      unit_price: Number(product.price),
      is_global: isGlobal,
      display_name: product.name || '',
      size: product.size,
      school_id: schoolId,
      school_name: schoolName,
    };

    const existingIndex = items.findIndex(
      (item) => item.product_id === product.id && item.is_global === isGlobal
    );

    if (existingIndex !== -1) {
      const updatedItems = [...items];
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        quantity: updatedItems[existingIndex].quantity + (quantity || 1),
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
    return items.reduce((total, item) => total + item.quantity * item.unit_price, 0);
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
      setError(
        `La suma de pagos ($${totalPayments.toLocaleString('es-CO')}) no coincide con el total ($${total.toLocaleString('es-CO')})`
      );
      return;
    }

    if (payments.every((p) => p.amount <= 0)) {
      setError('Debes ingresar al menos un pago');
      return;
    }

    if (formData.is_historical) {
      if (!formData.sale_day || !formData.sale_month || !formData.sale_year) {
        setError('Para ventas historicas debes ingresar dia, mes y ano');
        return;
      }
      const day = parseInt(formData.sale_day);
      const month = parseInt(formData.sale_month);
      const year = parseInt(formData.sale_year);
      if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2020) {
        setError('La fecha ingresada no es valida');
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

      const paymentsData = payments
        .filter((p) => p.amount > 0 && p.payment_method)
        .map((p) => ({
          amount: p.amount,
          payment_method: p.payment_method as PaymentMethod,
        }));

      if (paymentsData.length === 0) {
        setError('Debes agregar al menos un pago con monto mayor a 0');
        setLoading(false);
        return;
      }

      const results: SaleResult[] = [];

      for (const [schoolId, schoolItems] of itemsBySchool.entries()) {
        const schoolTotal = schoolItems.reduce(
          (sum, item) => sum + item.quantity * item.unit_price,
          0
        );

        let schoolPayments;
        if (itemsBySchool.size > 1) {
          const proportion = schoolTotal / total;
          schoolPayments = paymentsData.map((p) => ({
            ...p,
            amount: Math.round(p.amount * proportion),
          }));
          const sumSchoolPayments = schoolPayments.reduce((s, p) => s + p.amount, 0);
          if (sumSchoolPayments !== schoolTotal && schoolPayments.length > 0) {
            schoolPayments[0].amount += schoolTotal - sumSchoolPayments;
          }
        } else {
          schoolPayments = paymentsData;
        }

        const saleData = {
          client_id: clientId,
          items: schoolItems.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            is_global: item.is_global,
          })),
          payments: schoolPayments,
          notes: formData.notes || undefined,
          is_historical: formData.is_historical === true,
          sale_date: saleDateStr,
          source: 'admin_portal' as const, // Admin portal source
        };

        console.log('Creating sale with data:', JSON.stringify(saleData, null, 2));
        const response = await salesService.create(schoolId, saleData);

        results.push({
          schoolName: schoolItems[0].school_name,
          saleCode: response.code,
          total: schoolTotal,
          saleId: response.id,
        });
      }

      setSaleResults(results);
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('Error creating sale:', err);
      console.error('Response data:', err.response?.data);
      const detail = err.response?.data?.detail;
      let errorMsg = 'Error al crear la venta';
      if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        errorMsg = detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join(', ');
      } else if (detail && typeof detail === 'object') {
        errorMsg = detail.msg || detail.message || JSON.stringify(detail);
      }
      setError(errorMsg);
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
      alert('Has alcanzado el maximo de 5 borradores. Elimina uno para continuar.');
      return;
    }

    const total = calculateTotal();

    let historicalDate: string | undefined;
    if (formData.is_historical && formData.sale_day && formData.sale_month && formData.sale_year) {
      historicalDate = `${formData.sale_year}-${formData.sale_month}-${formData.sale_day.padStart(2, '0')}`;
    }

    const draftItems: DraftItem[] = items.map((item) => ({
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

    const draftPayments: DraftPayment[] = payments.map((p) => ({
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

  const getProductName = (productId: string, isGlobal: boolean = false) => {
    if (isGlobal) {
      const product = globalProducts.find((p) => p.id === productId);
      return product ? `${product.name} - ${product.size} (${product.code})` : productId;
    }
    const product = products.find((p) => p.id === productId);
    return product ? `${product.name} - ${product.size} (${product.code})` : productId;
  };

  if (!isOpen) return null;

  // Show loading if schools are loading
  if (schoolsLoading || (availableSchools.length === 0 && !error)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl p-8 z-10">
          <div className="flex flex-col items-center">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">Cargando colegios...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4 relative z-10">
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
                    {availableSchools.map((school) => (
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <ClientSelector
                  value={formData.client_id}
                  onChange={(clientId) => setFormData({ ...formData, client_id: clientId })}
                  schoolId={selectedSchoolId}
                  allowNoClient={true}
                  placeholder="Buscar cliente por nombre, telefono..."
                />
                {formData.client_id === NO_CLIENT_ID && (
                  <p className="mt-1 text-xs text-orange-600 flex items-center">
                    <UserX className="w-3 h-3 mr-1" />
                    La venta se registrara sin cliente asociado
                  </p>
                )}
              </div>
            </div>

            {/* Historical Sale Section */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="flex items-center h-5 mt-0.5">
                  <input
                    id="is_historical"
                    type="checkbox"
                    checked={formData.is_historical}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_historical: e.target.checked,
                        sale_date: e.target.checked ? formData.sale_date : '',
                        sale_day: e.target.checked ? formData.sale_day : '',
                        sale_month: e.target.checked ? formData.sale_month : '',
                        sale_year: e.target.checked ? formData.sale_year : '',
                      })
                    }
                    className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
                  />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="is_historical"
                    className="text-sm font-semibold text-amber-800 flex items-center cursor-pointer"
                  >
                    <History className="w-4 h-4 mr-2" />
                    Venta Historica (Migracion de datos)
                  </label>
                  <p className="text-xs text-amber-700 mt-1">
                    Las ventas historicas NO afectan el inventario actual y permiten establecer
                    una fecha pasada. Util para migrar registros de ventas anteriores.
                  </p>
                </div>
              </div>

              {formData.is_historical && (
                <div className="mt-4 pl-7">
                  <label className="block text-sm font-medium text-amber-800 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Fecha de la venta *
                  </label>
                  <div className="flex items-center gap-2">
                    <div>
                      <input
                        type="number"
                        placeholder="Dia"
                        min="1"
                        max="31"
                        value={formData.sale_day}
                        onChange={(e) => setFormData({ ...formData, sale_day: e.target.value })}
                        className="w-20 px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none bg-white text-center"
                      />
                      <p className="text-xs text-amber-600 mt-1 text-center">Dia</p>
                    </div>
                    <span className="text-amber-600 text-xl font-bold">/</span>
                    <div>
                      <select
                        value={formData.sale_month}
                        onChange={(e) => setFormData({ ...formData, sale_month: e.target.value })}
                        className="w-32 px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none bg-white"
                      >
                        <option value="">Mes</option>
                        <option value="01">Enero</option>
                        <option value="02">Febrero</option>
                        <option value="03">Marzo</option>
                        <option value="04">Abril</option>
                        <option value="05">Mayo</option>
                        <option value="06">Junio</option>
                        <option value="07">Julio</option>
                        <option value="08">Agosto</option>
                        <option value="09">Septiembre</option>
                        <option value="10">Octubre</option>
                        <option value="11">Noviembre</option>
                        <option value="12">Diciembre</option>
                      </select>
                      <p className="text-xs text-amber-600 mt-1 text-center">Mes</p>
                    </div>
                    <span className="text-amber-600 text-xl font-bold">/</span>
                    <div>
                      <input
                        type="number"
                        placeholder="Ano"
                        min="2020"
                        max={new Date().getFullYear()}
                        value={formData.sale_year}
                        onChange={(e) => setFormData({ ...formData, sale_year: e.target.value })}
                        className="w-24 px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none bg-white text-center"
                      />
                      <p className="text-xs text-amber-600 mt-1 text-center">Ano</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Add Product Section */}
            <div className="border-t border-gray-200 pt-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Agregar Productos</h3>

              {/* Product Source Tabs */}
              <div className="flex space-x-1 mb-4 bg-gray-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setProductSource('school')}
                  className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition ${
                    productSource === 'school'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Building className="w-4 h-4 mr-2" />
                  Productos del Colegio ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => setProductSource('global')}
                  className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition ${
                    productSource === 'global'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Productos Globales ({globalProducts.length})
                </button>
              </div>

              {/* Product Selector Button */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setProductSelectorOpen(true)}
                  className="w-full px-6 py-4 border-2 border-dashed border-blue-400 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition flex flex-col items-center gap-2 group"
                >
                  <Package className="w-8 h-8 text-blue-500 group-hover:text-blue-600" />
                  <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700">
                    Buscar y agregar productos
                  </span>
                  <span className="text-xs text-gray-500">Click para abrir el catalogo</span>
                </button>
              </div>
            </div>

            {/* Items List */}
            {items.length > 0 && (
              <div className="border-t border-gray-200 pt-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Productos en la Venta
                  {itemsBySchool.size > 1 && (
                    <span className="ml-2 text-sm font-normal text-blue-600">
                      ({itemsBySchool.size} colegios)
                    </span>
                  )}
                </h3>

                <div className="space-y-4">
                  {Array.from(itemsBySchool.entries()).map(([schoolId, schoolItems]) => {
                    const schoolTotal = schoolItems.reduce(
                      (sum, item) => sum + item.quantity * item.unit_price,
                      0
                    );
                    return (
                      <div
                        key={schoolId}
                        className="border border-gray-200 rounded-lg overflow-hidden"
                      >
                        {itemsBySchool.size > 1 && (
                          <div className="bg-blue-50 px-4 py-2 flex items-center justify-between border-b border-blue-200">
                            <span className="font-medium text-blue-800 flex items-center">
                              <Building2 className="w-4 h-4 mr-2" />
                              {schoolItems[0].school_name}
                            </span>
                            <span className="text-sm text-blue-600 font-medium">
                              Subtotal: ${schoolTotal.toLocaleString('es-CO')}
                            </span>
                          </div>
                        )}

                        <div className="divide-y divide-gray-100">
                          {schoolItems.map((item) => {
                            const originalIndex = items.findIndex(
                              (i) =>
                                i.product_id === item.product_id &&
                                i.school_id === item.school_id &&
                                i.is_global === item.is_global
                            );
                            return (
                              <div
                                key={`${item.school_id}-${item.product_id}-${item.is_global}`}
                                className={`flex items-center justify-between p-3 ${
                                  item.is_global ? 'bg-purple-50' : 'bg-white'
                                }`}
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">
                                    {item.display_name ||
                                      getProductName(item.product_id, item.is_global)}
                                    {item.is_global && (
                                      <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                        Global
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {item.size && (
                                      <span className="font-medium">Talla: {item.size} | </span>
                                    )}
                                    Cantidad: {item.quantity} × $
                                    {item.unit_price.toLocaleString('es-CO')} = $
                                    {(item.quantity * item.unit_price).toLocaleString('es-CO')}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(originalIndex)}
                                  className="ml-4 text-red-600 hover:text-red-800 transition"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">
                      {itemsBySchool.size > 1 ? 'Total General:' : 'Total:'}
                    </span>
                    <span className="text-2xl font-bold text-blue-600">
                      ${calculateTotal().toLocaleString('es-CO')}
                    </span>
                  </div>
                  {itemsBySchool.size > 1 && (
                    <p className="text-sm text-gray-500 mt-1">
                      Se crearan {itemsBySchool.size} ventas separadas (una por colegio)
                    </p>
                  )}
                </div>

                {/* Payments Section */}
                <div className="mt-6 border border-green-200 rounded-lg p-4 bg-green-50">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-gray-800 flex items-center">
                      <CreditCard className="w-4 h-4 mr-2 text-green-600" />
                      Metodo de Pago
                    </label>
                    <button
                      type="button"
                      onClick={addPaymentLine}
                      className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Dividir pago
                    </button>
                  </div>

                  <div className="space-y-3">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex items-center gap-3">
                        <select
                          value={payment.payment_method}
                          onChange={(e) =>
                            updatePaymentMethod(payment.id, e.target.value as PaymentMethod)
                          }
                          className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white ${
                            !payment.payment_method ? 'border-red-300 text-gray-400' : 'border-gray-300'
                          }`}
                        >
                          <option value="" disabled>-- Seleccione método --</option>
                          <option value="cash">Efectivo</option>
                          <option value="nequi">Nequi</option>
                          <option value="transfer">Transferencia</option>
                          <option value="card">Tarjeta</option>
                          <option value="credit">Credito</option>
                        </select>

                        {payments.length > 1 && (
                          <div className="relative w-32">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="number"
                              value={payment.amount || ''}
                              onChange={(e) =>
                                updatePaymentAmount(payment.id, Number(e.target.value) || 0)
                              }
                              placeholder="Monto"
                              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                            />
                          </div>
                        )}

                        {payments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePaymentLine(payment.id)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Validation message for missing payment method */}
                  {payments.some((p) => !p.payment_method) && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">
                        Debe seleccionar un método de pago
                      </p>
                    </div>
                  )}

                  {payments.length > 1 && totalPayments !== calculateTotal() && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">
                        La suma de pagos (${totalPayments.toLocaleString('es-CO')}) no coincide
                        con el total (${calculateTotal().toLocaleString('es-CO')})
                      </p>
                    </div>
                  )}

                  {payments.length > 1 && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Suma de pagos:</span>
                        <span
                          className={`font-medium ${totalPayments === calculateTotal() ? 'text-green-600' : 'text-orange-600'}`}
                        >
                          ${totalPayments.toLocaleString('es-CO')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="mb-6">
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
                disabled={loading || items.length === 0 || payments.some((p) => !p.payment_method)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : itemsBySchool.size > 1 ? (
                  `Crear ${itemsBySchool.size} Ventas`
                ) : (
                  'Crear Venta'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && saleResults.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={handleCloseSuccessModal}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                {saleResults.length === 1
                  ? 'Venta Creada Exitosamente'
                  : `${saleResults.length} Ventas Creadas Exitosamente`}
              </h3>
            </div>

            <div className="space-y-3 mb-6">
              {saleResults.map((result, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  {saleResults.length > 1 && (
                    <div className="flex items-center text-sm text-blue-600 mb-2">
                      <Building2 className="w-4 h-4 mr-1" />
                      {result.schoolName}
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-lg font-bold text-gray-900">
                      {result.saleCode}
                    </span>
                    <span className="text-lg font-semibold text-green-600">
                      ${result.total.toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {saleResults.length > 1 && (
              <div className="border-t border-gray-200 pt-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">Total General:</span>
                  <span className="text-xl font-bold text-blue-600">
                    ${saleResults.reduce((sum, r) => sum + r.total, 0).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCloseSuccessModal}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Group Selector */}
      <ProductGroupSelector
        isOpen={productSelectorOpen}
        onClose={() => setProductSelectorOpen(false)}
        onSelect={handleProductSelectorSelect}
        schoolId={selectedSchoolId}
        filterByStock={formData.is_historical ? 'all' : 'with_stock'}
        excludeProductIds={items.map((i) => i.product_id)}
        excludeGarmentTypeIds={yomberGarmentTypeIds}
        allowGlobalProducts={true}
        initialProductSource={productSource}
        title="Seleccionar Producto"
        emptyMessage="No se encontraron productos disponibles"
      />
    </div>
  );
}
