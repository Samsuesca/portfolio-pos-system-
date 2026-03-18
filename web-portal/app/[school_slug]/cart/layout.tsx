import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cotizacion',
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
