'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bug, Lightbulb, MessageCircleQuestion, Sparkles } from 'lucide-react';
import { detectParentPortalPlatform, openFeedbackForm, type FeedbackTemplate } from '@/lib/feedback';
import { SYSTEM_VERSION } from '@/lib/version';

function pathToSection(pathname: string): string | undefined {
  if (pathname.startsWith('/pago')) return 'Pasarela de pago Wompi (padres)';
  if (pathname.startsWith('/mi-cuenta')) return 'Mi cuenta (padres)';
  if (pathname.startsWith('/encargos-personalizados')) return 'Encargos personalizados (padres)';
  if (pathname.startsWith('/soporte')) return 'Soporte (padres)';
  if (pathname.startsWith('/registro')) return 'Login / Autenticacion';
  if (pathname.startsWith('/activar-cuenta')) return 'Login / Autenticacion';
  if (pathname.startsWith('/recuperar-password')) return 'Login / Autenticacion';
  if (pathname === '/' || pathname.length > 1) return 'Catalogo por colegio (padres)';
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
  { template: 'bug_report', label: 'Reportar un problema', description: 'Algo no funciona como deberia', icon: Bug, iconColor: 'text-red-500' },
  { template: 'feature_request', label: 'Sugerir mejora', description: 'Algo que falta o podria mejorar', icon: Lightbulb, iconColor: 'text-amber-500' },
  { template: 'ux_feedback', label: 'Feedback de uso', description: 'Algo confuso, feo o lento', icon: Sparkles, iconColor: 'text-purple-500' },
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
      section: pathToSection(pathname || '/'),
      platform: detectParentPortalPlatform(),
      appVersion: `v${SYSTEM_VERSION}`,
    });
  };

  return (
    <div ref={containerRef} className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40">
      {open && (
        <div className="absolute bottom-14 right-0 w-72 bg-white rounded-xl shadow-xl border border-stone-200 py-2">
          <div className="px-3 py-2 border-b border-stone-100">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              Reportar / Sugerir
            </p>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Se abre un formulario en GitHub
            </p>
          </div>
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.template}
                onClick={() => handleSelect(opt.template)}
                className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-stone-50 transition-colors"
              >
                <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${opt.iconColor}`} />
                <div>
                  <p className="text-sm font-medium text-stone-800">{opt.label}</p>
                  <p className="text-xs text-stone-500">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-700 hover:bg-amber-800 text-white shadow-lg transition-colors"
        title="Reportar problema o sugerencia"
        aria-label="Reportar problema o sugerencia"
      >
        <MessageCircleQuestion className="w-6 h-6" />
      </button>
    </div>
  );
}
