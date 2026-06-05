/**
 * Permission Registry Service for Admin Portal
 *
 * Fetches and caches the permission registry from the backend.
 */
import apiClient from '../api';

const STORAGE_KEY = 'permission_registry';
const STORAGE_VERSION_KEY = 'permission_registry_version';

export interface PermissionRegistry {
  permissions: { code: string; category: string; name: string; is_sensitive: boolean }[];
  system_roles: Record<string, string[] | null>;
  role_constraints: Record<string, Record<string, Record<string, unknown>>>;
  role_max_discount: Record<string, number>;
  version: string;
}

let _memoryCache: PermissionRegistry | null = null;

function loadFromStorage(): PermissionRegistry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PermissionRegistry;
  } catch {
    return null;
  }
}

function saveToStorage(registry: PermissionRegistry): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
    localStorage.setItem(STORAGE_VERSION_KEY, registry.version);
  } catch {
    // localStorage full or unavailable
  }
}

export function getCachedRegistry(): PermissionRegistry | null {
  if (_memoryCache) return _memoryCache;
  const stored = loadFromStorage();
  if (stored) {
    _memoryCache = stored;
  }
  return stored;
}

export function getSystemRolePermissions(role: string): Set<string> {
  const registry = getCachedRegistry();
  if (!registry) return new Set();
  const perms = registry.system_roles[role];
  if (perms === null) return new Set();
  if (!perms) return new Set();
  return new Set(perms);
}

export function getRoleMaxDiscount(role: string): number {
  const registry = getCachedRegistry();
  if (!registry) return 0;
  return registry.role_max_discount[role] ?? 0;
}

export async function fetchPermissionRegistry(): Promise<PermissionRegistry> {
  try {
    const response = await apiClient.get<PermissionRegistry>('/permissions/registry');
    const registry = response.data;
    _memoryCache = registry;
    saveToStorage(registry);
    return registry;
  } catch {
    const cached = getCachedRegistry();
    if (cached) return cached;
    throw new Error('No se pudo cargar el registro de permisos');
  }
}

interface PermissionsRefreshResponse {
  status: 'current' | 'stale';
  permissions_version?: number;
  school_roles?: unknown[];
}

export async function checkPermissionsRefresh(currentVersion: number): Promise<PermissionsRefreshResponse | null> {
  try {
    const response = await apiClient.get<PermissionsRefreshResponse>(
      `/auth/permissions-refresh?version=${currentVersion}`
    );
    return response.data;
  } catch {
    return null;
  }
}

export async function refreshRegistryIfStale(): Promise<void> {
  try {
    const response = await apiClient.get<PermissionRegistry>('/permissions/registry');
    const registry = response.data;
    const currentVersion = typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_VERSION_KEY)
      : null;
    if (registry.version !== currentVersion) {
      _memoryCache = registry;
      saveToStorage(registry);
    }
  } catch {
    // Silent fail
  }
}
