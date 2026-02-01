/**
 * ESC/POS Commands Generator for Thermal Printers
 *
 * Compatible with Jaltech 80mm USB/RED and other ESC/POS printers.
 * Paper width: 80mm (576 dots/line, 48 chars font A, 64 chars font B)
 */

// ESC/POS Command Constants
export const ESC = 0x1b;
export const GS = 0x1d;
export const LF = 0x0a;

// Commands
export const COMMANDS = {
  // Initialize printer
  INIT: [ESC, 0x40], // ESC @

  // Select character code table (for Spanish accents)
  // ESC t n - Select character code table
  // n=2: CP850 (Multilingual Latin 1) - supports áéíóúñ
  CODE_PAGE_CP850: [ESC, 0x74, 0x02], // ESC t 2

  // Text alignment
  ALIGN_LEFT: [ESC, 0x61, 0x00], // ESC a 0
  ALIGN_CENTER: [ESC, 0x61, 0x01], // ESC a 1
  ALIGN_RIGHT: [ESC, 0x61, 0x02], // ESC a 2

  // Text formatting
  BOLD_ON: [ESC, 0x45, 0x01], // ESC E 1
  BOLD_OFF: [ESC, 0x45, 0x00], // ESC E 0
  UNDERLINE_ON: [ESC, 0x2d, 0x01], // ESC - 1
  UNDERLINE_OFF: [ESC, 0x2d, 0x00], // ESC - 0

  // Font size (double height/width)
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10], // ESC ! 16
  DOUBLE_WIDTH: [ESC, 0x21, 0x20], // ESC ! 32
  DOUBLE_SIZE: [ESC, 0x21, 0x30], // ESC ! 48
  NORMAL_SIZE: [ESC, 0x21, 0x00], // ESC ! 0

  // Paper control
  FEED_LINE: [LF],
  FEED_LINES: (n: number) => [ESC, 0x64, n], // ESC d n

  // Cut paper
  CUT_FULL: [GS, 0x56, 0x00], // GS V 0
  CUT_PARTIAL: [GS, 0x56, 0x01], // GS V 1

  // Cash drawer
  OPEN_DRAWER: [ESC, 0x70, 0x00, 0x19, 0xfa], // ESC p 0 25 250
};

/**
 * Map Unicode characters to CP850 code page for ESC/POS printers
 * CP850 is the standard code page for Spanish characters
 */
const UNICODE_TO_CP850: Record<number, number> = {
  // Spanish accented vowels
  0x00e1: 0xa0, // á
  0x00c1: 0xb5, // Á
  0x00e9: 0x82, // é
  0x00c9: 0x90, // É
  0x00ed: 0xa1, // í
  0x00cd: 0xd6, // Í
  0x00f3: 0xa2, // ó
  0x00d3: 0xe0, // Ó
  0x00fa: 0xa3, // ú
  0x00da: 0xe9, // Ú
  // Spanish ñ
  0x00f1: 0xa4, // ñ
  0x00d1: 0xa5, // Ñ
  // Other common Spanish characters
  0x00fc: 0x81, // ü
  0x00dc: 0x9a, // Ü
  0x00bf: 0xa8, // ¿
  0x00a1: 0xad, // ¡
};

/**
 * Convert string to bytes using CP850 encoding for Spanish characters
 */
function textToBytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 128) {
      // ASCII characters pass through directly
      bytes.push(code);
    } else if (UNICODE_TO_CP850[code] !== undefined) {
      // Map special characters to CP850
      bytes.push(UNICODE_TO_CP850[code]);
    } else if (code < 256) {
      // Latin-1 characters that might work
      bytes.push(code);
    } else {
      // Replace unsupported characters with ?
      bytes.push(0x3f);
    }
  }
  return bytes;
}

/**
 * Format currency for Colombian Pesos
 * Uses manual formatting for consistent output in thermal printers
 * Handles both numbers and strings safely
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  // Convert to number safely
  const numAmount = Number(amount) || 0;
  // Round to integer (no decimals for COP)
  const rounded = Math.round(numAmount);
  const absValue = Math.abs(rounded);
  // Manual thousand separator (dots for Colombian format)
  const formatted = String(absValue).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return rounded < 0 ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Format date for receipt
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format date only (no time)
 */
