import { ArrowRight, MessageCircle } from "lucide-react";
import type { School } from "@/lib/api";
import type { BusinessInfo } from "@/lib/businessInfo";
import { Eyebrow } from "./primitives/Eyebrow";

interface HeroV3Props {
  businessInfo: BusinessInfo | null;
  schools: School[];
}

const SCHOOL_COLOR_FALLBACK = "#A8A29E"; // stone-400 — neutral when DB has no color

export function HeroV3({ businessInfo, schools }: HeroV3Props): React.JSX.Element {
  const activeSchools = schools.filter((s) => s.is_active);
  const whatsappHref = businessInfo?.whatsapp_number
    ? `https://wa.me/${businessInfo.whatsapp_number}`
    : null;

  return (
    <section className="relative overflow-hidden bg-stone-900 text-stone-50">
      {/* Warm gold wash — atemperado, not full editorial-luxury */}
      <div
        aria-hidden
        className="absolute -top-40 -right-40 w-[640px] h-[640px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(212,175,55,0.16), transparent 65%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 lg:pt-28 lg:pb-32">
        <div className="max-w-3xl">
          <Eyebrow dark>
            Uniformes escolares · {businessInfo?.city ?? "Medellín"}
          </Eyebrow>
          <h1
            className="mt-6 font-editorial font-medium text-stone-50 tracking-[-0.03em] leading-[0.95] text-5xl sm:text-6xl lg:text-7xl xl:text-[88px]"
            style={{ fontVariationSettings: '"opsz" 144' }}
          >
            Uniformes escolares,{" "}
            <em className="italic font-normal text-brand-400">por colegio</em>.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-stone-300">
            Catálogo en línea de {activeSchools.length} colegios aliados en
            {" "}{businessInfo?.city ?? "Medellín"}. Tallas, precios y
            disponibilidad actualizados al día.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="#schools"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-brand-500 text-white font-medium text-sm border border-brand-500 hover:bg-brand-600 hover:-translate-y-px active:translate-y-0 shadow-sm hover:shadow-md transition-all duration-200"
            >
              Ver colegios
              <ArrowRight size={18} strokeWidth={1.75} />
            </a>
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-transparent text-white font-medium text-sm border border-white/20 hover:bg-white/5 hover:border-white/40 transition-all duration-200"
              >
                <MessageCircle size={17} strokeWidth={1.75} />
                Escribir por WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Marquee of real allied schools at the foot */}
      {activeSchools.length > 0 && (
        <div className="border-t border-white/10 py-5 overflow-hidden">
          <div className="flex items-center gap-12 flex-wrap justify-center px-4 sm:px-6 lg:px-8 text-[12px] font-mono font-medium tracking-[0.18em] uppercase text-stone-400">
            {activeSchools.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-3">
                <span
                  aria-hidden
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: s.primary_color || SCHOOL_COLOR_FALLBACK,
                  }}
                />
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
