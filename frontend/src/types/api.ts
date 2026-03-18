/**
 * API Types - TypeScript interfaces matching backend schemas
 */

// ============================================
// Auth Types
// ============================================

export interface LoginRequest {
  username: string;
  password: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// User roles (hierarchical, highest to lowest)
export type UserRole = 'owner' | 'admin' | 'seller' | 'viewer';

export interface SchoolInfoForRole {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface UserSchoolRole {
  id: string;
  user_id: string;
  school_id: string;
  role: UserRole | null;  // Can be null if using custom_role
  custom_role_id: string | null;
  custom_role_name?: string | null;
  is_primary: boolean;
  created_at: string;
  school?: SchoolInfoForRole;
  permissions?: string[];  // Effective permissions for this role
  max_discount_percent?: number;  // Maximum discount percentage allowed
  constraints?: Record<string, PermissionConstraints>;  // Micro-permission constraints per permission code
}

export interface PermissionConstraints {
  max_amount?: number | null;
  requires_approval?: boolean;
  max_daily_count?: number | null;
  max_discount_percent?: number | null;
}

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  school_roles?: UserSchoolRole[];
}

export interface LoginResponse {
  token: Token;
  user: User;
}

// Role hierarchy for permission checking
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 1,
  seller: 2,
  admin: 3,
  owner: 4,
};

// Permission check helpers
export const canManageUsers = (role?: UserRole): boolean => role === 'owner';
export const canAccessAccounting = (role?: UserRole): boolean =>
  role ? ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin : false;
export const canModifyInventory = (role?: UserRole): boolean =>
  role ? ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin : false;
export const canCreateSales = (role?: UserRole): boolean =>
  role ? ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.seller : false;
export const canDeleteRecords = (role?: UserRole): boolean =>
  role ? ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin : false;
export const canAccessAlterations = (role?: UserRole): boolean =>
  role ? ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin : false;

// ============================================
// School Types
// ============================================