function formatDateOnly(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Pad or truncate string to specific length
 */
function padString(str: string, length: number, align: "left" | "right" = "left"): string {
  if (str.length > length) {
    return str.substring(0, length);
  }
  const padding = " ".repeat(length - str.length);
  return align === "left" ? str + padding : padding + str;
}

/**
 * Center text within a given width
 */
function centerText(text: string, width: number = 48): string {
  if (text.length >= width) {
    return text.substring(0, width);
  }
  const padding = Math.floor((width - text.length) / 2);
  return " ".repeat(padding) + text;
}

/**
 * Create a line with left and right text
 */
function createLine(left: string, right: string | null | undefined, width: number = 48): string {
  // Handle null/undefined values
  const safeLeft = left ?? "";
  const safeRight = right ?? "";

  const rightLen = safeRight.length;
  const leftMaxLen = width - rightLen - 1;
  const leftTrunc = safeLeft.substring(0, leftMaxLen);
  const spaces = " ".repeat(Math.max(0, width - leftTrunc.length - rightLen));
  return leftTrunc + spaces + safeRight;
}

/**
 * Create a separator line
 */
function createSeparator(char: string = "-", width: number = 48): string {
  return char.repeat(width);
}

// ============================================
// INTERFACES
// ============================================

export interface SaleItem {
  quantity: number;
  product_name: string;
  product_size?: string;
  unit_price: number;
  subtotal: number;
}

// Payment info for cash change tracking
export interface SalePaymentInfo {
  amount: number;
  payment_method: string;
  amount_received?: number;
  change_given?: number;
}

export interface SaleData {
  code: string;
  sale_date: string;
  client_name?: string;
  school_name?: string; // Solo si tiene productos de colegio especifico
  items: SaleItem[];
  subtotal: number;
  discount?: number;
  total: number;
  paid_amount: number;
  payment_method: string;
  payments?: SalePaymentInfo[]; // For cash change tracking
  notes?: string;
}

export interface OrderItem {
  name: string;
  size?: string;
  color?: string;
  custom_measurements?: string;
  embroidery_text?: string;
  quantity: number;
  subtotal: number;
}

export interface OrderData {
  code: string;
  order_date: string;
  status: string;
  client_name?: string;
  client_email?: string; // Para mostrar mensaje de activacion
  school_name?: string; // Solo si tiene productos de colegio especifico
  items: OrderItem[];
  subtotal: number;
  total: number;
  paid_amount: number;
  balance: number;
  delivery_type: "PICKUP" | "DELIVERY";
  delivery_date?: string;
  notes?: string;
}

// Alteration (Arreglo) data for receipt
export interface AlterationData {
  code: string;
  received_date: string;
  status: string;
  client_name: string;
  client_phone?: string;
  alteration_type: string;
  garment_name: string;
  description: string;
  cost: number;
  amount_paid: number;
  balance: number;
  is_paid: boolean;
  estimated_delivery_date?: string;
  notes?: string;
}

export interface PrinterConfig {
  businessName: string;
  businessPhone: string;
  businessAddress: string;
  returnPolicy: string;
  footerMessage: string;
  websiteUrl: string;
}

const DEFAULT_CONFIG: PrinterConfig = {
  businessName: "UNIFORMES CONSUELO RIOS",
  businessPhone: "WhatsApp: 300 123 4567",
  businessAddress: "Calle 56D #26 BE 04, Boston",
  returnPolicy: "Cambios: 8 dias con factura",
  footerMessage: "Gracias por su compra!",
  websiteUrl: "yourdomain.com",
};

// ============================================
// SALE RECEIPT
// ============================================

/**
 * Generate ESC/POS bytes for a sale receipt
 */
export function generateSaleReceipt(
  sale: SaleData,
  config: PrinterConfig = DEFAULT_CONFIG
): number[] {
  const bytes: number[] = [];
  const LINE_WIDTH = 48;

  // Initialize printer and set CP850 code page for Spanish accents (áéíóúñ)
  bytes.push(...COMMANDS.INIT);
  bytes.push(...COMMANDS.CODE_PAGE_CP850);

  // --- HEADER ---
  bytes.push(...COMMANDS.ALIGN_CENTER);
  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...COMMANDS.DOUBLE_WIDTH);
  bytes.push(...textToBytes(config.businessName + "\n"));
  bytes.push(...COMMANDS.NORMAL_SIZE);
  bytes.push(...COMMANDS.BOLD_OFF);

  bytes.push(...textToBytes(config.businessPhone + "\n"));
  bytes.push(...textToBytes(config.businessAddress + "\n"));

  bytes.push(...textToBytes(createSeparator("=", LINE_WIDTH) + "\n"));

  // --- TITLE ---
  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...textToBytes(centerText("COMPROBANTE DE VENTA", LINE_WIDTH) + "\n"));
  bytes.push(...COMMANDS.BOLD_OFF);

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  // --- SALE INFO ---
  bytes.push(...COMMANDS.ALIGN_LEFT);
  bytes.push(...textToBytes(createLine("Codigo:", sale.code, LINE_WIDTH) + "\n"));
  bytes.push(...textToBytes(createLine("Fecha:", formatDate(sale.sale_date), LINE_WIDTH) + "\n"));

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  if (sale.client_name) {
    bytes.push(...textToBytes(createLine("Cliente:", sale.client_name, LINE_WIDTH) + "\n"));
  }

  // Solo mostrar colegio si aplica
  if (sale.school_name) {
    bytes.push(...textToBytes(createLine("Colegio:", sale.school_name, LINE_WIDTH) + "\n"));
  }

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  // --- ITEMS HEADER ---
  bytes.push(...COMMANDS.BOLD_ON);
  const itemHeader = padString("Cant", 5) + padString("Descripcion", 28) + padString("Subtotal", 15, "right");
  bytes.push(...textToBytes(itemHeader + "\n"));
  bytes.push(...COMMANDS.BOLD_OFF);

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  // --- ITEMS ---
  for (const item of sale.items) {
    const qty = padString(item.quantity.toString(), 5);
    let desc = item.product_name;
    if (item.product_size) {
      desc += ` ${item.product_size}`;
    }
    const descPadded = padString(desc, 28);
    const subtotal = padString(formatCurrency(item.subtotal), 15, "right");
    bytes.push(...textToBytes(qty + descPadded + subtotal + "\n"));
  }

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  // --- TOTALS ---
  bytes.push(...textToBytes(createLine("SUBTOTAL:", formatCurrency(sale.subtotal), LINE_WIDTH) + "\n"));

  if (sale.discount && sale.discount > 0) {
    bytes.push(...textToBytes(createLine("DESCUENTO:", "-" + formatCurrency(sale.discount), LINE_WIDTH) + "\n"));
  }

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...COMMANDS.DOUBLE_HEIGHT);
  bytes.push(...textToBytes(createLine("TOTAL:", formatCurrency(sale.total), LINE_WIDTH) + "\n"));
  bytes.push(...COMMANDS.NORMAL_SIZE);
  bytes.push(...COMMANDS.BOLD_OFF);

  bytes.push(...textToBytes(createLine("Pagado:", formatCurrency(sale.paid_amount), LINE_WIDTH) + "\n"));

  const pendingAmount = sale.total - sale.paid_amount;
  if (pendingAmount > 0) {
    bytes.push(...textToBytes(createLine("Saldo:", formatCurrency(pendingAmount), LINE_WIDTH) + "\n"));
  }

  // Payment method translation
  const paymentMethodMap: Record<string, string> = {
    cash: "Efectivo",
    nequi: "Nequi",
    transfer: "Transferencia",
    card: "Tarjeta",
    credit: "Credito",
  };
  const methodText = paymentMethodMap[sale.payment_method] || sale.payment_method;
  bytes.push(...textToBytes(createLine("Metodo:", methodText, LINE_WIDTH) + "\n"));

  // Cash change info - Show amount received and change given
  if (sale.payments) {
    const cashPaymentsWithChange = sale.payments.filter(
      (p) => p.payment_method === "cash" && p.change_given && p.change_given > 0
    );
    if (cashPaymentsWithChange.length > 0) {
      bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));
      cashPaymentsWithChange.forEach((p) => {
        bytes.push(...textToBytes(createLine("Recibido:", formatCurrency(p.amount_received || 0), LINE_WIDTH) + "\n"));
        bytes.push(...COMMANDS.BOLD_ON);
        bytes.push(...textToBytes(createLine("DEVUELTAS:", formatCurrency(p.change_given || 0), LINE_WIDTH) + "\n"));
        bytes.push(...COMMANDS.BOLD_OFF);
      });
    }
  }

  // Notes
  if (sale.notes) {
    bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));
    bytes.push(...textToBytes("Notas: " + sale.notes + "\n"));
  }

  bytes.push(...textToBytes(createSeparator("=", LINE_WIDTH) + "\n"));

  // --- FOOTER ---
  bytes.push(...COMMANDS.ALIGN_CENTER);
  bytes.push(...textToBytes(config.footerMessage + "\n"));
  bytes.push(...textToBytes(config.returnPolicy + "\n"));

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  // Marketing message
  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...textToBytes(config.websiteUrl + "\n"));
  bytes.push(...COMMANDS.BOLD_OFF);
  bytes.push(...textToBytes("Catalogo por colegio\n"));
  bytes.push(...textToBytes("Seguimiento de pedidos en linea\n"));
  bytes.push(...textToBytes("Paga con Nequi o transferencia\n"));

  bytes.push(...textToBytes(createSeparator("=", LINE_WIDTH) + "\n"));

  // Feed and cut
  bytes.push(...COMMANDS.FEED_LINES(6));
  bytes.push(...COMMANDS.CUT_FULL);

  return bytes;
}

