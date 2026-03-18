'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  School,
  Users,
  Package,
  CreditCard,
  Truck,
  RefreshCw,
  ShoppingCart,
  ShoppingBag,
  UserCheck,
  Wallet,
  Receipt,
  Scissors,
  Calculator,
  ClipboardList,
  AlertCircle,
} from 'lucide-react';
import schoolService from '@/lib/services/schoolService';
import userService from '@/lib/services/userService';
import { useDashboardConfig } from '@/lib/hooks/useDashboardConfig';
import { useAdminAuth } from '@/lib/adminAuth';

interface Stats {
  totalSchools: number;
  activeSchools: number;
  totalUsers: number;
  superusers: number;
}

export default function DashboardPage() {
  const { user } = useAdminAuth();
  const config = useDashboardConfig();

  const [stats, setStats] = useState<Stats>({
    totalSchools: 0,
    activeSchools: 0,
    totalUsers: 0,
    superusers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const promises: Promise<any>[] = [];

      // Only load data the user has permission to see
      if (config.stats.schools) {
        promises.push(schoolService.list({ include_inactive: true }));
      } else {
        promises.push(Promise.resolve([]));
      }

      if (config.stats.users) {
        promises.push(userService.list({ include_inactive: true }));
      } else {
        promises.push(Promise.resolve([]));
      }

      const [schools, users] = await Promise.all(promises);

      setStats({
        totalSchools: schools.length,
        activeSchools: schools.filter((s: any) => s.is_active).length,
        totalUsers: users.length,
        superusers: users.filter((u: any) => u.is_superuser).length,
      });
    } catch (err: any) {
      // Don't show error if it's a permission error and user doesn't have access
      if (!config.isSuperuser && err.message?.includes('403')) {
        // Silently ignore - user doesn't have access to these endpoints
        setStats({ totalSchools: 0, activeSchools: 0, totalUsers: 0, superusers: 0 });
      } else {
        setError(err.message || 'Error al cargar estadísticas');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [config.isSuperuser, config.stats.schools, config.stats.users]);

  // Build stat cards based on permissions
  const statCards = [];

  if (config.stats.schools) {
    statCards.push({
      label: 'Colegios Activos',
      value: stats.activeSchools,
      total: stats.totalSchools,
      icon: School,
      color: 'bg-brand-500',
      href: '/schools',
    });
  }

  if (config.stats.users) {
    statCards.push({
      label: 'Usuarios',
      value: stats.totalUsers,
      subtitle: `${stats.superusers} superusuarios`,
      icon: Users,
      color: 'bg-stone-700',
      href: '/users',
    });
  }

  // Build quick links based on permissions
  const quickLinks = [];

  if (config.quickAccess.schools) {
    quickLinks.push({
      label: 'Colegios',
      icon: School,
      href: '/schools',
      color: 'text-brand-700 bg-brand-100',
    });
  }

  if (config.quickAccess.users) {
    quickLinks.push({
      label: 'Usuarios',
      icon: Users,
      href: '/users',
      color: 'text-stone-700 bg-stone-200',
    });
  }

  if (config.quickAccess.paymentAccounts) {
    quickLinks.push({
      label: 'Cuentas de Pago',
      icon: CreditCard,
      href: '/payment-accounts',
      color: 'text-brand-700 bg-brand-100',
    });
  }

  if (config.quickAccess.deliveryZones) {
    quickLinks.push({
      label: 'Zonas de Entrega',
      icon: Truck,
      href: '/delivery-zones',
      color: 'text-stone-700 bg-stone-200',
    });
  }

  if (config.quickAccess.products) {
    quickLinks.push({
      label: 'Productos',
      icon: Package,
      href: '/products',
      color: 'text-brand-700 bg-brand-100',
    });
  }

  if (config.quickAccess.sales) {
    quickLinks.push({
      label: 'Ventas',
      icon: ShoppingCart,
      href: '/sales',
      color: 'text-emerald-700 bg-emerald-100',
    });
  }

  if (config.quickAccess.orders) {
    quickLinks.push({
      label: 'Encargos',
      icon: ShoppingBag,
      href: '/orders',
      color: 'text-emerald-700 bg-emerald-100',
    });
  }

  if (config.quickAccess.clients) {
    quickLinks.push({
      label: 'Clientes',
      icon: UserCheck,
      href: '/clients',
      color: 'text-stone-700 bg-stone-200',
    });
  }

  if (config.quickAccess.accounting) {
    quickLinks.push({
      label: 'Contabilidad',
      icon: Calculator,
      href: '/accounting',
      color: 'text-brand-700 bg-brand-100',
    });
  }

  if (config.quickAccess.alterations) {
    quickLinks.push({
      label: 'Arreglos',
      icon: Scissors,
      href: '/alterations',
      color: 'text-stone-700 bg-stone-200',
    });
  }

  if (config.quickAccess.workforce) {
    quickLinks.push({
      label: 'Gestión Laboral',
      icon: ClipboardList,
      href: '/workforce',
      color: 'text-emerald-700 bg-emerald-100',
    });
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            Dashboard
          </h1>
          <p className="text-slate-600 mt-1">
            Bienvenido al panel de administración
            {user?.full_name && `, ${user.full_name}`}
          </p>
        </div>
        {(config.stats.schools || config.stats.users) && (
          <button
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Limited Access Message */}
      {config.showLimitedAccessMessage && (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-medium text-amber-900">Acceso Limitado</h3>
              <p className="text-sm text-amber-700 mt-1">
                Tu cuenta tiene acceso limitado. Contacta a un administrador si necesitas más permisos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards - Only show if user has any stats to display */}
      {statCards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.label}
                href={card.href}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-600">{card.label}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">
                      {loading ? '...' : card.value}
                    </p>
                    {card.total !== undefined && !loading && (
                      <p className="text-sm text-slate-500 mt-1">
                        de {card.total} totales
                      </p>
                    )}
                    {card.subtitle && !loading && (
                      <p className="text-sm text-slate-500 mt-1">{card.subtitle}</p>
                    )}
                  </div>
                  <div className={`p-3 rounded-lg ${card.color}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Quick Links - Only show if user has any */}
      {quickLinks.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Accesos Rápidos
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-slate-50 transition-colors group"
                >
                  <div className={`p-4 rounded-xl ${link.color} group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* System Status - Only for superusers */}
      {config.widgets.systemStatus && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Sistema
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-slate-700">API Backend</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Conectado</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-slate-700">Portal Web</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">yourdomain.com</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-slate-700">Admin Portal</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">v1.0.0</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
