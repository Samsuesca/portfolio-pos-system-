'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Eye, EyeOff, Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { clientsApi, schoolsApi, type School } from '@/lib/api';
import { useClientAuth } from '@/lib/clientAuth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type RegistrationStep = 'email' | 'verify' | 'details';

export default function RegistroPage() {
  const router = useRouter();
  const { login } = useClientAuth();

  const [step, setStep] = useState<RegistrationStep>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Email verification
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Registration form
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    password_confirm: '',
    student_name: '',
    student_grade: '',
    school_id: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);

  // Load schools
  useEffect(() => {
    const loadSchools = async () => {
      try {
        const response = await schoolsApi.list();
        setSchools(response.data);
      } catch (err) {
        console.error('Error loading schools:', err);
      }
    };
    loadSchools();
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSendCode = async () => {
    if (!email || !validateEmail(email)) {
      setError('Ingresa un correo electrónico válido');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/portal/clients/verify-email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: formData.name || undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Error al enviar código');
      }

      setStep('verify');
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Error al enviar el código');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Ingresa el código de 6 dígitos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/portal/clients/verify-email/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Código inválido');
      }

      setStep('details');
    } catch (err: any) {
      setError(err.message || 'Código inválido o expirado');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (formData.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (formData.password !== formData.password_confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (!formData.school_id) {
      setError('Selecciona un colegio');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await clientsApi.register({
        name: formData.name,
        email: email,
        password: formData.password,
        phone: formData.phone || undefined,
        students: [{
          school_id: formData.school_id,
          student_name: formData.student_name || formData.name,
          student_grade: formData.student_grade || undefined,
        }]
      });

      // Auto-login
      await login(email, formData.password);
      setSuccess(true);

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'Error al crear la cuenta';
      if (message.includes('already registered')) {
        setError('Este email ya está registrado. Por favor inicia sesión.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-primary mb-4">
            ¡Cuenta creada!
          </h2>
          <p className="text-slate-600 mb-6">
            Tu cuenta ha sido creada exitosamente. Ya puedes hacer pedidos y ver tu historial.
          </p>
          <p className="text-sm text-slate-500">Redirigiendo al inicio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      {/* Header */}
      <header className="bg-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Volver al inicio</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex items-center justify-center p-4 mt-8">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {['email', 'verify', 'details'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step === s
                    ? 'bg-brand-600 text-white'
                    : ['email', 'verify', 'details'].indexOf(step) > i
                      ? 'bg-green-500 text-white'
                      : 'bg-surface-200 text-slate-500'
                }`}>
                  {['email', 'verify', 'details'].indexOf(step) > i ? '✓' : i + 1}
                </div>
                {i < 2 && <div className={`w-8 h-1 ${
                  ['email', 'verify', 'details'].indexOf(step) > i ? 'bg-green-500' : 'bg-surface-200'
                }`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Email */}
          {step === 'email' && (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-brand-600" />
                </div>
                <h1 className="text-2xl font-bold text-primary mb-2">
                  Verifica tu correo
                </h1>
                <p className="text-slate-600">
                  Te enviaremos un código de verificación a tu email
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    placeholder="tu@email.com"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSendCode}
                  disabled={loading || !email}
                  className="w-full py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar código'
                  )}
                </button>
              </div>
            </>
          )}

          {/* Step 2: Verify Code */}
          {step === 'verify' && (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-brand-600" />
                </div>
                <h1 className="text-2xl font-bold text-primary mb-2">
                  Ingresa el código
                </h1>
                <p className="text-slate-600">
                  Enviamos un código de 6 dígitos a <span className="font-semibold">{email}</span>
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Código de verificación
                  </label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => {
                      setVerificationCode(e.target.value.replace(/\D/g, ''));
                      setError('');
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-center text-2xl tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  onClick={handleVerifyCode}
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    'Verificar código'
                  )}
                </button>

                <div className="text-center">
                  {resendCooldown > 0 ? (
                    <p className="text-sm text-slate-500">
                      Reenviar código en {resendCooldown}s
                    </p>
                  ) : (
                    <button
                      onClick={handleSendCode}
                      className="text-sm text-brand-600 hover:text-brand-700"
                    >
                      Reenviar código
                    </button>
                  )}
                </div>

                <button
                  onClick={() => {
                    setStep('email');
                    setVerificationCode('');
                    setError('');
                  }}
                  className="w-full text-sm text-slate-600 hover:text-slate-800"
                >
                  Cambiar correo electrónico
                </button>
              </div>
            </>
          )}

          {/* Step 3: Details */}
          {step === 'details' && (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-primary mb-2">
                  Completa tu registro
                </h1>
                <p className="text-slate-600">
                  Email verificado: <span className="font-semibold text-green-600">{email}</span>
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Nombre completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    placeholder="Tu nombre completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Teléfono (opcional)
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    placeholder="3001234567"
                    maxLength={10}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Contraseña *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all pr-12"
                      placeholder="Mínimo 8 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Confirmar contraseña *
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={formData.password_confirm}
                    onChange={(e) => setFormData({ ...formData, password_confirm: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    placeholder="Repite tu contraseña"
                  />
                </div>

                <div className="pt-4 border-t border-surface-200">
                  <h3 className="font-semibold text-primary mb-3">Información del estudiante</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Colegio *
                      </label>
                      <select
                        required
                        value={formData.school_id}
                        onChange={(e) => setFormData({ ...formData, school_id: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                      >
                        <option value="">Selecciona un colegio</option>
                        {schools.map((school) => (
                          <option key={school.id} value={school.id}>
                            {school.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Nombre del estudiante
                      </label>
                      <input
                        type="text"
                        value={formData.student_name}
                        onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                        placeholder="Nombre del estudiante (opcional)"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Grado
                      </label>
                      <input
                        type="text"
                        value={formData.student_grade}
                        onChange={(e) => setFormData({ ...formData, student_grade: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                        placeholder="Ej: Primero, Segundo, etc."
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creando cuenta...
                    </>
                  ) : (
                    'Crear cuenta'
                  )}
                </button>
              </form>
            </>
          )}

          {/* Login link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              ¿Ya tienes cuenta?{' '}
              <button
                onClick={() => router.push('/')}
                className="text-brand-600 hover:text-brand-700 font-semibold"
              >
                Inicia sesión
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
