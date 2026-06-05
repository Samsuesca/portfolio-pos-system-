import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAuthStore } from './authStore';

vi.mock('../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getErrorMessage: vi.fn((err: any) => err?.message || 'Error desconocido'),
}));

vi.mock('../services/permissionRegistryService', () => ({
  refreshRegistryIfStale: vi.fn().mockResolvedValue(undefined),
}));

import apiClient from '../utils/api-client';
import { refreshRegistryIfStale } from '../services/permissionRegistryService';

const apiMock = vi.mocked(apiClient);
const refreshMock = vi.mocked(refreshRegistryIfStale);

const mockUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  full_name: 'Test User',
  is_superuser: false,
  is_active: true,
  last_login: null,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
  school_roles: [],
  permissions_version: 1,
};

const mockLoginResponse = {
  token: { access_token: 'jwt-token-123' },
  user: mockUser,
};

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    act(() => {
      useAuthStore.setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    });
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts unauthenticated with no user', () => {
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('login', () => {
    it('sets authenticated state on success', async () => {
      apiMock.post.mockResolvedValueOnce({ data: mockLoginResponse, status: 200 });
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login({ username: 'testuser', password: 'password' });
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe('jwt-token-123');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('stores token in localStorage on success', async () => {
      apiMock.post.mockResolvedValueOnce({ data: mockLoginResponse, status: 200 });
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login({ username: 'testuser', password: 'password' });
      });

      expect(localStorage.getItem('access_token')).toBe('jwt-token-123');
    });

    it('calls refreshRegistryIfStale after successful login', async () => {
      apiMock.post.mockResolvedValueOnce({ data: mockLoginResponse, status: 200 });
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login({ username: 'testuser', password: 'password' });
      });

      // refreshRegistryIfStale is called with .catch, wait a tick
      await new Promise(r => setTimeout(r, 0));
      expect(refreshMock).toHaveBeenCalled();
    });

    it('clears auth state and sets error on failure', async () => {
      const err = new Error('Credenciales inválidas');
      apiMock.post.mockRejectedValueOnce(err);
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try { await result.current.login({ username: 'x', password: 'y' }); }
        catch { /* expected */ }
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBeTruthy();
    });

    it('sets isLoading to true during request', async () => {
      let resolveLogin!: (v: any) => void;
      apiMock.post.mockReturnValueOnce(new Promise(r => { resolveLogin = r; }));
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.login({ username: 'testuser', password: 'password' }).catch(() => {});
      });

      expect(result.current.isLoading).toBe(true);
      resolveLogin({ data: mockLoginResponse, status: 200 });
    });
  });

  describe('googleLogin', () => {
    it('sets authenticated state on success', async () => {
      apiMock.post.mockResolvedValueOnce({ data: mockLoginResponse, status: 200 });
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.googleLogin('google-id-token');
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });

    it('clears auth state and throws on failure', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('Google auth failed'));
      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => { await result.current.googleLogin('bad-token'); })
      ).rejects.toThrow();

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('logout', () => {
    it('clears all auth state', async () => {
      // Set up authenticated state
      act(() => {
        useAuthStore.setState({
          user: mockUser,
          token: 'jwt-token-123',
          isAuthenticated: true,
        });
      });

      const { result } = renderHook(() => useAuthStore());
      act(() => { result.current.logout(); });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('removes access_token from localStorage', () => {
      localStorage.setItem('access_token', 'jwt-token-123');
      const { result } = renderHook(() => useAuthStore());
      act(() => { result.current.logout(); });
      expect(localStorage.getItem('access_token')).toBeNull();
    });
  });

  describe('clearError', () => {
    it('resets error to null', () => {
      act(() => { useAuthStore.setState({ error: 'some error' }); });
      const { result } = renderHook(() => useAuthStore());
      act(() => { result.current.clearError(); });
      expect(result.current.error).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('updates user on success', async () => {
      act(() => {
        useAuthStore.setState({ token: 'valid-token', isAuthenticated: true });
      });

      const updatedUser = { ...mockUser, full_name: 'Updated Name' };
      apiMock.get.mockResolvedValueOnce({ data: updatedUser, status: 200 });

      const { result } = renderHook(() => useAuthStore());
      await act(async () => { await result.current.getCurrentUser(); });

      expect(result.current.user).toEqual(updatedUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('calls logout on API error (invalid token)', async () => {
      act(() => {
        useAuthStore.setState({ token: 'expired-token', isAuthenticated: true, user: mockUser });
      });

      apiMock.get.mockRejectedValueOnce(new Error('Unauthorized'));

      const { result } = renderHook(() => useAuthStore());
      await act(async () => { await result.current.getCurrentUser(); });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('does nothing when no token', async () => {
      const { result } = renderHook(() => useAuthStore());
      await act(async () => { await result.current.getCurrentUser(); });

      expect(apiMock.get).not.toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    it('merges partial user data into existing user', () => {
      act(() => {
        useAuthStore.setState({ user: mockUser });
      });

      const { result } = renderHook(() => useAuthStore());
      act(() => {
        result.current.updateUser({ full_name: 'New Name' });
      });

      expect(result.current.user?.full_name).toBe('New Name');
      expect(result.current.user?.email).toBe(mockUser.email);
    });

    it('does nothing when user is null', () => {
      const { result } = renderHook(() => useAuthStore());
      act(() => { result.current.updateUser({ full_name: 'X' }); });
      expect(result.current.user).toBeNull();
    });
  });
});
