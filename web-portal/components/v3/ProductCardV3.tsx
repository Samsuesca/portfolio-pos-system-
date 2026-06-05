"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { ProductGroup } from "@/lib/types";
import { useCartStore } from "@/lib/store";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

interface ProductCardV3Props {
  group: ProductGroup;
  detailHref: string;
}

// API serializa Decimal como string; coercionamos para que el separador es-CO
// se aplique correctamente (si no, sale "$42000.00" en vez de "$42.000").
const fmt = (n: number | string): string =>
  `$${Number(n).toLocaleString("es-CO")}`;

export function ProductCardV3({ group, detailHref }: ProductCardV3Props): React.JSX.Element {
  const addItem = useCartStore((s) => s.addItem);
  // Find the first in-stock variant; if none, fall back to the first variant
  // and mark the line as an order (encargo).
  const inStockVariants = group.variants.filter((v) => !v.isOrder);
  const inStock = inStockVariants[0];
  const defaultVariant = inStock ?? group.variants[0];
  const hasStock = Boolean(inStock);
  const totalVariants = group.variants.length;
  const inStockCount = inStockVariants.length;
  // Label honesto: con count cuando hay mix, plano cuando es extremo.
  const stockLabel = !hasStock
    ? "Por encargo"
    : inStockCount === totalVariants
      ? "Disponible"
      : `${inStockCount} de ${totalVariants} tallas disponibles`;
  const priceLabel =
    group.basePrice === group.maxPrice
      ? fmt(group.basePrice)
      : `${fmt(group.basePrice)} – ${fmt(group.maxPrice)}`;

  const handleQuickAdd = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    if (!defaultVariant) return;
    // Build a Product-like object from the variant. The store consumes Product
    // shape, but only product + school + isOrder are used downstream.
    const productLike = {
      id: defaultVariant.id,
      school_id: group.isGlobal ? null : group.school.id,
      garment_type_id: group.garmentTypeId,
      is_global: group.isGlobal,
      name: group.name,
      code: "",
      price: defaultVariant.price,
      size: defaultVariant.size,
      stock: defaultVariant.stock,
    } as Parameters<typeof addItem>[0];
    addItem(productLike, group.school, !hasStock, group.isGlobal);
    toast.cart("Agregado al carrito", group.name);
  };

  return (
    <Link
      href={detailHref}
      className={cn(
        "group bg-surface-50 rounded-xl border border-stone-200/60 overflow-hidden",
        "flex flex-col cursor-pointer",
        "transition-all duration-200 ease-out",
        "hover:shadow-md hover:-translate-y-px hover:border-stone-300"
      )}
    >
      <div className="relative aspect-square bg-surface-200 m-3 rounded-lg overflow-hidden">
        {group.primaryImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={group.primaryImageUrl}
            alt={group.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs font-mono uppercase tracking-wider">
            {group.name.slice(0, 2)}
          </div>
        )}
      </div>

      <div className="px-5 pb-5 flex flex-col flex-1">
        <div
          className="font-editorial text-stone-900 text-lg leading-tight mb-1.5"
          style={{ fontVariationSettings: '"opsz" 36' }}
        >
          {group.name}
        </div>
        {group.note && (
          <p className="text-xs italic text-stone-500 mb-2 line-clamp-2">{group.note}</p>
        )}
        <div
          className={cn(
            "text-xs mb-3.5 flex items-center gap-1.5",
            hasStock ? "text-success" : "text-brand-700"
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
          <span className="truncate">{stockLabel}</span>
        </div>

        <div className="mt-auto pt-3 border-t border-stone-200/60 flex items-center justify-between gap-2">
          <span className="font-editorial text-stone-900 text-lg font-semibold tabular-nums">
            {priceLabel}
          </span>
          {defaultVariant && (
            <button
              type="button"
              onClick={handleQuickAdd}
              aria-label={`Agregar ${group.name} al carrito`}
              className={cn(
                "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg",
                "bg-stone-900 text-white text-xs font-medium",
                "hover:bg-stone-800 transition-colors"
              )}
            >
              <Plus size={13} strokeWidth={2} />
              Agregar
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
