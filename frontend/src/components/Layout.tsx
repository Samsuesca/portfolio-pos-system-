/**
 * Layout Component - Main app layout with sidebar and navigation
 */
import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSchoolStore } from '../stores/schoolStore';
import { useUserRole, getRoleDisplayName } from '../hooks/useUserRole';
import { usePermissions } from '../hooks/usePermissions';
import { DevelopmentBanner } from './EnvironmentIndicator';
import { DraftsBar } from './DraftsBar';
import { useDraftStore } from '../stores/draftStore';
import { NotificationBell } from './NotificationBell';
import { NotificationPanel } from './NotificationPanel';
import { PrintQueuePanel } from './PrintQueuePanel';
import { usePrintQueueStore, usePrintQueuePendingCount } from '../stores/printQueueStore';
import { usePrinterStore } from '../stores/printerStore';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  FileText,
  RefreshCw,
  Settings,
  LogOut,
  Menu,
  X,
  BarChart3,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Mail,
  Shield,
  Calculator,
  ShieldCheck,
  Clock,
  Wifi,
  WifiOff,
  Globe,
  MessageSquare,
  FolderOpen,
  Banknote,
  Scissors,
  Plus,
  UserPlus,
  Printer,
  Gauge,
  HardHat,
  UserCircle,
} from 'lucide-react';
import { useConfigStore } from '../stores/configStore';
import { useBusinessInfoStore } from '../stores/businessInfoStore';
import { SYSTEM_VERSION, APP_VERSION } from '../config/version';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  path: string;
  icon: typeof LayoutDashboard;
  requiresAccounting?: boolean; // Only visible if user can access accounting
  requiresSuperuser?: boolean; // Only visible if user is superuser
  requiresOwner?: boolean; // Only visible if user is owner/superuser
  permission?: string; // Granular permission required (e.g., "sales.view")
  anyPermission?: string[]; // Any of these permissions grants access
  category?: 'main' | 'operations' | 'finance' | 'hr' | 'admin'; // For grouping
}

const navigation: NavItem[] = [
  // Main - Dashboard, catálogo, clientes y contacto
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, category: 'main' },
  { name: 'Productos', path: '/products', icon: Package, permission: 'products.view', category: 'main' },
  { name: 'Clientes', path: '/clients', icon: Users, permission: 'clients.view', category: 'main' },
  { name: 'PQRS', path: '/contacts', icon: MessageSquare, category: 'main' },
  // Operaciones - Ventas y servicios del día a día
  { name: 'Ventas', path: '/sales', icon: ShoppingCart, permission: 'sales.view', category: 'operations' },
  { name: 'Encargos', path: '/orders', icon: FileText, permission: 'orders.view', category: 'operations' },
  { name: 'Pedidos Web', path: '/web-orders', icon: Globe, permission: 'orders.view', category: 'operations' },
  { name: 'Cambios/Devoluciones', path: '/sale-changes', icon: RefreshCw, permission: 'changes.view', category: 'operations' },
  { name: 'Arreglos', path: '/alterations', icon: Scissors, anyPermission: ['alterations.view', 'accounting.view_cash'], category: 'operations' },
  // Finanzas
  { name: 'Panel CFO', path: '/cfo', icon: Gauge, requiresAccounting: true, category: 'finance' },
  { name: 'Contabilidad', path: '/accounting', icon: Calculator, anyPermission: ['accounting.view_cash', 'accounting.view_bank'], category: 'finance' },
  { name: 'Reportes', path: '/reports', icon: BarChart3, permission: 'reports.dashboard', category: 'finance' },
  // RRHH - Recursos Humanos
  { name: 'Nomina', path: '/payroll', icon: Banknote, requiresAccounting: true, category: 'hr' },
  { name: 'Gestion Laboral', path: '/workforce', icon: HardHat, anyPermission: ['workforce.view_shifts', 'workforce.view_attendance'], category: 'hr' },
];