// ============================================
// ORDER RECEIPT
// ============================================

/**
 * Translate order status to Spanish
 */
function translateOrderStatus(status: string): string {
  const statusMap: Record<string, string> = {
    PENDING: "PENDIENTE",
    IN_PRODUCTION: "EN PRODUCCION",
    READY: "LISTO PARA ENTREGA",
    DELIVERED: "ENTREGADO",
    CANCELLED: "CANCELADO",
  };
  return statusMap[status] || status;
}

/**
 * Generate ESC/POS bytes for an order receipt
 */
export function generateOrderReceipt(
  order: OrderData,
  config: PrinterConfig = DEFAULT_CONFIG
): number[] {
  const bytes: number[] = [];
  const LINE_WIDTH = 48;

  // Initialize printer and set CP850 code page for Spanish accents (áéíóúñ)
  bytes.push(...COMMANDS.INIT);
  bytes.push(...COMMANDS.CODE_PAGE_CP850);

  // --- HEADER ---
  bytes.push(...COMMANDS.ALIGN_CENTER);
  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...COMMANDS.DOUBLE_WIDTH);
  bytes.push(...textToBytes(config.businessName + "\n"));
  bytes.push(...COMMANDS.NORMAL_SIZE);
  bytes.push(...COMMANDS.BOLD_OFF);

  bytes.push(...textToBytes(config.businessPhone + "\n"));
  bytes.push(...textToBytes(config.businessAddress + "\n"));

  bytes.push(...textToBytes(createSeparator("=", LINE_WIDTH) + "\n"));

  // --- TITLE ---
  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...textToBytes(centerText("COMPROBANTE DE PEDIDO", LINE_WIDTH) + "\n"));
  bytes.push(...COMMANDS.BOLD_OFF);

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  // --- ORDER INFO ---
  bytes.push(...COMMANDS.ALIGN_LEFT);
  bytes.push(...textToBytes(createLine("Codigo:", order.code, LINE_WIDTH) + "\n"));
  bytes.push(...textToBytes(createLine("Fecha:", formatDate(order.order_date), LINE_WIDTH) + "\n"));
  bytes.push(...textToBytes(createLine("Estado:", translateOrderStatus(order.status), LINE_WIDTH) + "\n"));

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  if (order.client_name) {
    bytes.push(...textToBytes(createLine("Cliente:", order.client_name, LINE_WIDTH) + "\n"));
  }

  // Solo mostrar colegio si aplica
  if (order.school_name) {
    bytes.push(...textToBytes(createLine("Colegio:", order.school_name, LINE_WIDTH) + "\n"));
  }

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  // --- ITEMS ---
  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...textToBytes("ARTICULOS:\n"));
  bytes.push(...COMMANDS.BOLD_OFF);
  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  let itemNumber = 1;
  for (const item of order.items) {
    bytes.push(...textToBytes(`${itemNumber}. ${item.name}\n`));

    // Details on separate lines
    const details: string[] = [];
    if (item.size) details.push(`Talla: ${item.size}`);
    if (item.color) details.push(`Color: ${item.color}`);

    if (details.length > 0) {
      bytes.push(...textToBytes("   " + details.join(" | ") + "\n"));
    }

    if (item.custom_measurements) {
      bytes.push(...textToBytes("   Medidas: " + item.custom_measurements + "\n"));
    }

    if (item.embroidery_text) {
      bytes.push(...textToBytes(`   Bordado: "${item.embroidery_text}"\n`));
    }

    bytes.push(...textToBytes(createLine(`   Qty: ${item.quantity}`, `Subtotal: ${formatCurrency(item.subtotal)}`, LINE_WIDTH) + "\n"));
    itemNumber++;
  }

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  // --- TOTALS ---
  bytes.push(...textToBytes(createLine("SUBTOTAL:", formatCurrency(order.subtotal), LINE_WIDTH) + "\n"));
  bytes.push(...textToBytes(createLine("TOTAL:", formatCurrency(order.total), LINE_WIDTH) + "\n"));

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  bytes.push(...textToBytes(createLine("Abono recibido:", formatCurrency(order.paid_amount), LINE_WIDTH) + "\n"));

  if (order.balance > 0) {
    bytes.push(...COMMANDS.BOLD_ON);
    bytes.push(...textToBytes(createLine("SALDO PENDIENTE:", formatCurrency(order.balance), LINE_WIDTH) + "\n"));
    bytes.push(...COMMANDS.BOLD_OFF);
  }

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  // --- DELIVERY INFO ---
  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...textToBytes("ENTREGA:\n"));
  bytes.push(...COMMANDS.BOLD_OFF);

  // Compare case-insensitively to handle both "pickup"/"PICKUP" formats
  const deliveryTypeText = order.delivery_type?.toUpperCase() === "PICKUP" ? "Recoger en tienda" : "Domicilio";
  bytes.push(...textToBytes(createLine("Tipo:", deliveryTypeText, LINE_WIDTH) + "\n"));

  if (order.delivery_date) {
    bytes.push(...textToBytes(createLine("Fecha estimada:", formatDateOnly(order.delivery_date), LINE_WIDTH) + "\n"));
  }

  // Notes
  if (order.notes) {
    bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));
    bytes.push(...textToBytes("Notas: " + order.notes + "\n"));
  }

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  // --- FOOTER ---
  bytes.push(...COMMANDS.ALIGN_CENTER);
  bytes.push(...textToBytes("Gracias por su pedido!\n"));
  bytes.push(...textToBytes(config.returnPolicy + "\n"));

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  // Website and tracking message - improved marketing
  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...textToBytes("CONSULTA TU PEDIDO EN:\n"));
  bytes.push(...textToBytes(config.websiteUrl + "\n"));
  bytes.push(...COMMANDS.BOLD_OFF);
  bytes.push(...textToBytes("\n"));
  bytes.push(...textToBytes("Te notificaremos por WhatsApp\n"));
  bytes.push(...textToBytes("cuando tu pedido este listo.\n"));

  // Solo mostrar mensaje de activacion si el cliente tiene email
  if (order.client_email) {
    bytes.push(...textToBytes("\n"));
    bytes.push(...textToBytes("Tambien puedes activar tu cuenta\n"));
    bytes.push(...textToBytes("en la web con tu correo para\n"));
    bytes.push(...textToBytes("ver el estado en tiempo real.\n"));
  }

  bytes.push(...textToBytes(createSeparator("=", LINE_WIDTH) + "\n"));

  // Feed and cut
  bytes.push(...COMMANDS.FEED_LINES(6));
  bytes.push(...COMMANDS.CUT_FULL);

  return bytes;
}

