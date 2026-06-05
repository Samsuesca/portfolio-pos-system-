'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bug, Lightbulb, MessageCircleQuestion, Sparkles } from 'lucide-react';
import { openFeedbackForm, type FeedbackTemplate } from '@/lib/feedback';
import { SYSTEM_VERSION } from '@/lib/version';

const PLATFORM = 'Portal admin (web)';

function pathToSection(pathname: string): string | undefined {
  if (pathname.startsWith('/sale-changes')) return 'Cambios y devoluciones';
  if (pathname.startsWith('/sales')) return 'Ventas (crear venta)';
  if (pathname.startsWith('/web-orders')) return 'Pedidos web (de padres)';
  if (pathname.startsWith('/orders')) return 'Pedidos / Encargos';
  if (pathname.startsWith('/clients')) return 'Clientes';
  if (pathname.startsWith('/products')) return 'Productos / Catalogo';
  if (pathname.startsWith('/alterations')) return 'Arreglos (alteraciones)';
  if (pathname.startsWith('/accounting')) return 'Contabilidad / Caja';
  if (pathname.startsWith('/reports')) return 'Reportes';
  if (pathname.startsWith('/payroll')) return 'Nomina';
  if (pathname.startsWith('/workforce')) return 'Personal / Workforce';
  if (pathname.startsWith('/schools')) return 'Multi-tenant (colegios)';
  if (pathname.startsWith('/users')) return 'Sistema de permisos';
  if (pathname.startsWith('/documents')) return 'Documentos';
  if (pathname.startsWith('/contacts')) return 'Contactos / Proveedores';
  if (pathname.startsWith('/delivery-zones')) return 'Pedidos web (de padres)';
  if (pathname.startsWith('/settings')) return 'Sistema de permisos';
  if (pathname === '/' || pathname.startsWith('/dashboard')) return 'Dashboard';
  return undefined;
}

interface FeedbackOption {
  template: FeedbackTemplate;
  label: string;
  description: string;
  icon: typeof Bug;
  iconColor: string;
}

const OPTIONS: FeedbackOption[] = [
  { template: 'bug_report', label: 'Reportar un bug', description: 'Algo no funciona como deberia', icon: Bug, iconColor: 'text-red-500' },
  { template: 'feature_request', label: 'Sugerir mejora', description: 'Algo que falta o podria mejorar', icon: Lightbulb, iconColor: 'text-amber-500' },
  { template: 'ux_feedback', label: 'Feedback de UX', description: 'Algo confuso, feo o lento', icon: Sparkles, iconColor: 'text-purple-500' },
];

export default function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (template: FeedbackTemplate) => {
    setOpen(false);
    openFeedbackForm({
      template,
      section: pathToSection(pathname),
      platform: PLATFORM,
      appVersion: `v${SYSTEM_VERSION}`,
    });
  };

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="absolute bottom-14 right-0 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Reportar / Sugerir
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Se abre un formulario en GitHub
            </p>
          </div>
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.template}
                onClick={() => handleSelect(opt.template)}
                className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
              >
                <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${opt.iconColor}`} />
                <div>
                  <p className="text-sm font-medium text-slate-800">{opt.label}</p>
                  <p className="text-xs text-slate-500">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-colors"
        title="Reportar problema o sugerencia"
      >
        <MessageCircleQuestion className="w-6 h-6" />
      </button>
    </div>
  );
}
