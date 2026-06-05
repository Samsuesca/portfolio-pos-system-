export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value;
  return num.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHrs < 24) return `Hace ${diffHrs}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;

  return formatDate(dateStr);
}

export function formatPaymentMethod(method: string | null): string {
  const map: Record<string, string> = {
    CASH: 'Efectivo',
    TRANSFER: 'Transferencia',
    CREDIT: 'Credito',
    NEQUI: 'Nequi',
    cash: 'Efectivo',
    nequi: 'Nequi',
    transfer: 'Transferencia',
    card: 'Tarjeta',
    credit: 'Credito',
  };
  return method ? map[method] || method : 'Sin pago';
}

export function formatOrderStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pendiente',
    in_production: 'En produccion',
    ready: 'Listo',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  };
  return map[status] || status;
}

export function formatSaleStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pendiente',
    completed: 'Completada',
    cancelled: 'Cancelada',
  };
  return map[status] || status;
}

export function formatChangeType(type: string): string {
  const map: Record<string, string> = {
    size_change: 'Cambio de talla',
    product_change: 'Cambio de producto',
    return: 'Devolucion',
    defect: 'Defecto',
  };
  return map[type] || type;
}

export function formatChangeStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pendiente',
    pending_stock: 'Sin stock',
    approved: 'Aprobado',
    rejected: 'Rechazado',
  };
  return map[status] || status;
}
