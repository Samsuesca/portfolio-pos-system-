'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ShoppingCart, ChevronRight } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { formatNumber } from '@/lib/utils';

export default function FloatingCartSummary() {
  const router = useRouter();
  const params = useParams();
  const schoolSlug = params.school_slug as string;

  const { getTotalItems, getTotalPrice } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevTotal, setPrevTotal] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Animate when total changes
  useEffect(() => {
    if (mounted) {
      const currentTotal = getTotalItems();
      if (currentTotal > prevTotal) {
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);
      }
      setPrevTotal(currentTotal);
    }
  }, [getTotalItems, mounted, prevTotal]);

  // Don't render on server or if cart is empty
  if (!mounted || getTotalItems() === 0) {
    return null;
  }

  const handleClick = () => {
    router.push(`/${schoolSlug}/cart`);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
      {/* Gradient shadow above */}
      <div className="h-4 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />

      <button
        onClick={handleClick}
        className={`w-full bg-brand-600 text-white px-4 py-3 flex items-center justify-between shadow-lg transition-all ${
          isAnimating ? 'scale-[1.02] bg-brand-500' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShoppingCart className="w-6 h-6" />
            <span className={`absolute -top-2 -right-2 w-5 h-5 bg-white text-brand-600 text-xs font-bold rounded-full flex items-center justify-center transition-transform ${
              isAnimating ? 'scale-125' : ''
            }`}>
              {getTotalItems()}
            </span>
          </div>
          <div className="text-left">
            <p className="text-xs text-brand-100">Tu cotizacion</p>
            <p className="font-bold text-lg">${formatNumber(getTotalPrice())}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white text-brand-600 px-4 py-2 rounded-lg font-semibold">
          Ver detalle
          <ChevronRight className="w-4 h-4" />
        </div>
      </button>
    </div>
  );
}
