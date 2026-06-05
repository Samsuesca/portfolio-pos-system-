"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, MessageCircle, Search, X } from "lucide-react";
import type { School } from "@/lib/api";
import type { ProductGroup } from "@/lib/types";
import { ProductCardV3 } from "./ProductCardV3";
import { Eyebrow } from "./primitives/Eyebrow";
import { Button } from "./primitives/Button";
import { cn } from "@/lib/cn";
import {
  extractCategories,
  productMatchesCategory,
} from "@/app/[school_slug]/utils/categorization";

interface CatalogClientV3Props {
  school: School;
  productGroups: ProductGroup[];
  basePath?: string;
  whatsappNumber?: string | null;
}

const COLOR_FALLBACK = "#A8A29E";

/**
 * Deriva tallas unicas de un set de ProductGroups (cada uno con `variants`).
 * Reutiliza la logica de normalizacion (case + tipo) que vivia en
 * `utils/categorization.ts::extractSizes` pero adaptada al modelo ProductGroup.
 */
function extractSizesFromGroups(groups: ProductGroup[]): string[] {
  const canonicalByKey = new Map<string, string>();
  groups.forEach((g) => {
    g.variants.forEach((v) => {
      if (!v.size || v.size === "Única") return;
      const trimmed = v.size.trim();
      const key = trimmed.toLowerCase();
      if (canonicalByKey.has(key)) return;
      // Tallas cortas tipo letra (S/M/L/XL/XXL) en mayuscula; descriptivas en Title.
      const isShortAlpha = /^[A-Za-z]{1,4}$/.test(trimmed);
      canonicalByKey.set(
        key,
        isShortAlpha
          ? trimmed.toUpperCase()
          : trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase(),
      );
    });
  });
  // Numeros < rangos (4-6) < letras, dentro de cada bucket sort natural.
  return Array.from(canonicalByKey.values()).sort((a, b) => {
    const aNum = /^\d+$/.test(a);
    const bNum = /^\d+$/.test(b);
    if (aNum && bNum) return parseInt(a) - parseInt(b);
    if (aNum) return -1;
    if (bNum) return 1;
    const aRange = /^\d+-\d+$/.test(a);
    const bRange = /^\d+-\d+$/.test(b);
    if (aRange && bRange) return parseInt(a) - parseInt(b);
    if (aRange) return -1;
    if (bRange) return 1;
    return a.localeCompare(b);
  });
}

