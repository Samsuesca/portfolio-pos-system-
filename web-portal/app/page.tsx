'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, School as SchoolIcon, ArrowRight, User, LogOut, Package, Eye, EyeOff, HelpCircle, CreditCard, Building2, Smartphone, Copy, Check } from 'lucide-react';
import Footer from '@/components/Footer';
import { schoolsApi, API_BASE_URL, type School } from '@/lib/api';
import { useClientAuth } from '@/lib/clientAuth';

interface PaymentAccount {
  id: string;
  method_type: string;
  account_name: string;
  account_number: string;
  account_holder: string;
  bank_name: string | null;
  account_type: string | null;
  qr_code_url: string | null;
  instructions: string | null;
  display_order: number;
}

export default function Home() {
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Auth state
  const { client, isAuthenticated, login, logout, isLoading: authLoading, error: authError, clearError } = useClientAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Payment accounts state
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    loadSchools();
    loadPaymentAccounts();
  }, []);

  const loadPaymentAccounts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/payment-accounts/public`);
      if (response.ok) {
        const data = await response.json();
        setPaymentAccounts(data.slice(0, 3)); // Show max 3 inline
      }
    } catch (error) {
      console.error('Error loading payment accounts:', error);
    } finally {
      setPaymentLoading(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  const loadSchools = async () => {
    try {
      const response = await schoolsApi.list();
      setSchools(response.data);
    } catch (error) {
      console.error('Error loading schools:', error);
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50 flex flex-col">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary to-primary-light text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="Uniformes Consuelo Rios" className="h-16 sm:h-20 w-auto" />
              <span className="text-xl sm:text-2xl font-bold font-display text-brand-500 hidden sm:block">Uniformes Consuelo Rios</span>
            </div>

            {/* Auth Section */}
            {mounted && (
              <div className="flex items-center gap-4">
                {isAuthenticated && client ? (
                  <>
                    <button
                      onClick={() => router.push('/mi-cuenta')}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                    >
                      <Package className="w-4 h-4" />
                      <span className="hidden sm:inline">Mis Pedidos</span>
                    </button>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold">{client.name}</p>
                        <p className="text-xs text-blue-200">{client.email}</p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                        title="Cerrar sesión"
                      >
                        <LogOut className="w-5 h-5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-primary rounded-lg hover:bg-brand-400 transition-colors font-semibold"
                  >
                    <User className="w-4 h-4" />
                    <span>Iniciar Sesión</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-display mb-4 tracking-tight">
            Uniformes Escolares de Calidad
          </h1>
          <p className="text-xl md:text-2xl text-brand-300 mb-2 font-light">
            Calidad y los mejores precios
          </p>
          <p className="text-base text-brand-400/80 max-w-2xl mx-auto">
            Encuentra el uniforme completo de tu colegio con envio a domicilio o recogelo en nuestro local
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800 font-display mb-3">
            Selecciona tu Colegio
          </h2>
          <p className="text-lg text-gray-600">
            Busca tu institución y explora nuestro catálogo completo
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar colegio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-xl border border-surface-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all bg-white shadow-sm text-primary placeholder-slate-400"
            />
          </div>
        </div>

        {/* Schools Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-200 border-t-brand-600"></div>
            <p className="mt-4 text-slate-600">Cargando colegios...</p>
          </div>
        ) : filteredSchools.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-surface-200">
            <SchoolIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">No se encontraron colegios</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSchools.map((school) => (
              <button
                key={school.id}
                onClick={() => handleSchoolSelect(school.slug)}
                className="group bg-white rounded-2xl border-2 border-gray-200 p-8 hover:shadow-2xl hover:border-brand-500 hover:-translate-y-2 transition-all duration-300 text-left"
              >
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center mx-auto mb-4 group-hover:from-primary group-hover:to-primary-light transition-all overflow-hidden shadow-md">
                    {school.logo_url ? (
                      <img
                        src={`${API_BASE_URL}${school.logo_url}`}
                        alt={`Escudo ${school.name}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <SchoolIcon className="w-12 h-12 text-brand-600 group-hover:text-brand-400 transition-colors" />
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 font-display mb-2">
                    {school.name}
                  </h3>
                  <div className="flex items-center justify-center gap-2 text-brand-600 font-semibold group-hover:gap-3 transition-all">
                    <span>Ver catálogo</span>
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Custom Orders Card */}
        <div className="mt-12 mb-8">
          <button
            onClick={() => router.push('/encargos-personalizados')}
            className="relative w-full max-w-md mx-auto bg-white rounded-2xl border-2 border-purple-200 p-8 hover:shadow-xl hover:border-purple-400 transition-all duration-300 hover:-translate-y-1 block"
          >
            {/* Badge "Personalizado" */}
            <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
              Personalizado
            </div>

            {/* Icono */}
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
              <Package className="w-10 h-10 text-purple-600" />
            </div>

            {/* Título */}
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Encargos Personalizados
            </h3>

            {/* Subtítulo */}
            <p className="text-sm text-gray-600 mb-4">
              Crea tu uniforme a medida con tallas y especificaciones únicas
            </p>

            {/* CTA */}
            <span className="inline-flex items-center text-purple-600 font-semibold">
              Crear encargo
              <ArrowRight className="ml-2 w-5 h-5" />
            </span>
          </button>
        </div>

        {/* Payment Methods Section */}
        <div className="mb-12 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200 p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
              <CreditCard className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 font-display mb-2">
              Metodos de Pago
            </h3>
            <p className="text-gray-600 mb-6">
              Realiza tu pago de forma facil y segura
            </p>
          </div>

          {paymentLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full" />
            </div>
          ) : paymentAccounts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {paymentAccounts.map((account) => (
                <div key={account.id} className="bg-white rounded-xl p-4 border border-green-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      {account.method_type === 'nequi' ? (
                        <Smartphone className="w-5 h-5 text-green-600" />
                      ) : account.method_type === 'bank_account' ? (
                        <Building2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <CreditCard className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-800 block">{account.account_name}</span>
                      <span className="text-xs text-gray-500">{account.bank_name || account.method_type}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Titular:</span> {account.account_holder}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono text-gray-800 bg-gray-50 px-2 py-1 rounded flex-1">
                        {account.account_number}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(account.account_number, account.id);
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded transition"
                        title="Copiar numero"
                      >
                        {copiedId === account.id ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="font-semibold text-gray-800">Transferencia</span>
                </div>
                <p className="text-sm text-gray-600">Bancaria o cuenta de ahorros</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="font-semibold text-gray-800">Nequi</span>
                </div>
                <p className="text-sm text-gray-600">Pago rapido por celular</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="font-semibold text-gray-800">Efectivo</span>
                </div>
                <p className="text-sm text-gray-600">Pago en nuestro local</p>
              </div>
            </div>
          )}

          {/* WhatsApp CTA + Details Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://wa.me/573001234567?text=Hola, tengo una consulta sobre el pago de mi pedido"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all duration-300 hover:shadow-lg font-semibold"
            >
              {/* WhatsApp SVG Icon */}
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Consultas por WhatsApp
            </a>

            <button
              onClick={() => window.open('/pago', '_blank')}
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-green-600 text-green-600 rounded-xl hover:bg-green-50 transition-all duration-300 font-semibold"
            >
              Ver Detalles Completos
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contact CTA */}
        <div className="mt-16 bg-white rounded-2xl border border-surface-200 p-8 text-center">
          <h3 className="text-xl font-bold text-gray-800 font-display mb-3">
            ¿Necesitas ayuda?
          </h3>
          <p className="text-gray-600 mb-6">
            ¿No encuentras tu colegio o tienes preguntas sobre nuestros uniformes?
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://wa.me/573001234567?text=Hola, necesito información sobre uniformes"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-semibold"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>
            <button
              onClick={() => router.push('/soporte')}
              className="flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors font-semibold"
            >
              <HelpCircle className="w-5 h-5" />
              Centro de Soporte
            </button>
          </div>
        </div>
      </main>

      <Footer />

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-brand-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 font-display">
                Iniciar Sesión
              </h2>
              <p className="text-gray-600 mt-2">
                Accede para ver tu historial de pedidos
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  required
                  value={loginForm.email}
                  onChange={(e) => {
                    setLoginForm({ ...loginForm, email: e.target.value });
                    clearError();
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                  placeholder="tu@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginForm.password}
                    onChange={(e) => {
                      setLoginForm({ ...loginForm, password: e.target.value });
                      clearError();
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all pr-12"
                    placeholder="Tu contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading ? 'Iniciando...' : 'Iniciar Sesión'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  router.push('/recuperar-password');
                }}
                className="w-full text-sm text-brand-600 hover:text-brand-700 mt-3"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600 text-center mb-3">
                ¿No tienes cuenta?
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  router.push('/registro');
                }}
                className="w-full py-3 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
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
              className="mt-4 w-full py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
