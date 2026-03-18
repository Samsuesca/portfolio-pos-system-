import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mi Cuenta',
  description: 'Accede a tu historial de pedidos y gestiona tu cuenta.',
};

export default function MiCuentaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
