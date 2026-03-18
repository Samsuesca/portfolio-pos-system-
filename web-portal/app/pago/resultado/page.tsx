'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Clock, ArrowLeft, Home } from 'lucide-react';
import { paymentsApi, type PaymentStatus } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

export default function PaymentResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-[3px] border-brand-200 border-t-brand-600"></div>
          <p className="mt-4 text-stone-500 text-sm">Verificando estado del pago...</p>
        </div>
      </div>
    }>
      <PaymentResultContent />
    </Suspense>
  );
}

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paramRef = searchParams.get('ref') || searchParams.get('reference');
  const wompiId = searchParams.get('id');
  const [resolvedRef, setResolvedRef] = useState<string | null>(paramRef);

  // When Wompi redirects with ?id=, resolve our reference by querying Wompi API directly
  useEffect(() => {
    if (!resolvedRef && wompiId) {
      const wompiEnv = searchParams.get('env') === 'test' ? 'sandbox' : 'production';
      const apiUrl = wompiEnv === 'sandbox'
        ? 'https://sandbox.wompi.co/v1'
        : 'https://production.wompi.co/v1';
      fetch(`${apiUrl}/transactions/${wompiId}`)
        .then(r => r.json())
        .then(data => {
          const ref = data?.data?.reference;
          if (ref) {
            setResolvedRef(ref);
          } else {
            setError('No se pudo resolver la referencia de pago');
            setLoading(false);
          }
        })
        .catch(() => {
          setError('No se pudo verificar la transaccion');
          setLoading(false);
        });
    }
  }, [resolvedRef, wompiId, searchParams]);

  const checkStatus = useCallback(async () => {
    if (!resolvedRef) {
      if (!wompiId) {
        setError('No se encontro referencia de pago');
        setLoading(false);
      }
      return;
    }

    try {
      const status = await paymentsApi.checkStatus(resolvedRef);
      setPayment(status);

      // If still pending, poll every 5 seconds (max 60s)
      if (status.status === 'PENDING') {
        return true; // Signal to continue polling
      }
      return false;
    } catch {
      setError('No se pudo verificar el estado del pago');
      return false;
    } finally {
      setLoading(false);
    }
  }, [resolvedRef, wompiId]);

  useEffect(() => {
    let pollCount = 0;
    const maxPolls = 12; // 60 seconds max
    let timer: NodeJS.Timeout;

    const poll = async () => {
      const shouldContinue = await checkStatus();
      pollCount++;
      if (shouldContinue && pollCount < maxPolls) {
        timer = setTimeout(poll, 5000);
      }
    };

    poll();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [checkStatus]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return {
          icon: <CheckCircle className="w-20 h-20 text-green-500" />,
          title: 'Pago Aprobado',
          message: 'Tu pago fue procesado exitosamente. El saldo de tu pedido ha sido actualizado.',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
        };
      case 'DECLINED':
        return {
          icon: <XCircle className="w-20 h-20 text-red-500" />,
          title: 'Pago Rechazado',
          message: 'El pago no pudo ser procesado. Puedes intentar nuevamente con otro metodo de pago.',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
        };
      case 'ERROR':
        return {
          icon: <XCircle className="w-20 h-20 text-red-500" />,
          title: 'Error en el Pago',
          message: 'Ocurrio un error al procesar el pago. Por favor intenta nuevamente.',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
        };
      case 'VOIDED':
        return {
          icon: <XCircle className="w-20 h-20 text-gray-500" />,
          title: 'Pago Anulado',
          message: 'Este pago fue anulado.',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
        };
      default: // PENDING
        return {
          icon: <Clock className="w-20 h-20 text-amber-500 animate-pulse" />,
          title: 'Procesando Pago',
          message: 'Tu pago esta siendo procesado. Esto puede tomar unos momentos...',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
        };
    }
  };

  if (loading && !payment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-200 border-t-brand-600"></div>
          <p className="mt-4 text-gray-600">Verificando estado del pago...</p>
        </div>
      </div>
    );
  }

  if (error) {
    // Trigger sync in background so payment is reflected when user visits Mi Cuenta
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${API_BASE_URL}/api/v1/payments/sync-pending`, { method: 'POST' }).catch(() => {});

    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Pago procesado</h2>
          <p className="text-gray-600 mb-6">
            Si completaste el pago en Wompi, tu saldo sera actualizado automaticamente.
            Revisa el estado de tu pedido en Mi Cuenta.
          </p>
          <button
            onClick={() => router.push('/mi-cuenta')}
            className="px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors font-semibold"
          >
            Ir a Mis Pedidos
          </button>
        </div>
      </div>
    );
  }

  const status = payment?.status || 'PENDING';
  const config = getStatusConfig(status);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full border ${config.borderColor}`}>
        <div className="text-center">
          <div className="flex justify-center mb-6">
            {config.icon}
          </div>

          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {config.title}
          </h1>

          <p className="text-gray-600 mb-6">
            {config.message}
          </p>

          {payment && (
            <div className={`${config.bgColor} rounded-xl p-4 mb-6 text-left space-y-2`}>
              <div className="flex justify-between">
                <span className="text-gray-600 text-sm">Referencia:</span>
                <span className="font-mono text-sm font-medium">{payment.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 text-sm">Monto:</span>
                <span className="font-bold text-lg">
                  ${formatNumber(payment.amount_in_cents / 100)}
                </span>
              </div>
              {payment.payment_method_type && (
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">Metodo:</span>
                  <span className="font-medium text-sm">{payment.payment_method_type}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => router.push('/mi-cuenta')}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors font-semibold"
            >
              <ArrowLeft className="w-5 h-5" />
              Mis Pedidos
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
            >
              <Home className="w-5 h-5" />
              Inicio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
