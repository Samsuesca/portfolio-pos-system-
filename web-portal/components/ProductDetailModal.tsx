'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ShoppingCart,
  Package,
  Ruler,
  Info,
  MessageCircle,
  Phone,
  Check,
  Clock
} from 'lucide-react';
import { type GarmentTypeImage, API_BASE_URL, getProductImage } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { type ProductGroup, type ProductVariant, compareSizes } from '@/lib/types';

interface ProductDetailModalProps {
  group: ProductGroup;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (productId: string, isOrder: boolean) => void;
  initialSize?: string; // Talla pre-seleccionada (opcional)
}

/**
 * Modal de detalle de producto estilo e-commerce
 * - Galería de imágenes con navegación
 * - Selector de tallas con precios y stock
 * - Botón de agregar al carrito
 */
export default function ProductDetailModal({
  group,
  isOpen,
  onClose,
  onAddToCart,
  initialSize
}: ProductDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'sizes'>('info');
  const [addedToCart, setAddedToCart] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  // Get sorted images
  const images = group.images || [];
  const sortedImages = [...images].sort((a, b) => a.display_order - b.display_order);
  const hasImages = sortedImages.length > 0 || group.primaryImageUrl;

  // Sort variants by size
  const sortedVariants = [...group.variants].sort((a, b) => compareSizes(a.size, b.size));

  // Get full image URL
  const getFullImageUrl = (imageUrl: string) => {
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${API_BASE_URL}${imageUrl}`;
  };

  // Get current image URL
  const getCurrentImageUrl = (): string | null => {
    if (sortedImages.length > 0) {
      return getFullImageUrl(sortedImages[currentImageIndex].image_url);
    }
    if (group.primaryImageUrl) {
      return getFullImageUrl(group.primaryImageUrl);
    }
    return null;
  };

  // Navigation handlers
  const handlePrevious = useCallback(() => {
    if (sortedImages.length > 1) {
      setCurrentImageIndex(prev => prev === 0 ? sortedImages.length - 1 : prev - 1);
    }
  }, [sortedImages.length]);

  const handleNext = useCallback(() => {
    if (sortedImages.length > 1) {
      setCurrentImageIndex(prev => prev === sortedImages.length - 1 ? 0 : prev + 1);
    }
  }, [sortedImages.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          if (isZoomed) {
            setIsZoomed(false);
          } else {
            onClose();
          }
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isZoomed, handlePrevious, handleNext, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentImageIndex(0);
      setIsZoomed(false);
      setAddedToCart(false);
      setActiveTab('info');

      // Seleccionar talla inicial o primera disponible
      if (initialSize) {
        const variant = sortedVariants.find(v => v.size === initialSize);
        setSelectedVariant(variant || sortedVariants[0] || null);
      } else {
        // Seleccionar primera variante con stock, o primera si ninguna tiene
        const withStock = sortedVariants.find(v => v.stock > 0);
        setSelectedVariant(withStock || sortedVariants[0] || null);
      }

      // Find primary image index
      const primaryIdx = sortedImages.findIndex(img => img.is_primary);
      if (primaryIdx >= 0) {
        setCurrentImageIndex(primaryIdx);
      }
    }
  }, [isOpen, group.garmentTypeId, initialSize]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle add to cart with feedback
  const handleAddToCart = () => {
    if (!selectedVariant) return;
    onAddToCart(selectedVariant.id, selectedVariant.isOrder);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  if (!isOpen) return null;

  const currentImageUrl = getCurrentImageUrl();
  const currentPrice = selectedVariant?.price ?? group.basePrice;
  const currentStock = selectedVariant?.stock ?? 0;
  const isOrder = selectedVariant?.isOrder ?? true;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>

            <div className="flex flex-col lg:flex-row">
              {/* Left: Image Gallery */}
              <div className="lg:w-3/5 bg-gradient-to-br from-gray-50 to-gray-100">
                {/* Main Image */}
                <div className="relative aspect-square lg:aspect-[4/3]">
                  {currentImageUrl ? (
                    <div
                      className={`w-full h-full cursor-zoom-in ${isZoomed ? 'cursor-zoom-out' : ''}`}
                      onClick={() => setIsZoomed(!isZoomed)}
                    >
                      <img
                        src={currentImageUrl}
                        alt={group.name}
                        className={`w-full h-full transition-transform duration-300 ${
                          isZoomed
                            ? 'object-contain scale-150 cursor-move'
                            : 'object-contain'
                        }`}
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-9xl">{getProductImage(group.name)}</span>
                    </div>
                  )}

                  {/* Zoom indicator */}
                  {currentImageUrl && (
                    <button
                      onClick={() => setIsZoomed(!isZoomed)}
                      className="absolute bottom-4 right-4 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-colors"
                      aria-label={isZoomed ? 'Reducir' : 'Ampliar'}
                    >
                      {isZoomed ? (
                        <ZoomOut className="w-5 h-5 text-gray-700" />
                      ) : (
                        <ZoomIn className="w-5 h-5 text-gray-700" />
                      )}
                    </button>
                  )}

                  {/* Navigation Arrows */}
                  {sortedImages.length > 1 && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-colors"
                        aria-label="Imagen anterior"
                      >
                        <ChevronLeft className="w-6 h-6 text-gray-700" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleNext(); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-colors"
                        aria-label="Siguiente imagen"
                      >
                        <ChevronRight className="w-6 h-6 text-gray-700" />
                      </button>
                    </>
                  )}

                  {/* Image Counter */}
                  {sortedImages.length > 1 && (
                    <div className="absolute top-4 left-4 bg-black/50 text-white text-sm px-3 py-1 rounded-full">
                      {currentImageIndex + 1} / {sortedImages.length}
                    </div>
                  )}
                </div>

                {/* Thumbnail Strip */}
                {sortedImages.length > 1 && (
                  <div className="p-4 border-t border-gray-200 bg-white">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {sortedImages.map((img, idx) => (
                        <button
                          key={img.id}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                            idx === currentImageIndex
                              ? 'border-brand-600 ring-2 ring-brand-200'
                              : 'border-transparent hover:border-gray-300'
                          }`}
                        >
                          <img
                            src={getFullImageUrl(img.image_url)}
                            alt={`${group.name} - Miniatura ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Product Info */}
              <div className="lg:w-2/5 p-6 lg:p-8 overflow-y-auto max-h-[50vh] lg:max-h-[90vh]">
                {/* Yomber Badge */}
                {group.isYomber && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-4">
                    <span>✂️</span>
                    Confección Personalizada
                  </div>
                )}

                {/* Global Badge */}
                {group.isGlobal && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
                    <span>🌐</span>
                    Disponible para todos los colegios
                  </div>
                )}

                {/* Product Name */}
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">
                  {group.name}
                </h2>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-3xl lg:text-4xl font-bold text-brand-600">
                    ${formatNumber(currentPrice)}
                  </span>
                  {group.basePrice !== group.maxPrice && !selectedVariant && (
                    <span className="text-lg text-gray-400 ml-2">
                      - ${formatNumber(group.maxPrice)}
                    </span>
                  )}
                </div>

                {/* Size Selector */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Selecciona una talla:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {sortedVariants.map(variant => (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariant(variant)}
                        className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                          selectedVariant?.id === variant.id
                            ? 'bg-brand-600 text-white border-brand-600'
                            : variant.stock > 0
                              ? 'bg-white text-gray-700 border-gray-200 hover:border-brand-400'
                              : 'bg-orange-50 text-orange-600 border-orange-200 hover:border-orange-400'
                        }`}
                      >
                        {variant.size}
                        {variant.stock === 0 && selectedVariant?.id !== variant.id && (
                          <span className="ml-1 text-xs">📦</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stock Status */}
                <div className="mb-6">
                  {group.isYomber ? (
                    <div className="flex items-center gap-2 text-purple-600">
                      <Ruler className="w-5 h-5" />
                      <span className="font-medium">Requiere medidas personalizadas</span>
                    </div>
                  ) : selectedVariant ? (
                    currentStock > 0 ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <Check className="w-5 h-5" />
                        <span className="font-medium">Disponible ({currentStock} unidades)</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-orange-600">
                          <Clock className="w-5 h-5" />
                          <span className="font-medium">Sin stock - Se confecciona en 5-7 dias habiles</span>
                        </div>
                        <p className="text-xs text-gray-500 ml-7">
                          Agregalo a tu cotizacion y lo fabricamos para ti
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Info className="w-5 h-5" />
                      <span className="font-medium">Selecciona una talla</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 mb-8">
                  {group.isYomber ? (
                    <>
                      <a
                        href="https://wa.me/573001234567?text=Hola, estoy interesado en un yomber personalizado"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-semibold"
                      >
                        <MessageCircle className="w-5 h-5" />
                        Consultar por WhatsApp
                      </a>
                      <a
                        href="tel:+573001234567"
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
                      >
                        <Phone className="w-5 h-5" />
                        Llamar para cita
                      </a>
                    </>
                  ) : selectedVariant ? (
                    currentStock > 0 ? (
                      <button
                        onClick={handleAddToCart}
                        disabled={addedToCart}
                        className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-lg transition-all ${
                          addedToCart
                            ? 'bg-green-500 text-white'
                            : 'bg-brand-600 text-white hover:bg-brand-700'
                        }`}
                      >
                        {addedToCart ? (
                          <>
                            <Check className="w-5 h-5" />
                            ¡Agregado al carrito!
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-5 h-5" />
                            Agregar al carrito
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={handleAddToCart}
                        disabled={addedToCart}
                        className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-lg transition-all ${
                          addedToCart
                            ? 'bg-green-500 text-white'
                            : 'bg-orange-500 text-white hover:bg-orange-600'
                        }`}
                      >
                        {addedToCart ? (
                          <>
                            <Check className="w-5 h-5" />
                            Agregado a tu cotizacion
                          </>
                        ) : (
                          <>
                            <Clock className="w-5 h-5" />
                            Agregar a cotizacion (5-7 dias)
                          </>
                        )}
                      </button>
                    )
                  ) : (
                    <button
                      disabled
                      className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-lg bg-gray-200 text-gray-500 cursor-not-allowed"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      Selecciona una talla
                    </button>
                  )}
                </div>

                {/* Tabs for additional info */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex gap-4 mb-4 border-b border-gray-200">
                    <button
                      onClick={() => setActiveTab('info')}
                      className={`pb-2 px-1 font-medium text-sm transition-colors ${
                        activeTab === 'info'
                          ? 'text-brand-600 border-b-2 border-brand-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Info className="w-4 h-4 inline mr-1" />
                      Información
                    </button>
                    <button
                      onClick={() => setActiveTab('sizes')}
                      className={`pb-2 px-1 font-medium text-sm transition-colors ${
                        activeTab === 'sizes'
                          ? 'text-brand-600 border-b-2 border-brand-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Ruler className="w-4 h-4 inline mr-1" />
                      Guía de Tallas
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="text-sm text-gray-600">
                    {activeTab === 'info' && (
                      <div className="space-y-3">
                        <p>
                          Uniforme escolar de alta calidad, confeccionado con materiales
                          duraderos y cómodos para el uso diario.
                        </p>
                        <ul className="space-y-2 mt-4">
                          <li className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>Confección nacional de calidad</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>Materiales resistentes y duraderos</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>Acabados de alta calidad</span>
                          </li>
                        </ul>
                      </div>
                    )}

                    {activeTab === 'sizes' && (
                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-blue-800 font-medium mb-2">
                            📏 Guía de Tallas
                          </p>
                          <p className="text-blue-700 text-sm">
                            Próximamente podrás ver la guía de tallas detallada para
                            este producto. Por ahora, te recomendamos contactarnos
                            para asesoría personalizada.
                          </p>
                        </div>

                        <div className="mt-4">
                          <p className="font-medium text-gray-700 mb-2">
                            Tallas disponibles para este producto:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {sortedVariants.map(variant => (
                              <span
                                key={variant.id}
                                className={`px-3 py-1 rounded-full text-sm ${
                                  variant.stock > 0
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}
                              >
                                {variant.size}
                                {variant.stock === 0 && ' (encargo)'}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">¿Necesitas ayuda?</span>
                            <br />
                            Contáctanos por WhatsApp para recibir asesoría
                            personalizada sobre tallas.
                          </p>
                          <a
                            href="https://wa.me/573001234567?text=Hola, necesito ayuda con las tallas"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 mt-3 text-green-600 hover:text-green-700 font-medium"
                          >
                            <MessageCircle className="w-4 h-4" />
                            Consultar tallas
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
