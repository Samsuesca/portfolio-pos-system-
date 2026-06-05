"use client";

/**
 * Modal de login que abre automaticamente cuando llega `?login=required` en la URL
 * (por ejemplo, redirect desde /mi-cuenta sin sesion activa). Replica el flujo
 * del HomePageClient viejo: email/password + Google OAuth + recuperar password
 * + crear cuenta. Tipografia y ritmo de v3.
 */
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, X } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { useClientAuth } from "@/lib/clientAuth";
import { Button } from "./primitives/Button";
import { useHydrated } from "@/lib/useHydrated";

export function LoginRequiredDialog(): React.JSX.Element | null {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const {
    isAuthenticated,
    login,
    googleLogin,
    isLoading,
    error,
    clearError,
  } = useClientAuth();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Solo abre si: hidratado + ?login=required + no autenticado.
  useEffect(() => {
    if (!hydrated) return;
    const required = searchParams.get("login") === "required";
    if (required && !isAuthenticated) setOpen(true);
  }, [hydrated, searchParams, isAuthenticated]);

  if (!open) return null;

  function close(): void {
    setOpen(false);
    clearError();
    setEmail("");
    setPassword("");
    // Limpiar el query param para que no reabra al refrescar.
    const url = new URL(window.location.href);
    url.searchParams.delete("login");
    router.replace(url.pathname + url.search);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const ok = await login(email, password);
    if (ok) {
      close();
      router.push("/mi-cuenta");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-dialog-title"
    >
      <div className="relative w-full max-w-md bg-surface-50 rounded-2xl shadow-2xl animate-scale-in">
        <button
          type="button"
          onClick={close}
          className="absolute top-4 right-4 w-8 h-8 rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors flex items-center justify-center"
          aria-label="Cerrar"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <div className="p-7 sm:p-8">
          <div className="text-center mb-6">
            <div className="text-[11px] font-mono font-semibold tracking-[0.18em] uppercase text-brand-600 inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              Tu cuenta
            </div>
            <h2
              id="login-dialog-title"
              className="mt-3 font-editorial font-medium text-stone-900 text-3xl tracking-[-0.02em] leading-tight"
              style={{ fontVariationSettings: '"opsz" 72' }}
            >
              Inicia sesion
            </h2>
            {searchParams.get("login") === "required" && (
              <div className="mt-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
                Debes iniciar sesion para acceder a tu cuenta.
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-dialog-email"
                className="block text-xs font-medium tracking-wide uppercase text-stone-700 mb-1.5"
              >
                Correo electronico
              </label>
              <input
                id="login-dialog-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                }}
                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-stone-200 placeholder:text-stone-400 focus:outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-400/20 transition-all text-sm"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label
                htmlFor="login-dialog-password"
                className="block text-xs font-medium tracking-wide uppercase text-stone-700 mb-1.5"
              >
                Contrasena
              </label>
              <div className="relative">
                <input
                  id="login-dialog-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError();
                  }}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-stone-200 placeholder:text-stone-400 focus:outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-400/20 transition-all text-sm pr-10"
                  placeholder="Tu contrasena"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                  aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                >
                  {showPassword ? (
                    <EyeOff size={16} strokeWidth={1.75} />
                  ) : (
                    <Eye size={16} strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isLoading}
              className="w-full justify-center"
            >
              {isLoading ? "Iniciando..." : "Iniciar sesion"}
            </Button>

            <button
              type="button"
              onClick={() => {
                close();
                router.push("/recuperar-password");
              }}
              className="w-full text-xs text-stone-500 hover:text-stone-900 transition-colors"
            >
              Olvidaste tu contrasena?
            </button>
          </form>

          {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
            <div className="mt-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-stone-200" />
                <span className="text-[10px] font-mono tracking-[0.14em] uppercase text-stone-400">
                  o continuar con
                </span>
                <div className="h-px flex-1 bg-stone-200" />
              </div>
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={(response) => {
                    if (!response.credential) return;
                    void googleLogin(response.credential).then((ok) => {
                      if (ok) {
                        close();
                        router.push("/mi-cuenta");
                      }
                    });
                  }}
                  onError={() => {
                    // Google component handles its own error UI; nothing to do here.
                  }}
                  text="signin_with"
                />
              </div>
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-stone-200/70">
            <Button
              type="button"
              variant="ghost"
              size="md"
              className="w-full justify-center"
              onClick={() => {
                close();
                router.push("/registro");
              }}
            >
              Crear cuenta nueva
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
