import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import { contactService } from '../contactService';

vi.mock('../../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

const apiMock = vi.mocked(apiClient);

function paginatedOf<T>(items: T[]) {
  return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
}

const mockContact = {
  id: 'contact-1',
  client_id: null,
  school_id: 'school-1',
  name: 'Carlos Perez',
  email: 'carlos@example.com',
  phone: '3109876543',
  contact_type: 'inquiry',
  subject: 'Disponibilidad uniformes',
  message: 'Quisiera saber si tienen uniformes del colegio San Jose',
  status: 'pending',
  is_read: false,
  admin_response: null,
  admin_response_date: null,
  responded_by_id: null,
  created_at: '2026-03-01T09:00:00',
  updated_at: '2026-03-01T09:00:00',
};

const mockStats = {
  by_status: { pending: 5, resolved: 10 },
  unread_count: 3,
  by_type: { inquiry: 8, complaint: 2 },
};

describe('contactService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getContacts', () => {
    it('fetches contacts with no params', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockContact]) });

      const result = await contactService.getContacts();

      expect(apiMock.get).toHaveBeenCalledWith('/contacts', { params: {} });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Carlos Perez');
    });

    it('passes filter params', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await contactService.getContacts({ status_filter: 'pending', unread_only: true, skip: 0, limit: 20 });

      expect(apiMock.get).toHaveBeenCalledWith('/contacts', {
        params: { status_filter: 'pending', unread_only: true, skip: 0, limit: 20 },
      });
    });

    it('propagates API errors', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('Forbidden'));

      await expect(contactService.getContacts()).rejects.toThrow('Forbidden');
    });
  });

  describe('getContact', () => {
    it('fetches a single contact by ID', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockContact });

      const result = await contactService.getContact('contact-1');

      expect(apiMock.get).toHaveBeenCalledWith('/contacts/contact-1');
      expect(result.id).toBe('contact-1');
    });
  });

  describe('updateContact', () => {
    it('updates contact status and response', async () => {
      const updateData = { status: 'resolved', admin_response: 'Si tenemos disponibilidad' };
      (apiMock.put as Mock).mockResolvedValueOnce({ data: { ...mockContact, ...updateData } });

      const result = await contactService.updateContact('contact-1', updateData);

      expect(apiMock.put).toHaveBeenCalledWith('/contacts/contact-1', updateData);
      expect(result.status).toBe('resolved');
      expect(result.admin_response).toBe('Si tenemos disponibilidad');
    });

    it('marks contact as read', async () => {
      const updateData = { is_read: true };
      (apiMock.put as Mock).mockResolvedValueOnce({ data: { ...mockContact, is_read: true } });

      const result = await contactService.updateContact('contact-1', updateData);

      expect(apiMock.put).toHaveBeenCalledWith('/contacts/contact-1', updateData);
      expect(result.is_read).toBe(true);
    });
  });

  describe('getStats', () => {
    it('fetches contact statistics', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockStats });

      const result = await contactService.getStats();

      expect(apiMock.get).toHaveBeenCalledWith('/contacts/stats/summary');
      expect(result.unread_count).toBe(3);
      expect(result.by_status.pending).toBe(5);
    });
  });
});
