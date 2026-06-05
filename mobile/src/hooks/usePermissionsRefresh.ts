/**
 * Hook que revisa periodicamente si los permisos del usuario cambiaron en
 * el backend y los refresca sin requerir re-login.
 *
 * Montar una sola vez en mobile/app/_layout.tsx.
 *
 * Nota: setInterval pausa cuando la app esta en background (iOS/Android).
 * El proximo intervalo despues de volver a foreground refresca el estado.
 */
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { checkPermissionsRefresh } from '../services/permissionRegistryService';
import type { User, UserSchoolRole } from '../types/api';

const REFRESH_INTERVAL_MS = 60_000;

export function usePermissionsRefresh(): void {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
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
          school_roles: result.school_roles as UserSchoolRole[],
        } as Partial<User>);
      }
    };

    intervalRef.current = setInterval(check, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAuthenticated, user?.permissions_version]);
}
