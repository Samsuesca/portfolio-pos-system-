/**
 * Garment Types tab content: toggle between school and global types,
 * table of types with images, and empty state.
 */
import React from 'react';
import { Building2, Globe, Tag, Plus, Edit2, Image as ImageIcon } from 'lucide-react';
import type { GarmentType, GlobalGarmentType } from './types';

interface School {
  id: string;
  name: string;
}

interface GarmentTypesTabProps {
  garmentTypes: GarmentType[];
  globalGarmentTypes: GlobalGarmentType[];
  showGlobalTypes: boolean;
  onToggleGlobalTypes: (show: boolean) => void;
  availableSchools: School[];
  isSuperuser: boolean;
  canManageGarmentTypes: boolean;
  onOpenGarmentTypeModal: (garmentType?: GarmentType | GlobalGarmentType, isGlobal?: boolean) => void;
  getImageUrl: (imageUrl: string | undefined | null) => string | null;
}

const GarmentTypesTab: React.FC<GarmentTypesTabProps> = ({
  garmentTypes,
  globalGarmentTypes,
  showGlobalTypes,
  onToggleGlobalTypes,
  availableSchools,
  isSuperuser,
  canManageGarmentTypes,
  onOpenGarmentTypeModal,
  getImageUrl,
}) => {
  const types = showGlobalTypes ? globalGarmentTypes : garmentTypes;

  return (
    <div className="bg-white rounded-lg shadow-sm mb-6">
      {/* Toggle between School and Global Types */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => onToggleGlobalTypes(false)}
          className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition ${
            !showGlobalTypes
              ? 'border-blue-600 text-blue-600 bg-blue-50'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Building2 className="w-4 h-4 inline mr-2" />
          Tipos del Colegio ({garmentTypes.length})
        </button>
        <button
          onClick={() => onToggleGlobalTypes(true)}
          className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition ${
            showGlobalTypes
              ? 'border-purple-600 text-purple-600 bg-purple-50'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Globe className="w-4 h-4 inline mr-2" />
          Tipos Globales ({globalGarmentTypes.length})
        </button>
      </div>

      {/* Garment Types Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className={showGlobalTypes ? 'bg-purple-50' : 'bg-blue-50'}>
            <tr>
              {!showGlobalTypes && (
                <th className="w-16 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Imagen
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre
              </th>
              {!showGlobalTypes && availableSchools.length > 1 && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Colegio
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descripcion
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Categoria
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Req. Bordado
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Medidas Custom
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {types.map((type) => {
              const schoolName = !showGlobalTypes && 'school_id' in type
                ? availableSchools.find(s => s.id === (type as GarmentType).school_id)?.name
                : null;

              const primaryImage = !showGlobalTypes && 'images' in type && Array.isArray((type as any).images)
                ? (type as any).images.find((img: any) => img.is_primary)?.image_url ||
                  (type as any).images[0]?.image_url
                : (type as any).primary_image_url;

              return (
                <tr key={type.id} className="hover:bg-gray-50">
                  {!showGlobalTypes && (
                    <td className="w-16 px-3 py-2">
                      {primaryImage ? (
                        <img
                          src={getImageUrl(primaryImage) || ''}
                          alt={type.name}
                          className="w-12 h-12 rounded object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {showGlobalTypes && <Globe className="w-4 h-4 text-purple-600 mr-2" />}
                      <span className="text-sm font-medium text-gray-900">{type.name}</span>
                    </div>
                  </td>
                  {!showGlobalTypes && availableSchools.length > 1 && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building2 className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                        <span className="text-sm text-gray-900">{schoolName || 'Sin colegio'}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{type.description || '-'}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {type.category ? (
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        type.category === 'uniforme_diario'
                          ? 'bg-blue-100 text-blue-800'
                          : type.category === 'uniforme_deportivo'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {type.category === 'uniforme_diario'
                          ? 'Diario'
                          : type.category === 'uniforme_deportivo'
                          ? 'Deportivo'
                          : 'Accesorios'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {type.requires_embroidery ? (
                      <span className="text-green-600">&#10003;</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {type.has_custom_measurements ? (
                      <span className="text-green-600">&#10003;</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      type.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {type.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {(showGlobalTypes ? isSuperuser : canManageGarmentTypes) && (
                      <button
                        onClick={() => onOpenGarmentTypeModal(type, showGlobalTypes)}
                        className={`${
                          showGlobalTypes
                            ? 'text-purple-600 hover:text-purple-800 hover:bg-purple-50'
                            : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                        } p-1 rounded transition`}
                        title="Editar tipo de prenda"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty state for garment types */}
      {types.length === 0 && (
        <div className="text-center py-12">
          <Tag className={`w-12 h-12 mx-auto mb-3 ${showGlobalTypes ? 'text-purple-400' : 'text-blue-400'}`} />
          <p className="text-gray-600">
            {showGlobalTypes
              ? 'No hay tipos de prenda globales'
              : 'No hay tipos de prenda para este colegio'}
          </p>
          {(showGlobalTypes ? isSuperuser : canManageGarmentTypes) && (
            <button
              onClick={() => onOpenGarmentTypeModal(undefined, showGlobalTypes)}
              className={`mt-4 ${
                showGlobalTypes
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white px-4 py-2 rounded-lg inline-flex items-center transition`}
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Primer Tipo
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(GarmentTypesTab);
