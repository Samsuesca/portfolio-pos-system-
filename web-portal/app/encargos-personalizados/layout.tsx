import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Encargos Personalizados',
  description: 'Crea uniformes a medida con tallas y especificaciones unicas para tu colegio en Medellin.',
  alternates: {
    canonical: '/encargos-personalizados',
  },
};

export default function EncargosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
