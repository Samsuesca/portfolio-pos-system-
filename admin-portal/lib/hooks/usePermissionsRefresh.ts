/**
 * Hook que revisa periodicamente si los permisos del usuario cambiaron en
 * el backend y los refresca sin requerir re-login.
 *
 * Montar una sola vez en un client-side wrapper del root layout.
 */
'use client';

import { useEffect, useRef } from 'react';
import { useAdminAuth, type User } from '../adminAuth';
import { checkPermissionsRefresh } from '../services/permissionRegistryService';

const REFRESH_INTERVAL_MS = 60_000;

export function usePermissionsRefresh(): void {
  const user = useAdminAuth((s) => s.user);
  const isAuthenticated = useAdminAuth((s) => s.isAuthenticated);
  const updateUser = useAdminAuth((s) => s.updateUser);
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
          school_roles: result.school_roles as User['school_roles'],
        });
      }
    };

    intervalRef.current = setInterval(check, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAuthenticated, user?.permissions_version]);
}