export interface School {
  id: string;
  code: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  settings: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchoolSummary {
  id: string;
  code: string;
  name: string;
  total_products: number;
  total_clients: number;
  total_sales: number;
  total_orders?: number;
  is_active: boolean;
}

// ============================================
// Product Types
// ============================================

export interface Product {
  id: string;
  school_id: string;
  code: string;
  garment_type_id: string;
  name: string | null;
  size: string;
  color: string | null;
  gender: string | null;
  price: number;
  cost: number | null;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Inventory fields (when with_inventory=true)
  inventory_quantity?: number;
  inventory_min_stock?: number;
  stock?: number; // Alias for inventory_quantity
  min_stock?: number; // Minimum stock alert level
  // Pending orders info
  pending_orders_qty?: number;
  pending_orders_count?: number;
  // Extra fields from multi-school endpoint
  garment_type_name?: string;
  school_name?: string;
  // Garment type images (when with_images=true)
  garment_type_images?: GarmentTypeImage[];
  garment_type_primary_image_url?: string | null;
}

export interface ProductWithInventory extends Product {
  inventory_quantity: number;
  inventory_min_stock: number;
}

// GarmentType Image (for multiple images per garment type)
export interface GarmentTypeImage {
  id: string;
  garment_type_id: string;
  school_id: string;
  image_url: string;
  display_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface GarmentType {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  category: string | null;
  has_custom_measurements: boolean;
  requires_embroidery: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Image fields (when included by backend)
  images?: GarmentTypeImage[];
  primary_image_url?: string | null;
}

// ============================================
// Client Types
// ============================================

export interface Client {
  id: string;
  school_id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  student_name: string | null;
  student_grade: string | null;
  notes: string | null;
  balance?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Portal activation status
  is_verified?: boolean;
  welcome_email_sent?: boolean;
  has_password?: boolean;
}

// ============================================
// Payment Method Types
// ============================================

// Payment methods for sales
export type PaymentMethod = 'cash' | 'nequi' | 'transfer' | 'card' | 'credit';

// Payment method display labels
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  nequi: 'Nequi',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  credit: 'Crédito',
};

// Payment method to account mapping (for UI display)
export const PAYMENT_METHOD_ACCOUNTS: Record<PaymentMethod, string> = {
  cash: 'Caja Menor',
  nequi: 'Nequi',
  transfer: 'Banco',
  card: 'Banco',
  credit: 'Cuenta por Cobrar',
};

// ============================================
// Sale Types
// ============================================

export interface Sale {
  id: string;
  school_id: string;
  code: string;
  client_id: string | null;
  user_id: string;
  user_name?: string | null;  // Seller name
  status: 'pending' | 'completed' | 'cancelled';
  is_historical: boolean;  // Historical sale (migration data)
  payment_method: 'cash' | 'nequi' | 'credit' | 'transfer' | 'card' | null;
  total: number;
  paid_amount: number;
  sale_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;  // null when is_global_product is true
  global_product_id?: string | null;
  is_global_product?: boolean;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
  updated_at: string;
}

export interface SaleItemWithProduct extends SaleItem {
  product_code: string | null;
  product_name: string | null;
  product_size: string | null;
  product_color: string | null;
  // Global product info (if applicable)
  global_product_code: string | null;
  global_product_name: string | null;
  global_product_size: string | null;
  global_product_color: string | null;
  // Flag to identify global products
  is_global_product?: boolean;
  global_product_id?: string | null;
}

export interface SalePayment {
  id: string;
  sale_id: string;
  amount: number;
  payment_method: PaymentMethod;
  notes: string | null;
  transaction_id: string | null;
  // Cash change tracking
  amount_received: number | null;
  change_given: number | null;
  created_at: string;
}

export interface SaleWithItems extends Sale {
  items: SaleItemWithProduct[];
  client_name: string | null;
  payments?: SalePayment[];
  // Calculated fields
  balance?: number;  // Saldo pendiente (total - paid_amount)
  // Multi-school support
  school_name?: string | null;
}

export interface SaleListItem {
  id: string;
  code: string;
  status: 'pending' | 'completed' | 'cancelled';
  source: 'desktop_app' | 'web_portal' | 'api' | null;
  is_historical: boolean;  // Historical sale (migration data)
  payment_method: 'cash' | 'nequi' | 'credit' | 'transfer' | 'card' | null;
  total: number;
  paid_amount: number;
  client_id: string | null;
  client_name: string | null;
  sale_date: string;
  created_at: string;
  items_count: number;
  // Track who made the sale
  user_id: string | null;
  user_name: string | null;
  // Multi-school support
  school_id: string | null;
  school_name: string | null;
}

// ============================================
// Sale Change Types
// ============================================

export type ChangeType = 'size_change' | 'product_change' | 'return' | 'defect';
export type ChangeStatus = 'pending' | 'pending_stock' | 'approved' | 'rejected';

export interface SaleChange {
  id: string;
  sale_id: string;
  original_item_id: string;
  new_product_id: string | null;
  new_global_product_id: string | null;
  is_new_global_product: boolean;
  change_type: ChangeType;
  status: ChangeStatus;
  returned_quantity: number;
  new_quantity: number;
  price_adjustment: number;
  reason: string | null;
  rejection_reason: string | null;
  change_date: string;
  user_id: string;
  order_id: string | null;  // Associated order when waiting for stock
  order_code: string | null;  // Order code for display
  created_at: string;
  updated_at: string;
}

export interface SaleChangeCreate {
  original_item_id: string;
  new_product_id?: string | null;  // null for returns
  is_new_global_product?: boolean;  // true if new_product_id refers to a global product
  change_type: ChangeType;
  returned_quantity: number;
  new_quantity?: number;  // 0 for returns
  reason: string;  // Required (min 3 chars in backend)
  create_order_if_no_stock?: boolean;  // Create order when stock unavailable
  payment_method?: 'cash' | 'nequi' | 'transfer' | 'card';  // For price adjustment
}

export interface SaleChangeListItem {
  id: string;
  sale_id: string;
  sale_code: string;
  change_type: ChangeType;
  status: ChangeStatus;
  returned_quantity: number;
  new_quantity: number;
  price_adjustment: number;
  change_date: string;
  reason: string | null;
  rejection_reason?: string | null;
  created_at?: string;

  // Original product info
  original_product_code?: string;
  original_product_name?: string;
  original_product_size?: string;
  original_product_color?: string;
  original_unit_price?: number;
  original_is_global?: boolean;

  // New product info
  new_product_code?: string;
  new_product_name?: string;
  new_product_size?: string;
  new_product_color?: string;
  new_unit_price?: number;
  new_is_global?: boolean;

