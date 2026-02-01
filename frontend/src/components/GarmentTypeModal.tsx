/**
 * GarmentType Modal - Create/Edit Garment Type Form
 * Handles both school-specific and global garment types
 * Access: Admin (school) or Superuser (global)
 */
import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Upload, Trash2, Star, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { productService } from '../services/productService';
import { extractErrorMessage, getImageUrlWithCacheBust, refreshImageCache } from '../utils/api-client';
import type { GarmentType, GlobalGarmentType } from '../types/api';

interface GarmentTypeImage {
  id: string;
  image_url: string;
  display_order: number;
  is_primary: boolean;
  garment_type_id: string;
  school_id: string;
  created_at: string;
}

interface GarmentTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  garmentType?: GarmentType | GlobalGarmentType | null;
  isGlobal: boolean;
  schoolId?: string;
}

export default function GarmentTypeModal({
  isOpen,
  onClose,
  onSuccess,
  garmentType,
  isGlobal,
  schoolId,
}: GarmentTypeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image gallery state
  const [images, setImages] = useState<GarmentTypeImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageCacheBust, setImageCacheBust] = useState<number>(Date.now()); // Force re-render after upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    requires_embroidery: false,
    has_custom_measurements: false,
    is_active: true,
  });

  useEffect(() => {
    if (isOpen) {
      if (garmentType) {
        // Edit mode
        setFormData({
          name: garmentType.name || '',
          description: garmentType.description || '',
          category: garmentType.category || '',
          requires_embroidery: garmentType.requires_embroidery || false,
          has_custom_measurements: garmentType.has_custom_measurements || false,
          is_active: garmentType.is_active ?? true,
        });
        // Load images for existing garment types (both school-specific and global)
        if (garmentType) {
          loadImages();
        }
      } else {
        // Create mode - reset form
        setFormData({
          name: '',
          description: '',
          category: '',
          requires_embroidery: false,
          has_custom_measurements: false,
          is_active: true,
        });
        setImages([]);
      }
      setError(null);
      setImageError(null);
    }
  }, [isOpen, garmentType]);

  // Load images for garment type (supports both school-specific and global)
  const loadImages = async () => {
    if (!garmentType) return;
    // For school types, we need schoolId
    if (!isGlobal && !schoolId) return;

    setImagesLoading(true);
    try {
      let data;
      if (isGlobal) {
        data = await productService.getGlobalGarmentTypeImages(garmentType.id);
      } else if (schoolId) {
        data = await productService.getGarmentTypeImages(schoolId, garmentType.id);
      }
      setImages(data || []);
    } catch (err) {
      console.error('Error loading images:', err);
      setImageError('Error al cargar imágenes');
    } finally {
      setImagesLoading(false);
    }
  };

  // Handle file selection for upload (supports both school-specific and global)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !garmentType) return;
    // For school types, we need schoolId
    if (!isGlobal && !schoolId) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setImageError('Formato no válido. Usa JPG, PNG o WebP');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setImageError('La imagen es muy grande. Máximo 2MB');
      return;
    }

    // Check max images
    if (images.length >= 10) {
      setImageError('Máximo 10 imágenes por tipo de prenda');
      return;
    }

    setUploadingImage(true);
    setImageError(null);

    try {
      let newImage;
      if (isGlobal) {
        newImage = await productService.uploadGlobalGarmentTypeImage(garmentType.id, file);
      } else if (schoolId) {
        newImage = await productService.uploadGarmentTypeImage(schoolId, garmentType.id, file);
      }
      if (newImage) {
        setImages(prev => [...prev, newImage]);
        // Force cache bust to ensure new image displays correctly (Windows WebView2 fix)
        setImageCacheBust(Date.now());
        refreshImageCache(); // Also refresh global cache for other components
      }
    } catch (err: any) {
      console.error('Error uploading image:', err);
      setImageError(err.message || 'Error al subir imagen');
    } finally {
      setUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle delete image (supports both school-specific and global)
  const handleDeleteImage = async (imageId: string) => {
    if (!garmentType) return;
    // For school types, we need schoolId
    if (!isGlobal && !schoolId) return;

    try {
      if (isGlobal) {
        await productService.deleteGlobalGarmentTypeImage(garmentType.id, imageId);
      } else if (schoolId) {
        await productService.deleteGarmentTypeImage(schoolId, garmentType.id, imageId);
      }
      setImages(prev => prev.filter(img => img.id !== imageId));
    } catch (err: any) {
      console.error('Error deleting image:', err);
      setImageError(err.message || 'Error al eliminar imagen');
    }
  };

  // Handle set primary image (supports both school-specific and global)
  const handleSetPrimary = async (imageId: string) => {
    if (!garmentType) return;
    // For school types, we need schoolId
    if (!isGlobal && !schoolId) return;

    try {
      if (isGlobal) {
        await productService.setGlobalGarmentTypePrimaryImage(garmentType.id, imageId);
      } else if (schoolId) {
        await productService.setGarmentTypePrimaryImage(schoolId, garmentType.id, imageId);
      }
      // Update local state
      setImages(prev => prev.map(img => ({
        ...img,
        is_primary: img.id === imageId
      })));
    } catch (err: any) {
      console.error('Error setting primary image:', err);
      setImageError(err.message || 'Error al establecer imagen principal');
    }
  };

  // Get full image URL - using centralized utility with cache-busting
  const getImageUrl = (imageUrl: string) => {
    return getImageUrlWithCacheBust(imageUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data: any = {
        name: formData.name.trim(),
      };

      // Optional fields
      if (formData.description.trim()) data.description = formData.description.trim();
      if (formData.category) data.category = formData.category;
      data.requires_embroidery = formData.requires_embroidery;
      data.has_custom_measurements = formData.has_custom_measurements;
      if (garmentType) data.is_active = formData.is_active;

      if (isGlobal) {
        // Global garment type
        if (garmentType) {
          // Update existing
          await productService.updateGlobalGarmentType(garmentType.id, data);
        } else {
          // Create new
          await productService.createGlobalGarmentType(data);
        }
      } else {
        // School-specific garment type
        if (!schoolId) {
          throw new Error('School ID is required for school-specific garment types');
        }

        if (garmentType) {
          // Update existing
          await productService.updateGarmentType(schoolId, garmentType.id, data);
        } else {
          // Create new
          await productService.createGarmentType(schoolId, data);
        }
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error saving garment type:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                {garmentType ? 'Editar Tipo de Prenda' : 'Nuevo Tipo de Prenda'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {isGlobal
                  ? 'Tipo compartido entre todos los colegios'
                  : 'Tipo específico del colegio'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Scope indicator */}
            <div className={`${isGlobal ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'} border rounded-lg p-3`}>
              <p className={`text-sm ${isGlobal ? 'text-purple-700' : 'text-blue-700'}`}>
                <span className="font-medium">Alcance:</span>{' '}
                {isGlobal ? 'Global (todos los colegios)' : 'Específico del colegio'}
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                minLength={3}
                maxLength={100}
                placeholder="Ej: Camisa, Pantalón, Zapatos"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Entre 3 y 100 caracteres
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Descripción opcional del tipo de prenda"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoría
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Sin categoría</option>
                <option value="uniforme_diario">Uniforme Diario</option>
                <option value="uniforme_deportivo">Uniforme Deportivo</option>
                <option value="accesorios">Accesorios</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Opcional - Ayuda a organizar los productos
              </p>
            </div>

            {/* Boolean Flags */}
            <div className="space-y-3">
              {/* Requires Embroidery */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="requires_embroidery"
                    checked={formData.requires_embroidery}
                    onChange={(e) => setFormData({ ...formData, requires_embroidery: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
                <div>
                  <span className="text-sm font-medium text-gray-700">
                    Requiere bordado
                  </span>
                  <p className="text-xs text-gray-500">
                    Indica si los productos de este tipo necesitan personalización con bordado
                  </p>
                </div>
              </div>

              {/* Has Custom Measurements */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="has_custom_measurements"
                    checked={formData.has_custom_measurements}
                    onChange={(e) => setFormData({ ...formData, has_custom_measurements: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
                <div>
                  <span className="text-sm font-medium text-gray-700">
                    Medidas personalizadas
                  </span>
                  <p className="text-xs text-gray-500">
                    Indica si los productos requieren medidas específicas del cliente (ej: Yomber)
                  </p>
                </div>
              </div>
            </div>

            {/* Active Status - Only show when editing */}
            {garmentType && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
                <div>
                  <span className="text-sm font-medium text-gray-700">
                    {formData.is_active ? 'Tipo Activo' : 'Tipo Inactivo'}
                  </span>
                  <p className="text-xs text-gray-500">
                    {formData.is_active
                      ? 'El tipo está visible y disponible para crear productos'
                      : 'El tipo está oculto y no se puede usar para nuevos productos'}
                  </p>
                </div>
              </div>
            )}

            {/* Image Gallery - Show for both school-specific and global garment types in edit mode */}
            {garmentType && (isGlobal || schoolId) && (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Imágenes del Tipo de Prenda
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Agrega fotos desde diferentes ángulos para mostrar en el catálogo web
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {images.length}/10
                  </span>
                </div>

                {/* Image error */}
                {imageError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-700">{imageError}</p>
                    <button
                      type="button"
                      onClick={() => setImageError(null)}
                      className="ml-auto text-red-400 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Images loading */}
                {imagesLoading ? (
                  <div className="flex items-center justify-center py-8 bg-gray-50 rounded-lg">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Cargando imágenes...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-3">
                    {/* Existing images */}
                    {images.map((image) => (
                      <div
                        key={image.id}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
                          image.is_primary ? 'border-yellow-400' : 'border-gray-200'
                        } group`}
                      >
                        <img
                          src={`${getImageUrl(image.image_url)}&local=${imageCacheBust}`}
                          alt="Imagen del producto"
                          className="w-full h-full object-cover"
                        />
                        {/* Overlay with actions */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          {/* Set as primary */}
                          {!image.is_primary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(image.id)}
                              className="p-1.5 bg-white rounded-full shadow hover:bg-yellow-100 transition"
                              title="Establecer como principal"
                            >
                              <Star className="w-4 h-4 text-yellow-500" />
                            </button>
                          )}
                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(image.id)}
                            className="p-1.5 bg-white rounded-full shadow hover:bg-red-100 transition"
                            title="Eliminar imagen"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                        {/* Primary badge */}
                        {image.is_primary && (
                          <div className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                            <Star className="w-3 h-3" fill="currentColor" />
                            Principal
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Upload button */}
                    {images.length < 10 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploadingImage ? (
                          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-gray-400" />
                            <span className="text-xs text-gray-500">Agregar</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Help text */}
                <p className="text-xs text-gray-400 mt-2">
                  JPG, PNG o WebP • Máx 2MB • Click en ⭐ para marcar como principal
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  garmentType ? 'Actualizar Tipo' : 'Crear Tipo de Prenda'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
