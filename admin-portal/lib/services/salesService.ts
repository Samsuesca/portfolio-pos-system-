import apiClient, {
  Sale,
  SaleWithItems,
  SaleItem,
  SalePayment,
  SaleChange,
  SaleChangeListItem,
  SaleChangeDetailResponse,
  PaymentMethod,
  ChangeType,
  ChangeStatus,
} from '../api';

export interface SaleListParams {
  school_id?: string;
  status?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface CreateSaleItemData {
  product_id: string;
  quantity: number;
  is_global?: boolean;
}

export type SaleSource = 'desktop_app' | 'web_portal' | 'api' | 'admin_portal';

export interface CreateSaleData {
  client_id?: string;
  items: CreateSaleItemData[];
  payment_method?: PaymentMethod;
  payments?: { amount: number; payment_method: PaymentMethod }[];
  notes?: string;
  is_historical?: boolean;
  sale_date?: string;
  source?: SaleSource;
}

export interface AddPaymentData {
  amount: number;
  payment_method: PaymentMethod;
  reference?: string;
  create_accounting_entry?: boolean;
}

export interface CreateChangeData {
  change_type: ChangeType;
  original_item_id: string;
  new_product_id?: string;
  quantity: number;
  reason?: string;
}

export interface ApproveChangeData {
  payment_method?: PaymentMethod;
  notes?: string;
}

export interface RejectChangeData {
  reason?: string;
}

export interface SaleChangeFilters {
  status?: ChangeStatus;
  change_type?: ChangeType;
  limit?: number;
}

const salesService = {
  // Get all sale changes from all schools (global endpoint)
  getAllChanges: async (filters?: SaleChangeFilters): Promise<SaleChangeListItem[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.change_type) params.append('change_type', filters.change_type);
    if (filters?.limit) params.append('limit', String(filters.limit));

    const queryString = params.toString();
    const url = queryString ? `/sale-changes?${queryString}` : '/sale-changes';
    const response = await apiClient.get<SaleChangeListItem[]>(url);
    return response.data;
  },

  // List sales (multi-school)
  list: async (params?: SaleListParams): Promise<Sale[]> => {
    const response = await apiClient.get<Sale[]>('/sales', { params });
    return response.data;
  },

  // Get sale by ID
  getById: async (id: string): Promise<Sale> => {
    const response = await apiClient.get<Sale>(`/sales/${id}`);
    return response.data;
  },

  // Get sale with items and product details
  getWithItems: async (schoolId: string, saleId: string): Promise<SaleWithItems> => {
    const response = await apiClient.get<SaleWithItems>(
      `/schools/${schoolId}/sales/${saleId}/items`
    );
    return response.data;
  },

  // Get changes for a sale
  getChanges: async (schoolId: string, saleId: string): Promise<SaleChange[]> => {
    const response = await apiClient.get<SaleChange[]>(
      `/schools/${schoolId}/sales/${saleId}/changes`
    );
    return response.data;
  },

  // Create sale
  create: async (schoolId: string, data: CreateSaleData): Promise<Sale> => {
    const response = await apiClient.post<Sale>(`/schools/${schoolId}/sales`, data);
    return response.data;
  },

  // Add payment to sale
  addPayment: async (
    schoolId: string,
    saleId: string,
    data: AddPaymentData
  ): Promise<SalePayment> => {
    const response = await apiClient.post<SalePayment>(
      `/schools/${schoolId}/sales/${saleId}/payments`,
      data
    );
    return response.data;
  },

  // Create change/return request
  createChange: async (
    schoolId: string,
    saleId: string,
    data: CreateChangeData
  ): Promise<SaleChange> => {
    const response = await apiClient.post<SaleChange>(
      `/schools/${schoolId}/sales/${saleId}/changes`,
      data
    );
    return response.data;
  },

  // Approve change request
  approveChange: async (
    schoolId: string,
    saleId: string,
    changeId: string,
    data?: ApproveChangeData
  ): Promise<SaleChange> => {
    const response = await apiClient.patch<SaleChange>(
      `/schools/${schoolId}/sales/${saleId}/changes/${changeId}/approve`,
      data || {}
    );
    return response.data;
  },

  // Reject change request
  rejectChange: async (
    schoolId: string,
    saleId: string,
    changeId: string,
    data?: RejectChangeData
  ): Promise<SaleChange> => {
    const response = await apiClient.patch<SaleChange>(
      `/schools/${schoolId}/sales/${saleId}/changes/${changeId}/reject`,
      data || {}
    );
    return response.data;
  },

  // Get receipt HTML
  getReceipt: async (schoolId: string, saleId: string): Promise<string> => {
    const response = await apiClient.get<string>(
      `/schools/${schoolId}/sales/${saleId}/receipt`,
      { responseType: 'text' as any }
    );
    return response.data;
  },

  // Get detailed information for a sale change
  getChangeDetails: async (changeId: string): Promise<SaleChangeDetailResponse> => {
    const response = await apiClient.get<SaleChangeDetailResponse>(
      `/sale-changes/${changeId}/details`
    );
    return response.data;
  },
};

export default salesService;
