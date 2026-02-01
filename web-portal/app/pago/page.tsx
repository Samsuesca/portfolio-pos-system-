'use client';

/**
 * Payment Information Page
 *
 * Displays active payment methods (bank accounts, Nequi, QR codes)
 * configured by admin for customers to make payments.
 */

import { useEffect, useState } from 'react';
import { Building2, Smartphone, CreditCard, QrCode, Copy, Check } from 'lucide-react';

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

const METHOD_TYPE_LABELS: Record<string, string> = {
  nequi: 'Nequi',
  bank_account: 'Cuenta Bancaria',
  daviplata: 'Daviplata',
  other: 'Otro'
};

const METHOD_TYPE_ICONS: Record<string, any> = {
  nequi: Smartphone,
  bank_account: Building2,
  daviplata: Smartphone,
  other: CreditCard
};

export default function PaymentPage() {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadPaymentAccounts();
  }, []);

  const loadPaymentAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/payment-accounts/public`);

      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (error) {
      console.error('Error loading payment accounts:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando información de pago...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Métodos de Pago
          </h1>
          <p className="text-lg text-gray-600">
            Realiza tu pago a través de cualquiera de nuestras cuentas
          </p>
        </div>

        {/* Payment Accounts */}
        {accounts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <CreditCard className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No hay métodos de pago configurados</p>
          </div>
        ) : (
          <div className="space-y-6">
            {accounts.map((account) => {
              const Icon = METHOD_TYPE_ICONS[account.method_type] || CreditCard;

              return (
                <div
                  key={account.id}
                  className="bg-white rounded-lg shadow-lg border-2 border-gray-200 overflow-hidden hover:border-green-500 transition"
                >
                  {/* Header */}
                  <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{account.account_name}</h2>
                        <p className="text-green-100 text-sm">
                          {METHOD_TYPE_LABELS[account.method_type]}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Account Details */}
                      <div className="space-y-4">
                        {/* Account Holder */}
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">
                            Titular
                          </label>
                          <p className="text-lg font-semibold text-gray-900">
                            {account.account_holder}
                          </p>
                        </div>

                        {/* Account Number */}
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">
                            Número de Cuenta
                          </label>
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-semibold text-gray-900 flex-1">
                              {account.account_number}
                            </p>
                            <button
                              onClick={() => copyToClipboard(account.account_number, `number-${account.id}`)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition"
                              title="Copiar número"
                            >
                              {copiedId === `number-${account.id}` ? (
                                <Check className="w-5 h-5 text-green-600" />
                              ) : (
                                <Copy className="w-5 h-5 text-gray-400" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Bank Name */}
                        {account.bank_name && (
                          <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1">
                              Banco
                            </label>
                            <p className="text-lg font-semibold text-gray-900">
                              {account.bank_name}
                            </p>
                          </div>
                        )}

                        {/* Account Type */}
                        {account.account_type && (
                          <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1">
                              Tipo de Cuenta
                            </label>
                            <p className="text-lg font-semibold text-gray-900">
                              {account.account_type}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* QR Code */}
                      {account.qr_code_url && (
                        <div className="flex flex-col items-center justify-center bg-gray-50 rounded-lg p-4">
                          <div className="mb-3 flex items-center gap-2 text-gray-700">
                            <QrCode className="w-5 h-5" />
                            <span className="font-medium">Código QR</span>
                          </div>
                          <img
                            src={account.qr_code_url}
                            alt={`QR Code ${account.account_name}`}
                            className="w-48 h-48 object-contain border-2 border-gray-300 rounded-lg"
                          />
                          <p className="text-sm text-gray-500 mt-2 text-center">
                            Escanea para pagar con tu app
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Instructions */}
                    {account.instructions && (
                      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                          <span>📋</span> Instrucciones
                        </h3>
                        <p className="text-blue-800 whitespace-pre-wrap">
                          {account.instructions}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Information */}
        <div className="mt-12 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-900 mb-3 text-lg">
            ⚠️ Importante
          </h3>
          <ul className="space-y-2 text-yellow-800">
            <li className="flex items-start gap-2">
              <span className="text-yellow-600 mt-1">•</span>
              <span>
                Después de realizar el pago, guarda el comprobante de transferencia
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600 mt-1">•</span>
              <span>
                Envía el comprobante al WhatsApp: <strong>300-123-4567</strong> o <strong>300-765-4321</strong>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600 mt-1">•</span>
              <span>
                Tu pedido será procesado una vez confirmemos el pago
              </span>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-2">¿Tienes dudas sobre el pago?</p>
          <a
            href="mailto:contact@example.com"
            className="text-green-600 hover:text-green-700 font-medium"
          >
            contact@example.com
          </a>
        </div>
      </div>
    </div>
  );
}
