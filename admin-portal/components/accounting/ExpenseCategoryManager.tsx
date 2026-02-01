'use client';

import { useState } from 'react';
import {
  X, Plus, Pencil, Trash2, Shield, AlertCircle, Loader2, Check, GripVertical
} from 'lucide-react';
import {
  useExpenseCategories,
  DEFAULT_CATEGORY_COLORS
} from '@/lib/hooks/useExpenseCategories';
import type {
  ExpenseCategoryListItem,
  ExpenseCategoryCreate,
  ExpenseCategoryUpdate
} from '@/lib/services/accountingService';

interface ExpenseCategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CategoryFormData {
  code: string;
  name: string;
  description: string;
  color: string;
  is_active: boolean;
}

const initialFormData: CategoryFormData = {
  code: '',
  name: '',
  description: '',
  color: '#9CA3AF',
  is_active: true
};

const ExpenseCategoryManager: React.FC<ExpenseCategoryManagerProps> = ({
  isOpen,
  onClose
}) => {
  const {
    categories,
    loading,
    error,
    refresh,
    createCategory,
    updateCategory,
    deleteCategory,
    permanentDeleteCategory
  } = useExpenseCategories({ includeInactive: true });

  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategoryListItem | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(initialFormData);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [permanentDeletingId, setPermanentDeletingId] = useState<string | null>(null);
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  if (!isOpen) return null;

  const handleNew = () => {
    setEditingCategory(null);
    setFormData(initialFormData);
    setFormError(null);
    setShowForm(true);
  };

  const handleEdit = (category: ExpenseCategoryListItem) => {
    setEditingCategory(category);
    setFormData({
      code: category.code,
      name: category.name,
      description: '',
      color: category.color,
      is_active: category.is_active
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingCategory(null);
    setFormData(initialFormData);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('El nombre es requerido');
      return;
    }

    if (!editingCategory && !formData.code.trim()) {
      setFormError('El código es requerido');
      return;
    }

    if (!editingCategory) {
      const codeRegex = /^[a-z][a-z0-9_]*$/;
      if (!codeRegex.test(formData.code.toLowerCase())) {
        setFormError('El código debe empezar con letra y solo contener letras, números y guiones bajos');
        return;
      }
    }

    try {
      setSaving(true);

      if (editingCategory) {
        const updateData: ExpenseCategoryUpdate = {
          name: formData.name,
          color: formData.color,
          is_active: formData.is_active
        };
        if (formData.description.trim()) {
          updateData.description = formData.description;
        }
        await updateCategory(editingCategory.id, updateData);
      } else {
        const createData: ExpenseCategoryCreate = {
          code: formData.code.toLowerCase(),
          name: formData.name,
          color: formData.color
        };
        if (formData.description.trim()) {
          createData.description = formData.description;
        }
        await createCategory(createData);
      }

      handleCancelForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar';
      if (err && typeof err === 'object' && 'response' in err) {
        const response = (err as { response?: { data?: { detail?: string } } }).response;
        if (response?.data?.detail) {
          setFormError(response.data.detail);
          return;
        }
      }
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: ExpenseCategoryListItem) => {
    if (category.is_system) {
      alert('No se pueden eliminar categorías del sistema');
      return;
    }

    if (!confirm(`¿Eliminar la categoría "${category.name}"?`)) {
      return;
    }

    try {
      setDeletingId(category.id);
      await deleteCategory(category.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar';
      alert(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handlePermanentDelete = async (category: ExpenseCategoryListItem) => {
    if (category.is_system || category.is_active) return;

    if (!window.confirm(
      `¿Eliminar PERMANENTEMENTE la categoría "${category.name}"?\n\nEsta acción no se puede deshacer.`
    )) {
      return;
    }

    try {
      setPermanentDeletingId(category.id);
      await permanentDeleteCategory(category.id);
      alert(`Categoría "${category.name}" eliminada permanentemente.`);
    } catch (err) {
      let message = 'Error al eliminar permanentemente';
      if (err && typeof err === 'object' && 'response' in err) {
        const response = (err as { response?: { status?: number; data?: { detail?: string } } }).response;
        if (response?.data?.detail) {
          message = response.data.detail;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      alert(message);
    } finally {
      setPermanentDeletingId(null);
    }
  };

  const displayedCategories = showOnlyActive
    ? categories.filter((c) => c.is_active)
    : categories;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">
            Gestionar Categorías de Gastos
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700">{error}</p>
              <button
                onClick={refresh}
                className="ml-auto text-red-600 hover:text-red-800 font-medium"
              >
                Reintentar
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}

          {/* Form */}
          {showForm && (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">
                {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingCategory && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Código *
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase() })}
                      placeholder="ej: marketing_digital"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={saving}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Solo letras minúsculas, números y guiones bajos
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ej: Marketing Digital"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción opcional..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    disabled={saving}
                  />
                </div>

                {/* Color Picker */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_CATEGORY_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-8 h-8 rounded-lg transition-all ${
                          formData.color === color
                            ? 'ring-2 ring-offset-2 ring-blue-500 scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        {formData.color === color && (
                          <Check className="w-4 h-4 text-white mx-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Toggle (only for edit) */}
                {editingCategory && (
                  <div className="flex items-center justify-between p-3 bg-slate-100 rounded-lg">
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Estado
                      </label>
                      <p className="text-xs text-slate-500">
                        Las categorías inactivas no aparecen al crear gastos
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        formData.is_active ? 'bg-green-500' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.is_active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                )}

                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{formError}</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    disabled={saving}
                    className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingCategory ? 'Guardar Cambios' : 'Crear Categoría'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Add Button */}
          {!showForm && !loading && (
            <button
              onClick={handleNew}
              className="w-full mb-4 p-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nueva Categoría
            </button>
          )}

          {/* Active/Inactive Filter Toggle */}
          {!loading && categories.length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-600">
                {displayedCategories.length} categoría{displayedCategories.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setShowOnlyActive(!showOnlyActive)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  showOnlyActive
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    showOnlyActive ? 'bg-green-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      showOnlyActive ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </span>
                {showOnlyActive ? 'Solo activas' : 'Todas'}
              </button>
            </div>
          )}

          {/* Categories List */}
          {!loading && displayedCategories.length > 0 && (
            <div className="space-y-2">
              {displayedCategories.map((category) => (
                <div
                  key={category.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    category.is_active
                      ? 'bg-white border-slate-200'
                      : 'bg-slate-50 border-slate-200 opacity-50'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0 cursor-grab" />

                  <div
                    className="w-3 h-8 rounded-full flex-shrink-0"
                    style={{ backgroundColor: category.color }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 truncate">
                        {category.name}
                      </span>
                      {category.is_system && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                          <Shield className="w-3 h-3" />
                          Sistema
                        </span>
                      )}
                      {!category.is_active && (
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded-full">
                          (Inactiva)
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-slate-500">{category.code}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(category)}
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {!category.is_system && (
                      <button
                        onClick={() => handleDelete(category)}
                        disabled={deletingId === category.id}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                        title="Eliminar"
                      >
                        {deletingId === category.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    {!category.is_active && !category.is_system && (
                      <button
                        onClick={() => handlePermanentDelete(category)}
                        disabled={permanentDeletingId === category.id}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                        title="Eliminar permanentemente"
                      >
                        {permanentDeletingId === category.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Eliminar permanente
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && displayedCategories.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <p>
                {showOnlyActive && categories.length > 0
                  ? 'No hay categorías activas. Desactiva el filtro para ver todas.'
                  : 'No hay categorías'}
              </p>
            </div>
          )}

          {/* Help Text */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Nota:</strong> Las categorías del sistema (marcadas con{' '}
              <Shield className="w-3 h-3 inline" />) no se pueden eliminar, pero
              puedes editar su nombre y color. Las categorías personalizadas
              se pueden eliminar si no están siendo usadas en gastos.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpenseCategoryManager;
