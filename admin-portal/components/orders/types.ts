/**
 * Shared types for CreateOrderModal components
 */

export type OrderType = 'catalog' | 'yomber' | 'custom';
export type TabType = 'catalog' | 'yomber' | 'custom';
export type PaymentMethod = 'cash' | 'nequi' | 'transfer' | 'card';

export interface YomberMeasurements {
  delantero: number;
  trasero: number;
  cintura: number;
  largo: number;
  espalda?: number;
  cadera?: number;
  hombro?: number;
  pierna?: number;
  entrepierna?: number;
  manga?: number;
  cuello?: number;
  pecho?: number;
  busto?: number;
  tiro?: number;
}

// Extended item form with school info for multi-school support
export interface OrderItemForm {
  tempId: string;
  orderType: OrderType;
  garmentTypeId?: string;
  garmentTypeName?: string;
  productId?: string;
  globalProductId?: string;
  isGlobalProduct?: boolean;
  productName?: string;
  productCode?: string;
  quantity: number;
  unitPrice: number;
  additionalPrice?: number;
  size?: string;
  color?: string;
  gender?: 'unisex' | 'male' | 'female';
  customMeasurements?: YomberMeasurements;
  embroideryText?: string;
  notes?: string;
  reserveStock?: boolean;
  stockAvailable?: number;
  schoolId: string;
  schoolName: string;
}

// Result of creating an order (for multi-school success modal)
export interface OrderResult {
  schoolName: string;
  orderCode: string;
  total: number;
  orderId: string;
}

// Product types from API
export interface Product {
  id: string;
  school_id?: string;
  garment_type_id: string;
  code: string;
  name?: string;
  size: string;
  color?: string | null;
  gender?: 'unisex' | 'male' | 'female';
  price: number | string;
  cost?: number | string;
  description?: string;
  is_active: boolean;
  inventory_quantity?: number;
}

export interface GlobalProduct {
  id: string;
  garment_type_id: string;
  code: string;
  name?: string;
  size: string;
  color?: string | null;
  gender?: 'unisex' | 'male' | 'female';
  price: number | string;
  cost?: number | string;
  description?: string;
  is_active: boolean;
  inventory_quantity?: number;
}

export interface GarmentType {
  id: string;
  school_id?: string;
  name: string;
  description?: string;
  category?: string;
  requires_embroidery?: boolean;
  has_custom_measurements?: boolean;
  is_active: boolean;
  image_url?: string;
}

export interface GlobalGarmentType {
  id: string;
  name: string;
  description?: string;
  category?: string;
  requires_embroidery?: boolean;
  has_custom_measurements?: boolean;
  is_active: boolean;
  image_url?: string;
}

export interface School {
  id: string;
  name: string;
  is_active: boolean;
}

export interface Client {
  id: string;
  school_id: string;
  name?: string;
  email?: string;
  phone?: string;
  student_name?: string;
  student_grade?: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  is_active: boolean;
}

// Props for tab components
export interface CatalogTabProps {
  onOpenSelector: () => void;
}

export interface YomberTabProps {
  products: Product[];
  garmentTypes: GarmentType[];
  yomberProducts: Product[];
  yomberProductId: string;
  yomberQuantity: number;
  yomberMeasurements: Partial<YomberMeasurements>;
  yomberAdditionalPrice: number;
  yomberEmbroideryText: string;
  onOpenSelector: () => void;
  onQuantityChange: (quantity: number) => void;
  onMeasurementsChange: (measurements: Partial<YomberMeasurements>) => void;
  onAdditionalPriceChange: (price: number) => void;
  onEmbroideryTextChange: (text: string) => void;
  onAddItem: () => void;
}

export interface CustomTabProps {
  garmentTypes: GarmentType[];
  customGarmentTypeId: string;
  customQuantity: number;
  customSize: string;
  customColor: string;
  customPrice: number;
  customNotes: string;
  customEmbroideryText: string;
  onGarmentTypeChange: (id: string) => void;
  onQuantityChange: (quantity: number) => void;
  onSizeChange: (size: string) => void;
  onColorChange: (color: string) => void;
  onPriceChange: (price: number) => void;
  onNotesChange: (notes: string) => void;
  onEmbroideryTextChange: (text: string) => void;
  onAddItem: () => void;
}

export interface ItemsListProps {
  items: OrderItemForm[];
  itemsBySchool: Map<string, OrderItemForm[]>;
  onRemoveItem: (tempId: string) => void;
}

export interface PaymentSectionProps {
  total: number;
  advancePayment: number;
  advancePaymentMethod: PaymentMethod | '';
  advanceAmountReceived: number;
  onAdvancePaymentChange: (amount: number) => void;
  onPaymentMethodChange: (method: PaymentMethod | '') => void;
  onAmountReceivedChange: (amount: number) => void;
}

export interface SuccessModalProps {
  isOpen: boolean;
  orderResults: OrderResult[];
  onClose: () => void;
}

// Validation helpers
export const REQUIRED_YOMBER_FIELDS: (keyof YomberMeasurements)[] = [
  'delantero',
  'trasero',
  'cintura',
  'largo',
];

export function validateYomberMeasurements(
  measurements: Partial<YomberMeasurements> | undefined
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!measurements) {
    REQUIRED_YOMBER_FIELDS.forEach((field) => {
      errors[field] = 'Requerido';
    });
    return { valid: false, errors };
  }

  REQUIRED_YOMBER_FIELDS.forEach((field) => {
    const value = measurements[field];
    if (value === undefined || value === null) {
      errors[field] = 'Requerido';
    } else if (value <= 0) {
      errors[field] = 'Debe ser mayor a 0';
    }
  });

  return { valid: Object.keys(errors).length === 0, errors };
}

// Currency formatting
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value);
}

// Order type badge helper
export function getOrderTypeBadge(orderType: OrderType | undefined): { label: string; className: string } | null {
  switch (orderType) {
    case 'catalog':
      return { label: 'Catalogo', className: 'bg-blue-100 text-blue-700' };
    case 'yomber':
      return { label: 'Yomber', className: 'bg-purple-100 text-purple-700' };
    case 'custom':
      return { label: 'Personal.', className: 'bg-orange-100 text-orange-700' };
    default:
      return null;
  }
}
