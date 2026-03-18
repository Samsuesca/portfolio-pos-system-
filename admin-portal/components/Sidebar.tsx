'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  School,
  Users,
  Users2,
  CreditCard,
  Truck,
  Package,
  Receipt,
  LogOut,
  Menu,
  X,
  Shield,
  ShoppingCart,
  ClipboardList,
  Settings,
  RefreshCw,
  Globe,
  Scissors,
  BarChart3,
  Wallet,
  FolderOpen,
  MessageSquare,
  HardHat,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useAdminAuth } from '@/lib/adminAuth';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { SYSTEM_VERSION, APP_VERSION } from '@/lib/version';

interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  anyPermission?: string[];
  requiresSuperuser?: boolean;
}

interface MenuGroup {
  label: string | null;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: null,
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/sales', label: 'Ventas', icon: ShoppingCart, anyPermission: ['sales.view'] },
      { href: '/sale-changes', label: 'Cambios', icon: RefreshCw, anyPermission: ['changes.view'] },
      { href: '/orders', label: 'Encargos', icon: ClipboardList, anyPermission: ['orders.view'] },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { href: '/web-orders', label: 'Pedidos Web', icon: Globe, anyPermission: ['orders.view'] },
      { href: '/clients', label: 'Clientes', icon: Users2, anyPermission: ['clients.view'] },
      { href: '/alterations', label: 'Arreglos', icon: Scissors, anyPermission: ['alterations.view'] },
      { href: '/products', label: 'Productos', icon: Package, anyPermission: ['products.view'] },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { href: '/accounting', label: 'Contabilidad', icon: Receipt, anyPermission: ['accounting.view_cash', 'accounting.view_expenses', 'accounting.view_caja_menor'] },
      { href: '/reports', label: 'Reportes', icon: BarChart3, anyPermission: ['reports.dashboard', 'reports.sales', 'reports.financial'] },
      { href: '/payroll', label: 'Nómina', icon: Wallet, anyPermission: ['workforce.view_deductions'] },
    ],
  },
  {
    label: 'Recurso Humano',
    items: [
      { href: '/workforce', label: 'Gestión Laboral', icon: HardHat, anyPermission: ['workforce.view_shifts', 'workforce.view_attendance'] },
    ],
  },
  {
    label: 'Administración',
    items: [
      { href: '/documents', label: 'Documentos', icon: FolderOpen },
      { href: '/contacts', label: 'PQRS', icon: MessageSquare },
      { href: '/schools', label: 'Colegios', icon: School, requiresSuperuser: true },
      { href: '/users', label: 'Usuarios', icon: Users, requiresSuperuser: true },
      { href: '/payment-accounts', label: 'Cuentas de Pago', icon: CreditCard, requiresSuperuser: true },
      { href: '/delivery-zones', label: 'Zonas de Entrega', icon: Truck, requiresSuperuser: true },
      { href: '/settings', label: 'Configuración', icon: Settings, anyPermission: ['settings.edit_business_info'] },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAdminAuth();
  const { hasAnyPermission, isSuperuser } = usePermissions();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const visibleGroups = useMemo(() => {
    return menuGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          // Superuser requirement check
          if (item.requiresSuperuser && !isSuperuser) return false;
          // Permission check (superusers always pass)
          if (item.anyPermission && !isSuperuser) {
            return hasAnyPermission(...item.anyPermission);
          }
          return true;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [hasAnyPermission, isSuperuser]);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-stone-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white">Admin Panel</h1>
            <p className="text-xs text-stone-400">v{SYSTEM_VERSION} | Admin v{APP_VERSION}</p>
          </div>
        </div>
      </div>

      {/* Navigation with scroll */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-4"
        style={{ maxHeight: 'calc(100vh - 180px)' }}
      >
        {visibleGroups.map((group, groupIndex) => (
          <div key={group.label ?? 'main'} className={groupIndex > 0 ? 'mt-6' : ''}>
            {group.label && (
              <div className="px-3 mb-2">
                <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                  {group.label}
                </span>
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                      active
                        ? 'bg-brand-500/15 text-brand-400 border-l-3 border-brand-400 -ml-px'
                        : 'text-stone-300 hover:bg-stone-700/50 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-brand-400' : ''}`} />
                    <span className="font-medium text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-stone-700">
        <div className="px-3 py-2 mb-1">
          <p className="text-sm font-medium text-white truncate">
            {user?.full_name || user?.username}
          </p>
          <p className="text-xs text-stone-400 truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-stone-300 hover:bg-stone-700/50 hover:text-white rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Cerrar Sesión</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-stone-800 rounded-lg text-white shadow-lg"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 w-64 bg-stone-900 z-50 transform transition-transform duration-300 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="flex flex-col h-full">
          <NavContent />
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-stone-900">
        <NavContent />
      </aside>
    </>
  );
}
