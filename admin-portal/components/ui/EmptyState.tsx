'use client';

/**
 * EmptyState Component
 *
 * A visually appealing empty state component for tables, lists, and search results.
 *
 * Usage:
 *   import EmptyState from '@/components/ui/EmptyState';
 *   <EmptyState
 *     icon={Package}
 *     title="No hay productos"
 *     description="Agrega tu primer producto para comenzar"
 *     action={{ label: 'Agregar Producto', onClick: () => {} }}
 *   />
 */

import { LucideIcon, Search, FileX, Database, Plus } from 'lucide-react';

type EmptyStateVariant = 'default' | 'search' | 'error' | 'minimal';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  variant?: EmptyStateVariant;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

const VARIANT_STYLES = {
  default: {
    container: 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200',
    iconBg: 'bg-slate-200',
    iconColor: 'text-slate-400',
  },
  search: {
    container: 'bg-gradient-to-br from-blue-50 to-slate-50 border-blue-100',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-400',
  },
  error: {
    container: 'bg-gradient-to-br from-red-50 to-slate-50 border-red-100',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-400',
  },
  minimal: {
    container: 'bg-transparent border-transparent',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-400',
  },
};

const DEFAULT_ICONS: Record<EmptyStateVariant, LucideIcon> = {
  default: Database,
  search: Search,
  error: FileX,
  minimal: Database,
};

export function EmptyState({
  icon,
  title,
  description,
  variant = 'default',
  action,
  className = '',
}: EmptyStateProps) {
  const styles = VARIANT_STYLES[variant];
  const Icon = icon || DEFAULT_ICONS[variant];
  const ActionIcon = action?.icon || Plus;

  return (
    <div
      className={`
        flex flex-col items-center justify-center py-12 px-6
        rounded-xl border
        ${styles.container}
        ${className}
      `}
    >
      {/* Icon */}
      <div
        className={`
          w-16 h-16 rounded-2xl flex items-center justify-center mb-4
          ${styles.iconBg}
        `}
      >
        <Icon className={`w-8 h-8 ${styles.iconColor}`} />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-slate-700 text-center">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-slate-500 text-center mt-2 max-w-sm">
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 btn-primary flex items-center gap-2"
        >
          <ActionIcon className="w-4 h-4" />
          {action.label}
        </button>
      )}
    </div>
  );
}

// Preset empty states for common use cases
export function SearchEmptyState({
  query,
  onClear,
}: {
  query: string;
  onClear?: () => void;
}) {
  return (
    <EmptyState
      variant="search"
      icon={Search}
      title="Sin resultados"
      description={`No se encontraron resultados para "${query}"`}
      action={onClear ? { label: 'Limpiar búsqueda', onClick: onClear } : undefined}
    />
  );
}

export function TableEmptyState({
  itemName,
  onAdd,
}: {
  itemName: string;
  onAdd?: () => void;
}) {
  return (
    <EmptyState
      variant="default"
      title={`No hay ${itemName}`}
      description={`Aún no se han registrado ${itemName}. Agrega el primero para comenzar.`}
      action={onAdd ? { label: `Agregar ${itemName}`, onClick: onAdd } : undefined}
    />
  );
}

export function ErrorEmptyState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      variant="error"
      icon={FileX}
      title="Error al cargar"
      description={message || 'Ocurrió un error al cargar los datos. Intenta de nuevo.'}
      action={onRetry ? { label: 'Reintentar', onClick: onRetry } : undefined}
    />
  );
}

export default EmptyState;
