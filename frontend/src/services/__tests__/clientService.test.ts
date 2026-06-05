import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import { clientService } from '../clientService';
import type { Client, PaginatedResponse } from '../../types/api';

vi.mock('../../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const apiMock = vi.mocked(apiClient);

function paginatedOf<T>(items: T[]): PaginatedResponse<T> {
  return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
}

const mockClient: Client = {
  id: 'client-1',
  name: 'Maria Lopez',
  email: 'maria@example.com',
  phone: '3001234567',
  client_type: 'regular',
  is_active: true,
  created_at: '2026-01-01T00:00:00',
} as unknown as Client;

describe('clientService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getClients', () => {
    it('fetches all clients with no filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockClient]) });

      const result = await clientService.getClients();

      expect(apiMock.get).toHaveBeenCalledWith('/clients');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('appends all filters to query string', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await clientService.getClients(undefined, {
        search: 'Maria',
        client_type: 'web',
        is_active: true,
        skip: 20,
        limit: 10,
      });

      expect(apiMock.get).toHaveBeenCalledWith(
        '/clients?search=Maria&client_type=web&is_active=true&skip=20&limit=10'
      );
    });

    it('ignores the deprecated schoolId parameter', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await clientService.getClients('school-1');

      expect(apiMock.get).toHaveBeenCalledWith('/clients');
    });

    it('does not append undefined filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await clientService.getClients(undefined, { search: undefined });

      expect(apiMock.get).toHaveBeenCalledWith('/clients');
    });
  });

  describe('searchClients', () => {
    it('encodes query and uses default limit', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockClient] });

      const result = await clientService.searchClients('Maria Lopez');

      expect(apiMock.get).toHaveBeenCalledWith('/clients/search?q=Maria%20Lopez&limit=20');
      expect(result).toHaveLength(1);
    });

    it('respects custom limit', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [] });

      await clientService.searchClients('test', 5);

      expect(apiMock.get).toHaveBeenCalledWith('/clients/search?q=test&limit=5');
    });
  });

  describe('getClient', () => {
    it('fetches client by ID (new signature)', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockClient });

      const result = await clientService.getClient('client-1');

      expect(apiMock.get).toHaveBeenCalledWith('/clients/client-1');
      expect(result.id).toBe('client-1');
    });

    it('fetches client by ID (old signature with schoolId)', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockClient });

      const result = await clientService.getClient('school-1', 'client-1');

      expect(apiMock.get).toHaveBeenCalledWith('/clients/client-1');
      expect(result.id).toBe('client-1');
    });
  });

  describe('getClientSummary', () => {
    it('fetches client summary', async () => {
      const mockSummary = { total_spent: 500000, orders_count: 5 };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockSummary });

      const result = await clientService.getClientSummary('client-1');

      expect(apiMock.get).toHaveBeenCalledWith('/clients/client-1/summary');
      expect(result.total_spent).toBe(500000);
    });
  });

  describe('createClient', () => {
    it('posts client data (new signature)', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockClient });

      const result = await clientService.createClient({ name: 'Maria Lopez', email: 'maria@example.com' });

      expect(apiMock.post).toHaveBeenCalledWith('/clients', { name: 'Maria Lopez', email: 'maria@example.com' });
      expect(result.id).toBe('client-1');
    });

    it('posts client data (old signature with schoolId)', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockClient });

      const clientData = { name: 'Maria Lopez' };
      await clientService.createClient('school-1', clientData);

      expect(apiMock.post).toHaveBeenCalledWith('/clients', clientData);
    });
  });

  describe('updateClient', () => {
    it('patches client (new signature: clientId, data)', async () => {
      const updated = { ...mockClient, phone: '3009999999' };
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: updated });

      const result = await clientService.updateClient('client-1', { phone: '3009999999' });

      expect(apiMock.patch).toHaveBeenCalledWith('/clients/client-1', { phone: '3009999999' });
      expect(result.phone).toBe('3009999999');
    });

    it('patches client (old signature: schoolId, clientId, data)', async () => {
      const updated = { ...mockClient, phone: '3009999999' };
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: updated });

      await clientService.updateClient('school-1', 'client-1', { phone: '3009999999' });

      expect(apiMock.patch).toHaveBeenCalledWith('/clients/client-1', { phone: '3009999999' });
    });
  });

  describe('deleteClient', () => {
    it('deletes client by ID (new signature)', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({ data: undefined });

      await clientService.deleteClient('client-1');

      expect(apiMock.delete).toHaveBeenCalledWith('/clients/client-1');
    });

    it('deletes client by ID (old signature with schoolId)', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({ data: undefined });

      await clientService.deleteClient('school-1', 'client-1');

      expect(apiMock.delete).toHaveBeenCalledWith('/clients/client-1');
    });
  });

  describe('getTopClients', () => {
    it('fetches top clients with default limit', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockClient] });

      const result = await clientService.getTopClients();

      expect(apiMock.get).toHaveBeenCalledWith('/clients/top?limit=10');
      expect(result).toHaveLength(1);
    });

    it('uses custom limit', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [] });

      await clientService.getTopClients(5);

      expect(apiMock.get).toHaveBeenCalledWith('/clients/top?limit=5');
    });
  });

  describe('resendActivationEmail', () => {
    it('posts to resend-activation endpoint', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: { message: 'Email enviado', email: 'maria@example.com' } });

      const result = await clientService.resendActivationEmail('client-1');

      expect(apiMock.post).toHaveBeenCalledWith('/clients/client-1/resend-activation');
      expect(result.email).toBe('maria@example.com');
    });
  });

  describe('student management', () => {
    it('addStudent posts to client students endpoint', async () => {
      const studentData = {
        school_id: 'school-1',
        student_name: 'Ana Lopez',
        student_grade: '5',
      };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: { id: 'student-1', ...studentData } });

      const result = await clientService.addStudent('client-1', studentData);

      expect(apiMock.post).toHaveBeenCalledWith('/clients/client-1/students', studentData);
      expect(result.student_name).toBe('Ana Lopez');
    });

    it('updateStudent patches student data', async () => {
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: { id: 'student-1', student_grade: '6' } });

      const result = await clientService.updateStudent('client-1', 'student-1', { student_grade: '6' });

      expect(apiMock.patch).toHaveBeenCalledWith(
        '/clients/client-1/students/student-1',
        { student_grade: '6' }
      );
      expect(result.student_grade).toBe('6');
    });

    it('removeStudent deletes student', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({ data: undefined });

      await clientService.removeStudent('client-1', 'student-1');

      expect(apiMock.delete).toHaveBeenCalledWith('/clients/client-1/students/student-1');
    });
  });

  describe('error propagation', () => {
    it('propagates errors from getClients', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('Network Error'));

      await expect(clientService.getClients()).rejects.toThrow('Network Error');
    });
  });
});
