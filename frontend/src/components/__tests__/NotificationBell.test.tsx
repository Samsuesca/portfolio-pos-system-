import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotificationBell } from '../NotificationBell';

const mockOpenPanel = vi.fn();

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({
    unreadCount: 5,
    openPanel: mockOpenPanel,
  }),
}));

describe('NotificationBell', () => {
  it('renders bell button', () => {
    render(<NotificationBell />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows unread count badge', () => {
    render(<NotificationBell />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('calls openPanel when clicked', () => {
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockOpenPanel).toHaveBeenCalled();
  });

  it('shows title with unread count', () => {
    render(<NotificationBell />);
    expect(screen.getByTitle('5 notificaciones sin leer')).toBeInTheDocument();
  });
});
