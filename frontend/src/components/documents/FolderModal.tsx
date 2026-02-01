/**
 * FolderModal Component - Create/Edit folder modal
 */
import { useState, useEffect } from 'react';
import { X, Folder } from 'lucide-react';
import type { DocumentFolder, DocumentFolderCreate, DocumentFolderUpdate } from '../../types/document';
import { FOLDER_COLORS } from '../../types/document';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DocumentFolderCreate | DocumentFolderUpdate) => Promise<void>;
  folder?: DocumentFolder | null; // If provided, we're editing
  parentId?: string | null; // Parent folder ID for new folders
  isLoading?: boolean;
}

export default function FolderModal({
  isOpen,
  onClose,
  onSubmit,
  folder,
  parentId,
  isLoading = false,
}: FolderModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(FOLDER_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!folder;

  // Reset form when modal opens/closes or folder changes
  useEffect(() => {
    if (isOpen) {
      if (folder) {
        setName(folder.name);
        setDescription(folder.description || '');
        setColor(folder.color || FOLDER_COLORS[0]);
      } else {
        setName('');
        setDescription('');
        setColor(FOLDER_COLORS[0]);
      }
      setError(null);
    }
  }, [isOpen, folder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre es requerido');
      return;
    }

    try {
      const data: DocumentFolderCreate | DocumentFolderUpdate = {
        name: name.trim(),
        description: description.trim() || null,
        color,
      };

      if (!isEditing && parentId !== undefined) {
        (data as DocumentFolderCreate).parent_id = parentId;
      }

      await onSubmit(data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al guardar la carpeta');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Editar carpeta' : 'Nueva carpeta'}
          </h3>
          <button
            className="p-1 hover:bg-gray-100 rounded"
            onClick={onClose}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nombre de la carpeta"
              maxLength={255}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripcion
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Descripcion opcional"
              rows={2}
              maxLength={1000}
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center transition-transform
                    ${color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'}
                  `}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                >
                  {color === c && (
                    <Folder className="w-4 h-4 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
            <Folder className="w-6 h-6" style={{ color }} />
            <span className="text-sm font-medium text-gray-700">
              {name || 'Nueva carpeta'}
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Guardando...' : isEditing ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
