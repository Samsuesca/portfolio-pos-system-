/**
 * Quick Garment Type Modal - Simplified form for inline creation
 * Used inside ProductModal to quickly create a new garment type
 */
import { useState } from 'react';
import { X, Loader2, Factory, ShoppingBag } from 'lucide-react';
import { productService } from '../services/productService';
import { extractErrorMessage } from '../utils/api-client';
import type { GarmentType } from '../types/api';

interface QuickGarmentTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newType: GarmentType) => void;
  schoolId: string;
}

export default function QuickGarmentTypeModal({
  isOpen,
  onClose,
  onSuccess,
  schoolId,
}: QuickGarmentTypeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    cost_type: 'manufactured' as 'manufactured' | 'purchased',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('El nombre es requerido');
      return;
    }

    if (formData.name.trim().length < 3) {
      setError('El nombre debe tener al menos 3 caracteres');
      return;
    }

    setLoading(true);

    try {
      const data: any = {
        name: formData.name.trim(),
      };

      if (formData.category) {
        data.category = formData.category;
      }

      if (formData.description.trim()) {
        data.description = formData.description.trim();
      }

      data.cost_type = formData.cost_type;

      const newType = await productService.createGarmentType(schoolId, data);

      // Reset form
      setFormData({ name: '', category: '', description: '', cost_type: 'manufactured' });

      onSuccess(newType);
      onClose();
    } catch (err: unknown) {
      console.error('Error creating garment type:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ name: '', category: '', description: '', cost_type: 'manufactured' });
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-stone-200">
            <h3 className="text-lg font-semibold text-stone-800">
              Nuevo Tipo de Prenda
            </h3>
            <button
              onClick={handleClose}
              className="text-stone-400 hover:text-stone-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Camisa, Pantalon, Falda"
                autoFocus
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Categoria
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
              >
                <option value="">Sin categoria</option>
                <option value="uniforme_diario">Uniforme Diario</option>
                <option value="uniforme_deportivo">Uniforme Deportivo</option>
                <option value="accesorios">Accesorios</option>
              </select>
            </div>

            {/* Description (optional) */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Descripcion (opcional)
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Breve descripcion"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
              />
            </div>

            {/* Cost Type */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Origen
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, cost_type: 'manufactured' })}
                  className={`flex items-center gap-2 p-2 rounded-lg border-2 text-left transition ${
                    formData.cost_type === 'manufactured'
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <Factory className={`w-4 h-4 ${formData.cost_type === 'manufactured' ? 'text-brand-600' : 'text-stone-400'}`} />
                  <span className="text-xs font-medium text-stone-900">Se fabrica</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, cost_type: 'purchased' })}
                  className={`flex items-center gap-2 p-2 rounded-lg border-2 text-left transition ${
                    formData.cost_type === 'purchased'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <ShoppingBag className={`w-4 h-4 ${formData.cost_type === 'purchased' ? 'text-emerald-600' : 'text-stone-400'}`} />
                  <span className="text-xs font-medium text-stone-900">Se compra</span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear Tipo'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
