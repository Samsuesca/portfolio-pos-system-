export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  last_login: string | null;
  telegram_chat_id: string | null;
  created_at: string;
  updated_at: string | null;
  school_roles: UserSchoolRole[];
  permissions_version?: number;
}

export interface UserSchoolRole {
  id: string;
  user_id: string;
  school_id: string;
  role: string | null;
  custom_role_id: string | null;
  custom_role_name: string | null;
  is_primary: boolean;
  created_at: string;
  permissions: string[];
  max_discount_percent: number;
  constraints: Record<string, Record<string, unknown>>;
}

export interface Token {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: Token;
  user: User;
}

export interface School {
  id: string;
  code: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  settings: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  display_order?: number;
}

export interface DashboardStats {
  totals: {
    total_sales: number;
    sales_amount_month: number;
    total_orders: number;
    pending_orders: number;
    total_clients: number;
    total_products: number;
  };
  schools_summary: SchoolSummary[];
  school_count: number;
}

export interface SchoolSummary {
  school_id: string;
  school_name: string;
  school_code: string;
  sales_count: number;
  sales_amount: number;
  pending_orders: number;
}

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CREDIT' | 'NEQUI';
export type SaleStatus = 'pending' | 'completed' | 'cancelled';
export type SaleSource = 'desktop_app' | 'web_portal' | 'api';
export type OrderStatus = 'pending' | 'in_production' | 'ready' | 'delivered' | 'cancelled';

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
  page: number;
  total_pages: number;
  has_more: boolean;
}

export interface SaleListItem {
  id: string;
  code: string;
  status: SaleStatus;
  source: SaleSource;
  is_historical: boolean;
  payment_method: PaymentMethod | null;
  total: number;
  paid_amount: number;
  client_id: string | null;
  client_name: string | null;
  sale_date: string;
  created_at: string;
  items_count: number;
  user_id: string | null;
  user_name: string | null;
  school_id: string | null;
  school_name: string | null;
}

