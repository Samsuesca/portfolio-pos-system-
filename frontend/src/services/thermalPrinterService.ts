/**
 * Thermal Printer Service
 *
 * Provides interface to communicate with thermal printers via Tauri commands.
 * Compatible with Jaltech 80mm USB/RED and other ESC/POS printers.
 */
import { invoke } from "@tauri-apps/api/core";
import apiClient from "../utils/api-client";
import {
  generateSaleReceipt,
  generateOrderReceipt,
  generateAlterationReceipt,
  generateTestReceipt,
  type SaleData,
  type OrderData,
  type AlterationData,
  type PrinterConfig,
} from "../utils/escpos";

export interface PortInfo {
  name: string;
  port_type: string;
  description: string | null;
}

export interface PrinterSettings {
  enabled: boolean;
  portName: string;
  autoOpenDrawer: boolean;
  autoPrintReceipt: boolean;
}

const DEFAULT_SETTINGS: PrinterSettings = {
  enabled: false,
  portName: "",
  autoOpenDrawer: true,
  autoPrintReceipt: false,  // Manual print via button, not automatic
};

const STORAGE_KEY = "thermal_printer_settings";

/**
 * Check if running inside Tauri v2
 * In Tauri v2, __TAURI__ is not automatically exposed.
 * We check for __TAURI_INTERNALS__ or __TAURI_IPC__ instead.
 */
function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  // Tauri v2 detection
  return "__TAURI_INTERNALS__" in window || "__TAURI_IPC__" in window || "__TAURI__" in window;
}

/**
 * List available serial ports
 */
export async function listPorts(): Promise<PortInfo[]> {
  if (!isTauri()) {
    console.warn("Tauri not available, cannot list serial ports");
    return [];
  }

  try {
    const ports = await invoke<PortInfo[]>("list_serial_ports");
    return ports;
  } catch (error) {
    console.error("Error listing serial ports:", error);
    throw new Error(`No se pudieron listar los puertos: ${error}`);
  }
}

/**
 * Print raw ESC/POS data to printer
 */
export async function printRaw(portName: string, data: number[]): Promise<boolean> {
  if (!isTauri()) {
    console.warn("Tauri not available, cannot print");
    return false;
  }

  if (!portName) {
    throw new Error("Puerto de impresora no configurado");
  }

  try {
    const result = await invoke<boolean>("print_thermal", {
      portName,
      data,
    });
    return result;
  } catch (error) {
    console.error("Error printing:", error);
    throw new Error(`Error al imprimir: ${error}`);
  }
}

/**
 * Open the cash drawer
 */
export async function openCashDrawer(portName?: string): Promise<boolean> {
  const settings = getSettings();
  const port = portName || settings.portName;

  if (!isTauri()) {
    console.warn("Tauri not available, cannot open cash drawer");
    return false;
  }

  if (!port) {
    throw new Error("Puerto de impresora no configurado");
  }

  try {
    const result = await invoke<boolean>("open_cash_drawer", { portName: port });
    return result;
  } catch (error) {
    console.error("Error opening cash drawer:", error);
    throw new Error(`Error al abrir el cajón: ${error}`);
  }
}

/**
 * Print receipt and optionally open cash drawer
 */
export async function printAndOpenDrawer(
  portName: string,
  data: number[],
  openDrawer: boolean
): Promise<boolean> {
  if (!isTauri()) {
    console.warn("Tauri not available");
    return false;
  }

  try {
    const result = await invoke<boolean>("print_and_open_drawer", {
      portName,
      data,
      openDrawer,
    });
    return result;
  } catch (error) {
    console.error("Error in print_and_open_drawer:", error);
    throw new Error(`Error: ${error}`);
  }
}

/**
 * Test printer connection
 */
export async function testPrinter(portName?: string): Promise<boolean> {
  const settings = getSettings();
  const port = portName || settings.portName;

  if (!port) {
    throw new Error("Puerto de impresora no configurado");
  }

  const testData = generateTestReceipt(port);
  return printRaw(port, testData);
}

/**
 * Test cash drawer
 */
export async function testCashDrawer(portName?: string): Promise<boolean> {
  return openCashDrawer(portName);
}

/**
 * Get printer settings from localStorage
 */
export function getSettings(): PrinterSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("Error reading printer settings:", error);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save printer settings to localStorage
 */
export function saveSettings(settings: Partial<PrinterSettings>): PrinterSettings {
  const current = getSettings();
  const updated = { ...current, ...settings };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Error saving printer settings:", error);
  }
  return updated;
}

/**
 * Check if printer is configured and enabled
 */
