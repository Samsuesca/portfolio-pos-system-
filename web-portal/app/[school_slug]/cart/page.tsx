'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, School as SchoolIcon, Package, Share2, Copy, Check, Clock, Calculator } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import GarmentIcon from '@/components/GarmentIcon';
import { formatNumber } from '@/lib/utils';

export default function CartPage() {
  const params = useParams();
  const router = useRouter();
  const schoolSlug = params.school_slug as string;
  const [copied, setCopied] = useState(false);

  const { items, removeItem, updateQuantity, getTotalPrice, getTotalItems, getItemsBySchool, hasOrderItems } = useCartStore();

  const handleCheckout = () => {
    router.push(`/${schoolSlug}/checkout`);
  };

  // Generate quotation text for sharing
  const getQuotationText = () => {
    const itemsBySchool = getItemsBySchool();
    let text = 'Mi Cotizacion - Uniformes Consuelo Rios\n';
    text += '================================\n\n';

    Array.from(itemsBySchool.entries()).forEach(([schoolId, schoolItems]) => {
      const school = schoolItems[0].school;
      text += `${school.name}:\n`;
      schoolItems.forEach(item => {
        const isOrderText = item.isOrder ? ' (Encargo 5-7 dias)' : '';
        text += `- ${item.product.name} (${item.product.size || 'Unica'}) x${item.quantity} = $${formatNumber(item.product.price * item.quantity)}${isOrderText}\n`;
      });
      text += '\n';
    });

    text += `TOTAL: $${formatNumber(getTotalPrice())}\n`;
    text += '\nVer catalogo: https://yourdomain.com';
    return text;
  };

  const handleShare = async () => {
    const text = getQuotationText();

    // Try native share first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mi Cotizacion - Uniformes Consuelo Rios',
          text: text,
        });
        return;
      } catch (err) {
        // User cancelled or error, fall back to clipboard
      }
    }

    // Fall back to clipboard
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-surface-50">
        <header className="bg-white border-b border-surface-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={() => router.push(`/${schoolSlug}`)}
              className="flex items-center text-slate-600 hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Volver al catálogo
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <div className="w-24 h-24 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calculator className="w-12 h-12 text-slate-400" />
            </div>
            <h2 className="text-2xl font-bold text-primary font-display mb-2">
              Tu cotizacion esta vacia
            </h2>
            <p className="text-slate-600 mb-8">
              Explora el catalogo y agrega productos para armar tu cotizacion
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors font-medium"
            >
              Ver catálogos
            </button>
          </div>
        </main>
      </div>
    );
  }

  const itemsBySchool = getItemsBySchool();

  return (
    <div className="min-h-screen bg-surface-50">
      <header className="bg-white border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center text-slate-600 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Volver
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-primary font-display flex items-center gap-3">
            <Calculator className="w-8 h-8 text-brand-600" />
            Tu Cotizacion
          </h1>
          <button
            onClick={handleShare}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              copied
                ? 'bg-green-100 text-green-700'
                : 'bg-surface-100 text-slate-600 hover:bg-surface-200'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copiado
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                Compartir
              </>
            )}
          </button>
        </div>
        <p className="text-slate-600 mb-8">
          {getTotalItems()} {getTotalItems() === 1 ? 'producto' : 'productos'} en tu cotizacion
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Items List */}
          <div className="lg:col-span-2 space-y-6">
            {Array.from(itemsBySchool.entries()).map(([schoolId, schoolItems]) => {
              const school = schoolItems[0].school;
              const schoolTotal = schoolItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

              return (
                <div key={schoolId} className="bg-white rounded-xl border border-surface-200 p-6">
                  {/* School Header */}
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-surface-200">
                    <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
                      <SchoolIcon className="w-6 h-6 text-brand-600" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg text-primary font-display">
                        {school.name}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {schoolItems.length} {schoolItems.length === 1 ? 'producto' : 'productos'}
                      </p>
                    </div>
                  </div>

                  {/* Products from this school */}
                  <div className="space-y-4">
                    {schoolItems.map((item) => (
                      <div
                        key={item.product.id}
                        className={`flex items-center gap-4 p-4 rounded-lg ${
                          item.isOrder
                            ? 'bg-orange-50 border border-orange-200'
                            : 'bg-surface-50'
                        }`}
                      >
                        {/* Product Image */}
                        <div className={`w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          item.isOrder
                            ? 'bg-gradient-to-br from-orange-100 to-orange-50'
                            : 'bg-gradient-to-br from-brand-50 to-surface-100'
                        }`}>
                          <GarmentIcon productName={item.product.name} className="w-10 h-10 text-stone-400" />
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-primary truncate">
                              {item.product.name}
                            </h3>
                            {item.isOrder && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500 text-white text-xs font-medium rounded-full">
                                <Package className="w-3 h-3" />
                                Encargo
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500">
                            {item.product.size || 'Talla única'}
                          </p>
                          <p className={`text-lg font-bold mt-1 ${item.isOrder ? 'text-orange-600' : 'text-brand-600'}`}>
                            ${formatNumber(item.product.price)}
                          </p>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="w-8 h-8 rounded-lg bg-white border border-surface-200 hover:bg-surface-100 flex items-center justify-center transition-colors"
                          >
                            <Minus className="w-4 h-4 text-slate-600" />
                          </button>
                          <span className="w-10 text-center font-semibold text-primary">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            disabled={!item.isOrder && item.quantity >= (item.product.stock ?? item.product.stock_quantity ?? item.product.inventory_quantity ?? 0)}
                            className="w-8 h-8 rounded-lg bg-white border border-surface-200 hover:bg-surface-100 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-4 h-4 text-slate-600" />
                          </button>
                        </div>

                        {/* Subtotal & Remove */}
                        <div className="flex flex-col items-end gap-2">
                          <p className={`text-xl font-bold ${item.isOrder ? 'text-orange-600' : 'text-primary'}`}>
                            ${formatNumber(item.product.price * item.quantity)}
                          </p>
                          <button
                            onClick={() => removeItem(item.product.id)}
                            className="text-red-500 hover:text-red-600 transition-colors flex items-center gap-1 text-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* School Subtotal */}
                  <div className="mt-4 pt-4 border-t border-surface-200 flex justify-between items-center">
                    <span className="font-semibold text-slate-700">Subtotal {school.name}:</span>
                    <span className="text-xl font-bold text-brand-600">
                      ${formatNumber(schoolTotal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-surface-200 p-6 sticky top-4">
              <h2 className="text-lg font-bold text-primary font-display mb-4">
                Resumen de Cotizacion
              </h2>

              <div className="space-y-3 mb-6">
                {items.map((item) => (
                  <div key={item.product.id} className="flex justify-between text-sm">
                    <span className={`truncate pr-2 flex items-center gap-1 ${item.isOrder ? 'text-orange-600' : 'text-slate-600'}`}>
                      {item.isOrder && <Clock className="w-3 h-3 flex-shrink-0" />}
                      {item.product.name} x{item.quantity}
                    </span>
                    <span className={`font-medium whitespace-nowrap ${item.isOrder ? 'text-orange-600' : 'text-primary'}`}>
                      ${formatNumber(item.product.price * item.quantity)}
                    </span>
                  </div>
                ))}

                <div className="border-t border-surface-200 pt-3 flex justify-between">
                  <span className="font-bold text-primary">Total Cotizacion</span>
                  <span className="text-2xl font-bold text-brand-600 font-display">
                    ${formatNumber(getTotalPrice())}
                  </span>
                </div>
              </div>

              {/* Order items notice */}
              {hasOrderItems() && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-orange-700">
                      <span className="font-semibold">Incluye productos por encargo.</span> Tiempo de confeccion: 5-7 dias habiles.
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={handleCheckout}
                className="w-full py-4 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors font-bold shadow-lg hover:shadow-xl"
              >
                Confirmar Pedido
              </button>

              <p className="text-xs text-slate-500 text-center mt-4">
                Al confirmar, coordinaremos la entrega de tu pedido
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
