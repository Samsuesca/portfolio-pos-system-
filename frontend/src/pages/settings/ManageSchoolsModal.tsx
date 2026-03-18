/**
 * Manage Schools Modal
 * Lists schools with edit/toggle actions. Opens SchoolModal for create/edit.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Edit2, CheckCircle, XCircle, Loader2, School } from 'lucide-react';
import toast from 'react-hot-toast';
import SchoolModal from '../../components/SchoolModal';
import { schoolService, type School as SchoolType } from '../../services/schoolService';
import { useConfigStore } from '../../stores/configStore';

interface ManageSchoolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ManageSchoolsModal: React.FC<ManageSchoolsModalProps> = ({ isOpen, onClose }) => {
  const { apiUrl } = useConfigStore();

  const [schools, setSchools] = useState<SchoolType[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<SchoolType | null>(null);
  const [showSchoolModal, setShowSchoolModal] = useState(false);

  const loadSchools = useCallback(async () => {
    setLoading(true);
    try {
      const data = await schoolService.getSchools(false);
      setSchools(data);
    } catch (err: any) {
      console.error('Error loading schools:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSchools();
    }
  }, [isOpen, loadSchools]);

  const handleOpenCreate = () => {
    setSelectedSchool(null);
    setShowSchoolModal(true);
  };

  const handleOpenEdit = (school: SchoolType) => {
    setSelectedSchool(school);
    setShowSchoolModal(true);
  };

  const handleSchoolModalClose = () => {
    setShowSchoolModal(false);
    setSelectedSchool(null);
  };

  const handleSchoolSaved = () => {
    loadSchools();
  };

  const handleToggleActive = async (school: SchoolType) => {
    try {
      if (school.is_active) {
        await schoolService.deleteSchool(school.id);
        toast.success(`${school.name} desactivado`);
      } else {
        await schoolService.activateSchool(school.id);
        toast.success(`${school.name} activado`);
      }
      await loadSchools();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Error al cambiar estado del colegio');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold">Administrar Colegios</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenCreate}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center"
              >
                <Plus className="w-4 h-4 mr-1" />
                Nuevo
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="p-4 overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                <span className="ml-2 text-gray-600">Cargando colegios...</span>
              </div>
            ) : schools.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No hay colegios registrados</div>
            ) : (
              <div className="space-y-3">
                {schools.map((school) => (
                  <div key={school.id} className={`p-4 border rounded-lg ${school.is_active ? 'bg-white' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Logo */}
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {school.logo_url ? (
                            <img
                              src={`${apiUrl}${school.logo_url}`}
                              alt={school.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <School className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            {school.primary_color && (
                              <div
                                className="w-3 h-3 rounded-full border border-gray-200"
                                style={{ backgroundColor: school.primary_color }}
                              />
                            )}
                            <span className="font-medium text-gray-800">{school.name}</span>
                            <span className="text-xs text-gray-500 font-mono">{school.code}</span>
                            {!school.is_active && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">Inactivo</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {school.email && <span>{school.email}</span>}
                            {school.phone && <span className="ml-3">{school.phone}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(school)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(school)}
                          className={`p-2 rounded-lg transition ${
                            school.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={school.is_active ? 'Desactivar' : 'Activar'}
                        >
                          {school.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* School Create/Edit Modal */}
      <SchoolModal
        isOpen={showSchoolModal}
        school={selectedSchool}
        onClose={handleSchoolModalClose}
        onSaved={handleSchoolSaved}
      />
    </>
  );
};

export default React.memo(ManageSchoolsModal);