export function isPrinterConfigured(): boolean {
  const settings = getSettings();
  return settings.enabled && !!settings.portName;
}

// Sale response type for API (matches SaleWithItems schema from backend)
interface SaleApiResponse {
  code: string;
  sale_date: string;
  client_name?: string;
  school_name?: string;
  items: Array<{
    quantity: number;
    unit_price: number;
    subtotal: number;
    is_global_product?: boolean;
    // School product fields
    product_name?: string;
    product_size?: string;
    product_code?: string;
    // Global product fields
    global_product_name?: string;
    global_product_size?: string;
    global_product_code?: string;
  }>;
  discount?: number;
  total: number;
  paid_amount?: number;
  payment_method?: string;
  notes?: string;
  // Payments array with cash change tracking
  payments?: Array<{
    amount: number;
    payment_method: string;
    amount_received?: number;
    change_given?: number;
  }>;
}

// Order response type for API (matches OrderWithItems schema from backend)
// Note: Backend returns flat fields (client_name, school_name) not nested objects
interface OrderApiResponse {
  code: string;
  created_at: string;
  status: string;
  // Client info as flat fields (from backend OrderWithItems)
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  // School info as flat field
  school_name?: string;
  // Items with garment_type_name as direct field
  items: Array<{
    quantity: number;
    unit_price: number;
    subtotal: number;
    size?: string;
    color?: string;
    custom_measurements?: Record<string, number>;
    embroidery_text?: string;
    // Garment type name is a direct field, not nested
    garment_type_name?: string;
  }>;
  subtotal: number;
  total: number;
  paid_amount?: number;
  balance?: number;
  // Backend returns lowercase: "pickup" | "delivery"
  delivery_type: "pickup" | "delivery";
  delivery_date?: string;
  notes?: string;
}

/**
 * Fetch sale data from API and format for receipt
 */
async function fetchSaleData(schoolId: string, saleId: string, schoolName?: string): Promise<SaleData> {
  // Use /items endpoint to get full product details, client_name, school_name
  const response = await apiClient.get<SaleApiResponse>(`/schools/${schoolId}/sales/${saleId}/items`);
  const sale = response.data;

  // Determinar si mostrar el colegio (solo si hay productos especificos del colegio)
  const hasSchoolProducts = sale.items.some((item) => !item.is_global_product && item.product_name);

  return {
    code: sale.code || "SIN-CODIGO",
    sale_date: sale.sale_date || new Date().toISOString(),
    client_name: sale.client_name,
    school_name: hasSchoolProducts ? (sale.school_name || schoolName) : undefined,
    items: sale.items.map((item) => {
      // Get product name: prefer school product, fallback to global
      const productName = item.is_global_product
        ? (item.global_product_name || "Producto")
        : (item.product_name || item.global_product_name || "Producto");

      // Get size: prefer school product size, fallback to global
      const productSize = item.is_global_product
        ? item.global_product_size
        : (item.product_size || item.global_product_size);

      return {
        quantity: Number(item.quantity) || 1,
        product_name: productName,
        product_size: productSize,
        unit_price: Number(item.unit_price) || 0,
        subtotal: Number(item.subtotal) || 0,
      };
    }),
    subtotal: sale.items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0),
    discount: Number(sale.discount) || 0,
    total: Number(sale.total) || 0,
    paid_amount: Number(sale.paid_amount) || Number(sale.total) || 0,
    payment_method: sale.payment_method || "cash",
    // Include payments with cash change info
    payments: sale.payments?.map((p) => ({
      amount: Number(p.amount) || 0,
      payment_method: p.payment_method,
      amount_received: p.amount_received ? Number(p.amount_received) : undefined,
      change_given: p.change_given ? Number(p.change_given) : undefined,
    })),
    notes: sale.notes,
  };
}

/**
 * Format custom measurements for display
 */
function formatMeasurements(measurements?: Record<string, number>): string | undefined {
  if (!measurements || Object.keys(measurements).length === 0) return undefined;
  return Object.entries(measurements)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}

/**
 * Fetch order data from API and format for receipt
 */
