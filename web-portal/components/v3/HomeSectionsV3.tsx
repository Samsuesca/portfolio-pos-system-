/**
 * Secciones home v3 — Encargos, Pago (Wompi), Ayuda.
 *
 * Replican 1:1 las features del HomePageClient viejo (cards "Encargos Personalizados",
 * "Pago en Linea con Wompi", "Necesitas ayuda?") con la tipografia y ritmo
 * editorial de v3. Sin claims inventados, solo lo verificable.
 */
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  HelpCircle,
  MessageCircle,
  Package,
  Shield,
} from "lucide-react";
import type { BusinessInfo } from "@/lib/businessInfo";
import { Eyebrow } from "./primitives/Eyebrow";

// ---------- ENCARGOS PERSONALIZADOS ---------- //

export function EncargosBannerV3({
  href = "/encargos-personalizados",
}: {
  href?: string;
}): React.JSX.Element {
  return (
    <section className="bg-surface-100 py-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href={href}
          className="group flex items-center gap-6 bg-surface-50 border border-stone-200/70 rounded-2xl p-6 lg:p-8 hover:border-stone-900/30 hover:shadow-md transition-all duration-200"
        >
          <div className="shrink-0 w-14 h-14 lg:w-16 lg:h-16 rounded-xl bg-brand-50 border border-brand-200/60 flex items-center justify-center">
            <Package size={26} strokeWidth={1.5} className="text-brand-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <h3
                className="font-editorial font-medium text-stone-900 text-xl lg:text-2xl leading-tight tracking-[-0.02em]"
                style={{ fontVariationSettings: '"opsz" 72' }}
              >
                Encargos personalizados
              </h3>
              <span className="text-[10px] font-mono font-semibold tracking-[0.14em] text-brand-700 uppercase bg-brand-50 border border-brand-200/60 px-2 py-0.5 rounded">
                A medida
              </span>
            </div>
            <p className="text-sm lg:text-[15px] text-stone-600">
              Confeccion bajo medida cuando tu talla o requisito no esta en
              catalogo.
            </p>
          </div>
          <ArrowRight
            size={20}
            strokeWidth={1.75}
            className="shrink-0 text-stone-400 group-hover:text-stone-900 group-hover:translate-x-0.5 transition-all duration-200"
          />
        </Link>
      </div>
    </section>
  );
}

// ---------- PAGO EN LINEA (WOMPI) ---------- //

// Cards de metodos de pago: usan logos reales de cada marca (SVG en
// /public/payment-brands/). Para Tarjetas mostramos Visa + Mastercard juntos
// porque ambos llegan via el mismo metodo Wompi (tarjeta credito/debito).
type PaymentBrand =
  | { kind: "double"; name: string; desc: string; logos: { src: string; alt: string; w: number; h: number }[] }
  | { kind: "single"; name: string; desc: string; logo: { src: string; alt: string; w: number; h: number } };

const PAYMENT_METHODS: PaymentBrand[] = [
  {
    kind: "double",
    name: "Tarjetas",
    desc: "Credito o debito",
    logos: [
      { src: "/payment-brands/visa.svg", alt: "Visa", w: 56, h: 18 },
      { src: "/payment-brands/mastercard.svg", alt: "Mastercard", w: 32, h: 20 },
    ],
  },
  {
    kind: "single",
    name: "PSE",
    desc: "Debito bancario",
    logo: { src: "/payment-brands/pse.svg", alt: "PSE", w: 48, h: 20 },
  },
  {
    kind: "single",
    name: "Nequi",
    desc: "Desde la app",
    logo: { src: "/payment-brands/nequi.svg", alt: "Nequi", w: 64, h: 22 },
  },
  {
    kind: "single",
    name: "Daviplata",
    desc: "Desde la app",
    logo: { src: "/payment-brands/daviplata.svg", alt: "DaviPlata", w: 88, h: 20 },
  },
  {
    kind: "single",
    name: "Bancolombia",
    desc: "QR / transferencia",
    logo: { src: "/payment-brands/bancolombia.svg", alt: "Bancolombia", w: 110, h: 22 },
  },
];

