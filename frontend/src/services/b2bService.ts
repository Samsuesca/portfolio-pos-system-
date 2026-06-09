/**
 * B2B Service - API calls for B2B Quotations (Cotizaciones empresariales)
 *
 * GLOBAL resource (no school_id). Endpoints under /b2b/quotations.
 * Mirrors orderService.ts: uses apiClient (auto-auth via JWT).
 *
 * Quotation workflow (FSM, server-validated):
 *   draft -> sent -> negotiation -> accepted -> (convert to contract)
 *   any non-terminal -> rejected | expired
 */
import apiClient from '../utils/api-client';
import type {
  PaginatedResponse,
  QuotationStatus,
  QuotationListResponse,
  QuotationResponse,
  QuotationCreate,
  QuotationUpdate,
  QuotationItemCreate,
  ContractStatus,
  ContractResponse,
  ContractListResponse,
  DepositRegisterPayload,
  DeliveryRegisterPayload,
  MilestoneDeliveryRegisterPayload,
  BalancePaymentRegisterPayload,
  ContractCancelPayload,
  B2BClientResponse,
  B2BClientCreate,
  B2BClientUpdate,
} from '../types/api';

export interface B2BClientFilters {
  active_only?: boolean;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface QuotationFilters {
  status?: QuotationStatus;
  b2b_client_id?: string;
  branch_id?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface ContractFilters {
  status?: ContractStatus;
  b2b_client_id?: string;
  branch_id?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

export const b2bService = {
  /**
   * List quotations (GLOBAL) with filters + pagination.
   * `total` from this response is the authoritative count (backend func.count),
   * NOT items.length — safe to use for per-status stats.
   */
  async getAllQuotations(
    filters?: QuotationFilters
  ): Promise<PaginatedResponse<QuotationListResponse>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.b2b_client_id) params.append('b2b_client_id', filters.b2b_client_id);
    if (filters?.branch_id) params.append('branch_id', filters.branch_id);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.skip !== undefined) params.append('skip', String(filters.skip));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));

    const queryString = params.toString();
    const url = queryString ? `/b2b/quotations?${queryString}` : '/b2b/quotations';
    const response = await apiClient.get<PaginatedResponse<QuotationListResponse>>(url);
    return response.data;
  },

  /**
   * Count quotations matching a filter without loading the rows.
   * Uses limit=1 and reads `total` (Stats Pattern: never count over a page).
   */
  async countQuotations(filters?: QuotationFilters): Promise<number> {
    const response = await this.getAllQuotations({ ...filters, skip: 0, limit: 1 });
    return response.total;
  },

  async getQuotationById(id: string): Promise<QuotationResponse> {
    const response = await apiClient.get<QuotationResponse>(`/b2b/quotations/${id}`);
    return response.data;
  },

  async createQuotation(data: QuotationCreate): Promise<QuotationResponse> {
    const response = await apiClient.post<QuotationResponse>('/b2b/quotations', data);
    return response.data;
  },

  async updateQuotation(id: string, data: QuotationUpdate): Promise<QuotationResponse> {
    const response = await apiClient.put<QuotationResponse>(`/b2b/quotations/${id}`, data);
    return response.data;
  },

  async replaceItems(id: string, items: QuotationItemCreate[]): Promise<QuotationResponse> {
    const response = await apiClient.put<QuotationResponse>(`/b2b/quotations/${id}/items`, items);
    return response.data;
  },

  /** PATCH /status — backend validates the FSM transition (400 if invalid). */
  async updateQuotationStatus(id: string, status: QuotationStatus): Promise<QuotationResponse> {
    const response = await apiClient.patch<QuotationResponse>(
      `/b2b/quotations/${id}/status`,
      { status }
    );
    return response.data;
  },

  /**
   * POST /convert — only valid when status === 'accepted'.
   * Returns the created Contract (pending_deposit). 409 if already converted
   * or not accepted.
   */
  async convertToContract(id: string): Promise<ContractResponse> {
    const response = await apiClient.post<ContractResponse>(`/b2b/quotations/${id}/convert`);
    return response.data;
  },

  /**
   * Fetch the self-contained commercial HTML document for a quotation and
   * return an object URL the caller can open in a new window (then Ctrl+P).
   *
   * The /document endpoint requires auth (b2b.view), so we cannot just point a
   * browser at the URL — we fetch it through apiClient (which attaches the JWT)
   * and wrap the returned HTML in a Blob URL.
   *
   * Caller is responsible for revoking the URL (URL.revokeObjectURL) once done.
   */
  async getQuotationDocumentUrl(id: string): Promise<string> {
    const response = await apiClient.get<string>(`/b2b/quotations/${id}/document`);
    const html = typeof response.data === 'string' ? response.data : String(response.data);
    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  },

  /**
   * Open the quotation document in a new window for printing/saving as PDF.
   * Revokes the temporary object URL after the window has had time to load it.
   */
  async openQuotationDocument(id: string): Promise<void> {
    const url = await this.getQuotationDocumentUrl(id);
    const win = window.open(url, '_blank');
    // Give the new window time to parse the blob before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    if (!win) {
      // Popup blocked: revoke immediately to avoid leaking the object URL.
      URL.revokeObjectURL(url);
      throw new Error('No se pudo abrir el documento. Permite las ventanas emergentes e intenta de nuevo.');
    }
  },

  // ===========================================================================
  // Contracts (Fase B3 — ciclo de vida contable: anticipo, entrega, cobro,
  // cancelación). Endpoints bajo /b2b/contracts. La contabilidad es GLOBAL.
  // FSM (server-validated):
  //   pending_deposit -> in_production -> (partial_delivery) -> delivered -> closed
  //   pending_deposit | in_production -> cancelled
  // ===========================================================================

  /**
   * List contracts (GLOBAL) with filters + pagination.
   * `total` is the authoritative count (backend func.count), safe for stats.
   */
  async getAllContracts(
    filters?: ContractFilters
  ): Promise<PaginatedResponse<ContractListResponse>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.b2b_client_id) params.append('b2b_client_id', filters.b2b_client_id);
    if (filters?.branch_id) params.append('branch_id', filters.branch_id);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.skip !== undefined) params.append('skip', String(filters.skip));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));

    const queryString = params.toString();
    const url = queryString ? `/b2b/contracts?${queryString}` : '/b2b/contracts';
    const response = await apiClient.get<PaginatedResponse<ContractListResponse>>(url);
    return response.data;
  },

  /**
   * Count contracts matching a filter without loading the rows.
   * Uses limit=1 and reads `total` (Stats Pattern: never count over a page).
   */
  async countContracts(filters?: ContractFilters): Promise<number> {
    const response = await this.getAllContracts({ ...filters, skip: 0, limit: 1 });
    return response.total;
  },

  async getContractById(id: string): Promise<ContractResponse> {
    const response = await apiClient.get<ContractResponse>(`/b2b/contracts/${id}`);
    return response.data;
  },

  /**
   * Register the deposit (pending_deposit -> in_production).
   * The deposit is recognized as a liability (account 2110), NOT income.
   * 409 if the contract is not in pending_deposit.
   */
  async recordDeposit(id: string, body: DepositRegisterPayload): Promise<ContractResponse> {
    const response = await apiClient.post<ContractResponse>(
      `/b2b/contracts/${id}/deposit`,
      body
    );
    return response.data;
  },

  /**
   * Register the full delivery (in_production/partial_delivery -> delivered).
   * Recognizes income for the total, reverses the deposit liability, optional
   * COGS, and generates the balance receivable when the client is on credit.
   */
  async recordDelivery(id: string, body: DeliveryRegisterPayload): Promise<ContractResponse> {
    const response = await apiClient.post<ContractResponse>(
      `/b2b/contracts/${id}/deliver`,
      body
    );
    return response.data;
  },

  /**
   * Register the delivery of a single milestone (prorated deposit application).
   * Moves the contract to partial_delivery (or delivered on the last milestone).
   */
  async deliverMilestone(
    id: string,
    milestoneId: string,
    body: MilestoneDeliveryRegisterPayload
  ): Promise<ContractResponse> {
    const response = await apiClient.post<ContractResponse>(
      `/b2b/contracts/${id}/milestones/${milestoneId}/deliver`,
      body
    );
    return response.data;
  },

  /**
   * Collect the balance receivable (CxC) of a delivered-on-credit contract.
   * Moves AR -> cash without re-recognizing income. Closes the contract when
   * no open receivables remain.
   */
  async payBalance(id: string, body: BalancePaymentRegisterPayload): Promise<ContractResponse> {
    const response = await apiClient.post<ContractResponse>(
      `/b2b/contracts/${id}/pay-balance`,
      body
    );
    return response.data;
  },

  /**
   * Cancel a contract (requires b2b.void_contracts). `retain_deposit` defines
   * the deposit policy: refund (false) reverses both legs, retain (true)
   * realizes the deposit as penalty income. Delivered contracts cannot be
   * cancelled (409) — use a return/credit-note flow.
   */
  async cancelContract(id: string, body: ContractCancelPayload): Promise<ContractResponse> {
    const response = await apiClient.post<ContractResponse>(
      `/b2b/contracts/${id}/cancel`,
      body
    );
    return response.data;
  },

  // ---------------------------------------------------------------------------
  // Clientes B2B (GLOBAL). Leer requiere b2b.view; crear/editar b2b.manage_clients.
  // ---------------------------------------------------------------------------

  async getAllClients(
    filters?: B2BClientFilters
  ): Promise<PaginatedResponse<B2BClientResponse>> {
    const params = new URLSearchParams();
    if (filters?.active_only !== undefined) params.append('active_only', String(filters.active_only));
    if (filters?.search) params.append('search', filters.search);
    if (filters?.skip !== undefined) params.append('skip', String(filters.skip));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
    const queryString = params.toString();
    const url = queryString ? `/b2b/clients?${queryString}` : '/b2b/clients';
    const response = await apiClient.get<PaginatedResponse<B2BClientResponse>>(url);
    return response.data;
  },

  async getClientById(id: string): Promise<B2BClientResponse> {
    const response = await apiClient.get<B2BClientResponse>(`/b2b/clients/${id}`);
    return response.data;
  },

  async createClient(data: B2BClientCreate): Promise<B2BClientResponse> {
    const response = await apiClient.post<B2BClientResponse>('/b2b/clients', data);
    return response.data;
  },

  async updateClient(id: string, data: B2BClientUpdate): Promise<B2BClientResponse> {
    const response = await apiClient.patch<B2BClientResponse>(`/b2b/clients/${id}`, data);
    return response.data;
  },
};

export default b2bService;