async function fetchOrderData(schoolId: string, orderId: string, schoolName?: string): Promise<OrderData> {
  const response = await apiClient.get<OrderApiResponse>(`/schools/${schoolId}/orders/${orderId}`);
  const order = response.data;

  return {
    code: order.code || "SIN-CODIGO",
    order_date: order.created_at || new Date().toISOString(),
    status: order.status?.toUpperCase() || "PENDING",
    // Use flat fields from API response (not nested objects)
    client_name: order.client_name,
    client_email: order.client_email,
    // Show school_name if available (from API or fallback)
    school_name: order.school_name || schoolName,
    items: order.items.map((item) => ({
      // garment_type_name is a direct field in the API response
      name: item.garment_type_name || "Articulo",
      size: item.size,
      color: item.color,
      custom_measurements: formatMeasurements(item.custom_measurements),
      embroidery_text: item.embroidery_text,
      quantity: item.quantity || 1,
      subtotal: item.subtotal || 0,
    })),
    subtotal: order.subtotal || 0,
    total: order.total || 0,
    paid_amount: order.paid_amount || 0,
    balance: order.balance || (order.total || 0) - (order.paid_amount || 0),
    // Convert lowercase to uppercase for display logic
    delivery_type: (order.delivery_type?.toUpperCase() as "PICKUP" | "DELIVERY") || "PICKUP",
    delivery_date: order.delivery_date,
    notes: order.notes,
  };
}

/**
 * Print a sale receipt
 */
export async function printSaleReceipt(
  schoolId: string,
  saleId: string,
  config?: PrinterConfig
): Promise<boolean> {
  const settings = getSettings();

  if (!settings.enabled || !settings.portName) {
    console.log("Printer not configured, skipping print");
    return false;
  }

  try {
    // Fetch sale data from API
    const saleData = await fetchSaleData(schoolId, saleId);

    // Generate ESC/POS data
    const receiptData = generateSaleReceipt(saleData, config);

    // Print
    return await printRaw(settings.portName, receiptData);
  } catch (error) {
    console.error("Error printing sale receipt:", error);
    throw error;
  }
}

/**
 * Print receipt and open drawer for cash sales
 */
export async function printSaleReceiptWithDrawer(
  schoolId: string,
  saleId: string,
  paymentMethod: string,
  config?: PrinterConfig
): Promise<boolean> {
  const settings = getSettings();

  if (!settings.enabled || !settings.portName) {
    console.log("Printer not configured, skipping");
    return false;
  }

  try {
    // Fetch sale data
    const saleData = await fetchSaleData(schoolId, saleId);

    // Generate receipt
    const receiptData = generateSaleReceipt(saleData, config);

    // Should we open drawer?
    const shouldOpenDrawer = settings.autoOpenDrawer && paymentMethod === "cash";

    // Print and optionally open drawer
    return await printAndOpenDrawer(settings.portName, receiptData, shouldOpenDrawer);
  } catch (error) {
    console.error("Error in printSaleReceiptWithDrawer:", error);
    throw error;
  }
}

/**
 * Handle post-sale printing based on settings
 */
export async function handlePostSalePrint(
  schoolId: string,
  saleId: string,
  paymentMethod: string
): Promise<void> {
  const settings = getSettings();

  // Skip if printer not configured
  if (!settings.enabled || !settings.portName) {
    return;
  }

  // Skip if auto-print is disabled
  if (!settings.autoPrintReceipt) {
    return;
  }

  try {
    await printSaleReceiptWithDrawer(schoolId, saleId, paymentMethod);
  } catch (error) {
    // Log error but don't throw - printing failure shouldn't block sale
    console.error("Post-sale print failed:", error);
  }
}

/**
 * Print an order receipt
 */
export async function printOrderReceipt(
  schoolId: string,
  orderId: string,
  schoolName?: string,
  config?: PrinterConfig
): Promise<boolean> {
  const settings = getSettings();

  if (!settings.enabled || !settings.portName) {
    console.log("Printer not configured, skipping print");
    return false;
  }

  try {
    // Fetch order data from API
    const orderData = await fetchOrderData(schoolId, orderId, schoolName);

    // Generate ESC/POS data
    const receiptData = generateOrderReceipt(orderData, config);

    // Print
    return await printRaw(settings.portName, receiptData);
  } catch (error) {
    console.error("Error printing order receipt:", error);
    throw error;
  }
}

/**
 * Print order receipt and open cash drawer if payment is cash
 */
export async function printOrderReceiptWithDrawer(
  schoolId: string,
  orderId: string,
  paymentMethod: string,
  schoolName?: string,
  config?: PrinterConfig
): Promise<boolean> {
  const settings = getSettings();

  if (!settings.enabled || !settings.portName) {
    console.log("Printer not configured, skipping");
    return false;
  }

  try {
    // Fetch order data from API
    const orderData = await fetchOrderData(schoolId, orderId, schoolName);

    // Generate ESC/POS data
    const receiptData = generateOrderReceipt(orderData, config);

    // Open drawer if cash payment and auto-open is enabled
    const shouldOpenDrawer = settings.autoOpenDrawer && paymentMethod === "cash";

    // Print and optionally open drawer
    return await printAndOpenDrawer(settings.portName, receiptData, shouldOpenDrawer);
  } catch (error) {
    console.error("Error in printOrderReceiptWithDrawer:", error);
    throw error;
  }
}

