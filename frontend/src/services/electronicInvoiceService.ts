/**
 * Electronic Invoice Service - Facturacion Electronica DIAN (Alegra)
 *
 * Global module (cross-school). Emits invoices on-demand for sales, orders
 * and alterations, annuls them via credit note, and looks up status.
 */
import apiClient from '../utils/api-client';
import type {
  ElectronicInvoice,
  InvoiceDocumentType,
  ElectronicInvoiceStatus,
  PaginatedResponse,
} from '../types/api';

const BASE = '/global/electronic-invoicing';

export const electronicInvoiceService = {
  /** Emit an electronic invoice for a document (idempotent server-side). */
  async emit(documentType: InvoiceDocumentType, documentId: string): Promise<ElectronicInvoice> {
    const response = await apiClient.post<ElectronicInvoice>(`${BASE}/emit`, {
      document_type: documentType,
      document_id: documentId,
    });
    return response.data;
  },

  /** Annul an emitted invoice via DIAN credit note. */
  async void(invoiceId: string, reason: string): Promise<ElectronicInvoice> {
    const response = await apiClient.post<ElectronicInvoice>(`${BASE}/${invoiceId}/void`, {
      reason,
    });
    return response.data;
  },

  /** Re-fetch PDF/XML URLs from Alegra (they can lag emission). */
  async refreshFiles(invoiceId: string): Promise<ElectronicInvoice> {
    const response = await apiClient.post<ElectronicInvoice>(`${BASE}/${invoiceId}/refresh-files`);
    return response.data;
  },

  /** Invoice linked to a document, or null if none has been emitted. */
  async getByDocument(
    documentType: InvoiceDocumentType,
    documentId: string,
  ): Promise<ElectronicInvoice | null> {
    const response = await apiClient.get<ElectronicInvoice | null>(
      `${BASE}/by-document/${documentType}/${documentId}`,
    );
    return response.data;
  },

  async getById(invoiceId: string): Promise<ElectronicInvoice> {
    const response = await apiClient.get<ElectronicInvoice>(`${BASE}/${invoiceId}`);
    return response.data;
  },

  async list(params?: {
    status?: ElectronicInvoiceStatus;
    document_type?: InvoiceDocumentType;
    skip?: number;
    limit?: number;
  }): Promise<PaginatedResponse<ElectronicInvoice>> {
    const response = await apiClient.get<PaginatedResponse<ElectronicInvoice>>(BASE, { params });
    return response.data;
  },
};

export default electronicInvoiceService;
