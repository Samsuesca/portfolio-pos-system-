'use client';

import { useState, useEffect } from 'react';
import { X, Lightbulb, ShoppingCart, Calculator } from 'lucide-react';

const STORAGE_KEY = 'quotation-banner-dismissed';

export default function QuotationBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if user has dismissed the banner before
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  // Don't render on server or if dismissed
  if (!mounted || !isVisible) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-brand-50 to-brand-100 border-b border-brand-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 bg-brand-500 rounded-full flex items-center justify-center">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-900">
                Arma tu cotizacion
              </p>
              <p className="text-xs text-brand-700 hidden sm:block">
                Agrega productos al carrito para ver el total de tu pedido antes de confirmar
              </p>
              <p className="text-xs text-brand-700 sm:hidden">
                Agrega productos y ve el total
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden md:flex items-center gap-4 text-xs text-brand-700 mr-4">
              <span className="flex items-center gap-1">
                <span className="w-5 h-5 bg-brand-200 rounded-full flex items-center justify-center text-brand-700 font-bold">1</span>
                Explora
              </span>
              <span className="flex items-center gap-1">
                <span className="w-5 h-5 bg-brand-200 rounded-full flex items-center justify-center text-brand-700 font-bold">2</span>
                Agrega
              </span>
              <span className="flex items-center gap-1">
                <span className="w-5 h-5 bg-brand-200 rounded-full flex items-center justify-center text-brand-700 font-bold">3</span>
                Cotiza
              </span>
            </div>

            <button
              onClick={handleDismiss}
              className="p-1.5 text-brand-600 hover:text-brand-800 hover:bg-brand-200 rounded-lg transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