// Admin navigation (superuser only)
const adminNavigation: NavItem[] = [
  { name: 'Panel Admin', path: '/admin', icon: ShieldCheck },
  { name: 'Documentos', path: '/documents', icon: FolderOpen },
  { name: 'Log de Emails', path: '/email-logs', icon: Mail },
];

// Print Queue Button Component
function PrintQueueButton() {
  const pendingCount = usePrintQueuePendingCount();
  const { isPanelOpen, togglePanel, isConnected } = usePrintQueueStore();
  const { settings: printerSettings } = usePrinterStore();

  // Only show if printer is configured
  if (!printerSettings.enabled || !printerSettings.portName) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={togglePanel}
        className={`relative p-2 rounded-lg transition-colors ${
          isPanelOpen
            ? 'bg-primary-100 text-primary-700'
            : 'hover:bg-surface-100 text-slate-600'
        }`}
        title="Cola de impresion"
      >
        <Printer className="w-5 h-5" />

        {/* Pending count badge */}
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1 animate-pulse">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}

        {/* Connection indicator */}
        <span
          className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white ${
            isConnected ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      </button>

      {/* Panel */}
      <PrintQueuePanel />
    </div>
  );
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { currentSchool, availableSchools, loadSchools, selectSchool } = useSchoolStore();
  const { isOnline, sidebarCollapsed, toggleSidebar } = useConfigStore();
  const { info: businessInfo, fetchInfo: fetchBusinessInfo } = useBusinessInfoStore();
  const { role, isSuperuser, canAccessAccounting } = useUserRole();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const { hasDrafts } = useDraftStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  // Warn user before leaving if there are unsaved drafts
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasDrafts()) {
        e.preventDefault();
        e.returnValue = 'Tienes borradores sin guardar. ¿Estás seguro de salir?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasDrafts]);

  // Load schools and business info on mount
  useEffect(() => {
    loadSchools();
    fetchBusinessInfo();
  }, [loadSchools, fetchBusinessInfo]);

  // Close quick actions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quickActionsOpen && !(e.target as Element).closest('.quick-actions-container')) {
        setQuickActionsOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [quickActionsOpen]);

  // Format time as HH:MM
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-CO', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-surface-50 font-sans text-primary">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 ${sidebarCollapsed ? 'w-16' : 'w-64'} bg-primary text-white transform transition-all duration-300 ease-in-out shadow-2xl ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 bg-brand-600 hover:bg-brand-700 rounded-full p-1.5 shadow-lg z-10 transition-colors hidden lg:flex"
          title={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4 text-white" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-white" />
          )}
        </button>

        {/* Sidebar Header */}
        <div className={`flex items-center justify-center h-16 px-4 bg-primary-light border-b border-white/5 relative`}>
          {sidebarCollapsed ? (
            <img src="/icon.png" alt={businessInfo.business_name_short || 'UCR'} className="h-10 w-10 object-contain" />
          ) : (
            <div className="flex items-center justify-center gap-2">
              <img src="/icon.png" alt={businessInfo.business_name_short || 'UCR'} className="h-10 w-10 object-contain" />
              <span className="text-white font-bold text-sm">
                {businessInfo.business_name_short || 'UCR'}
              </span>
            </div>
          )}
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden absolute right-2 p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Quick Actions Button */}
        <div className={`quick-actions-container ${sidebarCollapsed ? 'px-2' : 'px-3'} mt-4 mb-2`}>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setQuickActionsOpen(!quickActionsOpen);
              }}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-center gap-2'} bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-2.5 font-semibold transition-all shadow-lg shadow-brand-600/30`}
              title={sidebarCollapsed ? 'Crear nuevo' : undefined}
            >
              <Plus className="w-5 h-5" />
              {!sidebarCollapsed && <span>Crear</span>}
            </button>

            {/* Quick Actions Dropdown */}
            {quickActionsOpen && (
              <div className={`absolute ${sidebarCollapsed ? 'left-full ml-2' : 'left-0 right-0'} top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 min-w-[200px]`}>
                <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase">Acciones rápidas</p>
                {hasPermission('sales.create') && (
                  <button
                    onClick={() => {
                      navigate('/sales', { state: { openNew: true } });
                      setQuickActionsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Nueva Venta</span>
                  </button>
                )}
                {hasPermission('orders.create') && (
                  <button
                    onClick={() => {
                      navigate('/orders', { state: { openNew: true } });
                      setQuickActionsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Nuevo Encargo</span>
                  </button>
                )}
                {hasPermission('alterations.create') && (
                  <button
                    onClick={() => {
                      navigate('/alterations', { state: { openNew: true } });
                      setQuickActionsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                  >
                    <Scissors className="w-4 h-4" />
                    <span>Nuevo Arreglo</span>
                  </button>
                )}
                {hasPermission('clients.create') && (
                  <button
                    onClick={() => {
                      navigate('/clients', { state: { openNew: true } });
                      setQuickActionsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Nuevo Cliente</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className={`mt-2 ${sidebarCollapsed ? 'px-2' : 'px-3'} flex-1 overflow-y-auto pb-48`} style={{ maxHeight: 'calc(100vh - 280px)' }}>
          {/* Filter navigation items based on permissions */}
          {(() => {
            // Check if user is owner of current school
            const isOwner = isSuperuser || role === 'owner';

            const filteredNav = navigation.filter((item) => {
              // Superuser bypasses all permission checks
              if (isSuperuser) return true;

              // Legacy permission checks
              if (item.requiresSuperuser && !isSuperuser) return false;
              if (item.requiresAccounting && !canAccessAccounting) return false;
              if (item.requiresOwner && !isOwner) return false;

              // Granular permission checks
              if (item.permission && !hasPermission(item.permission)) return false;
              if (item.anyPermission && item.anyPermission.length > 0 && !hasAnyPermission(...item.anyPermission)) return false;

              return true;
            });

            // Group by category
            const mainItems = filteredNav.filter(i => i.category === 'main');
            const operationsItems = filteredNav.filter(i => i.category === 'operations');
            const financeItems = filteredNav.filter(i => i.category === 'finance');
            const hrItems = filteredNav.filter(i => i.category === 'hr');

            const renderNavItem = (item: NavItem) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  title={sidebarCollapsed ? item.name : undefined}
                  className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'px-3'} py-2.5 rounded-lg transition-all duration-200 group ${isActive
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                >
                  <Icon className={`w-4 h-4 ${sidebarCollapsed ? '' : 'mr-2.5'} flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                  {!sidebarCollapsed && <span className="text-sm font-medium truncate">{item.name}</span>}
                </button>
              );
            };

            return (
              <div className="space-y-4">
                {/* Main Section */}
                {mainItems.length > 0 && (
                  <div className="space-y-1">
                    {mainItems.map(renderNavItem)}
                  </div>
                )}

                {/* Operations Section */}
                {operationsItems.length > 0 && (
                  <div>
                    {!sidebarCollapsed && <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Operaciones</p>}
                    {sidebarCollapsed && <div className="border-t border-white/10 my-2" />}
                    <div className="space-y-0.5">
                      {operationsItems.map(renderNavItem)}
                    </div>
                  </div>
                )}

                {/* Finance Section */}
                {financeItems.length > 0 && (
                  <div>
                    {!sidebarCollapsed && <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Finanzas</p>}
                    {sidebarCollapsed && <div className="border-t border-white/10 my-2" />}
                    <div className="space-y-0.5">
                      {financeItems.map(renderNavItem)}
                    </div>
                  </div>
                )}

                {/* HR Section */}
                {hrItems.length > 0 && (
                  <div>
                    {!sidebarCollapsed && <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">RRHH</p>}
                    {sidebarCollapsed && <div className="border-t border-white/10 my-2" />}
                    <div className="space-y-0.5">
                      {hrItems.map(renderNavItem)}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Admin Navigation (Superuser Only) */}
          {isSuperuser && (
            <div className="mt-4">
              {!sidebarCollapsed && <p className="px-3 py-1.5 text-[10px] font-semibold text-amber-400/70 uppercase tracking-wider">Admin</p>}
              {sidebarCollapsed && <div className="border-t border-amber-400/30 my-2" />}
              <div className="space-y-0.5">
                {adminNavigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      title={sidebarCollapsed ? item.name : undefined}
                      className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'px-3'} py-2.5 rounded-lg transition-all duration-200 group ${isActive
                          ? 'bg-amber-600 text-white shadow-md'
                          : 'text-amber-300 hover:bg-amber-500/20 hover:text-amber-200'
                        }`}
                    >
                      <Icon className={`w-4 h-4 ${sidebarCollapsed ? '' : 'mr-2.5'} flex-shrink-0 ${isActive ? 'text-white' : 'text-amber-400 group-hover:text-amber-200'}`} />
                      {!sidebarCollapsed && <span className="text-sm font-medium truncate">{item.name}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* User Profile - Compact */}
        <div className={`absolute bottom-0 left-0 right-0 ${sidebarCollapsed ? 'p-2' : 'p-3'} bg-gradient-to-t from-primary via-primary to-transparent`}>
          <div className={`bg-white/5 rounded-xl ${sidebarCollapsed ? 'p-2' : 'p-3'} backdrop-blur-sm border border-white/10`}>
            {sidebarCollapsed ? (
              /* Collapsed: Only avatar, settings and logout */
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white shadow-lg"
                  title={user?.username}
                >
                  <span className="text-sm font-bold">
                    {user?.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={() => navigate('/my-profile')}
                  title="Mi Perfil"
                  className="w-full flex items-center justify-center p-2 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/10 hover:border-white/20"
                >
                  <UserCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate('/settings')}
                  title="Configuración"
                  className="w-full flex items-center justify-center p-2 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/10 hover:border-white/20"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={handleLogout}
                  title="Cerrar Sesión"
                  className="w-full flex items-center justify-center p-2 text-slate-300 hover:text-white bg-white/5 hover:bg-red-500/20 rounded-lg transition-all border border-white/10 hover:border-red-400/30"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Expanded: Full profile */
              <>
                <div className="flex items-center mb-2">
                  <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white shadow-lg">
                    <span className="text-sm font-bold">
                      {user?.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="ml-2.5 flex-1 overflow-hidden">
                    <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                  </div>
                </div>

                {/* Role Badge */}
                {(role || isSuperuser) && (
                  <div className="mb-2 flex items-center justify-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                      isSuperuser
                        ? 'bg-gradient-to-r from-amber-500/30 to-orange-500/30 text-amber-200 border border-amber-400/40'
                        : role === 'seller'
                          ? 'bg-gradient-to-r from-emerald-500/30 to-green-500/30 text-emerald-200 border border-emerald-400/40'
                          : role === 'admin'
                            ? 'bg-gradient-to-r from-blue-500/30 to-indigo-500/30 text-blue-200 border border-blue-400/40'
                            : 'bg-slate-500/30 text-slate-200 border border-slate-400/40'
                    }`}>
                      <Shield className="w-3 h-3" />
                      {isSuperuser ? 'Superusuario' : role ? getRoleDisplayName(role) : ''}
                    </span>
                  </div>
                )}

                <button
                  onClick={() => navigate('/my-profile')}
                  className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/10 hover:border-white/20"
                >
                  <UserCircle className="w-4 h-4 mr-2" />
                  Mi Perfil
                </button>

                <button
                  onClick={() => navigate('/settings')}
                  className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/10 hover:border-white/20"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configuración
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-red-500/20 rounded-lg transition-all border border-white/10 hover:border-red-400/30"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Cerrar Sesión
                </button>

                {/* Version Info */}
                <div className="mt-2 text-center">
                  <span className="text-[10px] text-slate-500">
                    v{SYSTEM_VERSION} | App v{APP_VERSION}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? (sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64') : ''}`}>
        {/* Development Banner */}
        <DevelopmentBanner />

        {/* Drafts Bar - Shows minimized sales/orders in progress */}
        {hasDrafts() && (
          <DraftsBar
            onOpenSale={(draftId) => {
              // Navigate to sales page with draft ID in state
              navigate('/sales', { state: { draftId, draftType: 'sale' } });
            }}
            onOpenOrder={(draftId) => {
              // Navigate to orders page with draft ID in state
              navigate('/orders', { state: { draftId, draftType: 'order' } });
            }}
          />
        )}

        {/* Top Bar */}
        <div className="sticky top-0 z-40 h-16 bg-white/80 backdrop-blur-md border-b border-surface-200 flex items-center px-4 md:px-6 justify-between">
          {/* Left Side: Menu + Page Title */}
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-surface-100 text-slate-600 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="ml-3 md:ml-4">
              <h2 className="text-lg md:text-xl font-bold font-display text-primary tracking-tight">
                {navigation.find((item) => item.path === location.pathname)?.name ||
                 adminNavigation.find((item) => item.path === location.pathname)?.name ||
                 (location.pathname === '/settings' ? 'Configuración' : null) ||
                 (location.pathname === '/payment-accounts' ? 'Cuentas de Pago' : null) ||
                 'Dashboard'}
              </h2>
            </div>
          </div>

          {/* Right Side: Time, User Info, Connection Status, School Selector */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Date & Time - Hidden on very small screens */}
            <div className="hidden sm:flex items-center gap-2 text-slate-600 bg-surface-50 px-3 py-1.5 rounded-lg">
              <Clock className="w-4 h-4 text-slate-400" />
              <div className="text-sm">
                <span className="font-medium">{formatTime(currentTime)}</span>
                <span className="hidden md:inline text-slate-400 mx-1">•</span>
                <span className="hidden md:inline text-slate-500">{formatDate(currentTime)}</span>
              </div>
            </div>

            {/* User Info - Compact */}
            <div className="hidden md:flex items-center gap-2 bg-surface-50 px-3 py-1.5 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
                {user?.username.charAt(0).toUpperCase()}
              </div>
              <div className="text-sm">
                <span className="font-medium text-slate-700">{user?.full_name || user?.username}</span>
                {isSuperuser && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                    Super
                  </span>
                )}
              </div>
            </div>

            {/* Connection Status */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                isOnline
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700 animate-pulse'
              }`}
              title={isOnline ? 'Conectado al servidor' : 'Sin conexión al servidor'}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Conectado</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sin conexión</span>
                </>
              )}
            </div>

            {/* Print Queue (only visible if printer is configured) */}
            <PrintQueueButton />

            {/* Notifications */}
            <div className="relative">
              <NotificationBell />
              <NotificationPanel />
            </div>

            {/* School Selector - Now labeled as "Vista de colegio" */}
            <div className="relative">
              <button
                onClick={() => setSchoolDropdownOpen(!schoolDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-surface-100 hover:bg-surface-200 rounded-lg transition-colors"
                title="Colegio para crear nuevos registros"
              >
                <Building2 className="w-4 h-4 text-brand-600" />
                <span className="text-sm font-medium text-gray-700 max-w-[120px] md:max-w-[180px] truncate">
                  {currentSchool?.name || 'Sin colegio'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${schoolDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown */}
              {schoolDropdownOpen && availableSchools.length > 0 && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setSchoolDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                    {/* Header explaining the dropdown */}
                    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Colegio predeterminado
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Para crear ventas, encargos y productos nuevos
                      </p>
                    </div>
                    {availableSchools.map((school) => (
                      <button
                        key={school.id}
                        onClick={() => {
                          selectSchool(school);
                          setSchoolDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-surface-100 transition-colors ${
                          currentSchool?.id === school.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{school.name}</div>
                            <div className="text-xs text-gray-500">{school.code}</div>
                          </div>
                          {currentSchool?.id === school.id && (
                            <span className="text-brand-600 text-xs">✓ Activo</span>
                          )}
                        </div>
                      </button>
                    ))}
                    {availableSchools.length > 1 && (
                      <div className="px-4 py-2 border-t border-gray-100 bg-blue-50">
                        <p className="text-xs text-blue-600">
                          💡 Tip: En cada página puedes filtrar para ver datos de todos los colegios
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="p-6 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
