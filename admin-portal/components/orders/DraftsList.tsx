'use client';

/**
 * DraftsList - List of saved order drafts
 */
import { FileText, Trash2, Clock, ShoppingBag } from 'lucide-react';
import { useDraftStore, formatDraftLabel, getTimeAgo, type OrderDraft } from '@/lib/stores/draftStore';

interface DraftsListProps {
  onResumeDraft: (draftId: string) => void;
}

export default function DraftsList({ onResumeDraft }: DraftsListProps) {
  const { getOrderDrafts, removeDraft } = useDraftStore();
  const orderDrafts = getOrderDrafts();

  if (orderDrafts.length === 0) {
    return null;
  }

  const handleRemove = (e: React.MouseEvent, draftId: string) => {
    e.stopPropagation();
    if (confirm('¿Eliminar este borrador?')) {
      removeDraft(draftId);
    }
  };

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-5 h-5 text-purple-600" />
        <h3 className="font-medium text-purple-900">
          Borradores Guardados ({orderDrafts.length})
        </h3>
      </div>

      <div className="space-y-2">
        {orderDrafts.map((draft) => (
          <div
            key={draft.id}
            role="button"
            tabIndex={0}
            onClick={() => onResumeDraft(draft.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onResumeDraft(draft.id);
              }
            }}
            className="w-full flex items-center justify-between p-3 bg-white border border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-slate-900 text-sm">
                  {formatDraftLabel(draft)}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {getTimeAgo(draft.updatedAt)}
                  {draft.clientName && (
                    <span className="ml-2">• {draft.clientName}</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-purple-600">
                ${draft.total.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={(e) => handleRemove(e, draft.id)}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition"
                title="Eliminar borrador"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-purple-600 mt-3">
        Click en un borrador para continuar donde lo dejaste
      </p>
    </div>
  );
}
