import apiClient from '../utils/api-client';

const BASE_URL = '';

// ============================================
// Types
// ============================================

export interface CostComponentTemplate {
  id: string;
  garment_type_id: string | null;
  global_garment_type_id: string | null;
  name: string;
  code: string;
  is_variable: boolean;
  display_order: number;
  is_active: boolean;
}

export interface ProductCostComponent {
  id: string;
  template_id: string;
  template_name: string;
  template_code: string;
  is_variable: boolean;
  amount: number;
  notes: string | null;
}

export interface ProductCostBreakdown {
  product_id: string;
  product_code: string;
  product_name: string | null;
  size: string;
  price: number;
  total_cost: number;
  margin_percent: number;
  components: ProductCostComponent[];
  has_estimates: boolean;
}

export interface SizeDelta {
  sizes: string[];
  delta: number;
}

export interface BulkApplyResult {
  updated: number;
  total_cost_recalculated: number;
}

// ============================================
// Templates
// ============================================

export const getTemplates = async (
  garmentTypeId: string,
  schoolId?: string,
  isGlobal: boolean = false,
  includeInactive: boolean = false
): Promise<CostComponentTemplate[]> => {
  const baseUrl = isGlobal
    ? `${BASE_URL}/global-garment-types/${garmentTypeId}/cost-templates`
    : `${BASE_URL}/schools/${schoolId}/garment-types/${garmentTypeId}/cost-templates`;
  const url = includeInactive ? `${baseUrl}?include_inactive=true` : baseUrl;
  const response = await apiClient.get<CostComponentTemplate[]>(url);
  return response.data;
};

export const createTemplate = async (
  garmentTypeId: string,
  data: { name: string; code: string; is_variable: boolean; display_order: number },
  schoolId?: string,
  isGlobal: boolean = false
): Promise<CostComponentTemplate> => {
  const url = isGlobal
    ? `${BASE_URL}/global-garment-types/${garmentTypeId}/cost-templates`
    : `${BASE_URL}/schools/${schoolId}/garment-types/${garmentTypeId}/cost-templates`;
  const response = await apiClient.post<CostComponentTemplate>(url, data);
  return response.data;
};

export const updateTemplate = async (
  garmentTypeId: string,
  templateId: string,
  data: { name?: string; is_variable?: boolean; display_order?: number; is_active?: boolean },
  schoolId?: string,
  isGlobal: boolean = false
): Promise<CostComponentTemplate> => {
  const url = isGlobal
    ? `${BASE_URL}/global-garment-types/${garmentTypeId}/cost-templates/${templateId}`
    : `${BASE_URL}/schools/${schoolId}/garment-types/${garmentTypeId}/cost-templates/${templateId}`;
  const response = await apiClient.put<CostComponentTemplate>(url, data);
  return response.data;
};

export const deleteTemplate = async (
  garmentTypeId: string,
  templateId: string,
  schoolId?: string,
  isGlobal: boolean = false
): Promise<void> => {
  const url = isGlobal
    ? `${BASE_URL}/global-garment-types/${garmentTypeId}/cost-templates/${templateId}`
    : `${BASE_URL}/schools/${schoolId}/garment-types/${garmentTypeId}/cost-templates/${templateId}`;
  await apiClient.delete(url);
};

// ============================================
// Cost Breakdown
// ============================================

export const getBreakdown = async (
  productId: string,
  schoolId?: string,
  isGlobal: boolean = false
): Promise<ProductCostBreakdown> => {
  const url = isGlobal
    ? `${BASE_URL}/global-products/${productId}/cost-breakdown`
    : `${BASE_URL}/schools/${schoolId}/products/${productId}/cost-breakdown`;
  const response = await apiClient.get<ProductCostBreakdown>(url);
  return response.data;
};

export const upsertBreakdown = async (
  productId: string,
  components: Array<{ template_id: string; amount: number; notes?: string | null }>,
  schoolId?: string,
  isGlobal: boolean = false
): Promise<ProductCostBreakdown> => {
  const url = isGlobal
    ? `${BASE_URL}/global-products/${productId}/cost-breakdown`
    : `${BASE_URL}/schools/${schoolId}/products/${productId}/cost-breakdown`;
  const response = await apiClient.put<ProductCostBreakdown>(url, { components });
  return response.data;
};

// ============================================
// Bulk Operations
// ============================================

export const bulkApplyComponent = async (
  garmentTypeId: string,
  code: string,
  amount: number,
  sizeDeltas: SizeDelta[] = [],
  notes?: string | null,
  schoolId?: string,
  isGlobal: boolean = false
): Promise<BulkApplyResult> => {
  const url = isGlobal
    ? `${BASE_URL}/global-garment-types/${garmentTypeId}/bulk-cost-component`
    : `${BASE_URL}/schools/${schoolId}/garment-types/${garmentTypeId}/bulk-cost-component`;
  const response = await apiClient.put<BulkApplyResult>(url, {
    code,
    amount,
    notes,
    size_deltas: sizeDeltas,
  });
  return response.data;
};


// ============================================
// Cost Change History (audit trail)
// ============================================

export type CostChangeType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'template_activated'
  | 'template_deactivated'
  | 'bulk_apply'
  | 'import';

export interface CostChangeLog {
  id: string;
  product_id: string;
  template_id: string | null;
  template_name: string | null;
  template_code: string | null;
  product_cost_component_id: string | null;
  school_id: string | null;
  change_type: CostChangeType;
  amount_before: number | null;
  amount_after: number | null;
  notes_before: string | null;
  notes_after: string | null;
  reason: string | null;
  changed_by: string | null;
  changed_by_name: string | null;
  created_at: string;
}

export interface CostHistoryPage {
  items: CostChangeLog[];
  total: number;
  page: number;
  pages: number;
}

export const getCostHistory = async (
  productId: string,
  schoolId: string | undefined,
  isGlobal: boolean,
  skip: number = 0,
  limit: number = 50,
): Promise<CostHistoryPage> => {
  const baseUrl = isGlobal
    ? `${BASE_URL}/global-products/${productId}/cost-history`
    : `${BASE_URL}/schools/${schoolId}/products/${productId}/cost-history`;
  const url = `${baseUrl}?skip=${skip}&limit=${limit}`;
  const response = await apiClient.get<CostHistoryPage>(url);
  return response.data;
};
