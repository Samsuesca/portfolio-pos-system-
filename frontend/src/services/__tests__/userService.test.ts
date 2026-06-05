import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import { userService } from '../userService';

vi.mock('../../utils/api-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const apiMock = vi.mocked(apiClient);

function paginatedOf<T>(items: T[]) {
  return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
}

const mockUser = {
  id: 'user-1', username: 'testuser', email: 'test@example.com',
  full_name: 'Test User', is_active: true, is_superuser: false,
  created_at: '2026-01-01T00:00:00', updated_at: null,
};

describe('userService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('profile', () => {
    it('getMe fetches current user', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockUser });
      const result = await userService.getMe();
      expect(apiMock.get).toHaveBeenCalledWith('/auth/me');
      expect(result.id).toBe('user-1');
    });

    it('updateProfile puts user data', async () => {
      (apiMock.put as Mock).mockResolvedValueOnce({ data: { ...mockUser, full_name: 'New Name' } });
      const result = await userService.updateProfile('user-1', { full_name: 'New Name' });
      expect(apiMock.put).toHaveBeenCalledWith('/users/user-1', { full_name: 'New Name' });
      expect(result.full_name).toBe('New Name');
    });

    it('changePassword posts to auth endpoint', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: undefined });
      await userService.changePassword({ old_password: 'old', new_password: 'new' });
      expect(apiMock.post).toHaveBeenCalledWith('/auth/change-password', { old_password: 'old', new_password: 'new' });
    });
  });

  describe('user management', () => {
    it('getUsers fetches paginated users', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockUser]) });
      const result = await userService.getUsers();
      expect(apiMock.get).toHaveBeenCalledWith('/users', { params: { skip: 0, limit: 100 } });
      expect(result.items).toHaveLength(1);
    });

    it('getUsers wraps legacy array', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockUser] });
      const result = await userService.getUsers({ skip: 10, limit: 50 });
      expect(apiMock.get).toHaveBeenCalledWith('/users', { params: { skip: 10, limit: 50 } });
      expect(result.items).toHaveLength(1);
    });

    it('getUser fetches by ID', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockUser });
      const result = await userService.getUser('user-1');
      expect(apiMock.get).toHaveBeenCalledWith('/users/user-1');
      expect(result.id).toBe('user-1');
    });

    it('createUser posts new user', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockUser });
      const result = await userService.createUser({ username: 'testuser', email: 'test@example.com', password: 'pass123' });
      expect(apiMock.post).toHaveBeenCalledWith('/users', { username: 'testuser', email: 'test@example.com', password: 'pass123' });
      expect(result.id).toBe('user-1');
    });

    it('updateUser puts data', async () => {
      (apiMock.put as Mock).mockResolvedValueOnce({ data: mockUser });
      await userService.updateUser('user-1', { email: 'new@example.com' });
      expect(apiMock.put).toHaveBeenCalledWith('/users/user-1', { email: 'new@example.com' });
    });

    it('deleteUser deletes by ID', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({ data: { action: 'deactivated', message: 'OK' } });
      const result = await userService.deleteUser('user-1');
      expect(apiMock.delete).toHaveBeenCalledWith('/users/user-1');
      expect(result.action).toBe('deactivated');
    });
  });

  describe('school roles', () => {
    const mockRole = { id: 'role-1', user_id: 'user-1', school_id: 'school-1', role: 'vendedor', is_primary: true, created_at: '2026-01-01', school: { id: 'school-1', code: 'COL1', name: 'Test', is_active: true } };

    it('getUserSchools fetches roles', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockRole] });
      const result = await userService.getUserSchools('user-1');
      expect(apiMock.get).toHaveBeenCalledWith('/users/user-1/schools');
      expect(result).toHaveLength(1);
    });

    it('addUserSchoolRole posts with params', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockRole });
      await userService.addUserSchoolRole('user-1', 'school-1', 'vendedor' as any);
      expect(apiMock.post).toHaveBeenCalledWith('/users/user-1/schools/school-1/role', null, { params: { role: 'vendedor' } });
    });

    it('addUserSchoolRole includes customRoleId when provided', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockRole });
      await userService.addUserSchoolRole('user-1', 'school-1', 'vendedor' as any, 'custom-1');
      expect(apiMock.post).toHaveBeenCalledWith('/users/user-1/schools/school-1/role', null, { params: { role: 'vendedor', custom_role_id: 'custom-1' } });
    });

    it('updateUserSchoolRole puts with params', async () => {
      (apiMock.put as Mock).mockResolvedValueOnce({ data: mockRole });
      await userService.updateUserSchoolRole('user-1', 'school-1', 'admin' as any);
      expect(apiMock.put).toHaveBeenCalledWith('/users/user-1/schools/school-1/role', null, { params: { role: 'admin' } });
    });

    it('removeUserSchoolRole deletes', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({ data: undefined });
      await userService.removeUserSchoolRole('user-1', 'school-1');
      expect(apiMock.delete).toHaveBeenCalledWith('/users/user-1/schools/school-1/role');
    });

    it('getSchoolUsers fetches paginated', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockRole]) });
      const result = await userService.getSchoolUsers('school-1');
      expect(apiMock.get).toHaveBeenCalledWith('/users/schools/school-1/users');
      expect(result.items).toHaveLength(1);
    });
  });

  describe('email change', () => {
    it('requestEmailChange posts new email', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: { message: 'Sent', email: 'new@test.com' } });
      const result = await userService.requestEmailChange('new@test.com');
      expect(apiMock.post).toHaveBeenCalledWith('/auth/request-email-change', { new_email: 'new@test.com' });
      expect(result.email).toBe('new@test.com');
    });

    it('verifyEmailChange posts token', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: { message: 'OK', old_email: 'old@test.com', new_email: 'new@test.com' } });
      const result = await userService.verifyEmailChange('token-123');
      expect(apiMock.post).toHaveBeenCalledWith('/auth/verify-email/token-123');
      expect(result.new_email).toBe('new@test.com');
    });
  });

  describe('admin operations', () => {
    it('adminResetPassword posts new password', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: { message: 'OK' } });
      await userService.adminResetPassword('user-1', 'newpass');
      expect(apiMock.post).toHaveBeenCalledWith('/users/user-1/reset-password', { new_password: 'newpass' });
    });

    it('adminChangeEmail puts new email', async () => {
      (apiMock.put as Mock).mockResolvedValueOnce({ data: { ...mockUser, email: 'admin@test.com' } });
      await userService.adminChangeEmail('user-1', 'admin@test.com');
      expect(apiMock.put).toHaveBeenCalledWith('/users/user-1/email', { new_email: 'admin@test.com' });
    });

    it('adminSetSuperuser puts superuser status', async () => {
      (apiMock.put as Mock).mockResolvedValueOnce({ data: { ...mockUser, is_superuser: true } });
      const result = await userService.adminSetSuperuser('user-1', true);
      expect(apiMock.put).toHaveBeenCalledWith('/users/user-1/superuser', { is_superuser: true });
      expect(result.is_superuser).toBe(true);
    });
  });

  describe('error propagation', () => {
    it('propagates errors from getMe', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('Unauthorized'));
      await expect(userService.getMe()).rejects.toThrow('Unauthorized');
    });
  });
});
