/**
 * API Client - Hybrid approach for Tauri
 *
 * - In dev mode (localhost): Uses XMLHttpRequest (no CORS issues)
 * - In production build (tauri://): Uses Rust http_request command via IPC
 *
 * This bypasses WebView2's buggy tauriFetch implementation on Windows where
 * response.json()/text()/arrayBuffer() hangs indefinitely.
 */
import { invoke } from '@tauri-apps/api/core';
import { useConfigStore } from '../stores/configStore';

// Detect if running inside Tauri production build
// In dev mode: use XHR which works reliably on all platforms
// In production build (.exe): use Rust IPC to avoid Windows WebView2 hang
// Use import.meta.env.DEV (Vite compile-time constant) instead of protocol detection
// because Tauri's protocol varies across platforms (https:, tauri:, http:)
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const useRustHttp = isTauri && !import.meta.env.DEV;

// Track online status
function updateOnlineStatus(isOnline: boolean) {
  const store = useConfigStore.getState();
  if (store.isOnline !== isOnline) {
    store.setIsOnline(isOnline);
    store.updateLastChecked();
  }
}

// Helper function to get error message
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'detail' in error) {
    return String((error as { detail: unknown }).detail);
  }
  return 'An unexpected error occurred';
};

// Response type from Rust http_request command
interface RustHttpResponse {
  status: number;
  body: string;
}

// Helper for HTTP requests via Rust IPC (production builds)
async function rustHttpRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string
): Promise<{ status: number; data: unknown }> {
  const response = await invoke<RustHttpResponse>('http_request', {
    request: {
      method,
      url,
      headers,
      body,
      timeout_secs: 60,
    },
  });

  let data: unknown = {};
  if (response.body) {
    try {
      data = JSON.parse(response.body);
    } catch {
      data = response.body;
    }
  }

  return { status: response.status, data };
}

// Helper for HTTP requests via XMLHttpRequest (dev mode)
async function xhrRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string | FormData,
  isFormData: boolean = false
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);

    Object.entries(headers).forEach(([key, value]) => {
      // Don't set Content-Type for FormData - let browser handle it
      if (!(isFormData && key.toLowerCase() === 'content-type')) {
        xhr.setRequestHeader(key, value);
      }
    });

    xhr.onload = () => {
      let data: unknown = {};
      if (xhr.responseText) {
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = xhr.responseText;
        }
      }
      resolve({ status: xhr.status, data });
    };

    xhr.onerror = () => reject(new TypeError('Network request failed'));
    xhr.ontimeout = () => reject(new TypeError('Request timeout'));
    xhr.timeout = 60000;

    xhr.send(body || null);
  });
}

