import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { School } from "@/lib/api";
import { API_BASE_URL } from "@/lib/api";
import { Eyebrow } from "./primitives/Eyebrow";

interface SchoolPickerV3Props {
  schools: School[];
  /** Override the per-school link prefix (e.g. "/v3-preview/") */
  basePath?: string;
  /** Optional map of school slug -> product count for "N prendas" display */
  productCounts?: Record<string, number>;
}

/**
 * Backend devuelve logo_url como path relativo (`/uploads/school-logos/<uuid>.ext`).
 * Lo absolutizamos contra el API porque el browser lo resuelve contra :3001.
 */
function absoluteLogoUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) return logoUrl;
  return `${API_BASE_URL}${logoUrl.startsWith("/") ? "" : "/"}${logoUrl}`;
}

const COLOR_FALLBACK = "#A8A29E"; // stone-400

/**
 * "Institución Educativa Juan De La Cruz Posada" -> "JC"
 * "Comfama" -> "CO"
 * Uses initials of significant words (drops "institución/educativa/jardín/de/la/y").
 */
function monogramFor(name: string): string {
  const STOPWORDS = new Set([
    "institucion",
    "institución",
    "educativa",
    "educativo",
    "jardin",
    "jardín",
    "infantil",
    "de",
    "del",
    "la",
    "el",
    "y",
  ]);
  const tokens = name
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}]/gu, ""))
    .filter((t) => t && !STOPWORDS.has(t.toLowerCase()));
  if (tokens.length === 0) return name.slice(0, 2).toUpperCase();
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[1][0]).toUpperCase();
}

export function SchoolPickerV3({
  schools,
  basePath = "/",
  productCounts,
}: SchoolPickerV3Props): React.JSX.Element {
  const activeSchools = schools.filter((s) => s.is_active);

  return (
    <section
      id="schools"
      className="bg-surface-100 py-24 lg:py-32 scroll-mt-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 lg:items-end mb-14 lg:mb-16">
          <div>
            <Eyebrow>Colegios</Eyebrow>
            <h2
              className="mt-5 font-editorial font-medium text-stone-900 tracking-[-0.025em] leading-[1.05] text-4xl sm:text-5xl lg:text-[56px]"
              style={{ fontVariationSettings: '"opsz" 120' }}
            >
              Elige tu{" "}
              <em className="italic font-normal text-brand-600">colegio</em>.
            </h2>
          </div>
          <div className="lg:pb-2">
            <p className="text-base sm:text-lg leading-relaxed text-stone-600 max-w-md">
              {activeSchools.length} colegios disponibles. Selecciona uno para
              ver el catálogo con tallas, precios y disponibilidad.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {activeSchools.map((s) => {
            const href = `${basePath}${s.slug}`;
            const code = s.code ?? "";
            const count = productCounts?.[s.slug];
            const logoUrl = absoluteLogoUrl(s.logo_url);
            const color = s.primary_color || COLOR_FALLBACK;
            return (
              <Link
                key={s.id}
                href={href}
                className="group relative bg-surface-50 rounded-xl border border-stone-200/70 overflow-hidden hover:border-stone-900/30 hover:shadow-md transition-all duration-200"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-surface-100">
                  {logoUrl ? (
                    // El logo del colegio sobre un fondo neutro le da espacio para
                    // respirar; `contain` evita recortar escudos cuadrados.
                    <div className="absolute inset-0 flex items-center justify-center p-8">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoUrl}
                        alt={`Logo de ${s.name}`}
                        className="max-w-full max-h-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: color }}
                    >
                      <span
                        className="font-editorial font-medium text-white/95 leading-none tracking-[-0.04em] text-[88px]"
                        style={{ fontVariationSettings: '"opsz" 144' }}
                      >
                        {monogramFor(s.name)}
                      </span>
                    </div>
                  )}
                  {/* Thin school-color bar at the top — brand cue sin tapar el logo. */}
                  <span
                    aria-hidden
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ background: color }}
                  />
                  {code && (
                    <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-mono font-semibold tracking-[0.14em] text-stone-700">
                      {code.split("-")[0]}
                    </span>
                  )}
                </div>

                <div className="p-5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3
                      className="font-editorial font-medium text-stone-900 text-lg leading-tight tracking-[-0.02em]"
                      style={{ fontVariationSettings: '"opsz" 48' }}
                    >
                      {s.name}
                    </h3>
                    {typeof count === "number" && (
                      <div className="mt-1 text-xs text-stone-500">
                        {count} prenda{count === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                  <ArrowRight
                    size={18}
                    strokeWidth={1.75}
                    className="mt-0.5 shrink-0 text-stone-400 group-hover:text-stone-900 group-hover:translate-x-0.5 transition-all duration-200"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
