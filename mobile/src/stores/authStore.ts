import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import apiClient, { extractErrorMessage, setLogoutCallback } from '../utils/apiClient';
import type { User, LoginRequest, LoginResponse } from '../types/api';
import { refreshRegistryIfStale } from '../services/permissionRegistryService';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;

  login: (credentials: LoginRequest) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  getCurrentUser: () => Promise<void>;
  hydrate: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()((set, get) => {
  setLogoutCallback(() => {
    set({ user: null, token: null, isAuthenticated: false, error: null });
  });

  return {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    isHydrated: false,
    error: null,

    hydrate: async () => {
      const token = await SecureStore.getItemAsync('access_token');
      if (token) {
        set({ token, isAuthenticated: true, isHydrated: true });
        try {
          await get().getCurrentUser();
        } catch {
          await get().logout();
        }
      } else {
        set({ isHydrated: true });
      }
    },

    login: async (credentials: LoginRequest) => {
      set({ isLoading: true, error: null });
      try {
        const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
        const { token, user } = response.data;

        await SecureStore.setItemAsync('access_token', token.access_token);

        set({
          user,
          token: token.access_token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        refreshRegistryIfStale().catch(() => {});
      } catch (error) {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: extractErrorMessage(error),
        });
        throw error;
      }
    },

    googleLogin: async (idToken: string) => {
      set({ isLoading: true, error: null });
      try {
        const response = await apiClient.post<LoginResponse>('/auth/google-login', {
          id_token: idToken,
        });
        const { token, user } = response.data;

        await SecureStore.setItemAsync('access_token', token.access_token);

        set({
          user,
          token: token.access_token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        refreshRegistryIfStale().catch(() => {});
      } catch (error) {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: extractErrorMessage(error),
        });
        throw error;
      }
    },

    logout: async () => {
      await SecureStore.deleteItemAsync('access_token');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        error: null,
      });
    },

    clearError: () => set({ error: null }),

    updateUser: (patch: Partial<User>) => {
      const current = get().user;
      if (!current) return;
      set({ user: { ...current, ...patch } });
    },

    getCurrentUser: async () => {
      try {
        const response = await apiClient.get<User>('/auth/me');
        set({ user: response.data, isAuthenticated: true });
      } catch {
        await get().logout();
      }
    },
  };
});
