/**
 * SchoolVisibilityChecklist — selector de colegios donde un producto global
 * es visible en el catalogo publico. Modelo de exclusion: checked = visible,
 * unchecked = oculto (se agrega a hiddenSchoolIds).
 */
import { Loader2 } from 'lucide-react';

interface SchoolOption {
  id: string;
  name: string;
}

interface SchoolVisibilityChecklistProps {
  schools: SchoolOption[];
  /** Colegios donde el global esta OCULTO. */
  hiddenSchoolIds: string[];
  onChange: (hiddenSchoolIds: string[]) => void;
  loading?: boolean;
  disabled?: boolean;
}

export default function SchoolVisibilityChecklist({
  schools,
  hiddenSchoolIds,
  onChange,
  loading = false,
  disabled = false,
}: SchoolVisibilityChecklistProps) {
  const hidden = new Set(hiddenSchoolIds);

  const toggle = (schoolId: string) => {
    const next = new Set(hidden);
    if (next.has(schoolId)) {
      next.delete(schoolId); // pasa a visible
    } else {
      next.add(schoolId); // pasa a oculto
    }
    onChange(Array.from(next));
  };

  const visibleCount = schools.length - hiddenSchoolIds.length;

  return (
    <div className="border border-stone-200 rounded-lg p-3 bg-stone-50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-stone-700">Visible en colegios</span>
        {!loading && (
          <span className="text-xs text-stone-500">
            {visibleCount} de {schools.length}
          </span>
        )}
      </div>
      <p className="text-xs text-stone-500 mb-3">
        Desmarca un colegio para ocultar este producto de su catálogo público.
        Aplica a todas las tallas de este tipo de prenda.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-stone-500 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando visibilidad...
        </div>
      ) : schools.length === 0 ? (
        <p className="text-sm text-stone-400 py-1">No hay colegios activos.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto">
          {schools.map((school) => {
            const isVisible = !hidden.has(school.id);
            return (
              <label
                key={school.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition ${
                  disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isVisible}
                  disabled={disabled}
                  onChange={() => toggle(school.id)}
                  className="w-4 h-4 rounded border-stone-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-stone-700 truncate">{school.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