/**
 * Handle post-order printing based on settings
 */
export async function handlePostOrderPrint(
  schoolId: string,
  orderId: string,
  schoolName?: string
): Promise<void> {
  const settings = getSettings();

  // Skip if printer not configured
  if (!settings.enabled || !settings.portName) {
    return;
  }

  // Skip if auto-print is disabled
  if (!settings.autoPrintReceipt) {
    return;
  }

  try {
    await printOrderReceipt(schoolId, orderId, schoolName);
  } catch (error) {
    // Log error but don't throw - printing failure shouldn't block order
    console.error("Post-order print failed:", error);
  }
}

// ============================================
// ALTERATION (ARREGLO) PRINTING
// ============================================

// Alteration response type for API
interface AlterationApiResponse {
  id: string;
  code: string;
  client_id: string | null;
  external_client_name: string | null;
  external_client_phone: string | null;
  alteration_type: string;
  garment_name: string;
  description: string;
  cost: number;
  amount_paid: number;
  balance: number;
  is_paid: boolean;
  status: string;
  received_date: string;
  estimated_delivery_date: string | null;
  delivered_date: string | null;
  notes: string | null;
  client_display_name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch alteration data from API and format for receipt
 */
async function fetchAlterationData(alterationId: string): Promise<AlterationData> {
  const response = await apiClient.get<AlterationApiResponse>(`/global/alterations/${alterationId}`);
  const alteration = response.data;

  return {
    code: alteration.code || "SIN-CODIGO",
    received_date: alteration.received_date || new Date().toISOString(),
    status: alteration.status || "pending",
    client_name: alteration.client_display_name || alteration.external_client_name || "Sin nombre",
    client_phone: alteration.external_client_phone || undefined,
    alteration_type: alteration.alteration_type || "other",
    garment_name: alteration.garment_name || "Prenda",
    description: alteration.description || "",
    cost: Number(alteration.cost) || 0,
    amount_paid: Number(alteration.amount_paid) || 0,
    balance: Number(alteration.balance) || 0,
    is_paid: alteration.is_paid || false,
    estimated_delivery_date: alteration.estimated_delivery_date || undefined,
    notes: alteration.notes || undefined,
  };
}

/**
 * Print an alteration receipt
 */
export async function printAlterationReceipt(
  alterationId: string,
  config?: PrinterConfig
): Promise<boolean> {
  const settings = getSettings();

  if (!settings.enabled || !settings.portName) {
    console.log("Printer not configured, skipping print");
    return false;
  }

  try {
    // Fetch alteration data from API
    const alterationData = await fetchAlterationData(alterationId);

    // Generate ESC/POS data
    const receiptData = generateAlterationReceipt(alterationData, config);

    // Print
    return await printRaw(settings.portName, receiptData);
  } catch (error) {
    console.error("Error printing alteration receipt:", error);
    throw error;
  }
}

/**
 * Print alteration receipt and open cash drawer if payment is cash
 */
export async function printAlterationReceiptWithDrawer(
  alterationId: string,
  paymentMethod: string,
  config?: PrinterConfig
): Promise<boolean> {
  const settings = getSettings();

  if (!settings.enabled || !settings.portName) {
    console.log("Printer not configured, skipping");
    return false;
  }

  try {
    // Fetch alteration data from API
    const alterationData = await fetchAlterationData(alterationId);

    // Generate ESC/POS data
    const receiptData = generateAlterationReceipt(alterationData, config);

    // Open drawer if cash payment and auto-open is enabled
    const shouldOpenDrawer = settings.autoOpenDrawer && paymentMethod === "cash";

    // Print and optionally open drawer
    return await printAndOpenDrawer(settings.portName, receiptData, shouldOpenDrawer);
  } catch (error) {
    console.error("Error in printAlterationReceiptWithDrawer:", error);
    throw error;
  }
}

export const thermalPrinterService = {
  listPorts,
  printRaw,
  openCashDrawer,
  printAndOpenDrawer,
  testPrinter,
  testCashDrawer,
  getSettings,
  saveSettings,
  isPrinterConfigured,
  printSaleReceipt,
  printSaleReceiptWithDrawer,
  handlePostSalePrint,
  printOrderReceipt,
  printOrderReceiptWithDrawer,
  handlePostOrderPrint,
  printAlterationReceipt,
  printAlterationReceiptWithDrawer,
  isTauri,
};

export default thermalPrinterService;