// ============================================
// ALTERATION (ARREGLO) RECEIPT
// ============================================

// Map alteration type to Spanish labels
const ALTERATION_TYPE_MAP: Record<string, string> = {
  hem: "Dobladillo",
  length: "Largo",
  width: "Ancho",
  seam: "Costura",
  buttons: "Botones",
  zipper: "Cremallera",
  patch: "Parche",
  darts: "Pinzas",
  other: "Otro",
};

// Map alteration status to Spanish labels
const ALTERATION_STATUS_MAP: Record<string, string> = {
  pending: "PENDIENTE",
  in_progress: "EN PROCESO",
  ready: "LISTO PARA RECOGER",
  delivered: "ENTREGADO",
  cancelled: "CANCELADO",
};

/**
 * Generate ESC/POS receipt for an alteration (arreglo)
 */
export function generateAlterationReceipt(
  alteration: AlterationData,
  config: PrinterConfig = DEFAULT_CONFIG
): number[] {
  const bytes: number[] = [];
  const LINE_WIDTH = 48;

  // Initialize printer with CP850 code page for Spanish
  bytes.push(...COMMANDS.INIT);
  bytes.push(...COMMANDS.CODE_PAGE_CP850);

  // --- HEADER ---
  bytes.push(...COMMANDS.ALIGN_CENTER);
  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...COMMANDS.DOUBLE_HEIGHT);
  bytes.push(...textToBytes(config.businessName + "\n"));
  bytes.push(...COMMANDS.NORMAL_SIZE);
  bytes.push(...textToBytes(config.businessPhone + "\n"));
  bytes.push(...textToBytes(config.businessAddress + "\n"));
  bytes.push(...COMMANDS.BOLD_OFF);
  bytes.push(...textToBytes(createSeparator("=", LINE_WIDTH) + "\n"));

  // --- TITLE ---
  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...COMMANDS.DOUBLE_HEIGHT);
  bytes.push(...textToBytes("RECIBO\n"));
  bytes.push(...COMMANDS.NORMAL_SIZE);
  bytes.push(...COMMANDS.BOLD_OFF);
  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  // --- ORDER INFO ---
  bytes.push(...COMMANDS.ALIGN_LEFT);
  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...textToBytes("Codigo: "));
  bytes.push(...COMMANDS.BOLD_OFF);
  bytes.push(...textToBytes(alteration.code + "\n"));

  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...textToBytes("Fecha recibido: "));
  bytes.push(...COMMANDS.BOLD_OFF);
  bytes.push(...textToBytes(formatDate(alteration.received_date) + "\n"));

  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...textToBytes("Estado: "));
  bytes.push(...COMMANDS.BOLD_OFF);
  const statusLabel = ALTERATION_STATUS_MAP[alteration.status.toLowerCase()] || alteration.status;
  bytes.push(...textToBytes(statusLabel + "\n"));

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  // --- CLIENT INFO ---
  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...textToBytes("CLIENTE:\n"));
  bytes.push(...COMMANDS.BOLD_OFF);
  bytes.push(...textToBytes(createLine("Nombre:", alteration.client_name, LINE_WIDTH) + "\n"));

  if (alteration.client_phone) {
    bytes.push(...textToBytes(createLine("Telefono:", alteration.client_phone, LINE_WIDTH) + "\n"));
  }

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  // --- GARMENT INFO ---
  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...textToBytes("DETALLE DEL ARREGLO:\n"));
  bytes.push(...COMMANDS.BOLD_OFF);

  const typeLabel = ALTERATION_TYPE_MAP[alteration.alteration_type.toLowerCase()] || alteration.alteration_type;
  bytes.push(...textToBytes(createLine("Tipo:", typeLabel, LINE_WIDTH) + "\n"));
  bytes.push(...textToBytes(createLine("Prenda:", alteration.garment_name, LINE_WIDTH) + "\n"));

  // Description (may be multiline)
  if (alteration.description) {
    bytes.push(...textToBytes("\nDescripcion:\n"));
    // Split description into lines that fit
    const descLines = wrapText(alteration.description, LINE_WIDTH - 2);
    for (const line of descLines) {
      bytes.push(...textToBytes("  " + line + "\n"));
    }
  }

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  // --- PRICING ---
  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...textToBytes("RESUMEN:\n"));
  bytes.push(...COMMANDS.BOLD_OFF);

  bytes.push(...textToBytes(createLine("Costo:", formatCurrency(alteration.cost), LINE_WIDTH) + "\n"));
  bytes.push(...textToBytes(createLine("Pagado:", formatCurrency(alteration.amount_paid), LINE_WIDTH) + "\n"));

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  // Balance - highlight if pending
  bytes.push(...COMMANDS.BOLD_ON);
  if (alteration.is_paid) {
    bytes.push(...textToBytes(createLine("SALDO:", "PAGADO", LINE_WIDTH) + "\n"));
  } else {
    bytes.push(...COMMANDS.DOUBLE_HEIGHT);
    bytes.push(...textToBytes(createLine("SALDO PENDIENTE:", formatCurrency(alteration.balance), LINE_WIDTH) + "\n"));
    bytes.push(...COMMANDS.NORMAL_SIZE);
  }
  bytes.push(...COMMANDS.BOLD_OFF);

  bytes.push(...textToBytes(createSeparator("-", LINE_WIDTH) + "\n"));

  // --- DELIVERY INFO ---
  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...textToBytes("ENTREGA:\n"));
  bytes.push(...COMMANDS.BOLD_OFF);

  if (alteration.estimated_delivery_date) {
    bytes.push(...textToBytes(createLine("Fecha estimada:", formatDateOnly(alteration.estimated_delivery_date), LINE_WIDTH) + "\n"));
  } else {
    bytes.push(...textToBytes("Fecha estimada: Por confirmar\n"));
  }

  // Notes
  if (alteration.notes) {
    bytes.push(...textToBytes("\nNotas:\n"));
    const noteLines = wrapText(alteration.notes, LINE_WIDTH - 2);
    for (const line of noteLines) {
      bytes.push(...textToBytes("  " + line + "\n"));
    }
  }

  bytes.push(...textToBytes(createSeparator("=", LINE_WIDTH) + "\n"));

  // --- FOOTER ---
  bytes.push(...COMMANDS.ALIGN_CENTER);
  bytes.push(...textToBytes("Gracias por su confianza!\n"));
  bytes.push(...textToBytes("\n"));
  bytes.push(...textToBytes("Le notificaremos por WhatsApp\n"));
  bytes.push(...textToBytes("cuando su arreglo este listo.\n"));
  bytes.push(...textToBytes("\n"));
  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...textToBytes(config.websiteUrl + "\n"));
  bytes.push(...COMMANDS.BOLD_OFF);
  bytes.push(...textToBytes(createSeparator("=", LINE_WIDTH) + "\n"));

  // Feed and cut
  bytes.push(...COMMANDS.FEED_LINES(6));
  bytes.push(...COMMANDS.CUT_FULL);

  return bytes;
}

