'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { type GarmentTypeImage, API_BASE_URL } from '@/lib/api';
import GarmentIcon from './GarmentIcon';

interface ProductImageGalleryProps {
  images?: GarmentTypeImage[];
  primaryImageUrl?: string | null;
  productName: string;
  className?: string;
}

/**
 * E-commerce style image gallery for products
 * Shows multiple images with thumbnail navigation
 * Falls back to emoji if no images available
 */
export default function ProductImageGallery({
  images,
  primaryImageUrl,
  productName,
  className = ''
}: ProductImageGalleryProps) {
  // Find the index of the primary image, or default to 0
  const primaryIndex = images?.findIndex(img => img.is_primary) ?? 0;
  const [currentIndex, setCurrentIndex] = useState(primaryIndex >= 0 ? primaryIndex : 0);

  // Get full image URL
  const getFullImageUrl = (imageUrl: string) => {
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${API_BASE_URL}${imageUrl}`;
  };

  // No images - show emoji fallback
  if (!images || images.length === 0) {
    // Try primary image URL if available
    if (primaryImageUrl) {
      return (
        <div className={`aspect-square bg-gradient-to-br from-brand-50 to-surface-100 flex items-center justify-center overflow-hidden relative ${className}`}>
          <Image
            src={getFullImageUrl(primaryImageUrl)}
            alt={productName}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover"
            unoptimized
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.classList.add('flex', 'items-center', 'justify-center');
              }
            }}
          />
        </div>
      );
    }

    // No images at all - show garment icon
    return (
      <div className={`aspect-square bg-gradient-to-br from-brand-50 to-surface-100 flex items-center justify-center ${className}`}>
        <GarmentIcon productName={productName} className="w-16 h-16 text-stone-400" />
      </div>
    );
  }

  // Sort images by display_order
  const sortedImages = [...images].sort((a, b) => a.display_order - b.display_order);

  // Single image - no navigation needed
  if (sortedImages.length === 1) {
    return (
      <div className={`aspect-square bg-gradient-to-br from-brand-50 to-surface-100 overflow-hidden relative ${className}`}>
        <Image
          src={getFullImageUrl(sortedImages[0].image_url)}
          alt={productName}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover"
          unoptimized
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.classList.add('flex', 'items-center', 'justify-center');
              parent.classList.add('flex', 'items-center', 'justify-center');
            }
          }}
        />
      </div>
    );
  }

  // Multiple images - show gallery with navigation
  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? sortedImages.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === sortedImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className={`relative group ${className}`}>
      {/* Main Image */}
      <div className="aspect-square bg-gradient-to-br from-brand-50 to-surface-100 overflow-hidden relative">
        <Image
          src={getFullImageUrl(sortedImages[currentIndex].image_url)}
          alt={`${productName} - Imagen ${currentIndex + 1}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-opacity duration-300"
          unoptimized
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.classList.add('flex', 'items-center', 'justify-center');
              parent.classList.add('flex', 'items-center', 'justify-center');
            }
          }}
        />
      </div>

      {/* Navigation Arrows - Visible on mobile, hover on desktop */}
      <button
        onClick={handlePrevious}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full shadow-lg flex items-center justify-center opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
        aria-label="Imagen anterior"
      >
        <ChevronLeft className="w-5 h-5 text-gray-700" />
      </button>
      <button
        onClick={handleNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full shadow-lg flex items-center justify-center opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
        aria-label="Siguiente imagen"
      >
        <ChevronRight className="w-5 h-5 text-gray-700" />
      </button>

      {/* Image Counter / Dots */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
        {sortedImages.map((_, idx) => (
          <button
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(idx);
            }}
            className={`w-2 h-2 rounded-full transition-all ${
              idx === currentIndex
                ? 'bg-brand-600 w-4'
                : 'bg-white/70 hover:bg-white'
            }`}
            aria-label={`Ver imagen ${idx + 1}`}
          />
        ))}
      </div>

      {/* Image count badge */}
      <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full z-10">
        {currentIndex + 1}/{sortedImages.length}
      </div>
    </div>
  );
}
