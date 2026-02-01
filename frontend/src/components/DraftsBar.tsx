import React from 'react';
import { ShoppingCart, Package, X, Plus, Clock } from 'lucide-react';
import { useDraftStore, Draft, formatDraftLabel, getTimeAgo } from '../stores/draftStore';

interface DraftsBarProps {
  onOpenSale: (draftId: string) => void;
  onOpenOrder: (draftId: string) => void;
  onNewSale?: () => void;
  onNewOrder?: () => void;
}

export function DraftsBar({
  onOpenSale,
  onOpenOrder,
  onNewSale,
  onNewOrder
}: DraftsBarProps) {
  const { drafts, removeDraft, canAddDraft, activeDraftId } = useDraftStore();

  // No mostrar si no hay borradores
  if (drafts.length === 0) return null;

  const handleClick = (draft: Draft) => {
    if (draft.type === 'sale') {
      onOpenSale(draft.id);
    } else {
      onOpenOrder(draft.id);
    }
  };

  const handleRemove = (e: React.MouseEvent, draftId: string) => {
    e.stopPropagation();
    if (window.confirm('¿Eliminar este borrador? Se perderán los datos.')) {
      removeDraft(draftId);
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-200 px-4 py-2 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-blue-200 scrollbar-track-transparent">
        {/* Label */}
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap mr-1 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          En proceso ({drafts.length}/5):
        </span>

        {/* Draft buttons */}
        {drafts.map(draft => (
          <button
            key={draft.id}
            onClick={() => handleClick(draft)}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
              transition-all whitespace-nowrap group relative
              ${activeDraftId === draft.id
                ? 'bg-blue-600 text-white shadow-md scale-105'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-400 hover:shadow-md hover:scale-102'
              }
            `}
            title={`Última edición: ${getTimeAgo(draft.updatedAt)}`}
          >
            {/* Icono según tipo */}
            {draft.type === 'sale' ? (
              <ShoppingCart className="w-4 h-4 flex-shrink-0" />
            ) : (
              <Package className="w-4 h-4 flex-shrink-0" />
            )}

            {/* Label truncado */}
            <span className="max-w-[140px] truncate">
              {formatDraftLabel(draft)}
            </span>

            {/* Tiempo */}
            <span className={`text-xs ${activeDraftId === draft.id ? 'text-blue-200' : 'text-gray-400'}`}>
              {getTimeAgo(draft.updatedAt)}
            </span>

            {/* Botón eliminar */}
            <button
              onClick={(e) => handleRemove(e, draft.id)}
              className={`
                ml-1 p-0.5 rounded-full transition-all opacity-60 hover:opacity-100
                ${activeDraftId === draft.id
                  ? 'hover:bg-blue-500 text-white'
                  : 'hover:bg-red-100 hover:text-red-600 text-gray-400'
                }
              `}
              title="Eliminar borrador"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </button>
        ))}

        {/* Separador y botones de nuevo */}
        {canAddDraft() && (onNewSale || onNewOrder) && (
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-300">
            {onNewSale && (
              <button
                onClick={onNewSale}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                title="Nueva venta"
              >
                <Plus className="w-3 h-3" />
                <ShoppingCart className="w-3.5 h-3.5" />
              </button>
            )}
            {onNewOrder && (
              <button
                onClick={onNewOrder}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                title="Nuevo encargo"
              >
                <Plus className="w-3 h-3" />
                <Package className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DraftsBar;
