/**
 * RoleManagement - Roles tab main component
 */
import { useState, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import {
  permissionService,
  type CustomRole,
  type PermissionCatalog,
  type CreateRoleRequest,
} from '../../services/permissionService';
import type { School } from '../../services/schoolService';

import SystemRoles from './SystemRoles';
import CustomRolesList from './CustomRolesList';
import RoleModal from './modals/RoleModal';
import DeleteRoleModal from './modals/DeleteRoleModal';

interface RoleManagementProps {
  schools: School[];
  selectedSchoolId: string;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  success: string | null;
  setSuccess: (success: string | null) => void;
}

export default function RoleManagement({
  schools,
  selectedSchoolId,
  saving,
  setSaving,
  error: _error,
  setError,
  success: _success,
  setSuccess,
}: RoleManagementProps) {
  // Roles state
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionCatalog | null>(null);
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);

  // Role modals state
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showDeleteRoleModal, setShowDeleteRoleModal] = useState(false);
  const [roleForm, setRoleForm] = useState<CreateRoleRequest>({
    name: '',
    code: '',
    description: '',
    permissions: [],
  });
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Load roles and permissions on mount
  useEffect(() => {
    loadRolesAndPermissions();
  }, []);

  const loadRolesAndPermissions = async () => {
    setRolesLoading(true);
    setError(null);
    try {
      const [rolesData, catalogData] = await Promise.all([
        permissionService.getGlobalCustomRoles(),
        selectedSchoolId
          ? permissionService.getPermissionCatalog(selectedSchoolId)
          : schools.length > 0
          ? permissionService.getPermissionCatalog(schools[0].id)
          : Promise.resolve(null),
      ]);
      setCustomRoles(rolesData);
      if (catalogData) {
        setPermissionCatalog(catalogData);
      }
    } catch (err: any) {
      console.error('Error loading roles:', err);
      setError('Error al cargar roles');
    } finally {
      setRolesLoading(false);
    }
  };

  const handleOpenRoleModal = (role?: CustomRole) => {
    if (role) {
      setSelectedRole(role);
      setRoleForm({
        name: role.name,
        code: role.code,
        description: role.description || '',
        permissions: role.permissions.map((p) => p.permission_code),
        priority: role.priority,
        color: role.color || undefined,
      });
    } else {
      setSelectedRole(null);
      setRoleForm({
        name: '',
        code: '',
        description: '',
        permissions: [],
      });
    }
    // Expand all categories by default when opening modal
    if (permissionCatalog) {
      setExpandedCategories(new Set(permissionCatalog.categories.map((c) => c.code)));
    }
    setShowRoleModal(true);
  };

  const handleSaveRole = async () => {
    if (!roleForm.name || !roleForm.code) {
      setError('Nombre y codigo son requeridos');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (selectedRole) {
        await permissionService.updateGlobalRole(selectedRole.id, {
          name: roleForm.name,
          description: roleForm.description,
          permissions: roleForm.permissions,
          priority: roleForm.priority,
          color: roleForm.color,
        });
        setSuccess('Rol actualizado exitosamente');
      } else {
        await permissionService.createGlobalRole(roleForm);
        setSuccess('Rol creado exitosamente');
      }
      setShowRoleModal(false);
      setSelectedRole(null);
      loadRolesAndPermissions();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al guardar rol');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;
    setSaving(true);
    setError(null);
    try {
      await permissionService.deleteGlobalRole(selectedRole.id);
      setSuccess('Rol eliminado exitosamente');
      setShowDeleteRoleModal(false);
      setSelectedRole(null);
      loadRolesAndPermissions();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al eliminar rol');
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (permissionCode: string) => {
    setRoleForm((prev) => {
      const currentPermissions = (prev.permissions || []) as string[];
      return {
        ...prev,
        permissions: currentPermissions.includes(permissionCode)
          ? currentPermissions.filter((p) => p !== permissionCode)
          : [...currentPermissions, permissionCode],
      };
    });
  };

  const toggleCategory = (categoryCode: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryCode)) {
        next.delete(categoryCode);
      } else {
        next.add(categoryCode);
      }
      return next;
    });
  };

  const copyPermissionsFromRole = (roleCode: string) => {
    if (!permissionCatalog) return;
    const systemRole = permissionCatalog.system_roles.find((r) => r.role === roleCode);
    if (systemRole) {
      setRoleForm((prev) => ({
        ...prev,
        permissions: [...systemRole.default_permissions],
      }));
    }
  };

  const handleSelectCategoryAll = (categoryCode: string, select: boolean) => {
    if (!permissionCatalog) return;
    const categoryPermissions = permissionCatalog.permissions.filter(
      (p) => p.category === categoryCode
    );
    const permCodes = categoryPermissions.map((p) => p.code);

    if (select) {
      setRoleForm((prev) => ({
        ...prev,
        permissions: [...new Set([...((prev.permissions as string[]) || []), ...permCodes])],
      }));
    } else {
      setRoleForm((prev) => ({
        ...prev,
        permissions: ((prev.permissions as string[]) || []).filter(
          (p) => !permCodes.includes(p)
        ),
      }));
    }
  };

  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-gray-600">Cargando roles...</span>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="p-4 bg-gray-50 border-b flex flex-wrap gap-3 items-center">
        <div className="flex-1">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Roles Globales</span> - Los roles personalizados se
            pueden asignar a usuarios en cualquier colegio.
          </p>
        </div>
        <button
          onClick={() => handleOpenRoleModal()}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm flex items-center"
        >
          <Plus className="w-4 h-4 mr-1" />
          Crear Rol Personalizado
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <SystemRoles />
        <CustomRolesList
          roles={customRoles}
          onCreateRole={() => handleOpenRoleModal()}
          onEditRole={handleOpenRoleModal}
          onDeleteRole={(role) => {
            setSelectedRole(role);
            setShowDeleteRoleModal(true);
          }}
        />
      </div>

      {/* Modals */}
      <RoleModal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        selectedRole={selectedRole}
        roleForm={roleForm}
        setRoleForm={setRoleForm}
        permissionCatalog={permissionCatalog}
        expandedCategories={expandedCategories}
        onTogglePermission={togglePermission}
        onToggleCategory={toggleCategory}
        onCopyPermissionsFromRole={copyPermissionsFromRole}
        onSelectCategoryAll={handleSelectCategoryAll}
        onSave={handleSaveRole}
        saving={saving}
      />

      <DeleteRoleModal
        isOpen={showDeleteRoleModal}
        onClose={() => setShowDeleteRoleModal(false)}
        selectedRole={selectedRole}
        onConfirm={handleDeleteRole}
        saving={saving}
      />
    </>
  );
}
