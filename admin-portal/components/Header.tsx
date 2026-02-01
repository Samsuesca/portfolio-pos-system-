'use client';

import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';

const pathNames: Record<string, string> = {
  '/': 'Dashboard',
  '/sales': 'Ventas',
  '/orders': 'Encargos',
  '/schools': 'Colegios',
  '/users': 'Usuarios',
  '/payment-accounts': 'Cuentas de Pago',
  '/delivery-zones': 'Zonas de Entrega',
  '/products': 'Productos',
  '/products/global': 'Productos Globales',
  '/accounting': 'Contabilidad',
};

export default function Header() {
  const pathname = usePathname();

  // Build breadcrumbs
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/');
    const name = pathNames[path] || segment;
    const isLast = index === segments.length - 1;

    return { path, name, isLast };
  });

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/" className="text-slate-500 hover:text-slate-700">
          <Home className="w-4 h-4" />
        </Link>

        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.path} className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-slate-400" />
            {crumb.isLast ? (
              <span className="font-medium text-slate-900">{crumb.name}</span>
            ) : (
              <Link
                href={crumb.path}
                className="text-slate-500 hover:text-slate-700"
              >
                {crumb.name}
              </Link>
            )}
          </div>
        ))}

        {breadcrumbs.length === 0 && (
          <>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <span className="font-medium text-slate-900">Dashboard</span>
          </>
        )}
      </div>
    </header>
  );
}
