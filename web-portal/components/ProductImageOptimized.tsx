'use client';

import { useState } from 'react';
import Image from 'next/image';
import { type GarmentTypeImage, API_BASE_URL } from '@/lib/api';
import GarmentIcon from './GarmentIcon';

interface ProductImageOptimizedProps {
  images?: GarmentTypeImage[];
  primaryImageUrl?: string | null;
  productName: string;
  priority?: boolean; // Para imágenes above-the-fold
  className?: string;
  sizes?: string;
}

/**
 * Componente de imagen optimizado para productos usando next/image
 * Incluye lazy loading automático, optimización de tamaño, y placeholder blur
 */
export default function ProductImageOptimized({
  images,
  primaryImageUrl,
  productName,
  priority = false,
  className = '',
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw'
}: ProductImageOptimizedProps) {
  const [imageError, setImageError] = useState(false);

  // Obtener URL de imagen
  const getImageUrl = (): string | null => {
    // Primero intentar con el array de imágenes
    if (images && images.length > 0) {
      // Buscar imagen primaria o usar la primera
      const primary = images.find(img => img.is_primary);
      return primary?.image_url || images[0].image_url;
    }
    // Fallback a primaryImageUrl
    if (primaryImageUrl) {
      return primaryImageUrl;
    }
    return null;
  };

  // Construir URL completa
  const getFullImageUrl = (imageUrl: string): string => {
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${API_BASE_URL}${imageUrl}`;
  };

  const imageUrl = getImageUrl();

  // Sin imagen o error - mostrar SVG silhouette
  if (!imageUrl || imageError) {
    return (
      <div className={`aspect-square bg-gradient-to-br from-brand-50 to-surface-200 flex items-center justify-center ${className}`}>
        <GarmentIcon productName={productName} className="w-16 h-16 sm:w-20 sm:h-20 text-stone-400" />
      </div>
    );
  }

  const fullUrl = getFullImageUrl(imageUrl);

  return (
    <div className={`aspect-square relative bg-surface-100 overflow-hidden ${className}`}>
      <Image
        src={fullUrl}
        alt={productName}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-300 hover:scale-105"
        loading={priority ? 'eager' : 'lazy'}
        priority={priority}
        unoptimized
        onError={() => setImageError(true)}
      />
    </div>
  );
}