// API Client wrapper
export const apiClient = {
  async request<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    options?: { headers?: Record<string, string>; params?: Record<string, unknown> }
  ): Promise<{ data: T; status: number }> {
    const apiUrl = useConfigStore.getState().apiUrl;
    let url = `${apiUrl}/api/v1${endpoint}`;

    // Add query params if provided
    if (options?.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const token = localStorage.getItem('access_token');
    const isFormData = data instanceof FormData;

    const headers: Record<string, string> = {
      // Don't set Content-Type for FormData - let the browser set it with proper boundary
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      let response: { status: number; data: unknown };

      if (useRustHttp && !isFormData) {
        // Production build: use Rust IPC for JSON requests
        const body = data ? JSON.stringify(data) : undefined;
        response = await rustHttpRequest(method, url, headers, body);
      } else {
        // Dev mode OR FormData: use XMLHttpRequest
        const body = isFormData ? (data as FormData) : (data ? JSON.stringify(data) : undefined);
        response = await xhrRequest(method, url, headers, body, isFormData);
      }

      updateOnlineStatus(true);

      const responseData = response.data as Record<string, unknown>;

      // Handle 401 Unauthorized - clean auth state and let React Router redirect
      if (response.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        try {
          const { useAuthStore } = await import('../stores/authStore');
          useAuthStore.getState().logout();
        } catch {
          localStorage.removeItem('auth-storage');
        }
        throw new Error('Unauthorized');
      }

      // Handle 403 Forbidden - try to get detail from backend
      if (response.status === 403) {
        const detail = typeof responseData?.detail === 'string'
          ? responseData.detail
          : 'No tienes permisos para esta acción';
        throw new Error(detail);
      }

      // Handle other errors
      if (response.status >= 400) {
        let errorMessage: string;

        if (Array.isArray(responseData?.detail)) {
          // Pydantic validation errors - format them nicely
          errorMessage = (responseData.detail as Array<{ loc?: string[]; msg?: string }>)
            .map((e) => {
              const field = e.loc?.[e.loc.length - 1] || 'Campo';
              return `${field}: ${e.msg}`;
            })
            .join('\n');
        } else if (typeof responseData?.detail === 'string') {
          errorMessage = responseData.detail;
        } else if (responseData?.detail && typeof responseData.detail === 'object') {
          errorMessage = JSON.stringify(responseData.detail);
        } else {
          errorMessage = `HTTP ${response.status}`;
        }

        throw new Error(errorMessage);
      }

      // Handle 204 No Content (DELETE responses)
      if (response.status === 204) {
        return { data: {} as T, status: response.status };
      }

      return { data: response.data as T, status: response.status };
    } catch (error) {
      console.error('[API Client] Request error:', error);
      if (error instanceof TypeError && error.message.includes('Network')) {
        updateOnlineStatus(false);
      }
      throw error;
    }
  },

  async get<T>(endpoint: string, options?: { headers?: Record<string, string>; params?: Record<string, unknown> }) {
    return this.request<T>('GET', endpoint, undefined, options);
  },

  async post<T>(endpoint: string, data?: unknown, options?: { headers?: Record<string, string>; params?: Record<string, unknown> }) {
    return this.request<T>('POST', endpoint, data, options);
  },

  async put<T>(endpoint: string, data?: unknown, options?: { headers?: Record<string, string>; params?: Record<string, unknown> }) {
    return this.request<T>('PUT', endpoint, data, options);
  },

  async patch<T>(endpoint: string, data?: unknown, options?: { headers?: Record<string, string>; params?: Record<string, unknown> }) {
    return this.request<T>('PATCH', endpoint, data, options);
  },

  async delete<T>(endpoint: string, options?: { headers?: Record<string, string>; params?: Record<string, unknown> }) {
    return this.request<T>('DELETE', endpoint, undefined, options);
  },

  async uploadFile<T>(endpoint: string, file: File, fieldName: string = 'file'): Promise<{ data: T; status: number }> {
    const apiUrl = useConfigStore.getState().apiUrl;
    const url = `${apiUrl}/api/v1${endpoint}`;
    const token = localStorage.getItem('access_token');

    const formData = new FormData();
    formData.append(fieldName, file);

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      // Use XMLHttpRequest for FormData - works in both dev and build
      // (FormData uploads work fine via XHR even in Tauri builds)
      const response = await xhrRequest('POST', url, headers, formData, true);

      updateOnlineStatus(true);

      if (response.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        try {
          const { useAuthStore } = await import('../stores/authStore');
          useAuthStore.getState().logout();
        } catch {
          localStorage.removeItem('auth-storage');
        }
        throw new Error('Unauthorized');
      }

      const responseData = response.data as Record<string, unknown>;

      if (response.status === 403) {
        const detail = typeof responseData?.detail === 'string'
          ? responseData.detail
          : 'No tienes permisos para esta acción';
        throw new Error(detail);
      }

      if (response.status >= 400) {
        let errorMessage: string;

        if (Array.isArray(responseData?.detail)) {
          // Pydantic validation errors - format them nicely
          errorMessage = (responseData.detail as Array<{ loc?: string[]; msg?: string }>)
            .map((e) => {
              const field = e.loc?.[e.loc.length - 1] || 'Campo';
              return `${field}: ${e.msg}`;
            })
            .join('\n');
        } else if (typeof responseData?.detail === 'string') {
          errorMessage = responseData.detail;
        } else if (responseData?.detail && typeof responseData.detail === 'object') {
          errorMessage = JSON.stringify(responseData.detail);
        } else {
          errorMessage = `HTTP ${response.status}`;
        }

        throw new Error(errorMessage);
      }

      return { data: response.data as T, status: response.status };
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Network')) {
        updateOnlineStatus(false);
      }
      throw error;
    }
  },
};

