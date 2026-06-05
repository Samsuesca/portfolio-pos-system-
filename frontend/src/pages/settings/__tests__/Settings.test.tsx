import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useLocation: () => ({ pathname: '/settings', search: '', hash: '', state: null }),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock('../../../components/Layout', () => ({
  default: ({ children }: any) => <div data-testid="layout">{children}</div>,
}));

// Mock stores
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => ({
    user: { id: '1', username: 'admin', full_name: 'Admin', is_superuser: true },
    getCurrentUser: vi.fn(),
  }),
}));

vi.mock('../../../stores/configStore', () => ({
  useConfigStore: () => ({
    apiUrl: 'http://localhost:8001',
    setApiUrl: vi.fn(),
    isOnline: true,
  }),
}));

vi.mock('../../../stores/businessInfoStore', () => ({
  useBusinessInfoStore: () => ({
    info: { business_name: 'Test Business', tagline: 'Test tagline' },
  }),
}));

vi.mock('../../../stores/printerStore', () => ({
  usePrinterStore: () => ({
    settings: {},
    isModalOpen: false,
    openModal: vi.fn(),
    closeModal: vi.fn(),
  }),
}));

vi.mock('../../../stores/printQueueStore', () => ({
  usePrintQueueStore: () => ({
    settings: {},
    setSettings: vi.fn(),
    isConnected: false,
  }),
}));

// Mock sub-components
vi.mock('../SettingsServerCard', () => ({
  default: () => <div data-testid="server-card">ServerCard</div>,
}));

vi.mock('../SettingsProfileCard', () => ({
  default: () => <div data-testid="profile-card">ProfileCard</div>,
}));

vi.mock('../SettingsSecurityCard', () => ({
  default: () => <div data-testid="security-card">SecurityCard</div>,
}));

vi.mock('../SettingsSuperuserCards', () => ({
  default: () => <div data-testid="superuser-cards">SuperuserCards</div>,
}));

vi.mock('../SettingsNotificationsCard', () => ({
  default: () => <div data-testid="notifications-card">NotificationsCard</div>,
}));

vi.mock('../SettingsPrinterCard', () => ({
  default: () => <div data-testid="printer-card">PrinterCard</div>,
}));

vi.mock('../SettingsSystemInfoCard', () => ({
  default: () => <div data-testid="system-info-card">SystemInfoCard</div>,
}));

// Mock modals
vi.mock('../EditProfileModal', () => ({
  default: () => <div data-testid="edit-profile-modal" />,
}));

vi.mock('../ChangePasswordModal', () => ({
  default: () => <div data-testid="change-password-modal" />,
}));

vi.mock('../ChangeEmailModal', () => ({
  default: () => <div data-testid="change-email-modal" />,
}));

vi.mock('../ManageSchoolsModal', () => ({
  default: () => <div data-testid="manage-schools-modal" />,
}));

vi.mock('../ManageDeliveryZonesModal', () => ({
  default: () => <div data-testid="manage-delivery-zones-modal" />,
}));

vi.mock('../BusinessInfoModal', () => ({
  default: () => <div data-testid="business-info-modal" />,
}));

vi.mock('../../../components/UserManagementPanel', () => ({
  default: () => <div data-testid="user-management-panel" />,
}));

vi.mock('../../../components/PrinterSettingsModal', () => ({
  default: () => <div data-testid="printer-settings-modal" />,
}));

import Settings from '../Settings';

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Configuracion" heading', () => {
    render(<Settings />);
    expect(screen.getByText('Configuracion')).toBeInTheDocument();
  });

  it('renders subtitle text', () => {
    render(<Settings />);
    expect(screen.getByText('Administra la configuracion del sistema')).toBeInTheDocument();
  });

  // Section headings (Conexion, Cuenta, Preferencias, Administracion) used to live
  // here directly. They were extracted into individual SettingsXxxCard components.
  // Since those sub-cards are mocked in this suite (lines 56-82), heading assertions
  // belong in each sub-card's own test file. Coverage of which cards render is
  // already enforced by the 'renders all sub-component cards' test below.

  it('renders all sub-component cards', () => {
    render(<Settings />);
    expect(screen.getByTestId('server-card')).toBeInTheDocument();
    expect(screen.getByTestId('profile-card')).toBeInTheDocument();
    expect(screen.getByTestId('security-card')).toBeInTheDocument();
    expect(screen.getByTestId('superuser-cards')).toBeInTheDocument();
    expect(screen.getByTestId('notifications-card')).toBeInTheDocument();
    expect(screen.getByTestId('printer-card')).toBeInTheDocument();
    expect(screen.getByTestId('system-info-card')).toBeInTheDocument();
  });

  it('renders inside Layout', () => {
    render(<Settings />);
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });
});
