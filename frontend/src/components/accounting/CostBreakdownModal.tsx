/**
 * CostBreakdownModal - Modal wrapper para CostBreakdownEditor.
 *
 * El editor renderiza contenido plano (no modal). Este wrapper lo envuelve
 * para abrirlo desde ProductCostManager (por fila) o el árbol de catálogo (por prenda).
 * z-[60] para apilarse sobre el ProductCostManager (z-50).
 */
import React, { useState } from 'react';
import { X, Settings } from 'lucide-react';
import CostBreakdownEditor from './CostBreakdownEditor';
import TemplateManagerModal from './TemplateManagerModal';
import { usePermissions } from '../../hooks/usePermissions';

interface CostBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  garmentTypeId: string;
  garmentTypeName: string;
  isGlobal?: boolean;
  onCostsSaved?: () => void;
}

const CostBreakdownModal: React.FC<CostBreakdownModalProps> = ({
  isOpen,
  onClose,
  schoolId,
  garmentTypeId,
  garmentTypeName,
  isGlobal = false,
  onCostsSaved,
}) => {
  const { canManageCostTemplates } = usePermissions();
  const [templateMgrOpen, setTemplateMgrOpen] = useState(false);
  // Bump al cambiar templates: fuerza remount del editor para refetch.
  const [editorVersion, setEditorVersion] = useState(0);

  if (!isOpen) return null;

  const handleTemplatesChanged = () => {
    setEditorVersion(v => v + 1);
    onCostsSaved?.();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              Desglose de costos — {garmentTypeName}
            </h2>
            <p className="text-sm text-stone-500">
              Costo real por componentes (tela, confección, insumos) por talla.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canManageCostTemplates && (
              <button
                onClick={() => setTemplateMgrOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg"
                title="Activar/crear/editar/desactivar componentes para esta prenda"
              >
                <Settings className="w-4 h-4" />
                Gestionar componentes
              </button>
            )}
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 p-2"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <CostBreakdownEditor
            key={editorVersion}
            schoolId={schoolId}
            garmentTypeId={garmentTypeId}
            garmentTypeName={garmentTypeName}
            isGlobal={isGlobal}
            onCostsSaved={onCostsSaved}
          />
        </div>

        {templateMgrOpen && (
          <TemplateManagerModal
            isOpen={true}
            onClose={() => setTemplateMgrOpen(false)}
            schoolId={schoolId}
            garmentTypeId={garmentTypeId}
            garmentTypeName={garmentTypeName}
            isGlobal={isGlobal}
            onTemplatesChanged={handleTemplatesChanged}
          />
        )}

        <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CostBreakdownModal;
