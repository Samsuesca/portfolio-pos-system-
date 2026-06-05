import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8001';

const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let logoutCallback: (() => void) | null = null;

export function setLogoutCallback(cb: () => void): void {
  logoutCallback = cb;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('access_token');
      logoutCallback?.();
    }
    return Promise.reject(error);
  }
);

export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined;

    if (Array.isArray(data?.detail)) {
      return (data.detail as Array<{ loc?: string[]; msg?: string }>)
        .map((e) => {
          const field = e.loc?.[e.loc.length - 1] || 'Campo';
          return `${field}: ${e.msg}`;
        })
        .join('\n');
    }

    if (typeof data?.detail === 'string') {
      return data.detail;
    }

    if (err.response?.status === 401) return 'Sesion expirada. Inicia sesion nuevamente.';
    if (err.response?.status === 403) return 'No tienes permisos para esta accion.';
    if (err.response?.status === 404) return 'Recurso no encontrado.';
    if (err.response?.status === 422) return 'Error de validacion. Revisa los campos.';
    if (err.response?.status && err.response.status >= 500) return 'Error del servidor. Intenta de nuevo.';

    if (err.code === 'ERR_NETWORK') return 'Error de conexion. Verifica tu internet.';
    if (err.code === 'ECONNABORTED') return 'La solicitud tomo demasiado tiempo. Intenta de nuevo.';
  }

  if (err instanceof Error) return err.message;

  return 'Error desconocido. Intenta de nuevo.';
}

export default apiClient;
