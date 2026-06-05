/**
 * Hook that periodically checks if the user's permissions changed on the backend
 * and refreshes them without requiring re-login.
 *
 * Mount this once in the app layout (e.g., Layout.tsx).
 */
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { checkPermissionsRefresh } from '../services/permissionRegistryService';

const REFRESH_INTERVAL_MS = 60_000; // 60 seconds

export function usePermissionsRefresh(): void {
  const { user, isAuthenticated } = useAuthStore();
  const updateUser = useAuthStore((s) => s.updateUser);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const check = async () => {
      const version = user.permissions_version ?? 0;
      const result = await checkPermissionsRefresh(version);
      if (result && result.status === 'stale' && result.school_roles) {
        updateUser({
          permissions_version: result.permissions_version,
          school_roles: result.school_roles,
        } as Partial<typeof user>);
      }
    };

    intervalRef.current = setInterval(check, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAuthenticated, user?.permissions_version]);
}
