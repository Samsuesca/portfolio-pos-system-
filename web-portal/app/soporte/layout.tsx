import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Centro de Soporte',
  description: 'Contactanos por cualquier consulta sobre uniformes, pedidos o soporte tecnico. PQRS.',
};

export default function SoporteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