/**
 * Wrap text to fit within specified width
 */
function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate a simple test receipt
 */
export function generateTestReceipt(portName: string): number[] {
  const bytes: number[] = [];

  bytes.push(...COMMANDS.INIT);
  bytes.push(...COMMANDS.CODE_PAGE_CP850);
  bytes.push(...COMMANDS.ALIGN_CENTER);
  bytes.push(...COMMANDS.BOLD_ON);
  bytes.push(...textToBytes("=== PRUEBA DE IMPRESORA ===\n"));
  bytes.push(...COMMANDS.BOLD_OFF);
  bytes.push(...COMMANDS.ALIGN_LEFT);
  bytes.push(...textToBytes("\n"));
  bytes.push(...textToBytes("Impresora configurada correctamente\n"));
  bytes.push(...textToBytes("--------------------------------\n"));
  bytes.push(...textToBytes("Impresora: " + portName + "\n"));
  bytes.push(...textToBytes("Fecha: " + formatDate(new Date()) + "\n"));
  bytes.push(...textToBytes("--------------------------------\n"));
  bytes.push(...COMMANDS.ALIGN_CENTER);
  bytes.push(...textToBytes("\nUNIFORMES CONSUELO RIOS\n"));
  bytes.push(...textToBytes("WhatsApp: 300 123 4567\n"));
  bytes.push(...textToBytes("yourdomain.com\n\n"));
  bytes.push(...COMMANDS.FEED_LINES(6));
  bytes.push(...COMMANDS.CUT_FULL);

  return bytes;
}

/**
 * Generate command to open cash drawer
 */
export function generateOpenDrawerCommand(): number[] {
  return [...COMMANDS.OPEN_DRAWER];
}
