'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { usePermissionsRefresh } from '../lib/hooks/usePermissionsRefresh';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

function PermissionsRefreshMount({ children }: { children: React.ReactNode }) {
  usePermissionsRefresh();
  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const inner = <PermissionsRefreshMount>{children}</PermissionsRefreshMount>;

  if (!GOOGLE_CLIENT_ID) {
    return inner;
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {inner}
    </GoogleOAuthProvider>
  );
}
