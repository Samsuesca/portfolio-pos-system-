/**
 * Contact Service
 *
 * API client for PQRS (Peticiones, Quejas, Reclamos, Sugerencias) system.
 * Handles contact messages from web portal and admin responses.
 */
import apiClient from '../utils/api-client';

export interface Contact {
  id: string;
  client_id: string | null;
  school_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  contact_type: 'inquiry' | 'request' | 'complaint' | 'claim' | 'suggestion';
  subject: string;
  message: string;
  status: 'pending' | 'in_review' | 'resolved' | 'closed';
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

class ContactService {
  /**
   * Listar mensajes de contacto con paginación y filtros
   * Requiere autenticación (admin/superuser)
   */
  async getContacts(params: ContactListParams = {}): Promise<ContactListResponse> {
    const response = await apiClient.get<ContactListResponse>('/contacts', { params: params as Record<string, unknown> });
    return response.data;
  }

  /**
   * Obtener un mensaje de contacto por ID
   * Marca el mensaje como leído automáticamente
   * Requiere autenticación (admin/superuser)
   */
  async getContact(contactId: string): Promise<Contact> {
    const response = await apiClient.get<Contact>(`/contacts/${contactId}`);
    return response.data;
  }

  /**
   * Actualizar mensaje de contacto (marcar leído, responder, cambiar estado)
   * Requiere autenticación (admin/superuser)
   */
  async updateContact(
    contactId: string,
    data: {
      status?: string;
      admin_response?: string;
      is_read?: boolean;
    }
  ): Promise<Contact> {
    const response = await apiClient.put<Contact>(`/contacts/${contactId}`, data);
    return response.data;
  }

  /**
   * Obtener estadísticas de mensajes de contacto
   * Requiere autenticación (admin/superuser)
   */
  async getStats(): Promise<ContactStats> {
    const response = await apiClient.get<ContactStats>('/contacts/stats/summary');
    return response.data;
  }
}

export const contactService = new ContactService();
