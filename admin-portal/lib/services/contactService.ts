/**
 * Contact Service - API calls for PQRS management
 * Peticiones, Quejas, Reclamos, Sugerencias
 */
import apiClient from '../api';

// ======================
// Types
// ======================

export type ContactType = 'inquiry' | 'request' | 'complaint' | 'claim' | 'suggestion';
export type ContactStatus = 'pending' | 'in_review' | 'resolved' | 'closed';

export interface Contact {
  id: string;
  client_id: string | null;
  school_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  contact_type: ContactType;
  subject: string;
  message: string;
  status: ContactStatus;
  is_read: boolean;
  admin_response: string | null;
  admin_response_date: string | null;
  responded_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactListParams {
  page?: number;
  page_size?: number;
  school_id?: string;
  status_filter?: string;
  contact_type_filter?: string;
  unread_only?: boolean;
  search?: string;
}

export interface ContactListResponse {
  items: Contact[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ContactStats {
  by_status: Record<string, number>;
  unread_count: number;
  by_type: Record<string, number>;
}

export interface ContactUpdate {
  status?: string;
  admin_response?: string;
  is_read?: boolean;
}

// ======================
// Constants
// ======================

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  inquiry: 'Consulta',
  request: 'Peticion',
  complaint: 'Queja',
  claim: 'Reclamo',
  suggestion: 'Sugerencia',
};

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  pending: 'Pendiente',
  in_review: 'En Revision',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};

export const CONTACT_STATUS_COLORS: Record<ContactStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_review: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-700',
};

export const CONTACT_TYPE_COLORS: Record<ContactType, string> = {
  inquiry: 'bg-blue-100 text-blue-700',
  request: 'bg-purple-100 text-purple-700',
  complaint: 'bg-orange-100 text-orange-700',
  claim: 'bg-red-100 text-red-700',
  suggestion: 'bg-green-100 text-green-700',
};

// ======================
// API Functions
// ======================

const contactService = {
  // List contacts with pagination and filters
  list: async (params: ContactListParams = {}): Promise<ContactListResponse> => {
    const response = await apiClient.get<ContactListResponse>('/contacts', {
      params: params as Record<string, unknown>,
    });
    return response.data;
  },

  // Get single contact by ID (marks as read)
  getById: async (contactId: string): Promise<Contact> => {
    const response = await apiClient.get<Contact>(`/contacts/${contactId}`);
    return response.data;
  },

  // Update contact (respond, change status, mark read)
  update: async (contactId: string, data: ContactUpdate): Promise<Contact> => {
    const response = await apiClient.put<Contact>(`/contacts/${contactId}`, data);
    return response.data;
  },

  // Get contact statistics
  getStats: async (): Promise<ContactStats> => {
    const response = await apiClient.get<ContactStats>('/contacts/stats/summary');
    return response.data;
  },
};

export default contactService;
