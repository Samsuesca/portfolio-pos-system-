/**
 * PermissionEditor - Permission checkbox tree for role editing
 */
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { PermissionCatalog } from './types';

interface PermissionEditorProps {
  permissionCatalog: PermissionCatalog | null;
  selectedPermissions: string[];
  expandedCategories: Set<string>;
  onTogglePermission: (permissionCode: string) => void;
  onToggleCategory: (categoryCode: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onSelectCategoryAll: (categoryCode: string, select: boolean) => void;
}

export default function PermissionEditor({
  permissionCatalog,
  selectedPermissions,
  expandedCategories,
  onTogglePermission,
  onToggleCategory,
  onSelectAll,
  onClearAll,
  onSelectCategoryAll,
}: PermissionEditorProps) {
  if (!permissionCatalog) {
    return (
      <div className="text-center py-4 text-gray-500">Cargando permisos...</div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          Permisos ({selectedPermissions.length} seleccionados)
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            Seleccionar todos
          </button>
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Limpiar
          </button>
        </div>
      </div>

      <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
        {permissionCatalog.categories.map((category) => {
          const categoryPermissions = permissionCatalog.permissions.filter(
            (p) => p.category === category.code
          );
          const selectedCount = categoryPermissions.filter((p) =>
            selectedPermissions.includes(p.code)
          ).length;
          const isExpanded = expandedCategories.has(category.code);
          const allSelected = selectedCount === categoryPermissions.length;
          const someSelected = selectedCount > 0 && selectedCount < categoryPermissions.length;

          return (
            <div key={category.code}>
              <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <button
                  type="button"
                  onClick={() => onToggleCategory(category.code)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="font-medium text-gray-700">{category.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      allSelected
                        ? 'bg-green-100 text-green-700'
                        : someSelected
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {selectedCount}/{categoryPermissions.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCategoryAll(category.code, !allSelected);
                  }}
                  className={`text-xs px-2 py-1 rounded ${
                    allSelected
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-indigo-600 hover:bg-indigo-50'
                  }`}
                >
                  {allSelected ? 'Quitar todos' : 'Agregar todos'}
                </button>
              </div>
              {isExpanded && (
                <div className="px-4 pb-3 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {categoryPermissions.map((permission) => (
                      <label
                        key={permission.code}
                        className={`flex items-start gap-3 p-2 rounded cursor-pointer border transition ${
                          selectedPermissions.includes(permission.code)
                            ? 'bg-indigo-50 border-indigo-200'
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(permission.code)}
                          onChange={() => onTogglePermission(permission.code)}
                          className="mt-0.5 h-4 w-4 text-indigo-600 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">
                              {permission.name}
                            </span>
                            {permission.is_sensitive && (
                              <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                                Sensible
                              </span>
                            )}
                          </div>
                          {permission.description && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {permission.description}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