export interface SalePayment {
  id: string;
  sale_id: string;
  amount: number;
  payment_method: PaymentMethod;
  notes: string | null;
  transaction_id: string | null;
  amount_received: number | null;
  change_given: number | null;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface SaleDetail {
  id: string;
  code: string;
  status: SaleStatus;
  source: SaleSource;
  is_historical: boolean;
  payment_method: PaymentMethod | null;
  total: number;
  paid_amount: number;
  client_id: string | null;
  user_id: string;
  sale_date: string;
  created_at: string;
  updated_at: string;
  items: SaleItem[];
  payments: SalePayment[];
  school_id: string;
}

export interface SaleCreatePayment {
  amount: number;
  payment_method: PaymentMethod;
  notes?: string | null;
  amount_received?: number | null;
}

export interface SaleCreateItem {
  product_id: string;
  quantity: number;
}

export interface SaleCreate {
  client_id?: string | null;
  items: SaleCreateItem[];
  source?: SaleSource;
  payment_method?: PaymentMethod | null;
  payments?: SaleCreatePayment[];
  notes?: string | null;
}

export interface Client {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  student_name: string | null;
  student_grade: string | null;
  is_active: boolean;
  client_type: 'REGULAR' | 'WEB';
  school_id: string | null;
  created_at: string;
  updated_at: string | null;
  students?: ClientStudent[];
}

export interface ClientStudent {
  id: string;
  client_id: string;
  school_id: string;
  student_name: string;
  student_grade: string | null;
  student_section: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  school_name: string | null;
}

export interface ClientListItem {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  student_name: string | null;
  student_grade: string | null;
  is_active: boolean;
  client_type: 'REGULAR' | 'WEB';
  student_count: number;
}

export interface ClientCreate {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  student_name?: string | null;
  student_grade?: string | null;
  school_id?: string | null;
}

export interface ClientUpdate {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  student_name?: string | null;
  student_grade?: string | null;
}

export interface ClientStudentCreate {
  school_id: string;
  student_name: string;
  student_grade?: string | null;
  student_section?: string | null;
  notes?: string | null;
}

export interface ClientStudentUpdate {
  student_name?: string | null;
  student_grade?: string | null;
  student_section?: string | null;
  notes?: string | null;
}

export interface ProductListItem {
  id: string;
  code: string;
  name: string;
  size: string | null;
  color: string | null;
  gender: string | null;
  price: number;
  is_active: boolean;
  is_global?: boolean;
  garment_type_id: string;
  garment_type_name: string | null;
  school_id: string | null;
  school_name: string | null;
  stock: number | null;
  min_stock: number | null;
  pending_orders_qty: number;
  pending_orders_count: number;
}

export interface OrderListItem {
  id: string;
  code: string;
  status: OrderStatus;
  source: SaleSource | null;
  client_name: string | null;
  student_name: string | null;
  delivery_date: string | null;
  total: number;
  balance: number;
  created_at: string;
  items_count: number;
  user_id: string | null;
  user_name: string | null;
  school_id: string | null;
  school_name: string | null;
  items_delivered: number;
  items_total: number;
}

export interface OrderDetail {
  id: string;
  code: string;
  status: OrderStatus;
  source: SaleSource | null;
  client_id: string;
  delivery_date: string | null;
  notes: string | null;
  subtotal: number;
  tax: number;
  total: number;
  paid_amount: number;
  balance: number;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  student_name: string | null;
  school_name: string | null;
  school_id: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  school_id: string;
  garment_type_id: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  size: string | null;
  color: string | null;
  gender: string | null;
  notes: string | null;
  item_status: string;
  garment_type_name: string;
}

export interface PaginatedParams {
  skip?: number;
  limit?: number;
  search?: string;
}

// ============================================
// Accounting Types
// ============================================

export type AccPaymentMethod = 'cash' | 'nequi' | 'transfer' | 'card' | 'credit' | 'other';

export interface CashBalanceInfo {
  id: string;
  name: string;
  balance: number;
  last_updated: string | null;
}

export interface CashBalancesResponse {
  caja: CashBalanceInfo | null;
  banco: CashBalanceInfo | null;
  total_liquid: number;
  caja_menor: CashBalanceInfo | null;
  caja_mayor: CashBalanceInfo | null;
  nequi: CashBalanceInfo | null;
  total_cash: number | null;
}

export interface CategoryBreakdownItem {
  income: number;
  expense: number;
  count: number;
}

export interface CategoryBreakdown {
  sales: CategoryBreakdownItem;
  orders: CategoryBreakdownItem;
  alterations: CategoryBreakdownItem;
  sale_changes: CategoryBreakdownItem;
  transfers: CategoryBreakdownItem;
  expenses: CategoryBreakdownItem;
  other: CategoryBreakdownItem;
}

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
  breakdown_by_category: CategoryBreakdown | null;
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

export interface ExpenseListItem {
  id: string;
  category: string;
  description: string;
  amount: number;
  amount_paid: number;
  is_paid: boolean;
  expense_date: string;
  due_date: string | null;
  vendor: string | null;
  is_recurring: boolean;
  balance: number;
  payment_method: string | null;
  payment_account_name: string | null;
  paid_at: string | null;
}

export interface ExpenseDetail {
  id: string;
  school_id: string | null;
  category: string;
  description: string;
  amount: number;
  amount_paid: number;
  is_paid: boolean;
  expense_date: string;
  due_date: string | null;
  vendor: string | null;
  receipt_number: string | null;
  is_recurring: boolean;
  recurring_period: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  balance: number;
  payment_method: string | null;
  payment_account_name: string | null;
  paid_at: string | null;
}

export interface ExpenseCreate {
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  due_date?: string | null;
  vendor?: string | null;
  receipt_number?: string | null;
  notes?: string | null;
  is_recurring?: boolean;
  recurring_period?: 'weekly' | 'monthly' | 'yearly' | null;
  school_id?: string | null;
}

export interface ExpensePayment {
  amount: number;
  payment_method: AccPaymentMethod;
  notes?: string | null;
  use_fallback?: boolean;
}

export interface ExpenseCategory {
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface ReceivableListItem {
  id: string;
  client_id: string | null;
  sale_id: string | null;
  amount: number;
  amount_paid: number;
  balance: number;
  description: string;
  invoice_date: string;
  due_date: string | null;
  is_paid: boolean;
  is_overdue: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client_name: string | null;
}

export interface ReceivablePayment {
  amount: number;
  payment_method: AccPaymentMethod;
  notes?: string | null;
}

export interface AddPaymentToSale {
  amount: number;
  payment_method: PaymentMethod;
  notes?: string | null;
  apply_accounting?: boolean;
  amount_received?: number | null;
}

export interface OrderPaymentCreate {
  amount: number;
  payment_method: string;
  payment_reference?: string | null;
  notes?: string | null;
  amount_received?: number | null;
}

export interface GarmentType {
  id: string;
  name: string;
  category: string | null;
  is_active: boolean;
  school_id: string;
}

export interface OrderItemCreate {
  garment_type_id?: string | null;
  product_id?: string | null;
  quantity: number;
  unit_price?: number | null;
  size?: string | null;
  color?: string | null;
  gender?: string | null;
  notes?: string | null;
  reserve_stock?: boolean;
}

export interface OrderCreate {
  client_id: string;
  delivery_date?: string | null;
  notes?: string | null;
  items: OrderItemCreate[];
  advance_payment?: number | null;
  advance_payment_method?: string | null;
  advance_amount_received?: number | null;
  source?: string;
}

export type ChangeType = 'size_change' | 'product_change' | 'return' | 'defect';
export type ChangeStatus = 'pending' | 'pending_stock' | 'approved' | 'rejected';

export interface SaleChangeCreate {
  change_type: ChangeType;
  original_item_id: string;
  returned_quantity: number;
  new_product_id?: string | null;
  is_new_global_product?: boolean;
  new_quantity?: number;
  reason: string;
  create_order_if_no_stock?: boolean;
  payment_method?: PaymentMethod | null;
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
  reason: string;
  original_product_name: string | null;
  new_product_name: string | null;
  client_name: string | null;
  school_name: string | null;
}

export interface SaleChangeDetail extends SaleChangeListItem {
  sale_total: number;
  sale_date: string;
  original_unit_price: number | null;
  new_unit_price: number | null;
  rejection_reason: string | null;
  approved_by_name: string | null;
  created_by_name: string | null;
}
