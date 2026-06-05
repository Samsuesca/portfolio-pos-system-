import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Metodos de Pago',
  description: 'Informacion de cuentas bancarias y metodos de pago disponibles para uniformes escolares.',
  alternates: {
    canonical: '/pago',
  },
};

export default function PagoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
