/**
 * Environment Configuration
 *
 * Manages API endpoints for different deployment scenarios:
 * - LOCAL: Development on same machine
 * - LAN: Testing across machines on local network
 * - CLOUD: Production deployment
 */

export const ENVIRONMENTS = {
  LOCAL: 'http://127.0.0.1:8001',  // Use IP instead of localhost for Tauri compatibility
  LAN: 'http://192.168.18.48:8000',  // Mac's IP on local network
  CLOUD: 'https://api.yourdomain.com',   // Production API
} as const;

export type EnvironmentKey = keyof typeof ENVIRONMENTS;

export const ENVIRONMENT_LABELS: Record<EnvironmentKey, string> = {
  LOCAL: 'Mi computadora',
  LAN: 'Red de la tienda',
  CLOUD: 'Internet',
};

export const ENVIRONMENT_DESCRIPTIONS: Record<EnvironmentKey, string> = {
  LOCAL: 'Para pruebas en este equipo',
  LAN: 'Conexión dentro de la tienda',
  CLOUD: 'Conexión desde cualquier lugar',
};

/**
 * Get the default environment based on build mode
 */
export function getDefaultEnvironment(): string {
  // Check if running in dev mode
  if (import.meta.env.DEV) {
    return ENVIRONMENTS.LOCAL;
  }

  // In production, check if there's an env variable
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    return apiUrl;
  }

  // Default to cloud in production
  return ENVIRONMENTS.CLOUD;
}

/**
 * Validate if a URL is accessible (basic format check)
 */
export function isValidApiUrl(url: string): boolean {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
}
