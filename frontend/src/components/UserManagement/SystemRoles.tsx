/**
 * SystemRoles - Display system roles (read-only)
 */
import { Shield } from 'lucide-react';
import RoleBadge from '../RoleBadge';
import { SYSTEM_ROLES } from './types';

export default function SystemRoles() {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <Shield className="w-4 h-4" />
        Roles del Sistema (solo lectura)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {SYSTEM_ROLES.map((sysRole) => (
          <div
            key={sysRole.role}
            className="p-4 bg-gray-50 border border-gray-200 rounded-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <RoleBadge role={sysRole.role} size="sm" />
              <span className="text-xs text-gray-500">{sysRole.permissions} permisos</span>
            </div>
            <p className="text-xs text-gray-600">{sysRole.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
