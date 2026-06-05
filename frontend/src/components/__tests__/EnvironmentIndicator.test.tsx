import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EnvironmentIndicator, DevelopmentBanner } from '../EnvironmentIndicator';
import { useConfigStore, getEnvironmentType, getEnvironmentLabel, getEnvironmentColor } from '../../stores/configStore';

vi.mock('../../stores/configStore', () => ({
  useConfigStore: vi.fn(),
  getEnvironmentType: vi.fn(),
  getEnvironmentLabel: vi.fn(),
  getEnvironmentColor: vi.fn(),
}));

const mockedUseConfigStore = vi.mocked(useConfigStore);
const mockedGetEnvironmentType = vi.mocked(getEnvironmentType);
const mockedGetEnvironmentLabel = vi.mocked(getEnvironmentLabel);
const mockedGetEnvironmentColor = vi.mocked(getEnvironmentColor);

describe('EnvironmentIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseConfigStore.mockReturnValue({
      apiUrl: 'http://localhost:8000',
      isOnline: true,
    } as any);
    mockedGetEnvironmentLabel.mockReturnValue('Desarrollo');
    mockedGetEnvironmentColor.mockReturnValue('bg-yellow-500');
  });

  it('shows environment label', () => {
    render(<EnvironmentIndicator />);
    expect(screen.getByText('Desarrollo')).toBeInTheDocument();
  });

  it('shows wifi icon when online', () => {
    const { container } = render(<EnvironmentIndicator />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('hides label when showLabel=false', () => {
    render(<EnvironmentIndicator showLabel={false} />);
    expect(screen.queryByText('Desarrollo')).not.toBeInTheDocument();
  });
});

describe('DevelopmentBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for production', () => {
    mockedUseConfigStore.mockReturnValue({
      apiUrl: 'https://yourdomain.com',
      isOnline: true,
    } as any);
    mockedGetEnvironmentType.mockReturnValue('production');

    const { container } = render(<DevelopmentBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('shows warning text for development', () => {
    mockedUseConfigStore.mockReturnValue({
      apiUrl: 'http://localhost:8000',
      isOnline: true,
    } as any);
    mockedGetEnvironmentType.mockReturnValue('development');

    render(<DevelopmentBanner />);
    expect(screen.getByText('MODO DESARROLLO - Los datos pueden ser de prueba')).toBeInTheDocument();
  });
});
