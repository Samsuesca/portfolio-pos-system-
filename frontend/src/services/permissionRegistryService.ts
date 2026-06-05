/**
 * Permission Registry Service — Single Source of Truth
 *
 * Fetches the permission catalog from the backend registry endpoint
 * and caches it in localStorage. Frontends use this instead of
 * hardcoded SYSTEM_ROLE_PERMISSIONS maps.
 */
import apiClient from '../utils/api-client';

const STORAGE_KEY = 'permission_registry';
const STORAGE_VERSION_KEY = 'permission_registry_version';

export interface PermissionRegistryItem {
  code: string;
  category: string;
  name: string;
  description: string | null;
  is_sensitive: boolean;
}

export interface PermissionRegistry {
  permissions: PermissionRegistryItem[];
  system_roles: Record<string, string[] | null>;
  role_constraints: Record<string, Record<string, Record<string, unknown>>>;
  role_max_discount: Record<string, number>;
  version: string;
}

let _memoryCache: PermissionRegistry | null = null;

function loadFromStorage(): PermissionRegistry | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PermissionRegistry;
  } catch {
    return null;
  }
}

function saveToStorage(registry: PermissionRegistry): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
    localStorage.setItem(STORAGE_VERSION_KEY, registry.version);
  } catch {
    // localStorage full or unavailable — memory cache still works
  }
}

export function getStoredVersion(): string | null {
  return localStorage.getItem(STORAGE_VERSION_KEY);
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
  if (perms === null) return new Set(); // owner — handled specially
  if (!perms) return new Set();
  return new Set(perms);
}

export function getRoleMaxDiscount(role: string): number {
  const registry = getCachedRegistry();
  if (!registry) return 0;
  return registry.role_max_discount[role] ?? 0;
}

export function isOwnerRole(role: string): boolean {
  const registry = getCachedRegistry();
  if (!registry) return role === 'owner';
  return registry.system_roles[role] === null;
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
    const currentVersion = getStoredVersion();
    if (registry.version !== currentVersion) {
      _memoryCache = registry;
      saveToStorage(registry);
    }
  } catch {
    // Silent fail — cached version is fine
  }
}
