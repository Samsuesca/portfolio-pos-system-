/**
 * Email Log Service - API calls for email audit trail
 *
 * Global endpoints - no school_id required.
 * Provides access to email logs and statistics for monitoring.
 */
import apiClient from '../utils/api-client';

const BASE_URL = '/global/email-logs';

// ============================================
// Types
// ============================================

export type EmailType =
  | 'verification'
  | 'welcome'
  | 'password_reset'
  | 'order_confirmation'
  | 'sale_confirmation'
  | 'activation'
  | 'order_ready'
  | 'welcome_activation'
  | 'email_change'
  | 'drawer_access';

export type EmailStatus = 'success' | 'failed' | 'dev_skipped';

export interface EmailLog {
  id: string;
  email_type: EmailType;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  status: EmailStatus;
  error_message: string | null;
  reference_code: string | null;
  client_id: string | null;
  order_id: string | null;
  sale_id: string | null;
  user_id: string | null;
  triggered_by: string | null;
  sent_at: string;
  // Enriched fields
  client_name: string | null;
  triggered_by_name: string | null;
  email_type_label: string;
}

export interface EmailLogListResponse {
  items: EmailLog[];
  total: number;
  skip: number;
  limit: number;
}

export interface EmailLogFilters {
  start_date?: string;
  end_date?: string;
  email_type?: EmailType;
  status?: EmailStatus;
  recipient_email?: string;
  skip?: number;
  limit?: number;
}

export interface EmailTypeSummary {
  email_type: EmailType;
  email_type_label: string;
  total: number;
  success: number;
  failed: number;
  success_rate: number;
}

export interface EmailDaySummary {
  date: string;
  total: number;
  success: number;
  failed: number;
  success_rate: number;
}

export interface EmailStatsResponse {
  period_start: string;
  period_end: string;
  total_sent: number;
  total_success: number;
  total_failed: number;
  total_dev_skipped: number;
  overall_success_rate: number;
  by_type: EmailTypeSummary[];
  by_day: EmailDaySummary[];
  avg_per_day: number;
}

export interface QueueStatus {
  pending_logs: number;
}

export interface ProcessQueueResult {
  message: string;
  processed: number;
  remaining?: number;
}

// ============================================
// Labels and Colors
// ============================================

export const EMAIL_TYPE_LABELS: Record<EmailType, string> = {
  verification: 'Codigo de Verificacion',
  welcome: 'Bienvenida',
  password_reset: 'Recuperar Contrasena',
  order_confirmation: 'Confirmacion de Encargo',
  sale_confirmation: 'Confirmacion de Venta',
  activation: 'Activacion de Cuenta',
  order_ready: 'Pedido Listo',
  welcome_activation: 'Bienvenida + Activacion',
  email_change: 'Cambio de Email',
  drawer_access: 'Codigo de Cajon',
};

export const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = {
  success: 'Exitoso',
  failed: 'Fallido',
  dev_skipped: 'Omitido (Dev)',
};

export const EMAIL_STATUS_COLORS: Record<EmailStatus, { text: string; bg: string; border: string }> = {
  success: { text: 'text-green-700', bg: 'bg-green-100', border: 'border-green-200' },
  failed: { text: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200' },
  dev_skipped: { text: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-200' },
};

export const EMAIL_TYPE_COLORS: Record<EmailType, { text: string; bg: string }> = {
  verification: { text: 'text-blue-700', bg: 'bg-blue-100' },
  welcome: { text: 'text-purple-700', bg: 'bg-purple-100' },
  password_reset: { text: 'text-orange-700', bg: 'bg-orange-100' },
  order_confirmation: { text: 'text-indigo-700', bg: 'bg-indigo-100' },
  sale_confirmation: { text: 'text-green-700', bg: 'bg-green-100' },
  activation: { text: 'text-teal-700', bg: 'bg-teal-100' },
  order_ready: { text: 'text-emerald-700', bg: 'bg-emerald-100' },
  welcome_activation: { text: 'text-violet-700', bg: 'bg-violet-100' },
  email_change: { text: 'text-amber-700', bg: 'bg-amber-100' },
  drawer_access: { text: 'text-rose-700', bg: 'bg-rose-100' },
};

// ============================================
// API Functions
// ============================================

export const getEmailLogs = async (
  filters?: EmailLogFilters
): Promise<EmailLogListResponse> => {
  const params: Record<string, string | number | undefined> = {};

  if (filters?.start_date) params.start_date = filters.start_date;
  if (filters?.end_date) params.end_date = filters.end_date;
  if (filters?.email_type) params.email_type = filters.email_type;
  if (filters?.status) params.status = filters.status;
  if (filters?.recipient_email) params.recipient_email = filters.recipient_email;
  params.skip = filters?.skip || 0;
  params.limit = filters?.limit || 100;

  const response = await apiClient.get<EmailLogListResponse>(BASE_URL, { params });
  return response.data;
};

export const getEmailStatistics = async (
  startDate?: string,
  endDate?: string
): Promise<EmailStatsResponse> => {
  const params: Record<string, string | undefined> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const response = await apiClient.get<EmailStatsResponse>(
    `${BASE_URL}/statistics`,
    { params }
  );
  return response.data;
};

export const getRecentFailures = async (
  limit: number = 10
): Promise<EmailLog[]> => {
  const response = await apiClient.get<EmailLog[]>(`${BASE_URL}/failures`, {
    params: { limit },
  });
  return response.data;
};

export const getQueueStatus = async (): Promise<QueueStatus> => {
  const response = await apiClient.get<QueueStatus>(`${BASE_URL}/queue-status`);
  return response.data;
};

export const processQueue = async (): Promise<ProcessQueueResult> => {
  const response = await apiClient.post<ProcessQueueResult>(`${BASE_URL}/process-queue`);
  return response.data;
};

// ============================================
// Export as object
// ============================================

export const emailLogService = {
  getEmailLogs,
  getEmailStatistics,
  getRecentFailures,
  getQueueStatus,
  processQueue,
};

export default emailLogService;