export function CatalogClientV3({
  school,
  productGroups,
  basePath = "/",
  whatsappNumber,
}: CatalogClientV3Props): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sizeFilter, setSizeFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
  const [sizeOpen, setSizeOpen] = useState(false);
  const sizeMenuRef = useRef<HTMLDivElement>(null);

  // Tabs de categoria: derivamos del catalogo del colegio + 'Otros' para globales.
  // Como el modelo nuevo agrupa por garment_type, pasamos los grupos donde
  // `isGlobal === false` como "schoolProducts" y los `isGlobal === true` como globals.
  const categories = useMemo(() => {
    const school = productGroups.filter((g) => !g.isGlobal).map((g) => ({ name: g.name }));
    const global = productGroups.filter((g) => g.isGlobal).map((g) => ({ name: g.name }));
    return extractCategories(school, global);
  }, [productGroups]);

  // Filtrado encadenado: search -> categoria -> talla. El orden importa
  // porque las tallas disponibles deben derivarse del SUBSET visible (no del
  // catalogo completo) — si filtras "Camisas", solo te aparecen tallas de
  // camisas. Asi el filtro Talla nunca muestra opciones sin resultados.
  const matchesSearch = (g: ProductGroup): boolean => {
    if (!query.trim()) return true;
    return g.name.toLowerCase().includes(query.toLowerCase());
  };
  const matchesCategory = (g: ProductGroup): boolean =>
    productMatchesCategory(g.name, categoryFilter, g.isGlobal);
  // Las prendas unisex (o sin genero etiquetado) aplican a ambos: aparecen tanto
  // en "Niño" como en "Niña". Solo se excluyen las que tienen el genero opuesto.
  const matchesGender = (g: ProductGroup): boolean => {
    if (genderFilter === "all") return true;
    const hasMale = g.genders.includes("male");
    const hasFemale = g.genders.includes("female");
    const appliesToBoth = !hasMale && !hasFemale;
    return genderFilter === "male"
      ? hasMale || appliesToBoth
      : hasFemale || appliesToBoth;
  };
  const matchesSize = (g: ProductGroup): boolean => {
    if (sizeFilter === "all") return true;
    return g.variants.some(
      (v) => v.size?.toLowerCase() === sizeFilter.toLowerCase(),
    );
  };

  // El filtro de genero solo es util si el catalogo tiene prendas de niño Y de
  // niña etiquetadas. Si todo es unisex/sin etiquetar, no renderizamos el filtro
  // (seria UI decorativa). Ver normalizeGender en lib/types.
  const hasGenderedCatalog = useMemo(() => {
    let male = false;
    let female = false;
    for (const g of productGroups) {
      if (g.genders.includes("male")) male = true;
      if (g.genders.includes("female")) female = true;
      if (male && female) return true;
    }
    return false;
  }, [productGroups]);

  const afterCoarseFilters = useMemo(
    () =>
      productGroups.filter(
        (g) => matchesSearch(g) && matchesCategory(g) && matchesGender(g),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productGroups, query, categoryFilter, genderFilter],
  );

  const sizesAvailable = useMemo(
    () => extractSizesFromGroups(afterCoarseFilters),
    [afterCoarseFilters],
  );

  const filtered = useMemo(
    () => afterCoarseFilters.filter(matchesSize),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [afterCoarseFilters, sizeFilter],
  );

  // Click-outside del dropdown de talla.
  useEffect(() => {
    if (!sizeOpen) return;
    function onClick(e: MouseEvent): void {
      if (!sizeMenuRef.current?.contains(e.target as Node)) setSizeOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [sizeOpen]);

  const hasActiveFilters =
    categoryFilter !== "all" || sizeFilter !== "all" || query !== "" || genderFilter !== "all";

  const bannerColor = school.primary_color || COLOR_FALLBACK;
  const wahref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=Hola,%20quiero%20consultar%20por%20uniformes%20de%20${encodeURIComponent(school.name)}`
    : null;

  return (
    <section className="bg-surface-100 min-h-screen">
      {/* School banner */}
      <div
        className="relative overflow-hidden text-white"
        style={{ background: bannerColor }}
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.15), transparent 55%)",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-14">
          <Link
            href={basePath}
            className="inline-flex items-center gap-2 text-sm font-medium text-white/75 hover:text-white transition-colors mb-7"
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            Todos los colegios
          </Link>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 lg:gap-8">
            <div>
              <div className="text-[11px] font-mono font-semibold tracking-[0.2em] uppercase text-white/70 mb-3">
                Colegio · {school.code ?? school.slug}
              </div>
              <h1
                className="font-editorial font-medium text-white tracking-[-0.03em] leading-[0.95] text-4xl sm:text-5xl lg:text-6xl"
                style={{ fontVariationSettings: '"opsz" 144' }}
              >
                {school.name}
              </h1>
              <div className="mt-3 text-sm sm:text-base text-white/75">
                {productGroups.length} prenda{productGroups.length === 1 ? "" : "s"} en catálogo
              </div>
            </div>
            {wahref && (
              <a
                href={wahref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium border border-brand-500 hover:bg-brand-600 transition-all duration-200 shrink-0"
              >
                <MessageCircle size={15} strokeWidth={1.75} />
                Asesora del colegio
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Sticky filter bar: search + categorias + talla */}
      <div className="sticky top-16 z-30 bg-[rgba(250,248,242,0.92)] backdrop-blur-md border-b border-stone-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Fila 1: search + count + dropdown talla */}
          <div className="py-3.5 flex items-center gap-3">
            <div className="flex-1 max-w-md relative">
              <Search
                size={16}
                strokeWidth={1.75}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar prenda..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-white border border-stone-200 placeholder:text-stone-400 focus:outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-400/20 transition-all"
              />
            </div>

            {/* Dropdown de talla. Solo mostramos sizes derivadas del subset visible. */}
            <div className="relative" ref={sizeMenuRef}>
              <button
                type="button"
                onClick={() => setSizeOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={sizeOpen}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition-all",
                  sizeFilter === "all"
                    ? "bg-white text-stone-700 border-stone-200 hover:border-stone-300"
                    : "bg-stone-900 text-white border-stone-900",
                )}
              >
                {sizeFilter === "all" ? "Talla" : `T. ${sizeFilter}`}
                <ChevronDown size={14} strokeWidth={2} className={cn("transition-transform", sizeOpen && "rotate-180")} />
              </button>
              {sizeOpen && (
                <div
                  role="listbox"
                  className="absolute right-0 top-full mt-2 min-w-[160px] max-h-[280px] overflow-y-auto bg-white border border-stone-200 rounded-lg shadow-lg py-1.5 animate-scale-in"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={sizeFilter === "all"}
                    onClick={() => { setSizeFilter("all"); setSizeOpen(false); }}
                    className={cn(
                      "w-full text-left px-4 py-2 text-sm transition-colors",
                      sizeFilter === "all"
                        ? "bg-brand-50 text-brand-700 font-semibold"
                        : "text-stone-700 hover:bg-stone-50",
                    )}
                  >
                    Todas las tallas
                  </button>
                  {sizesAvailable.length === 0 ? (
                    <div className="px-4 py-2 text-xs text-stone-400">Sin tallas en este filtro</div>
                  ) : (
                    sizesAvailable.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="option"
                        aria-selected={sizeFilter === s}
                        onClick={() => { setSizeFilter(s); setSizeOpen(false); }}
                        className={cn(
                          "w-full text-left px-4 py-2 text-sm transition-colors tabular-nums",
                          sizeFilter === s
                            ? "bg-brand-50 text-brand-700 font-semibold"
                            : "text-stone-700 hover:bg-stone-50",
                        )}
                      >
                        Talla {s}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="ml-auto text-xs font-mono font-medium tracking-wider uppercase text-stone-500 hidden sm:block">
              {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
            </div>
          </div>

          {/* Fila 2: pills de genero (si aplica) + categoria (scroll horizontal en mobile) */}
          {(hasGenderedCatalog || categories.length > 1) && (
            <div className="pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-1.5 min-w-max">
                {hasGenderedCatalog && (
                  <>
                    <span className="text-[11px] font-mono font-semibold tracking-wider uppercase text-stone-400 mr-0.5 shrink-0">
                      Para
                    </span>
                    {([
                      ["all", "Todos"],
                      ["male", "Niño"],
                      ["female", "Niña"],
                    ] as const).map(([val, label]) => {
                      const active = genderFilter === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setGenderFilter(val)}
                          className={cn(
                            "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
                            active
                              ? "bg-brand-600 text-white border-brand-600"
                              : "bg-white text-stone-600 border-stone-200 hover:border-stone-400 hover:text-stone-900",
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                    {categories.length > 1 && (
                      <span className="w-px h-5 bg-stone-200 mx-1.5 shrink-0" />
                    )}
                  </>
                )}
                {categories.length > 1 && categories.map((cat) => {
                  const active = categoryFilter === cat;
                  const label = cat === "all" ? "Todos" : cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
                        active
                          ? "bg-stone-900 text-white border-stone-900"
                          : "bg-white text-stone-600 border-stone-200 hover:border-stone-400 hover:text-stone-900",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => { setCategoryFilter("all"); setSizeFilter("all"); setQuery(""); setGenderFilter("all"); }}
                    className="ml-2 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
                    aria-label="Limpiar filtros"
                  >
                    <X size={12} strokeWidth={2} />
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <Eyebrow>Sin resultados</Eyebrow>
            <h3
              className="mt-4 font-editorial text-stone-700 text-2xl"
              style={{ fontVariationSettings: '"opsz" 72' }}
            >
              {query
                ? <>No encontramos prendas con &ldquo;{query}&rdquo;</>
                : "Ningun producto coincide con los filtros activos"}
            </h3>
            <Button
              variant="ghost"
              size="md"
              className="mt-6"
              onClick={() => { setQuery(""); setCategoryFilter("all"); setSizeFilter("all"); setGenderFilter("all"); }}
            >
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 lg:gap-6">
            {filtered.map((group) => (
              <ProductCardV3
                key={group.garmentTypeId}
                group={group}
                detailHref={`${basePath}${school.slug}/${group.garmentTypeId}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
