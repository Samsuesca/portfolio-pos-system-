/**
 * Helpers para formatear entries del audit trail de costos.
 * Etiquetas y colores por CostChangeType.
 */
import type { CostChangeType } from '../services/costComponentService';

export interface CostChangeTypeInfo {
  label: string;
  color: string;       // text color (Tailwind)
  bgColor: string;     // background (Tailwind)
}

export function getCostChangeTypeInfo(type: CostChangeType): CostChangeTypeInfo {
  switch (type) {
    case 'created':
      return { label: 'Componente creado', color: 'text-green-700', bgColor: 'bg-green-50' };
    case 'updated':
      return { label: 'Actualizado', color: 'text-blue-700', bgColor: 'bg-blue-50' };
    case 'deleted':
      return { label: 'Eliminado', color: 'text-red-700', bgColor: 'bg-red-50' };
    case 'template_activated':
      return { label: 'Componente reactivado', color: 'text-purple-700', bgColor: 'bg-purple-50' };
    case 'template_deactivated':
      return { label: 'Componente desactivado', color: 'text-stone-700', bgColor: 'bg-stone-100' };
    case 'bulk_apply':
      return { label: 'Aplicado en bloque', color: 'text-amber-700', bgColor: 'bg-amber-50' };
    case 'import':
      return { label: 'Importado', color: 'text-indigo-700', bgColor: 'bg-indigo-50' };
    default:
      return { label: type, color: 'text-stone-500', bgColor: 'bg-stone-50' };
  }
}
