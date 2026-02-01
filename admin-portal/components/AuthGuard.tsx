'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/adminAuth';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAdminAuth();
  const [isChecking, setIsChecking] = useState(true);
  const hasChecked = useRef(false);

  useEffect(() => {
    // Only run once
    if (hasChecked.current) return;
    hasChecked.current = true;

    const verify = async () => {
      console.log('[AuthGuard] Starting auth verification');
      const isValid = await checkAuth();
      console.log('[AuthGuard] Auth verification result:', isValid);
      if (!isValid) {
        console.log('[AuthGuard] Not authenticated, redirecting to /login');
        router.push('/login');
      }
      setIsChecking(false);
    };

    verify();
  }, []); // Empty deps - run only once on mount

  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-brand-500"></div>
          <p className="mt-4 text-slate-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
