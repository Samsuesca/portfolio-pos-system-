"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Minus,
  Plus,
  X,
  MessageCircle,
  CreditCard,
  Truck,
  ShoppingBag,
  Lock,
} from "lucide-react";
import { useCartStore } from "@/lib/store";
import { deliveryZonesApi, type DeliveryZone } from "@/lib/api";
import { Eyebrow } from "./primitives/Eyebrow";
import { cn } from "@/lib/cn";

interface CartPageV3Props {
  /** Where back/continue shopping links go. Default: / */
  basePath?: string;
  /** Where checkout button pushes. Default: /<school_slug>/checkout */
  checkoutPath?: string;
  whatsappNumber?: string | null;
}

const fmt = (n: number): string => `$${n.toLocaleString("es-CO")}`;

export function CartPageV3({
  basePath = "/",
  checkoutPath,
  whatsappNumber,
}: CartPageV3Props): React.JSX.Element {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const getTotalPrice = useCartStore((s) => s.getTotalPrice);

  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | "pickup">("pickup");

  useEffect(() => {
    // /delivery-zones/public already filters to active zones server-side.
    deliveryZonesApi
      .listPublic()
      .then((zs) => setZones(zs))
      .catch(() => setZones([]));
  }, []);

  const subtotal = getTotalPrice();
  const selectedZone = useMemo(
    () => zones.find((z) => z.id === selectedZoneId) ?? null,
    [zones, selectedZoneId],
  );
  const deliveryFee = selectedZone ? Number(selectedZone.delivery_fee) : 0;
  const total = subtotal + deliveryFee;

  const handleCheckout = (): void => {
    if (checkoutPath) {
      router.push(checkoutPath);
      return;
    }
    // Fallback: pick the first school in cart and route to its checkout
    const first = items[0];
    if (first) router.push(`/${first.school.slug}/checkout`);
  };

  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=Hola,%20quiero%20coordinar%20un%20pedido%20del%20carrito`
    : null;

  return (
    <section className="bg-surface-100 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-10">
          <div>
            <Eyebrow>
              Tu carrito · {items.length} {items.length === 1 ? "prenda" : "prendas"}
            </Eyebrow>
            <h1
              className="mt-4 font-editorial font-medium text-stone-900 tracking-[-0.03em] leading-[1] text-4xl sm:text-5xl"
              style={{ fontVariationSettings: '"opsz" 120' }}
            >
              Revisa y{" "}
              <em className="italic font-normal text-brand-600">confirma</em>.
            </h1>
          </div>
          <Link
            href={basePath}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-transparent text-stone-700 border border-stone-200 hover:bg-surface-200 transition-colors text-sm font-medium self-start sm:self-auto"
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            Seguir comprando
          </Link>
        </div>

        {items.length === 0 ? (
          <EmptyCart basePath={basePath} />
        ) : (
          <div className="grid lg:grid-cols-[1.6fr_1fr] gap-8 lg:gap-10">
            {/* Items list */}
            <div className="bg-surface-50 border border-stone-200/60 rounded-2xl overflow-hidden">
              <div className="hidden sm:grid grid-cols-[80px_1fr_100px_100px_40px] gap-4 px-6 py-4 border-b border-stone-200/60 text-[11px] font-mono font-semibold tracking-[0.14em] uppercase text-stone-500">
                <span>Prenda</span>
                <span />
                <span className="text-center">Cantidad</span>
                <span className="text-right">Subtotal</span>
                <span />
              </div>
              {items.map((item, idx) => {
                const lineTotal = item.product.price * item.quantity;
                const isLast = idx === items.length - 1;
                return (
                  <div
                    key={`${item.product.id}-${idx}`}
                    className={cn(
                      "grid grid-cols-[80px_1fr_auto] sm:grid-cols-[80px_1fr_100px_100px_40px] gap-4 px-4 sm:px-6 py-5 items-center",
                      !isLast && "border-b border-stone-200/60",
                    )}
                  >
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-surface-200 flex items-center justify-center text-stone-400 text-xs font-mono uppercase">
                      {item.product.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono font-semibold tracking-[0.14em] uppercase text-stone-500 mb-1 truncate">
                        {item.school.name} · Talla {item.product.size || "única"}
                        {item.isOrder && " · Encargo"}
                      </div>
                      <div
                        className="font-editorial text-stone-900 text-base sm:text-lg leading-tight"
                        style={{ fontVariationSettings: '"opsz" 36' }}
                      >
                        {item.product.name}
                      </div>
                      <div className="text-xs text-stone-500 mt-1 tabular-nums">
                        {fmt(item.product.price)} c/u
                      </div>
                    </div>
                    <div className="sm:flex sm:justify-center sm:col-start-3 col-start-3 row-start-2 sm:row-start-auto">
                      <div className="inline-flex items-center border border-stone-200 rounded-lg bg-surface-100">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity - 1)
                          }
                          aria-label="Restar"
                          className="px-2.5 py-1.5 text-stone-700 hover:bg-surface-200 transition-colors"
                        >
                          <Minus size={12} strokeWidth={2} />
                        </button>
                        <span className="min-w-[24px] text-center text-sm font-semibold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity + 1)
                          }
                          aria-label="Sumar"
                          className="px-2.5 py-1.5 text-stone-700 hover:bg-surface-200 transition-colors"
                        >
                          <Plus size={12} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                    <div className="hidden sm:block text-right font-editorial text-stone-900 font-semibold tabular-nums">
                      {fmt(lineTotal)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.product.id)}
                      aria-label="Eliminar"
                      className="text-stone-400 hover:text-error transition-colors justify-self-end"
                    >
                      <X size={16} strokeWidth={1.75} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Order summary */}
            <div className="lg:sticky lg:top-24 lg:self-start space-y-5">
              <div className="bg-surface-50 border border-stone-200/60 rounded-2xl p-7">
                <Eyebrow>Resumen del pedido</Eyebrow>

                {/* Delivery zone selector */}
                {zones.length > 0 && (
                  <div className="mt-5">
                    <label className="block text-[11px] font-mono font-semibold tracking-[0.14em] uppercase text-stone-700 mb-2">
                      Entrega
                    </label>
                    <select
                      value={selectedZoneId}
                      onChange={(e) =>
                        setSelectedZoneId(e.target.value as string | "pickup")
                      }
                      className="w-full px-3 py-2.5 text-sm rounded-lg bg-white border border-stone-200 focus:outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-400/20"
                    >
                      <option value="pickup">Recoger en taller (gratis)</option>
                      {zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name} — {fmt(Number(z.delivery_fee))} ·{" "}
                          {z.estimated_days} día{z.estimated_days === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mt-5 pb-5 border-b border-stone-200/60 space-y-1.5">
                  <div className="flex justify-between text-sm text-stone-700">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{fmt(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-stone-700">
                    <span>Envío</span>
                    <span className="tabular-nums">
                      {deliveryFee === 0 ? "Gratis" : fmt(deliveryFee)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-stone-700">
                    <span>Bordados oficiales</span>
                    <span>Incluidos</span>
                  </div>
                </div>

                <div className="py-5 flex items-baseline justify-between">
                  <span className="text-sm font-medium text-stone-700">
                    Total a pagar
                  </span>
                  <span
                    className="font-editorial text-3xl font-semibold text-stone-900 tabular-nums"
                    style={{ fontVariationSettings: '"opsz" 72' }}
                  >
                    {fmt(total)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-stone-900 text-white text-sm font-medium border border-stone-900 hover:bg-stone-800 transition-all"
                >
                  <CreditCard size={16} strokeWidth={1.75} />
                  Pagar con Wompi
                </button>
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2.5 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-brand-500 text-white text-sm font-medium border border-brand-500 hover:bg-brand-600 transition-all"
                  >
                    <MessageCircle size={16} strokeWidth={1.75} />
                    Coordinar por WhatsApp
                  </a>
                )}

                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-stone-500">
                  <Lock size={12} strokeWidth={2} />
                  Pago seguro · Conexión SSL · Procesado por Wompi
                </div>

                {selectedZone && (
                  <div className="mt-6 p-4 bg-brand-50 rounded-xl flex gap-3">
                    <Truck
                      size={18}
                      strokeWidth={1.75}
                      className="text-brand-700 shrink-0 mt-0.5"
                    />
                    <div className="text-sm">
                      <div className="font-medium text-stone-900">
                        Entrega en {selectedZone.name}
                      </div>
                      <div className="text-xs text-stone-600 mt-0.5">
                        {selectedZone.estimated_days} día
                        {selectedZone.estimated_days === 1 ? "" : "s"} hábil
                        {selectedZone.estimated_days === 1 ? "" : "es"} ·{" "}
                        {fmt(deliveryFee)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyCart({ basePath }: { basePath: string }): React.JSX.Element {
  return (
    <div className="bg-surface-50 border border-stone-200/60 rounded-2xl p-16 text-center">
      <ShoppingBag
        size={40}
        strokeWidth={1.5}
        className="text-stone-400 mx-auto"
      />
      <h2
        className="mt-5 font-editorial text-stone-700 text-2xl"
        style={{ fontVariationSettings: '"opsz" 72' }}
      >
        Tu carrito está vacío
      </h2>
      <p className="mt-2 text-sm text-stone-500">
        Explora el catálogo y agrega prendas para empezar.
      </p>
      <Link
        href={basePath}
        className="mt-7 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-stone-900 text-white text-sm font-medium border border-stone-900 hover:bg-stone-800 transition-all"
      >
        Ver colegios
      </Link>
    </div>
  );
}
