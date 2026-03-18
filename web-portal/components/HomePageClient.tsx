'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search, School as SchoolIcon, ArrowRight, User, LogOut, Package, Eye, EyeOff, HelpCircle, CreditCard, Building2, Smartphone, Copy, Check } from 'lucide-react';
import Footer from '@/components/Footer';
import { API_BASE_URL, type School } from '@/lib/api';
import { useClientAuth } from '@/lib/clientAuth';
import type { PaymentAccount } from '@/lib/serverApi';

interface HomePageClientProps {
  schools: School[];
  paymentAccounts: PaymentAccount[];
}

export default function HomePageClient({ schools, paymentAccounts }: HomePageClientProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-100 flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <HomeContent schools={schools} paymentAccounts={paymentAccounts} />
    </Suspense>
  );
}

function HomeContent({ schools, paymentAccounts }: HomePageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');

  // Auth state
  const { client, isAuthenticated, login, logout, isLoading: authLoading, error: authError, clearError } = useClientAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Payment accounts clipboard state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-open login modal if redirected from a protected page
  useEffect(() => {
    if (mounted && searchParams.get('login') === 'required' && !isAuthenticated) {
      setShowLoginModal(true);
    }
  }, [mounted, searchParams, isAuthenticated]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  const filteredSchools = schools.filter(school =>
    school.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSchoolSelect = (slug: string) => {
    router.push(`/${slug}`);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(loginForm.email, loginForm.password);
    if (success) {
      setShowLoginModal(false);
      setLoginForm({ email: '', password: '' });
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      {/* Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-stone-200/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Uniformes Consuelo Rios" width={56} height={40} style={{ height: '2.5rem', width: 'auto' }} priority />
            <span className="text-lg font-bold font-display text-stone-900 hidden sm:block tracking-tight">Uniformes Consuelo Rios</span>
          </div>

          {/* Auth Section */}
          {mounted && (
            <div className="flex items-center gap-3">
              {isAuthenticated && client ? (
                <>
                  <button
                    onClick={() => router.push('/mi-cuenta')}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                  >
                    <Package className="w-4 h-4" />
                    <span className="hidden sm:inline">Mis Pedidos</span>
                  </button>
                  <div className="hidden sm:flex items-center gap-2 text-right">
                    <div>
                      <p className="text-sm font-medium text-stone-800">{client.name}</p>
                      <p className="text-xs text-stone-400">{client.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                    title="Cerrar sesion"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors text-sm font-medium"
                >
                  <User className="w-4 h-4" />
                  <span>Iniciar Sesion</span>
                </button>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-stone-900 text-white relative overflow-hidden">
        {/* Subtle gold gradient accent */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/40 via-transparent to-brand-800/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <p className="text-brand-400 text-sm font-semibold tracking-widest uppercase mb-4">Uniformes Escolares</p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-display mb-5 tracking-tight leading-[1.1]">
            Calidad que se nota,<br className="hidden sm:block" />
            <span className="text-brand-400">precios que convienen</span>
          </h1>
          <p className="text-lg text-stone-400 max-w-xl mx-auto leading-relaxed">
            Encuentra el uniforme completo de tu colegio. Envio a domicilio o recogelo en nuestro local.
          </p>
        </div>

      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1">
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-stone-900 font-display mb-2 tracking-tight">
            Selecciona tu colegio
          </h2>
          <p className="text-stone-600">
            Busca tu institucion para ver el catalogo completo
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-stone-400 w-5 h-5" />
            <input
              id="school-search"
              name="search"
              type="text"
              placeholder="Buscar colegio..."
              aria-label="Buscar colegio"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all bg-white text-stone-900 placeholder-stone-400"
            />
          </div>
        </div>

        {/* Schools Grid */}
        {filteredSchools.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-stone-200">
            <SchoolIcon className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500">No se encontraron colegios</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-stagger">
            {filteredSchools.map((school) => (
              <Link
                key={school.id}
                href={`/${school.slug}`}
                className="group bg-white rounded-xl border border-stone-200 p-5 hover:shadow-lg hover:border-brand-300 hover:-translate-y-0.5 transition-all duration-200 text-left flex items-center gap-4"
              >
                <div className="w-14 h-14 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0 overflow-hidden group-hover:bg-brand-100 transition-colors relative">
                  {school.logo_url ? (
                    <Image
                      src={`${API_BASE_URL}${school.logo_url}`}
                      alt={`Escudo ${school.name}`}
                      fill
                      sizes="56px"
                      className="object-cover"
                      unoptimized
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <SchoolIcon className={`w-7 h-7 text-brand-600 ${school.logo_url ? 'hidden' : ''}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-stone-900 font-display truncate text-[15px]">
                    {school.name}
                  </h3>
                  <p className="text-sm text-brand-600 font-medium flex items-center gap-1 mt-0.5">
                    Ver catalogo
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Custom Orders Card */}
        <div className="mt-10 mb-8">
          <Link
            href="/encargos-personalizados"
            className="w-full bg-white rounded-xl border border-stone-200 p-6 hover:shadow-lg hover:border-brand-300 transition-all duration-200 hover:-translate-y-0.5 flex items-center gap-5 text-left"
          >
            <div className="w-14 h-14 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
              <Package className="w-7 h-7 text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-stone-900 font-display text-[15px]">
                  Encargos Personalizados
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 uppercase tracking-wide">
                  A medida
                </span>
              </div>
              <p className="text-sm text-stone-500">
                Uniformes con tallas y especificaciones unicas
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-stone-400 flex-shrink-0" />
          </Link>
        </div>

        {/* Payment Methods Section */}
        <div className="mb-12 bg-white rounded-xl border border-stone-200 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-stone-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-900 font-display">
                Metodos de Pago
              </h3>
              <p className="text-sm text-stone-500">
                Paga de forma facil y segura
              </p>
            </div>
          </div>

          {paymentAccounts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              {paymentAccounts.map((account) => (
                <div key={account.id} className="bg-surface-100 rounded-lg p-4 border border-stone-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center border border-stone-200">
                      {account.method_type === 'nequi' ? (
                        <Smartphone className="w-4 h-4 text-stone-600" />
                      ) : account.method_type === 'bank_account' ? (
                        <Building2 className="w-4 h-4 text-stone-600" />
                      ) : (
                        <CreditCard className="w-4 h-4 text-stone-600" />
                      )}
                    </div>
                    <div>
                      <span className="font-semibold text-stone-800 block text-sm">{account.account_name}</span>
                      <span className="text-xs text-stone-400">{account.bank_name || account.method_type}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-stone-500">
                      <span className="font-medium text-stone-600">Titular:</span> {account.account_holder}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono tabular-nums text-stone-800 bg-white px-2.5 py-1.5 rounded-md border border-stone-200 flex-1">
                        {account.account_number}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(account.account_number, account.id);
                        }}
                        className="p-1.5 hover:bg-white rounded-md transition border border-transparent hover:border-stone-200"
                        title="Copiar numero"
                      >
                        {copiedId === account.id ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-stone-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <div className="bg-surface-100 rounded-lg p-4 border border-stone-100">
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center border border-stone-200">
                    <Building2 className="w-4 h-4 text-stone-600" />
                  </div>
                  <span className="font-semibold text-stone-800 text-sm">Transferencia</span>
                </div>
                <p className="text-xs text-stone-500 ml-12">Bancaria o cuenta de ahorros</p>
              </div>

              <div className="bg-surface-100 rounded-lg p-4 border border-stone-100">
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center border border-stone-200">
                    <Smartphone className="w-4 h-4 text-stone-600" />
                  </div>
                  <span className="font-semibold text-stone-800 text-sm">Nequi</span>
                </div>
                <p className="text-xs text-stone-500 ml-12">Pago rapido por celular</p>
              </div>

              <div className="bg-surface-100 rounded-lg p-4 border border-stone-100">
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center border border-stone-200">
                    <CreditCard className="w-4 h-4 text-stone-600" />
                  </div>
                  <span className="font-semibold text-stone-800 text-sm">Efectivo</span>
                </div>
                <p className="text-xs text-stone-500 ml-12">Pago en nuestro local</p>
              </div>
            </div>
          )}

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <a
              href="https://wa.me/573001234567?text=Hola, tengo una consulta sobre el pago de mi pedido"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Consultas por WhatsApp
            </a>

            <Link
              href="/pago"
              target="_blank"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors text-sm font-medium"
            >
              Ver detalles completos
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Contact CTA */}
        <div className="mt-8 bg-stone-900 rounded-xl p-8 text-center">
          <h3 className="text-lg font-semibold text-white font-display mb-2">
            Necesitas ayuda?
          </h3>
          <p className="text-stone-400 text-sm mb-5">
            No encuentras tu colegio o tienes preguntas sobre nuestros uniformes?
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="https://wa.me/573001234567?text=Hola, necesito información sobre uniformes"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>
            <Link
              href="/soporte"
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors text-sm font-medium"
            >
              <HelpCircle className="w-4 h-4" />
              Centro de Soporte
            </Link>
          </div>
        </div>
      </main>

      <Footer />

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl animate-fade-in">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-stone-900 font-display">
                Iniciar Sesion
              </h2>
              <p className="text-stone-500 text-sm mt-1">
                Accede para ver tu historial de pedidos
              </p>
              {searchParams.get('login') === 'required' && (
                <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
                  Debes iniciar sesion para acceder a tu cuenta.
                </div>
              )}
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-stone-700 mb-1.5">
                  Correo electronico
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={loginForm.email}
                  onChange={(e) => {
                    setLoginForm({ ...loginForm, email: e.target.value });
                    clearError();
                  }}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-sm"
                  placeholder="tu@email.com"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-stone-700 mb-1.5">
                  Contrasena
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={loginForm.password}
                    onChange={(e) => {
                      setLoginForm({ ...loginForm, password: e.target.value });
                      clearError();
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all pr-10 text-sm"
                    placeholder="Tu contrasena"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading ? 'Iniciando...' : 'Iniciar Sesion'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  router.push('/recuperar-password');
                }}
                className="w-full text-xs text-stone-500 hover:text-stone-700"
              >
                Olvidaste tu contrasena?
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  router.push('/registro');
                }}
                className="w-full py-2.5 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 transition-colors text-sm font-medium"
              >
                Crear una cuenta
              </button>
            </div>

            <button
              onClick={() => {
                setShowLoginModal(false);
                clearError();
                setLoginForm({ email: '', password: '' });
              }}
              className="mt-3 w-full py-2 text-stone-400 hover:text-stone-600 transition-colors text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
