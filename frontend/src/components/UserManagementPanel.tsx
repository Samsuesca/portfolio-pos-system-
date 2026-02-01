/**
 * UserManagementPanel - Unified panel for managing users and custom roles
 *
 * Features:
 * - Tab-based navigation (Users / Custom Roles)
 * - School-based user management with role assignment
 * - Custom role creation with granular permission editor
 *
 * This is a refactored version that delegates to modular components.
 */
import { useState, useEffect } from 'react';
import { Users, Shield, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { schoolService, type School } from '../services/schoolService';
import { permissionService, type CustomRole } from '../services/permissionService';
import { UserManagement, RoleManagement, type TabType } from './UserManagement';

interface UserManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}

export default function UserManagementPanel({
  isOpen,
  onClose,
  embedded = false,
}: UserManagementPanelProps) {
  useAuthStore(); // Keep subscription active
  const [activeTab, setActiveTab] = useState<TabType>('users');

  // Schools state
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');

  // Roles state (shared between tabs)
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [globalCustomRoles, setGlobalCustomRoles] = useState<CustomRole[]>([]);

  // General state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load schools on open
  useEffect(() => {
    if (isOpen) {
      loadSchools();
      loadGlobalCustomRoles();
    }
  }, [isOpen]);

  // Auto-select first school
  useEffect(() => {
    if (schools.length > 0 && !selectedSchoolId) {
      setSelectedSchoolId(schools[0].id);
    }
  }, [schools, selectedSchoolId]);

  // Clear success message after delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadSchools = async () => {
    setSchoolsLoading(true);
    try {
      const data = await schoolService.getSchools(false);
      setSchools(data.filter((s) => s.is_active));
    } catch (err: any) {
      console.error('Error loading schools:', err);
      setError('Error al cargar colegios');
    } finally {
      setSchoolsLoading(false);
    }
  };

  const loadGlobalCustomRoles = async () => {
    try {
      const roles = await permissionService.getGlobalCustomRoles();
      setGlobalCustomRoles(roles);
      setCustomRoles(roles);
    } catch (err: any) {
      console.error('Error loading global custom roles:', err);
      setGlobalCustomRoles([]);
      setCustomRoles([]);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className={
        embedded
          ? 'bg-white rounded-lg shadow w-full h-full flex flex-col'
          : 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
      }
    >
      <div
        className={
          embedded
            ? 'w-full h-full flex flex-col'
            : 'bg-white rounded-lg shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] flex flex-col'
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600" />
              Gestion de Usuarios y Roles
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Administra usuarios, permisos y roles personalizados
            </p>
          </div>
          {!embedded && (
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Messages */}
        {success && (
          <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800 text-sm">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b px-4">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
              activeTab === 'users'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4 inline-block mr-2" />
            Usuarios
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
              activeTab === 'roles'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Shield className="w-4 h-4 inline-block mr-2" />
            Roles Personalizados
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'users' ? (
            <UserManagement
              schools={schools}
              schoolsLoading={schoolsLoading}
              selectedSchoolId={selectedSchoolId}
              setSelectedSchoolId={setSelectedSchoolId}
              customRoles={customRoles}
              globalCustomRoles={globalCustomRoles}
              saving={saving}
              setSaving={setSaving}
              error={error}
              setError={setError}
              success={success}
              setSuccess={setSuccess}
            />
          ) : (
            <RoleManagement
              schools={schools}
              selectedSchoolId={selectedSchoolId}
              saving={saving}
              setSaving={setSaving}
              error={error}
              setError={setError}
              success={success}
              setSuccess={setSuccess}
            />
          )}
        </div>
      </div>
    </div>
  );
}
