/**
 * Print Queue Service
 *
 * Handles communication with the print queue API for
 * synchronizing cash sales across devices.
 */
import apiClient from '../utils/api-client';

export type PrintQueueStatus = 'pending' | 'printed' | 'skipped' | 'failed';

export interface PrintQueueItem {
  id: string;
  sale_id: string;
  school_id: string;
  sale_code: string;
  sale_total: number;
  client_name: string | null;
  school_name: string | null;
  source_device: string | null;
  status: PrintQueueStatus;
  print_receipt: boolean;
  open_drawer: boolean;
  created_at: string;
  processed_at: string | null;
  error_message: string | null;
  retry_count: number;
}

export interface PrintQueueStats {
  pending_count: number;
  printed_today: number;
  skipped_today: number;
  failed_today: number;
}

export interface ConnectionInfo {
  total_connections: number;
  unique_users: number;
}

/**
 * Get pending items in the queue
 */
export async function getPendingItems(limit = 50): Promise<PrintQueueItem[]> {
  const response = await apiClient.get<PrintQueueItem[]>(
    `/global/print-queue/pending`,
    { params: { limit } }
  );
  return response.data;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<PrintQueueStats> {
  const response = await apiClient.get<PrintQueueStats>('/global/print-queue/stats');
  return response.data;
}

/**
 * Mark an item as printed
 */
export async function markAsPrinted(itemId: string): Promise<PrintQueueItem> {
  const response = await apiClient.patch<PrintQueueItem>(
    `/global/print-queue/${itemId}/printed`
  );
  return response.data;
}

/**
 * Mark an item as skipped
 */
export async function markAsSkipped(itemId: string): Promise<PrintQueueItem> {
  const response = await apiClient.patch<PrintQueueItem>(
    `/global/print-queue/${itemId}/skipped`
  );
  return response.data;
}

/**
 * Mark an item as failed
 */
export async function markAsFailed(
  itemId: string,
  errorMessage: string
): Promise<PrintQueueItem> {
  const response = await apiClient.patch<PrintQueueItem>(
    `/global/print-queue/${itemId}/failed`,
    null,
    { params: { error_message: errorMessage } }
  );
  return response.data;
}

/**
 * Retry a failed item
 */
export async function retryFailed(itemId: string): Promise<PrintQueueItem> {
  const response = await apiClient.patch<PrintQueueItem>(
    `/global/print-queue/${itemId}/retry`
  );
  return response.data;
}

/**
 * Clean up old processed items
 */
export async function cleanupOldItems(days = 7): Promise<{ deleted_count: number }> {
  const response = await apiClient.delete<{ deleted_count: number; days: number }>(
    `/global/print-queue/cleanup`,
    { params: { days } }
  );
  return response.data;
}

/**
 * Get SSE connection info
 */
export async function getConnectionInfo(): Promise<ConnectionInfo> {
  const response = await apiClient.get<ConnectionInfo>('/global/print-queue/connection-info');
  return response.data;
}

export const printQueueService = {
  getPendingItems,
  getQueueStats,
  markAsPrinted,
  markAsSkipped,
  markAsFailed,
  retryFailed,
  cleanupOldItems,
  getConnectionInfo,
};

export default printQueueService;