// Check connection status by calling health endpoint
export async function checkConnection(): Promise<boolean> {
  try {
    const apiUrl = useConfigStore.getState().apiUrl;
    const url = `${apiUrl}/health`;

    let isOnline: boolean;

    if (useRustHttp) {
      // Production: use Rust IPC
      try {
        const response = await rustHttpRequest('GET', url, {});
        isOnline = response.status >= 200 && response.status < 300;
      } catch {
        isOnline = false;
      }
    } else {
      // Dev: use XMLHttpRequest
      isOnline = await new Promise<boolean>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.timeout = 5000;

        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
        xhr.onerror = () => resolve(false);
        xhr.ontimeout = () => resolve(false);

        xhr.send();
      });
    }

    updateOnlineStatus(isOnline);
    return isOnline;
  } catch {
    updateOnlineStatus(false);
    return false;
  }
}

// Función centralizada para extraer mensajes de error legibles
export function extractErrorMessage(err: unknown): string {
  // Errores de validación Pydantic (array de detalles)
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail &&
    Array.isArray((err as { response: { data: { detail: unknown[] } } }).response.data.detail)
  ) {
    return (err as { response: { data: { detail: Array<{ loc?: string[]; msg?: string }> } } }).response.data.detail
      .map((e) => {
        const field = e.loc?.[e.loc.length - 1] || 'Campo';
        return `${field}: ${e.msg}`;
      })
      .join('\n');
  }

  // Error string del backend (detail como string)
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
  ) {
    return (err as { response: { data: { detail: string } } }).response.data.detail;
  }

  // Error message directo (de throw new Error en apiClient)
  if (err instanceof Error && err.message) {
    if (err.message === 'Unauthorized') return 'Sesión expirada. Inicia sesión nuevamente.';
    if (err.message.includes('HTTP 400')) return 'Datos inválidos. Revisa los campos.';
    if (err.message.includes('HTTP 404')) return 'El recurso no fue encontrado.';
    if (err.message.includes('HTTP 409')) return 'Ya existe un registro con estos datos.';
    if (err.message.includes('HTTP 422')) return 'Error de validación. Revisa los campos.';
    if (err.message.includes('HTTP 500')) return 'Error del servidor. Intenta de nuevo.';
    // Si no es un error HTTP conocido, devolver el mensaje
    if (!err.message.startsWith('HTTP ')) return err.message;
  }

  // Error de red
  if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: string }).message === 'string'
  ) {
    const msg = (err as { message: string }).message;
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('Network')) {
      return 'Error de conexión. Verifica tu internet.';
    }
  }

  return (err as { message?: string })?.message || 'Error desconocido. Intenta de nuevo.';
}

/**
 * Build image URL with cache-busting parameter
 * Fixes Windows WebView2 aggressive caching issues where uploaded images
 * don't appear until app restart
 *
 * @param imageUrl - Relative or absolute image URL
 * @param cacheBuster - Optional cache buster timestamp (defaults to session start time)
 * @returns Full URL with cache-busting parameter
 */
let sessionCacheBuster = Date.now();

export function getImageUrlWithCacheBust(imageUrl: string | null | undefined, forceFresh: boolean = false): string {
  if (!imageUrl) return '';

  const apiUrl = useConfigStore.getState().apiUrl;
  const baseUrl = imageUrl.startsWith('http') ? imageUrl : `${apiUrl}${imageUrl}`;

  // Use fresh timestamp for newly uploaded images, session timestamp for existing
  const cacheBuster = forceFresh ? Date.now() : sessionCacheBuster;
  const separator = baseUrl.includes('?') ? '&' : '?';

  return `${baseUrl}${separator}cb=${cacheBuster}`;
}

/**
 * Refresh the session cache buster (call after uploading new images)
 */
export function refreshImageCache(): void {
  sessionCacheBuster = Date.now();
}

export default apiClient;
