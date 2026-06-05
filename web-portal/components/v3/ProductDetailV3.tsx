"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Minus,
  Plus,
  MessageCircle,
} from "lucide-react";
import type { School } from "@/lib/api";
import type { ProductGroup } from "@/lib/types";
import { useCartStore } from "@/lib/store";
import { Eyebrow } from "./primitives/Eyebrow";
import { cn } from "@/lib/cn";

interface ProductDetailV3Props {
  school: School;
  group: ProductGroup;
  basePath?: string;
  whatsappNumber?: string | null;
}

// API serializa Decimal como string; coercionamos para que toLocaleString aplique
// el separador es-CO. Si dejas el string crudo sale "$62000.00".
const fmt = (n: number | string): string =>
  `$${Number(n).toLocaleString("es-CO")}`;

export function ProductDetailV3({
  school,
  group,
  basePath = "/",
  whatsappNumber,
}: ProductDetailV3Props): React.JSX.Element {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);

  const initialVariant =
    group.variants.find((v) => !v.isOrder) ?? group.variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState(
    initialVariant?.id ?? "",
  );
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  const variant =
    group.variants.find((v) => v.id === selectedVariantId) ?? initialVariant;
  const isOrder = variant?.isOrder ?? true;
  const priceLine = Number(variant ? variant.price : group.basePrice);
  const subtotal = priceLine * qty;

  const handleAdd = (): void => {
    if (!variant) return;
    const productLike = {
      id: variant.id,
      school_id: group.isGlobal ? null : group.school.id,
      garment_type_id: group.garmentTypeId,
      is_global: group.isGlobal,
      name: group.name,
      code: "",
      price: variant.price,
      size: variant.size,
      stock: variant.stock,
    } as Parameters<typeof addItem>[0];
    for (let i = 0; i < qty; i += 1) {
      addItem(productLike, group.school, isOrder, group.isGlobal);
    }
    router.push(`${basePath}${school.slug}/cart`);
  };

  const wahref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=Hola,%20quiero%20pedir%20${encodeURIComponent(group.name)}%20del%20colegio%20${encodeURIComponent(school.name)}`
    : null;

  const galleryImages = group.images.slice(0, 4);
  const displayImage =
    galleryImages[activeImage]?.image_url ??
    group.primaryImageUrl ??
    galleryImages[0]?.image_url ??
    null;

  return (
    <section className="bg-surface-100 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-7 text-xs font-mono font-semibold tracking-[0.14em] uppercase text-stone-500">
          <Link
            href={`${basePath}${school.slug}`}
            className="hover:text-stone-900 transition-colors"
          >
            {school.name}
          </Link>
          <ChevronRight size={11} strokeWidth={2} />
          <span className="text-stone-900">{group.name}</span>
        </div>

        <Link
          href={`${basePath}${school.slug}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors mb-6"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Volver al catálogo
        </Link>

        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-16">
          {/* Gallery */}
          <div>
            <div className="aspect-[4/5] bg-surface-200 rounded-2xl overflow-hidden mb-3">
              {displayImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayImage}
                  alt={group.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm font-mono tracking-wider uppercase">
                  Foto pendiente
                </div>
              )}
            </div>
            {galleryImages.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {galleryImages.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    aria-label={`Ver vista ${i + 1}`}
                    aria-pressed={i === activeImage}
                    className={cn(
                      "aspect-square rounded-lg overflow-hidden cursor-pointer border transition-all",
                      i === activeImage
                        ? "border-2 border-brand-500"
                        : "border-stone-200/60 hover:border-stone-300",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.image_url}
                      alt={`${group.name} vista ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Buy box */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Eyebrow>
              {school.name} · {group.isGlobal ? "Producto general" : "Catálogo del colegio"}
            </Eyebrow>
            <h1
              className="mt-4 font-editorial font-medium text-stone-900 tracking-[-0.025em] leading-[1] text-4xl sm:text-5xl"
              style={{ fontVariationSettings: '"opsz" 120' }}
            >
              {group.name}
            </h1>
            <div className="mt-5 flex items-baseline gap-3">
              <span
                className="font-editorial text-3xl font-semibold text-stone-900 tabular-nums"
                style={{ fontVariationSettings: '"opsz" 72' }}
              >
                {fmt(priceLine)}
              </span>
              {group.basePrice !== group.maxPrice && (
                <span className="text-sm text-stone-500">
                  desde {fmt(group.basePrice)}
                </span>
              )}
            </div>
            {!isOrder && variant && (
              <div className="mt-2 text-xs font-medium text-success inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {variant.stock} {variant.stock === 1 ? "unidad" : "unidades"}{" "}
                disponibles
              </div>
            )}
            {isOrder && (
              <div className="mt-2 text-xs font-medium text-brand-700 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                Por encargo — confirmamos tiempo por WhatsApp
              </div>
            )}

            {/* Size picker */}
            {group.variants.length > 1 && (
              <div className="mt-7">
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-xs font-mono font-semibold tracking-[0.14em] uppercase text-stone-700">
                    Talla
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.variants.map((v) => {
                    const active = v.id === selectedVariantId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={cn(
                          "min-w-[52px] px-3.5 py-3 rounded-lg text-sm font-medium border transition-all",
                          active
                            ? "bg-stone-900 text-white border-stone-900"
                            : "bg-surface-50 text-stone-700 border-stone-200 hover:border-stone-300",
                        )}
                      >
                        {v.size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Qty + add */}
            <div className="mt-6 flex gap-2.5">
              <div className="inline-flex items-center bg-surface-50 border border-stone-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  aria-label="Restar"
                  className="px-3 py-3 text-stone-700 hover:bg-surface-200 transition-colors rounded-l-lg"
                >
                  <Minus size={14} strokeWidth={1.75} />
                </button>
                <span className="min-w-[36px] text-center text-sm font-semibold tabular-nums">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty(qty + 1)}
                  aria-label="Sumar"
                  className="px-3 py-3 text-stone-700 hover:bg-surface-200 transition-colors rounded-r-lg"
                >
                  <Plus size={14} strokeWidth={1.75} />
                </button>
              </div>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!variant}
                className="flex-1 inline-flex items-center justify-center px-6 py-3.5 rounded-lg bg-stone-900 text-white font-medium text-sm border border-stone-900 hover:bg-stone-800 transition-all disabled:opacity-50"
              >
                Agregar al carrito · {fmt(subtotal)}
              </button>
            </div>

            {wahref && (
              <a
                href={wahref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-brand-500 text-white font-medium text-sm border border-brand-500 hover:bg-brand-600 transition-all"
              >
                <MessageCircle size={16} strokeWidth={1.75} />
                Consultar por WhatsApp
              </a>
            )}

            <p className="mt-7 text-xs text-stone-500 leading-relaxed">
              ¿Dudas sobre talla, color o disponibilidad? Escríbenos por
              WhatsApp y te atendemos directo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
