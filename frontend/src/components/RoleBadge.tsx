/**
 * RoleBadge - Visual badge component for user roles
 * Displays role with distinctive color and icon
 */
import { Eye, ShoppingCart, Briefcase, Crown, Shield } from 'lucide-react';
import type { UserRole } from '../types/api';

interface RoleBadgeProps {
  role: UserRole | 'superuser';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
}

interface RoleConfig {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
}

const ROLE_CONFIG: Record<UserRole | 'superuser', RoleConfig> = {
  viewer: {
    label: 'Visualizador',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    icon: Eye,
  },
  seller: {
    label: 'Vendedor',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: ShoppingCart,
  },
  admin: {
    label: 'Administrador',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: Briefcase,
  },
  owner: {
    label: 'Propietario',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    icon: Crown,
  },
  superuser: {
    label: 'Superusuario',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: Shield,
  },
};

const SIZE_CLASSES = {
  sm: {
    badge: 'px-1.5 py-0.5 text-xs',
    icon: 'w-3 h-3',
  },
  md: {
    badge: 'px-2 py-1 text-xs',
    icon: 'w-3.5 h-3.5',
  },
  lg: {
    badge: 'px-2.5 py-1.5 text-sm',
    icon: 'w-4 h-4',
  },
};

export default function RoleBadge({
  role,
  size = 'md',
  showIcon = true,
  showLabel = true,
}: RoleBadgeProps) {
  const config = ROLE_CONFIG[role];
  const sizeClasses = SIZE_CLASSES[size];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgColor} ${config.color} ${sizeClasses.badge}`}
    >
      {showIcon && <Icon className={sizeClasses.icon} />}
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

/**
 * Helper function to get the display role for a user
 * Prioritizes superuser status over school role
 */
export function getUserDisplayRole(
  isSuperuser: boolean,
  schoolRole?: UserRole | null
): UserRole | 'superuser' {
  if (isSuperuser) return 'superuser';
  return schoolRole || 'viewer';
}

/**
 * Role hierarchy for permission checks
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 1,
  seller: 2,
  admin: 3,
  owner: 4,
};

/**
 * Check if a role has at least the required level
 */
export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