  // User and order info
  user_username?: string;
  order_id: string | null;
  order_code: string | null;
}

// Transaction summary for sale change details
export interface TransactionSummary {
  id: string;
  type: string;
  amount: number;
  description?: string;
  transaction_date: string;
}

// Inventory movement summary for sale change details
export interface InventoryMovementSummary {
  id: string;
  product_code: string;
  product_name?: string;
  movement_type: 'entrada' | 'salida';
  quantity: number;
  created_at: string;
}

// Order summary for sale change details
export interface OrderSummary {
  id: string;
  code: string;
  status: string;
  delivery_date?: string;
}

// Full sale change detail response
export interface SaleChangeDetailResponse extends SaleChangeListItem {
  sale_total: number;
  sale_date: string;
  client_name?: string;
  school_name?: string;
  transactions: TransactionSummary[];
  inventory_movements: InventoryMovementSummary[];
  associated_order?: OrderSummary;
}

// ============================================
// Order Types (Encargos)
// ============================================

export type OrderStatus = 'pending' | 'in_production' | 'ready' | 'delivered' | 'cancelled';
export type OrderItemStatus = 'pending' | 'in_production' | 'ready' | 'delivered' | 'cancelled';
export type OrderType = 'catalog' | 'yomber' | 'custom';
export type DeliveryType = 'pickup' | 'delivery';

// Yomber measurements interface
export interface YomberMeasurements {
  // Required
  delantero: number;
  trasero: number;
  cintura: number;
  largo: number;
  // Optional
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

export interface OrderItem {
  id: string;
  order_id: string;
  school_id: string;
  garment_type_id: string;
  garment_type_name: string;
  garment_type_category: string | null;
  requires_embroidery: boolean;
  has_custom_measurements: boolean;
  quantity: number;
  unit_price: number;
  subtotal: number;
  size: string | null;
  color: string | null;
  gender: string | null;
  custom_measurements: Record<string, number> | null;
  embroidery_text: string | null;
  notes: string | null;
  // Item-level status for individual tracking
  item_status: OrderItemStatus;
  status_updated_at: string | null;
  // Stock reservation tracking ("pisar" functionality)
  reserved_from_stock?: boolean;
  quantity_reserved?: number;
}

export interface OrderItemCreate {
  garment_type_id: string;
  quantity: number;
  // Order type
  order_type?: OrderType;
  // For catalog/yomber orders - product for price (school products)
  product_id?: string;
  // For global products (shared inventory)
  global_product_id?: string;
  is_global_product?: boolean;
  // For custom orders - manual price
  unit_price?: number;
  // Additional services price
  additional_price?: number;
  // Stock reservation - "pisar" functionality (reserve from inventory if available)
  reserve_stock?: boolean;
  // Common fields
  size?: string;
  color?: string;
  gender?: string;
  custom_measurements?: YomberMeasurements | Record<string, number>;
  embroidery_text?: string;
  notes?: string;
}

export interface Order {
  id: string;
  school_id: string;
  code: string;
  client_id: string;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  total: number;
  paid_amount: number;
  balance: number;
  delivery_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  student_name: string | null;
  // Delivery info
  delivery_type?: DeliveryType;
  delivery_address?: string | null;
  delivery_neighborhood?: string | null;
  delivery_city?: string | null;
  delivery_references?: string | null;
  delivery_zone_id?: string | null;
  delivery_fee?: number;
  // Multi-school support
  school_name?: string | null;
}

export interface OrderListItem {
  id: string;
  code: string;
  status: OrderStatus;
  source: 'desktop_app' | 'web_portal' | 'api' | null;
  client_name: string | null;
  student_name: string | null;
  delivery_date: string | null;
  total: number;
  balance: number;
  created_at: string;
  items_count: number;
  // Track who created the order
  user_id: string | null;
  user_name: string | null;
  // Multi-school support
  school_id: string | null;
  school_name: string | null;
  // Partial delivery tracking
  items_delivered: number;
  items_total: number;
  // Payment proof
  payment_proof_url: string | null;
  // Quotation flag
  needs_quotation?: boolean;
  // Delivery info
  delivery_type: DeliveryType;
  delivery_fee: number;
  delivery_address: string | null;
  delivery_neighborhood: string | null;
}

export interface OrderCreate {
  school_id: string;
  client_id: string;
  delivery_date?: string;
  notes?: string;
  items: OrderItemCreate[];
  advance_payment?: number;
  advance_payment_method?: 'cash' | 'nequi' | 'transfer' | 'card';
  advance_amount_received?: number;
}

export interface OrderPayment {
  amount: number;
  payment_method: string;
  payment_reference?: string;
  notes?: string;
  amount_received?: number;
}

export interface OrderItemStatusUpdate {
  item_status: OrderItemStatus;
}

// ============================================
// Order Change Types (Cambios/Devoluciones de Encargos)
// ============================================

export interface OrderChange {
  id: string;
  order_id: string;
  original_item_id: string;
  user_id: string;
  change_type: ChangeType;
  change_date: string;
  returned_quantity: number;
  new_product_id: string | null;
  new_global_product_id: string | null;
  is_new_global_product: boolean;
  new_quantity: number;
  new_unit_price: number | null;
  new_size: string | null;
  new_color: string | null;
  new_custom_measurements: Record<string, number> | null;
  new_embroidery_text: string | null;
  price_adjustment: number;
  status: ChangeStatus;
  reason: string;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderChangeCreate {
  original_item_id: string;
  change_type: ChangeType;
  returned_quantity: number;
  new_product_id?: string | null;
  is_new_global_product?: boolean;
  new_quantity?: number;
  reason: string;
  payment_method?: 'cash' | 'nequi' | 'transfer' | 'card';
  new_size?: string | null;
  new_color?: string | null;
  new_custom_measurements?: Record<string, number> | null;
  new_embroidery_text?: string | null;
}

export interface OrderChangeListItem {
  id: string;
  order_id: string;
  order_code: string;
  school_id: string | null;
  school_name: string | null;
  change_type: ChangeType;
  status: ChangeStatus;
  returned_quantity: number;
  new_quantity: number;
  price_adjustment: number;
  change_date: string;
  reason: string;
}

// ============================================
// Product Demand Types (Demanda de Productos)
// ============================================

export interface OrderReference {
  order_id: string;
  order_code: string;
  order_status: OrderStatus;
  client_name: string | null;
  student_name: string | null;
  school_id: string | null;
  school_name: string | null;
  delivery_date: string | null;
  quantity: number;
  item_id: string;
  item_status: OrderItemStatus;
  has_custom_measurements: boolean;
  custom_measurements: Record<string, number> | null;
}

export interface ProductDemandItem {
  garment_type_id: string | null;
  garment_type_name: string;
  garment_type_category: string | null;
  size: string | null;
  color: string | null;
  total_quantity: number;
  pending_quantity: number;
  in_production_quantity: number;
  ready_quantity: number;
  order_count: number;
  item_count: number;
  is_yomber: boolean;
  is_global_product: boolean;
  school_ids: string[];
  school_names: string[];
  orders: OrderReference[];
  earliest_delivery_date: string | null;
}

export interface ProductDemandResponse {
  items: ProductDemandItem[];
  total_items: number;
  total_quantity: number;
  total_orders: number;
  yomber_quantity: number;
  standard_quantity: number;
  pending_quantity: number;
  in_production_quantity: number;
  ready_quantity: number;
  generated_at: string;
  filters_applied: Record<string, unknown>;
}

export interface ProductDemandFilters {
  school_id?: string;
  include_ready?: boolean;
  type_filter?: 'yomber' | 'standard' | 'all';
  sort_by?: 'quantity' | 'delivery_date' | 'order_count';
  sort_order?: 'asc' | 'desc';
}

// ============================================
// Accounting Types
// ============================================

export type TransactionType = 'income' | 'expense' | 'transfer';
export type AccPaymentMethod = 'cash' | 'nequi' | 'transfer' | 'card' | 'credit' | 'other';
export type ExpenseCategory = 'rent' | 'utilities' | 'payroll' | 'supplies' | 'inventory' |
                              'transport' | 'maintenance' | 'marketing' | 'taxes' | 'bank_fees' | 'other';

export interface Transaction {
  id: string;
  school_id: string;
  type: TransactionType;
  amount: number;
  payment_method: AccPaymentMethod;
  description: string;
  category: string | null;
  reference_code: string | null;
  transaction_date: string;
  sale_id: string | null;
  order_id: string | null;
  expense_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionListItem {
  id: string;
  type: TransactionType;
  amount: number;
  payment_method: AccPaymentMethod;
  description: string;
  category: string | null;
  reference_code: string | null;
  transaction_date: string;
  created_at: string;
}

export interface TransactionCreate {
  school_id: string;
  type: TransactionType;
  amount: number;
  payment_method: AccPaymentMethod;
  description: string;
  category?: string;
  reference_code?: string;
  transaction_date: string;
  sale_id?: string;
  order_id?: string;
  expense_id?: string;
}

export interface Expense {
  id: string;
  school_id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  amount_paid: number;
  is_paid: boolean;
  expense_date: string;
  due_date: string | null;
  vendor: string | null;
  receipt_number: string | null;
  notes: string | null;
  is_recurring: boolean;
  recurring_period: string | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  balance: number;
}

export interface ExpenseListItem {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  amount_paid: number;
  is_paid: boolean;
  expense_date: string;
  due_date: string | null;
  vendor: string | null;
  notes: string | null;
  is_recurring: boolean;
  balance: number;
  payment_method?: string | null;
  payment_account_name?: string | null;
  paid_at?: string | null;
}

export interface ExpenseCreate {
  school_id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date: string;
  due_date?: string;
  vendor?: string;
  receipt_number?: string;
  notes?: string;
  is_recurring?: boolean;
  recurring_period?: 'weekly' | 'monthly' | 'yearly';
}

export interface ExpensePayment {
  amount: number;
  payment_method: AccPaymentMethod;
  notes?: string;
  use_fallback?: boolean;
}

export interface DailyCashRegister {
  id: string;
  school_id: string;
  register_date: string;
  opening_balance: number;
  closing_balance: number | null;
  total_income: number;
  total_expenses: number;
  cash_income: number;
  transfer_income: number;
  card_income: number;
  credit_sales: number;
  is_closed: boolean;
  closed_at: string | null;
  closed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  net_flow: number;
}

// Daily Flow by Account (Cierre de Caja)
export interface AccountDailyFlow {
  account_id: string;
  account_name: string;
  account_code: string;
  opening_balance: number;
  total_income: number;
  total_expenses: number;
  closing_balance: number;
  income_count: number;
  expense_count: number;
  net_flow: number;
}

export interface DailyFlowTotals {
  opening_balance: number;
  total_income: number;
  total_expenses: number;
  closing_balance: number;
  net_flow: number;
}

export interface DailyFlowResponse {
  date: string;
  accounts: AccountDailyFlow[];
  totals: DailyFlowTotals;
}

export interface AccountingDashboard {
  today_income: number;
  today_expenses: number;
  today_net: number;
  month_income: number;
  month_expenses: number;
  month_net: number;
  pending_expenses: number;
  pending_expenses_amount: number;
  recent_transactions: TransactionListItem[];
}

export interface CashFlowSummary {
  period_start: string;
  period_end: string;
  total_income: number;
  total_expenses: number;
  net_flow: number;
  income_by_method: Record<string, number>;
  expenses_by_category: Record<string, number>;
}

export interface ExpensesByCategory {
  category: ExpenseCategory;
  total_amount: number;
  count: number;
  percentage: number;
}

// ============================================
// Balance General Types (Balance Sheet)
// ============================================

export type AccountType =
  | 'asset_current' | 'asset_fixed' | 'asset_intangible' | 'asset_other'
  | 'liability_current' | 'liability_long' | 'liability_other'
  | 'equity_capital' | 'equity_retained' | 'equity_other';

// Balance Account (Cuenta de Balance)
export interface BalanceAccount {
  id: string;
  school_id: string;
  account_type: AccountType;
  name: string;
  description: string | null;
  code: string | null;
  balance: number;
  original_value: number | null;
  accumulated_depreciation: number | null;
  useful_life_years: number | null;
  interest_rate: number | null;
  due_date: string | null;
  creditor: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BalanceAccountCreate {
  account_type: AccountType;
  name: string;
  description?: string;
  code?: string;
  balance: number;
  original_value?: number;
  accumulated_depreciation?: number;
  useful_life_years?: number;
  interest_rate?: number;
  due_date?: string;
  creditor?: string;
}

export interface BalanceAccountUpdate {
  name?: string;
  description?: string;
  code?: string;
  balance?: number;
  original_value?: number;
  accumulated_depreciation?: number;
  useful_life_years?: number;
  interest_rate?: number;
  due_date?: string;
  creditor?: string;
  is_active?: boolean;
}

export interface BalanceAccountListItem {
  id: string;
  account_type: AccountType;
  name: string;
  code: string | null;
  balance: number;
  net_value: number;
  is_active: boolean;
  // Extended fields for detailed views
  description?: string | null;
  original_value?: number | null;
  accumulated_depreciation?: number | null;
  useful_life_years?: number | null;
  interest_rate?: number | null;
  due_date?: string | null;
  creditor?: string | null;
}

// Balance Entry (Movimiento de Cuenta)
export interface BalanceEntry {
  id: string;
  account_id: string;
  school_id: string;
  entry_date: string;
  amount: number;
  balance_after: number;
  description: string;
  reference: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BalanceEntryCreate {
  entry_date: string;
  amount: number;
  description: string;
  reference?: string;
}

// Accounts Receivable (Cuentas por Cobrar)
export interface AccountsReceivable {
  id: string;
  school_id: string;
  client_id: string | null;
  sale_id: string | null;
  amount: number;
  amount_paid: number;
  description: string;
  due_date: string | null;
  invoice_date: string;
  is_paid: boolean;
  is_overdue: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  balance: number;
  client_name?: string;
}

export interface AccountsReceivableCreate {
  client_id?: string;
  sale_id?: string;
  amount: number;
  description: string;
  due_date?: string;
  invoice_date: string;
  notes?: string;
}

export interface AccountsReceivablePayment {
  amount: number;
  payment_method: AccPaymentMethod;
  notes?: string;
}

export interface AccountsReceivableListItem {
  id: string;
  client_id: string | null;
  client_name: string | null;
  amount: number;
  amount_paid: number;
  balance: number;
  description: string;
  due_date: string | null;
  invoice_date: string;
  is_paid: boolean;
  is_overdue: boolean;
  // Origin information
  origin_type?: 'sale' | 'order' | 'manual' | null;
  sale_id?: string | null;
  sale_code?: string | null;
  order_id?: string | null;
  order_code?: string | null;
  order_status?: string | null;
  // School information
  school_id?: string | null;
  school_name?: string | null;
  // Notes
  notes?: string | null;
}

// Accounts Payable (Cuentas por Pagar)
export interface AccountsPayable {
  id: string;
  school_id: string;
  vendor: string;
  amount: number;
  amount_paid: number;
  description: string;
  category: string | null;
  invoice_number: string | null;
  invoice_date: string;
  due_date: string | null;
  is_paid: boolean;
  is_overdue: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  balance: number;
}

export interface AccountsPayableCreate {
  vendor: string;
  amount: number;
  description: string;
  category?: string;
  invoice_number?: string;
  invoice_date: string;
  due_date?: string;
  notes?: string;
}

export interface AccountsPayablePayment {
  amount: number;
  payment_method: AccPaymentMethod;
  notes?: string;
}

export interface AccountsPayableListItem {
  id: string;
  vendor: string;
  amount: number;
  amount_paid: number;
  balance: number;
  description: string;
  category: string | null;
  invoice_number: string | null;
  invoice_date: string;
  due_date: string | null;
  is_paid: boolean;
  is_overdue: boolean;
}

// Balance General Summary (Balance Sheet Summary)
export interface BalanceGeneralSummary {
  as_of_date: string;
  // Activos
  total_current_assets: number;
  total_fixed_assets: number;
  total_other_assets: number;
  total_assets: number;
  // Pasivos
  total_current_liabilities: number;
  total_long_liabilities: number;
  total_other_liabilities: number;
  total_liabilities: number;
  // Patrimonio
  total_equity: number;
  // Check
  is_balanced: boolean;
}

// Accounts grouped by type for balance sheet display
export interface BalanceAccountsByType {
  account_type: AccountType;
  account_type_label: string;
  accounts: BalanceAccountListItem[];
  total: number;
}

export interface BalanceGeneralDetailed {
  as_of_date: string;
  // Assets breakdown
  current_assets: BalanceAccountsByType;
  fixed_assets: BalanceAccountsByType;
  other_assets: BalanceAccountsByType;
  // Liabilities breakdown
  current_liabilities: BalanceAccountsByType;
  long_liabilities: BalanceAccountsByType;
  other_liabilities: BalanceAccountsByType;
  // Equity breakdown
  equity: BalanceAccountsByType[];
  // Totals
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  is_balanced: boolean;
}

export interface ReceivablesPayablesSummary {
  // Receivables (Cuentas por Cobrar)
  total_receivables: number;
  receivables_collected: number;
  receivables_pending: number;
  receivables_overdue: number;
  receivables_count: number;
  // Payables (Cuentas por Pagar)
  total_payables: number;
  payables_paid: number;
  payables_pending: number;
  payables_overdue: number;
  payables_count: number;
  // Net position
  net_position: number;
}

// ============================================
// Global Product Types
// ============================================

export interface GlobalGarmentType {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  has_custom_measurements: boolean;
  requires_embroidery: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  images?: GarmentTypeImage[];
}

export interface GlobalProduct {
  id: string;
  code: string;
  garment_type_id: string;
  name: string | null;
  size: string;
  color: string | null;
  gender: string | null;
  price: number;
  cost: number | null;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Inventory fields
  inventory_quantity?: number;
  inventory_min_stock?: number;
  stock?: number; // Alias for inventory_quantity (for consistency with Product)
  min_stock?: number; // Minimum stock alert level
}

export interface GlobalProductWithInventory extends GlobalProduct {
  inventory_quantity: number;
  inventory_min_stock: number;
}

// ============================================
// API Response Types
// ============================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

export interface ApiError {
  detail: string;
}

// ============================================
// Caja Menor Types (Cash Register)
// ============================================

export interface CajaMenorBalance {
  id: string | null;
  name: string;
  code: string;
  balance: number;
  last_updated: string | null;
}

export interface CajaMenorSummary {
  caja_menor_balance: number;
  caja_mayor_balance: number;
  today_liquidations: number;
  today_entries_count: number;
  date: string;
}

export interface LiquidationResult {
  success: boolean;
  message: string;
  caja_menor_balance: number;
  caja_mayor_balance: number;
  amount_liquidated: number;
  entry_from: {
    id: string;
    amount: number;
    balance_after: number;
    description: string;
  };
  entry_to: {
    id: string;
    amount: number;
    balance_after: number;
    description: string;
  };
}

export interface LiquidationHistoryItem {
  id: string;
  date: string;
  amount: number;
  balance_after: number;
  description: string;
  reference: string;
  created_at: string;
}

// Cash balances response with all accounts
export interface CashBalances {
  caja_menor: {
    id: string;
    name: string;
    code: string;
    balance: number;
    last_updated: string | null;
  } | null;
  caja_mayor: {
    id: string;
    name: string;
    code: string;
    balance: number;
    last_updated: string | null;
  } | null;
  nequi: {
    id: string;
    name: string;
    code: string;
    balance: number;
    last_updated: string | null;
  } | null;
  banco: {
    id: string;
    name: string;
    code: string;
    balance: number;
    last_updated: string | null;
  } | null;
  total_liquid: number;
  total_cash: number;
}

// ============================================
// Alteration Types (Arreglos)
// ============================================

export type AlterationType = 'hem' | 'length' | 'width' | 'seam' | 'buttons' | 'zipper' | 'patch' | 'darts' | 'other';
export type AlterationStatus = 'pending' | 'in_progress' | 'ready' | 'delivered' | 'cancelled';

export const ALTERATION_TYPE_LABELS: Record<AlterationType, string> = {
  hem: 'Dobladillo',
  length: 'Largo',
  width: 'Ancho',
  seam: 'Costura',
  buttons: 'Botones',
  zipper: 'Cremallera',
  patch: 'Parche',
  darts: 'Pinzas',
  other: 'Otro'
};

export const ALTERATION_STATUS_LABELS: Record<AlterationStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En Proceso',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado'
};

export const ALTERATION_STATUS_COLORS: Record<AlterationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  ready: 'bg-green-100 text-green-800',
  delivered: 'bg-emerald-600 text-white',
  cancelled: 'bg-red-100 text-red-800'
};

export interface Alteration {
  id: string;
  code: string;
  client_id: string | null;
  external_client_name: string | null;
  external_client_phone: string | null;
  alteration_type: AlterationType;
  garment_name: string;
  description: string;
  cost: number;
  amount_paid: number;
  balance: number;
  is_paid: boolean;
  status: AlterationStatus;
  received_date: string;
  estimated_delivery_date: string | null;
  delivered_date: string | null;
  notes: string | null;
  client_display_name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlterationListItem {
  id: string;
  code: string;
  client_id: string | null;
  client_display_name: string;
  alteration_type: AlterationType;
  garment_name: string;
  cost: number;
  amount_paid: number;
  balance: number;
  status: AlterationStatus;
  received_date: string;
  estimated_delivery_date: string | null;
  is_paid: boolean;
}

export interface AlterationPayment {
  id: string;
  alteration_id: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  transaction_id: string | null;
  created_by: string | null;
  created_at: string;
  created_by_username: string | null;
}

export interface AlterationWithPayments extends Alteration {
  payments: AlterationPayment[];
}

export interface AlterationCreate {
  client_id?: string;
  external_client_name?: string;
  external_client_phone?: string;
  alteration_type: AlterationType;
  garment_name: string;
  description: string;
  cost: number;
  received_date: string;
  estimated_delivery_date?: string;
  notes?: string;
  initial_payment?: number;
  initial_payment_method?: string;
}

export interface AlterationUpdate {
  alteration_type?: AlterationType;
  garment_name?: string;
  description?: string;
  cost?: number;
  status?: AlterationStatus;
  estimated_delivery_date?: string;
  delivered_date?: string;
  notes?: string;
}

export interface AlterationPaymentCreate {
  amount: number;
  payment_method: 'cash' | 'nequi' | 'transfer' | 'card';
  notes?: string;
  apply_accounting?: boolean;
  amount_received?: number;
}

export interface AlterationsSummary {
  total_count: number;
  pending_count: number;
  in_progress_count: number;
  ready_count: number;
  delivered_count: number;
  cancelled_count: number;
  total_revenue: number;
  total_pending_payment: number;
  today_received: number;
  today_delivered: number;
}

// ============================================
// Notification Types
// ============================================

export type NotificationType =
  | 'new_web_order'
  | 'new_web_sale'
  | 'order_status_changed'
  | 'pqrs_received'
  | 'low_stock_alert';

export type ReferenceType = 'order' | 'sale' | 'contact' | 'product';

export interface Notification {
  id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  reference_type: ReferenceType | null;
  reference_id: string | null;
  school_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  unread_count: number;
}

export interface UnreadCountResponse {
  unread_count: number;
  last_notification_at: string | null;
}

// ============================================
// Financial Planning Types
// ============================================

export type DebtPaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface DebtPayment {
  id: string;
  description: string;
  creditor: string | null;
  amount: number;
  due_date: string;
  is_recurring: boolean;
  recurrence_day: number | null;
  status: DebtPaymentStatus;
  paid_date: string | null;
  paid_amount: number | null;
  payment_method: string | null;
  payment_account_id: string | null;
  balance_account_id: string | null;
  accounts_payable_id: string | null;
  category: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  days_until_due: number | null;
}

export interface DebtPaymentCreate {
  description: string;
  creditor?: string;
  amount: number;
  due_date: string;
  is_recurring?: boolean;
  recurrence_day?: number;
  category?: string;
  notes?: string;
}

export interface DebtPaymentListResponse {
  items: DebtPayment[];
  total: number;
  pending_total: number;
  overdue_total: number;
  next_due: DebtPayment | null;
}

// Sales Seasonality
export interface MonthlySalesData {
  year: number;
  month: number;
  month_name: string;
  total_sales: number;
  sales_count: number;
  average_sale: number;
}

export interface SeasonalityPattern {
  period: string;
  percentage: number;
  behavior: 'ALTA' | 'MEDIA' | 'BAJA';
}

export interface SalesSeasonalityResponse {
  monthly_data: MonthlySalesData[];
  yearly_totals: Record<string, number>;
  patterns: SeasonalityPattern[];
  growth_rates: Record<string, number>;
  disclaimer: string;
}

// Cash Flow Projection
export interface MonthlyProjection {
  year: number;
  month: number;
  month_name: string;
  projected_sales: number;
  projected_income: number;
  fixed_expenses: number;
  debt_payments: number;
  projected_expenses: number;
  net_flow: number;
  opening_balance: number;
  closing_balance: number;
  is_below_threshold: boolean;
  has_debt_due: boolean;
  alert_message: string | null;
}

export interface CashProjectionParams {
  months?: number;
  growth_factor?: number;
  liquidity_threshold?: number;
}

export interface CashProjectionResponse {
  projections: MonthlyProjection[];
  current_liquidity: number;
  projected_end_balance: number;
  total_projected_income: number;
  total_projected_expenses: number;
  total_debt_payments: number;
  growth_factor: number;
  liquidity_threshold: number;
  months_below_threshold: string[];
  upcoming_debt_payments: DebtPayment[];
  disclaimer: string;
}

// Planning Dashboard
export interface PlanningDashboard {
  current_liquidity: number;
  current_date: string;
  fixed_expenses_monthly: number;
  pending_debt_total: number;
  next_debt_payment: DebtPayment | null;
  quick_projection: MonthlyProjection[];
  current_season: 'ALTA' | 'MEDIA' | 'BAJA';
  season_message: string;
}
