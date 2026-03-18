import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Crear Cuenta',
  description: 'Registrate para realizar pedidos de uniformes escolares online.',
};

export default function RegistroLayout({ children }: { children: React.ReactNode }) {
  return children;
}
