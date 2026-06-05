import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const { mockGetGlobalStats } = vi.hoisted(() => ({
  mockGetGlobalStats: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock('../../components/Layout', () => ({
  default: ({ children }: any) => <div data-testid="layout">{children}</div>,
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({
    user: { id: '1', username: 'admin', full_name: 'Admin User', is_superuser: true },
    token: 'fake-token',
  }),
}));

vi.mock('../../stores/schoolStore', () => ({
  useSchoolStore: () => ({
    availableSchools: [{ id: 's1', name: 'Colegio Test', code: 'CT' }],
    loadSchools: vi.fn(),
  }),
}));

vi.mock('../../hooks/useDashboardConfig', () => ({
  useDashboardConfig: () => ({
    permissions: {
      canViewAlterations: false,
      canViewCash: false,
      canViewExpenses: false,
      canViewDailyFlow: false,
    },
    stats: { sales: true, orders: true, clients: true, products: true, cashBalance: false, alterations: false },
    alerts: { todayOrders: true, criticalStock: true, alterationsReady: false },
    widgets: {
      recentSales: true,
      upcomingOrders: true,
      alterations: false,
      lowStock: true,
      dailyFinance: false,
      pqrs: true,
      schoolSummary: true,
    },
    quickActions: [],
  }),
  default: () => ({}),
}));

vi.mock('../../services/dashboardService', () => ({
  dashboardService: {
    getGlobalStats: (...args: any[]) => mockGetGlobalStats(...args),
  },
}));

vi.mock('../../services/saleService', () => ({
  saleService: {
    getAllSales: vi.fn().mockResolvedValue({ items: [], total: 0, skip: 0, limit: 5, page: 1, total_pages: 0, has_more: false }),
  },
}));

vi.mock('../../services/productService', () => ({
  productService: {
    getAllProducts: vi.fn().mockResolvedValue({ items: [], total: 0, skip: 0, limit: 500, page: 1, total_pages: 0, has_more: false }),
  },
}));

vi.mock('../../services/contactService', () => ({
  contactService: {
    getContacts: vi.fn().mockResolvedValue({ items: [], total: 0, skip: 0, limit: 5, page: 1, total_pages: 0, has_more: false }),
  },
}));

vi.mock('../../services/orderService', () => ({
  orderService: {
    getAllOrders: vi.fn().mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100, page: 1, total_pages: 0, has_more: false }),
  },
}));

vi.mock('../../services/alterationService', () => ({
  alterationService: {
    getSummary: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../../services/globalAccountingService', () => ({
  globalAccountingService: {
    getDailyAccountFlow: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../../components/dashboard', () => ({
  StatCard: ({ title, value }: any) => <div data-testid="stat-card">{title}: {value}</div>,
  UrgentAlertsSection: () => <div data-testid="urgent-alerts" />,
  processOrdersForAlerts: () => ({ overdue: [], today: [], tomorrow: [], noDateCount: 0 }),
  processCriticalStock: () => ({ criticalCount: 0, outOfStock: [], outOfStockCount: 0, lowStockCount: 0 }),
  UpcomingOrdersWidget: () => <div data-testid="upcoming-orders" />,
  DailyFinanceWidget: () => <div data-testid="daily-finance" />,
  AlterationsSummaryWidget: () => <div data-testid="alterations-summary" />,
  DashboardWidget: ({ title, children }: any) => <div data-testid="dashboard-widget">{title}{children}</div>,
  QuickActionsGrid: () => <div data-testid="quick-actions" />,
  StatCardSkeleton: () => <div data-testid="stat-skeleton" />,
}));

vi.mock('../../components/dashboard/LowStockWidget', () => ({
  LowStockWidget: () => <div data-testid="low-stock" />,
}));

vi.mock('../../utils/formatting', () => ({
  formatCurrency: (v: number) => `$${v}`,
}));

import Dashboard from '../Dashboard';

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeletons while data is being fetched', () => {
    mockGetGlobalStats.mockReturnValue(new Promise(() => {}));
    render(<Dashboard />);
    const skeletons = screen.getAllByTestId('stat-skeleton');
    expect(skeletons.length).toBe(4);
  });

  it('renders welcome heading with user name', async () => {
    mockGetGlobalStats.mockResolvedValue({
      school_count: 1,
      schools_summary: [{ school_id: 's1', school_name: 'Colegio Test', school_code: 'CT', sales_count: 0, sales_amount: 0, pending_orders: 0 }],
      totals: {
        total_sales: 10,
        sales_count_month: 5,
        sales_amount_month: 500000,
        total_products: 20,
        total_clients: 15,
        pending_orders: 3,
        total_orders: 8,
      },
    });

    render(<Dashboard />);

    expect(await screen.findByText(/Admin User/)).toBeInTheDocument();
  });

  it('renders stat cards after loading', async () => {
    mockGetGlobalStats.mockResolvedValue({
      school_count: 1,
      schools_summary: [{ school_id: 's1', school_name: 'Test', school_code: 'T', sales_count: 0, sales_amount: 0, pending_orders: 0 }],
      totals: {
        total_sales: 10,
        sales_count_month: 5,
        sales_amount_month: 500000,
        total_products: 20,
        total_clients: 15,
        pending_orders: 3,
        total_orders: 8,
      },
    });

    render(<Dashboard />);

    const statCards = await screen.findAllByTestId('stat-card');
    expect(statCards.length).toBeGreaterThanOrEqual(4);
  });

  it('renders error state when dashboard service fails', async () => {
    mockGetGlobalStats.mockRejectedValue({
      response: { data: { detail: 'Error de servidor' } },
    });

    render(<Dashboard />);

    expect(await screen.findByText('Error al cargar el dashboard')).toBeInTheDocument();
    expect(await screen.findByText('Error de servidor')).toBeInTheDocument();
  });

  it('renders Actualizar button', () => {
    mockGetGlobalStats.mockReturnValue(new Promise(() => {}));
    render(<Dashboard />);
    expect(screen.getByText('Actualizar')).toBeInTheDocument();
  });
});
