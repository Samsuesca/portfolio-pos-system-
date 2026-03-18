'use client';

/**
 * Payment Information Page
 *
 * Modern payment page showing Wompi online payments as primary method
 * and in-person payment as secondary option.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  CreditCard,
  Shield,
  Smartphone,
  Building2,
  Store,
  ArrowLeft,
  ArrowRight,
  Clock,
  CheckCircle,
  QrCode,
} from 'lucide-react';
import { paymentsApi } from '@/lib/api';

const PAYMENT_METHODS = [
  { name: 'Tarjetas', desc: 'Visa, Mastercard, Amex', icon: CreditCard },
  { name: 'PSE', desc: 'Debito bancario', icon: Building2 },
  { name: 'Nequi', desc: 'Pago desde la app', icon: Smartphone },
  { name: 'Daviplata', desc: 'Pago desde la app', icon: Smartphone },
  { name: 'Bancolombia QR', desc: 'Escanea y paga', icon: QrCode },
];

export default function PaymentPage() {
  const router = useRouter();
  const [wompiEnabled, setWompiEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    paymentsApi
      .getConfig()
      .then((config) => setWompiEnabled(config.enabled))
      .catch(() => setWompiEnabled(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-green-50/30">
      {/* Header */}
      <header className="bg-white border-b border-surface-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center text-slate-600 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Volver al Inicio
          </button>
        </div>
      </header>

      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center bg-green-50 rounded-2xl px-8 py-4 mb-6 border border-green-100">
              <Image
                src="/wompi-logo.png"
                alt="Wompi - Pasarela de pagos"
                width={180}
                height={90}
                className="h-12 sm:h-16 w-auto"
                style={{ width: 'auto' }}
                priority
              />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 font-display">
              Pagos Seguros
            </h1>
            <p className="text-lg text-gray-600 max-w-xl mx-auto">
              Realiza tus pagos de forma segura y rapida con Wompi, nuestra pasarela de pagos certificada
            </p>
          </div>

          {/* Online Payment Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-surface-200 overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 sm:px-8 py-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <CreditCard className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold">Pago en Linea</h2>
                  <p className="text-green-100 text-sm sm:text-base">
                    Paga al instante desde cualquier lugar
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              {/* Accepted methods */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
                {PAYMENT_METHODS.map((method) => (
                  <div
                    key={method.name}
                    className="flex flex-col items-center p-3 rounded-xl bg-surface-50 border border-surface-100"
                  >
                    <method.icon className="w-6 h-6 text-green-600 mb-2" />
                    <span className="text-sm font-semibold text-gray-800">{method.name}</span>
                    <span className="text-xs text-gray-500 text-center">{method.desc}</span>
                  </div>
                ))}
              </div>

              {/* How it works */}
              <div className="bg-green-50 border border-green-100 rounded-xl p-5 mb-6">
                <h3 className="font-bold text-green-900 mb-3">Como funciona</h3>
                <div className="space-y-3">
                  {[
                    'Realiza tu pedido en linea o en la tienda',
                    'Selecciona "Pagar en linea" desde tu cuenta o al finalizar la compra',
                    'Seras redirigido a Wompi, nuestra pasarela de pagos certificada',
                    'Tu pago se confirma automaticamente y procesamos tu pedido',
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-green-800 text-sm">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              {wompiEnabled && (
                <button
                  onClick={() => router.push('/mi-cuenta')}
                  className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold text-lg shadow-md shadow-green-200 hover:shadow-lg hover:shadow-green-200"
                >
                  Ir a Mis Pedidos para Pagar
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}

              {wompiEnabled === false && (
                <div className="text-center py-3 px-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-amber-800 text-sm">
                    Pagos en linea temporalmente no disponibles. Usa pago presencial.
                  </p>
                </div>
              )}

              {/* Trust badges */}
              <div className="flex flex-col items-center gap-4 mt-6 pt-6 border-t border-surface-100">
                <div className="flex items-center justify-center gap-6">
                  <div className="flex items-center gap-2 text-gray-500 text-xs">
                    <Shield className="w-4 h-4" />
                    <span>Encriptado SSL</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 text-xs">
                    <CheckCircle className="w-4 h-4" />
                    <span>Pagos seguros</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 text-xs">
                    <Clock className="w-4 h-4" />
                    <span>Confirmacion inmediata</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-60">
                  <span className="text-xs text-gray-400">Procesado por</span>
                  <Image
                    src="/wompi-logo.png"
                    alt="Wompi"
                    width={80}
                    height={40}
                    className="h-5 w-auto"
                    style={{ width: 'auto' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* In-Person Payment Card */}
          <div className="bg-white rounded-2xl shadow-md border border-surface-200 overflow-hidden mb-8">
            <div className="px-6 sm:px-8 py-5 border-b border-surface-100">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Store className="w-6 h-6 text-amber-700" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                    Pago Presencial
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Paga directamente en nuestra tienda
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="flex items-start gap-3 p-4 bg-surface-50 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">Efectivo</p>
                    <p className="text-gray-500 text-xs">Pago en pesos colombianos</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-surface-50 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">Contra entrega</p>
                    <p className="text-gray-500 text-xs">Paga cuando recibas tu pedido</p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-amber-800 text-sm">
                  <strong>Horario de atencion:</strong> Lunes a Sabado, 8:00 AM - 6:00 PM
                </p>
                <p className="text-amber-700 text-xs mt-1">
                  Comunicate con nosotros para coordinar la entrega o recogida de tu pedido.
                </p>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="text-center">
            <p className="text-gray-500 text-sm mb-2">
              Preguntas sobre tu pago?
            </p>
            <div className="flex items-center justify-center gap-4">
              <a
                href="https://wa.me/573001234567"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 hover:text-green-700 font-medium text-sm"
              >
                WhatsApp: 300-123-4567
              </a>
              <span className="text-gray-300">|</span>
              <a
                href="mailto:contact@example.com"
                className="text-green-600 hover:text-green-700 font-medium text-sm"
              >
                contact@example.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
