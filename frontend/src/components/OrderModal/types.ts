/**
 * Shared types for OrderModal components
 */
import type { OrderItemCreate, OrderType, YomberMeasurements } from '../../types/api';

// Extended item form with school info for multi-school support
export interface OrderItemForm extends OrderItemCreate {
  tempId: string;
  displayName?: string;
  unitPrice: number;
  school_id: string;      // School this item belongs to
  school_name: string;    // For display in UI
  // Stock reservation info for "pisar" functionality
  stock_available?: number;  // How many units are in stock (for display)
}

// Result of creating an order (for multi-school success modal)
export interface OrderResult {
  schoolName: string;
  orderCode: string;
  total: number;
  orderId: string;
}

export type TabType = 'catalog' | 'yomber' | 'custom';

// Props for tab components
export interface CatalogTabProps {
  onOpenSelector: () => void;
}

export interface YomberTabProps {
  products: Array<{
    id: string;
    garment_type_id: string;
    size: string;
    price: number | string;
    color?: string | null;
  }>;
  garmentTypes: Array<{
    id: string;
    name: string;
  }>;
  yomberProducts: Array<{
    id: string;
    garment_type_id: string;
    size: string;
    price: number | string;
    color?: string | null;
  }>;
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
  garmentTypes: Array<{
    id: string;
    name: string;
  }>;
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
  advancePaymentMethod: '' | 'cash' | 'nequi' | 'transfer' | 'card';
  advanceAmountReceived: number;
  onAdvancePaymentChange: (amount: number) => void;
  onPaymentMethodChange: (method: '' | 'cash' | 'nequi' | 'transfer' | 'card') => void;
  onAmountReceivedChange: (amount: number) => void;
}

export interface SuccessModalProps {
  isOpen: boolean;
  orderResults: OrderResult[];
  availableSchools: Array<{
    id: string;
    name: string;
  }>;
  isPrinting: boolean;
  onPrintReceipts: () => void;
  onClose: () => void;
}

// Helper function type for order type badge
export type GetOrderTypeBadge = (orderType: OrderType | undefined) => JSX.Element | null;
