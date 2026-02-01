/**
 * Admin Panel - Superuser-only administration page
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import UserManagementPanel from '../components/UserManagementPanel';
import {
  ShieldCheck, Building2, Users, Database, RefreshCw,
  Loader2, AlertCircle, Plus, Edit2, Trash2, X, Save,
  AlertTriangle
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useSchoolStore } from '../stores/schoolStore';
import apiClient, { extractErrorMessage } from '../utils/api-client';
import type { School } from '../types/api';

interface SchoolFormData {
  code: string;
  name: string;
  address: string;
  phone: string;
  email: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { loadSchools } = useSchoolStore();

  const [activeTab, setActiveTab] = useState<'schools' | 'users' | 'system'>('schools');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Schools state
  const [schools, setSchools] = useState<School[]>([]);
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [schoolForm, setSchoolForm] = useState<SchoolFormData>({
    code: '',
    name: '',
    address: '',
    phone: '',
    email: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'school'; id: string } | null>(null);

  // Check superuser access
  useEffect(() => {
    if (!currentUser?.is_superuser) {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const schoolsRes = await apiClient.get<School[]>('/schools');
      setSchools(schoolsRes.data);
    } catch (err: unknown) {
      console.error('Error loading admin data:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // School handlers
  const handleSaveSchool = async () => {
    setError(null);

    // === VALIDACIONES FRONTEND ===
    if (!schoolForm.code?.trim()) {
      setError('⚠️ El código del colegio es requerido');
      return;
    }
    if (schoolForm.code.length < 2) {
      setError('⚠️ El código debe tener al menos 2 caracteres');
      return;
    }
    if (!schoolForm.name?.trim()) {
      setError('⚠️ El nombre del colegio es requerido');
      return;
    }
    if (schoolForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(schoolForm.email)) {
      setError('⚠️ El email no tiene un formato válido');
      return;
    }
    if (schoolForm.phone && !/^[\d\s\-\+\(\)]{7,}$/.test(schoolForm.phone)) {
      setError('⚠️ El teléfono no tiene un formato válido');
      return;
    }

    try {
      setSubmitting(true);
      if (editingSchool) {
        await apiClient.patch(`/schools/${editingSchool.id}`, schoolForm);
      } else {
        await apiClient.post('/schools', schoolForm);
      }
      setShowSchoolModal(false);
      setEditingSchool(null);
      resetSchoolForm();
      await loadData();
      await loadSchools();
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSchool = (school: School) => {
    setEditingSchool(school);
    setSchoolForm({
      code: school.code,
      name: school.name,
      address: school.address || '',
      phone: school.phone || '',
      email: school.email || ''
    });
    setShowSchoolModal(true);
  };

  const handleDeleteSchool = async (id: string) => {
    try {
      setSubmitting(true);
      await apiClient.delete(`/schools/${id}`);
      setConfirmDelete(null);
      await loadData();
      await loadSchools();
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const resetSchoolForm = () => {
    setSchoolForm({ code: '', name: '', address: '', phone: '', email: '' });
  };

  if (!currentUser?.is_superuser) {
    return null;
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
          <span className="ml-3 text-gray-600">Cargando panel de administración...</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <ShieldCheck className="w-8 h-8 mr-3 text-amber-600" />
          Panel de Administración
        </h1>
        <p className="text-gray-600 mt-1">Gestión global del sistema (solo superusuarios)</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('schools')}
            className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'schools'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Building2 className="w-4 h-4 inline mr-2" />
            Colegios ({schools.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Usuarios
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'system'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Database className="w-4 h-4 inline mr-2" />
            Sistema
          </button>
        </nav>
      </div>

      {/* Schools Tab */}
      {activeTab === 'schools' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Colegios Registrados</h2>
            <button
              onClick={() => {
                resetSchoolForm();
                setEditingSchool(null);
                setShowSchoolModal(true);
              }}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nuevo Colegio
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contacto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {schools.map((school) => (
                  <tr key={school.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">{school.code}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{school.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {school.email || school.phone || 'Sin contacto'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        school.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {school.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleEditSchool(school)}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ type: 'school', id: school.id })}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="h-[calc(100vh-280px)]">
          <UserManagementPanel
            isOpen={true}
            onClose={() => {}}
            embedded={true}
          />
        </div>
      )}

      {/* System Tab */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Database className="w-5 h-5 mr-2 text-gray-600" />
              Estado del Sistema
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Colegios registrados:</span>
                <span className="font-medium">{schools.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <RefreshCw className="w-5 h-5 mr-2 text-gray-600" />
              Acciones del Sistema
            </h3>
            <div className="space-y-3">
              <button
                onClick={loadData}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Recargar Datos
              </button>
              <button
                onClick={() => loadSchools()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                <Building2 className="w-4 h-4" />
                Sincronizar Colegios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* School Modal */}
      {showSchoolModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">
                {editingSchool ? 'Editar Colegio' : 'Nuevo Colegio'}
              </h3>
              <button onClick={() => setShowSchoolModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
                  <input
                    type="text"
                    value={schoolForm.code}
                    onChange={(e) => setSchoolForm({ ...schoolForm, code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    placeholder="IE-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={schoolForm.name}
                    onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    placeholder="Nombre del colegio"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={schoolForm.address}
                  onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={schoolForm.phone}
                    onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={schoolForm.email}
                    onChange={(e) => setSchoolForm({ ...schoolForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowSchoolModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSchool}
                disabled={submitting || !schoolForm.code || !schoolForm.name}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <Save className="w-4 h-4" />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Confirmar Eliminación</h3>
                <p className="text-sm text-gray-500">
                  Esta acción no se puede deshacer
                </p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              ¿Está seguro que desea eliminar este colegio?
              <span className="block mt-2 text-sm text-red-600">
                Esto eliminará también todos los datos asociados (ventas, productos, clientes, etc.)
              </span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteSchool(confirmDelete.id)}
                disabled={submitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
