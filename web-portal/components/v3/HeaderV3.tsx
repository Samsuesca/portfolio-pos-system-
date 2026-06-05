"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, User, X } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { useClientAuth } from "@/lib/clientAuth";
import { useHydrated } from "@/lib/useHydrated";
import { Button } from "./primitives/Button";
import { cn } from "@/lib/cn";

interface HeaderV3Props {
  /** Override the home link target (e.g. /v3-preview/). Default: / */
  homeHref?: string;
}

const NAV_LINKS = [
  { href: "/", label: "Colegios", matchPrefix: "/" },
  { href: "/encargos-personalizados", label: "A medida", matchPrefix: "/encargos-personalizados" },
  { href: "/soporte", label: "Ayuda", matchPrefix: "/soporte" },
];

export function HeaderV3({ homeHref = "/" }: HeaderV3Props): React.JSX.Element {
  const pathname = usePathname();
  const hydrated = useHydrated();
  // En SSR estos stores devuelven el estado inicial (cart vacio, no autenticado).
  // En el cliente, despues de hydration de zustand persist, leen localStorage.
  // Gateamos con `hydrated` para que el primer render del cliente coincida con
  // el HTML del server y evitar mismatch.
  const rawTotalItems = useCartStore((s) => s.getTotalItems());
  const rawIsAuthenticated = useClientAuth((s) => s.isAuthenticated);
  const totalItems = hydrated ? rawTotalItems : 0;
  const isAuthenticated = hydrated ? rawIsAuthenticated : false;
  // El carrito vive por colegio (/[slug]/cart). El header es global, asi que
  // derivamos el slug del primer item (mismo patron que CartPageV3.handleCheckout).
  const firstSchoolSlug = useCartStore((s) => s.items[0]?.school.slug);
  const cartHref = hydrated && firstSchoolSlug ? `/${firstSchoolSlug}/cart` : "/";
  // El login real es el modal de /mi-cuenta (?login=required), no /registro
  // (esa pagina es solo registro). Mismo destino que usa el boton de registro.
  const loginHref = "/mi-cuenta?login=required";
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50",
        "bg-[rgba(250,248,242,0.88)] backdrop-blur-xl",
        "border-b border-stone-200/60"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-9 h-16">
          <Link href={homeHref} className="flex items-center shrink-0">
            <Image
              src="/v3/logo-lockup.png"
              alt="Uniformes Consuelo Rios"
              width={140}
              height={40}
              priority
              style={{ height: 40, width: "auto" }}
            />
          </Link>

          <nav className="hidden md:flex gap-7 ml-2">
            {NAV_LINKS.map(({ href, label, matchPrefix }) => {
              const isActive =
                matchPrefix === "/"
                  ? pathname === "/"
                  : pathname.startsWith(matchPrefix);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "text-sm font-medium transition-colors pb-1 border-b-2",
                    isActive
                      ? "text-stone-900 border-brand-500"
                      : "text-stone-600 border-transparent hover:text-stone-900"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Link
              href={isAuthenticated ? "/mi-cuenta" : loginHref}
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                "text-stone-700 hover:bg-surface-200 transition-colors"
              )}
              aria-label={isAuthenticated ? "Mi cuenta" : "Iniciar sesión"}
            >
              <User size={18} strokeWidth={1.75} />
            </Link>
            <Link
              href={cartHref}
              className={cn(
                "relative w-10 h-10 rounded-lg flex items-center justify-center",
                "text-stone-700 hover:bg-surface-200 transition-colors"
              )}
              aria-label={`Carrito (${totalItems})`}
            >
              <ShoppingBag size={18} strokeWidth={1.75} />
              {totalItems > 0 && (
                <span
                  className={cn(
                    "absolute top-1.5 right-1.5",
                    "min-w-[18px] h-[18px] px-1 rounded-full",
                    "bg-brand-500 text-white text-[10px] font-bold",
                    "flex items-center justify-center"
                  )}
                >
                  {totalItems}
                </span>
              )}
            </Link>
            {!isAuthenticated && (
              <Link href={loginHref} className="ml-2 hidden sm:block">
                <Button variant="primary" size="sm">
                  Iniciar sesión
                </Button>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className={cn(
                "md:hidden ml-1 w-10 h-10 rounded-lg flex items-center justify-center",
                "text-stone-700 hover:bg-surface-200 transition-colors"
              )}
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <X size={20} strokeWidth={1.75} />
              ) : (
                <Menu size={20} strokeWidth={1.75} />
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <nav className="md:hidden border-t border-stone-200/60 bg-[rgba(250,248,242,0.98)] backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col">
            {NAV_LINKS.map(({ href, label, matchPrefix }) => {
              const isActive =
                matchPrefix === "/"
                  ? pathname === "/"
                  : pathname.startsWith(matchPrefix);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "py-3 text-base font-medium transition-colors",
                    isActive ? "text-stone-900" : "text-stone-600 hover:text-stone-900"
                  )}
                >
                  {label}
                </Link>
              );
            })}
            <Link
              href={isAuthenticated ? "/mi-cuenta" : loginHref}
              onClick={() => setMobileOpen(false)}
              className="py-3 text-base font-medium text-stone-600 hover:text-stone-900 transition-colors border-t border-stone-200/60 mt-1"
            >
              {isAuthenticated ? "Mi cuenta" : "Iniciar sesión"}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
