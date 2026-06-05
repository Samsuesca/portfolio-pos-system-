import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bug, HelpCircle, Lightbulb, Sparkles } from 'lucide-react';
import { openFeedbackForm, type FeedbackTemplate } from '../utils/feedback';
import { SYSTEM_VERSION } from '../config/version';

function detectPlatform(): string {
  if (typeof window === 'undefined') return 'App escritorio vendedoras (Tauri - Windows)';
  const ua = window.navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'App escritorio vendedoras (Tauri - Mac)';
  return 'App escritorio vendedoras (Tauri - Windows)';
}

function pathToSection(pathname: string): string | undefined {
  if (pathname.startsWith('/sale-changes')) return 'Cambios y devoluciones';
  if (pathname.startsWith('/sales')) return 'Ventas (crear venta)';
  if (pathname.startsWith('/web-orders')) return 'Pedidos web (de padres)';
  if (pathname.startsWith('/orders')) return 'Pedidos / Encargos';
  if (pathname.startsWith('/clients')) return 'Clientes';
  if (pathname.startsWith('/products')) return 'Productos / Catalogo';
  if (pathname.startsWith('/alterations')) return 'Arreglos (alteraciones)';
  if (pathname.startsWith('/accounting')) return 'Contabilidad / Caja';
  if (pathname.startsWith('/cfo')) return 'CFO Dashboard';
  if (pathname.startsWith('/reports')) return 'Reportes';
  if (pathname.startsWith('/payroll')) return 'Nomina';
  if (pathname.startsWith('/workforce')) return 'Personal / Workforce';
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  if (pathname.startsWith('/login')) return 'Login / Autenticacion';
  if (pathname.startsWith('/email-logs')) return 'Email / Notificaciones';
  if (pathname.startsWith('/documents')) return 'Documentos';
  if (pathname.startsWith('/contacts')) return 'Contactos / Proveedores';
  if (pathname.startsWith('/my-profile')) return 'Mi perfil';
  if (pathname.startsWith('/telegram-alerts')) return 'Alertas Telegram';
  if (pathname.startsWith('/payment-accounts')) return 'Cuentas de pago';
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
  {
    template: 'bug_report',
    label: 'Reportar un bug',
    description: 'Algo no funciona como deberia',
    icon: Bug,
    iconColor: 'text-red-500',
  },
  {
    template: 'feature_request',
    label: 'Sugerir mejora',
    description: 'Algo que falta o podria mejorar',
    icon: Lightbulb,
    iconColor: 'text-amber-500',
  },
  {
    template: 'ux_feedback',
    label: 'Feedback de UX',
    description: 'Algo confuso, feo o lento',
    icon: Sparkles,
    iconColor: 'text-purple-500',
  },
];

export function FeedbackButton(): JSX.Element {
  const location = useLocation();
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

  const handleSelect = async (template: FeedbackTemplate) => {
    setOpen(false);
    await openFeedbackForm({
      template,
      section: pathToSection(location.pathname),
      platform: detectPlatform(),
      appVersion: `v${SYSTEM_VERSION}`,
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`p-2 rounded-lg transition-colors ${
          open ? 'bg-primary-100 text-primary-700' : 'hover:bg-surface-100 text-slate-600'
        }`}
        title="Reportar problema o sugerencia"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-stone-200 py-2 z-50">
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
                className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-surface-100 transition-colors"
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
    </div>
  );
}
