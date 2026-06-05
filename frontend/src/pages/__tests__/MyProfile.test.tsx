import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const { mockGetMyEmployee } = vi.hoisted(() => ({
  mockGetMyEmployee: vi.fn(),
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

vi.mock('../../services/employeeService', () => ({
  getMyEmployee: (...args: any[]) => mockGetMyEmployee(...args),
  getPaymentFrequencyLabel: (f: string) => f,
}));

vi.mock('../../services/workforceService', () => ({
  default: {
    getEmployeeSchedule: vi.fn().mockResolvedValue({ items: [] }),
    getDailyChecklists: vi.fn().mockResolvedValue({ items: [] }),
    getAttendanceRecords: vi.fn().mockResolvedValue({ items: [] }),
    getEmployeeMetrics: vi.fn().mockResolvedValue(null),
    getPerformanceReviews: vi.fn().mockResolvedValue({ items: [] }),
    getPositionResponsibilities: vi.fn().mockResolvedValue({ items: [] }),
  },
  ATTENDANCE_STATUS_LABELS: {},
  ATTENDANCE_STATUS_COLORS: {},
  RESPONSIBILITY_CATEGORY_LABELS: {},
  RESPONSIBILITY_CATEGORY_COLORS: {},
  REVIEW_PERIOD_LABELS: {},
}));

import MyProfile from '../MyProfile';

describe('MyProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading spinner initially', () => {
    mockGetMyEmployee.mockReturnValue(new Promise(() => {}));
    const { container } = render(<MyProfile />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders employee name and position after loading', async () => {
    mockGetMyEmployee.mockResolvedValue({
      id: '1',
      user_id: 'u1',
      full_name: 'Maria Lopez',
      position: 'Vendedora',
      hire_date: '2024-01-15',
      is_active: true,
      payment_type: 'salary',
      payment_frequency: 'monthly',
      base_salary: 1500000,
    });

    render(<MyProfile />);

    const nameElements = await screen.findAllByText('Maria Lopez');
    expect(nameElements.length).toBeGreaterThanOrEqual(1);
    const positionElements = await screen.findAllByText(/Vendedora/);
    expect(positionElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows not-linked message when employee returns 404', async () => {
    mockGetMyEmployee.mockRejectedValue({ response: { status: 404 } });

    render(<MyProfile />);

    expect(
      await screen.findByText(/No tienes un perfil laboral vinculado/),
    ).toBeInTheDocument();
  });

  it('shows error message on unexpected failure', async () => {
    mockGetMyEmployee.mockRejectedValue(new Error('Server error'));

    render(<MyProfile />);

    expect(
      await screen.findByText('Error al cargar tu perfil laboral. Intenta de nuevo.'),
    ).toBeInTheDocument();
  });

  it('renders tab buttons after employee loads', async () => {
    mockGetMyEmployee.mockResolvedValue({
      id: '1',
      user_id: 'u1',
      full_name: 'Ana',
      position: 'Admin',
      hire_date: '2024-01-01',
      is_active: true,
      payment_type: 'salary',
      payment_frequency: 'monthly',
      base_salary: 1000000,
    });

    render(<MyProfile />);

    expect(await screen.findByText('Mi Horario')).toBeInTheDocument();
    expect(screen.getByText('Mi Checklist')).toBeInTheDocument();
    expect(screen.getByText('Mi Asistencia')).toBeInTheDocument();
  });
});