export function PaymentSectionV3({
  whatsappNumber,
}: {
  whatsappNumber?: string | null;
}): React.JSX.Element {
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hola, tengo una consulta sobre el pago de mi pedido")}`
    : null;

  return (
    <section className="bg-stone-900 text-stone-50 py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-16 lg:items-start">
          <div>
            <Eyebrow dark>Pago en linea</Eyebrow>
            <h2
              className="mt-5 font-editorial font-medium text-stone-50 tracking-[-0.025em] leading-[1.05] text-4xl sm:text-5xl"
              style={{ fontVariationSettings: '"opsz" 120' }}
            >
              Pagas con{" "}
              <em className="italic font-normal text-brand-400">Wompi</em>.
            </h2>
            <p className="mt-6 text-base lg:text-lg leading-relaxed text-stone-300 max-w-md">
              Conexion encriptada SSL. Procesado y resguardado por Wompi.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/pago"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-brand-500 text-white font-medium text-sm border border-brand-500 hover:bg-brand-600 transition-all"
              >
                Ver como pagar
                <ArrowRight size={16} strokeWidth={1.75} />
              </Link>
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-transparent text-stone-50 font-medium text-sm border border-white/20 hover:bg-white/5 hover:border-white/40 transition-all"
                >
                  <MessageCircle size={15} strokeWidth={1.75} />
                  Consultas por WhatsApp
                </a>
              )}
            </div>

            <div className="mt-7 flex items-center gap-5 text-[11px] font-mono font-medium tracking-[0.14em] uppercase text-stone-400">
              <span className="inline-flex items-center gap-1.5">
                <Shield size={12} strokeWidth={2} /> SSL
              </span>
              <span className="w-px h-3 bg-white/15" />
              <span>Procesado por Wompi</span>
            </div>
          </div>

          {/* Payment method grid con logos reales de cada marca */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PAYMENT_METHODS.map((m) => (
              <div
                key={m.name}
                className="flex flex-col p-5 rounded-xl bg-white border border-white/10 min-h-[110px]"
              >
                <div className="flex items-center gap-2.5 h-7 mb-3">
                  {m.kind === "double"
                    ? m.logos.map((l) => (
                        <Image
                          key={l.src}
                          src={l.src}
                          alt={l.alt}
                          width={l.w}
                          height={l.h}
                          style={{ height: l.h, width: "auto" }}
                        />
                      ))
                    : (
                        <Image
                          src={m.logo.src}
                          alt={m.logo.alt}
                          width={m.logo.w}
                          height={m.logo.h}
                          style={{ height: m.logo.h, width: "auto" }}
                        />
                      )}
                </div>
                <span className="text-xs text-stone-500 mt-auto">{m.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- AYUDA ---------- //

export function HelpSectionV3({
  businessInfo,
}: {
  businessInfo: BusinessInfo | null;
}): React.JSX.Element {
  const whatsappNumber = businessInfo?.whatsapp_number;
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hola, necesito informacion sobre uniformes")}`
    : null;

  return (
    <section className="bg-surface-100 py-20 lg:py-24 border-t border-stone-200/60">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Eyebrow>Soporte</Eyebrow>
        <h2
          className="mt-5 font-editorial font-medium text-stone-900 tracking-[-0.025em] leading-[1.05] text-4xl sm:text-5xl"
          style={{ fontVariationSettings: '"opsz" 120' }}
        >
          Te ayudamos{" "}
          <em className="italic font-normal text-brand-600">por WhatsApp</em>.
        </h2>
        <p className="mt-6 text-base lg:text-lg leading-relaxed text-stone-600 max-w-xl mx-auto">
          {businessInfo?.hours_weekday ?? "Lunes a Viernes 8:00 AM - 6:00 PM"}
          {businessInfo?.hours_saturday
            ? ` · ${businessInfo.hours_saturday.replace("Sábados:", "Sab")}`
            : ""}
          .
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-brand-500 text-white font-medium text-sm border border-brand-500 hover:bg-brand-600 transition-all"
            >
              <MessageCircle size={16} strokeWidth={1.75} />
              Escribir por WhatsApp
            </a>
          )}
          <Link
            href="/soporte"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-transparent text-stone-700 font-medium text-sm border border-stone-300 hover:bg-surface-200 hover:text-stone-900 hover:border-stone-400 transition-all"
          >
            <HelpCircle size={16} strokeWidth={1.75} />
            Centro de soporte
          </Link>
        </div>
      </div>
    </section>
  );
}
