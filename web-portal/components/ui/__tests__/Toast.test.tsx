/**
 * Tests for Toast notification system
 * Tests toast display, interactions, and store functionality
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ToastContainer, toast, useToastStore } from '../Toast';

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => `test-id-${Math.random().toString(36).substr(2, 9)}`,
});

describe('Toast Store', () => {
  beforeEach(() => {
    // Clear all toasts before each test
    act(() => {
      useToastStore.getState().clearAll();
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty toasts', () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('addToast adds a toast', () => {
    act(() => {
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Test Toast',
      });
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].title).toBe('Test Toast');
  });

  it('addToast returns an id', () => {
    let id: string;
    act(() => {
      id = useToastStore.getState().addToast({
        type: 'success',
        title: 'Test',
      });
    });

    expect(id!).toBeDefined();
    expect(typeof id!).toBe('string');
  });

  it('removeToast removes a specific toast', () => {
    let id: string;
    act(() => {
      id = useToastStore.getState().addToast({
        type: 'success',
        title: 'Toast 1',
      });
      useToastStore.getState().addToast({
        type: 'info',
        title: 'Toast 2',
      });
    });

    expect(useToastStore.getState().toasts).toHaveLength(2);

    act(() => {
      useToastStore.getState().removeToast(id!);
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].title).toBe('Toast 2');
  });

  it('clearAll removes all toasts', () => {
    act(() => {
      useToastStore.getState().addToast({ type: 'success', title: 'Toast 1' });
      useToastStore.getState().addToast({ type: 'error', title: 'Toast 2' });
      useToastStore.getState().addToast({ type: 'info', title: 'Toast 3' });
    });

    expect(useToastStore.getState().toasts).toHaveLength(3);

    act(() => {
      useToastStore.getState().clearAll();
    });

    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('auto-removes toast after default duration', () => {
    act(() => {
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Auto-remove',
      });
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(3000); // Default duration
    });

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('error toasts have longer default duration', () => {
    act(() => {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Error',
      });
    });

    act(() => {
      vi.advanceTimersByTime(3000); // Normal duration
    });

    expect(useToastStore.getState().toasts).toHaveLength(1); // Still there

    act(() => {
      vi.advanceTimersByTime(2000); // 5000ms total
    });

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('respects custom duration', () => {
    act(() => {
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Custom',
        duration: 10000,
      });
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

describe('toast helper functions', () => {
  beforeEach(() => {
    act(() => {
      useToastStore.getState().clearAll();
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('toast.success creates success toast', () => {
    act(() => {
      toast.success('Success!', 'Operation completed');
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].title).toBe('Success!');
    expect(toasts[0].message).toBe('Operation completed');
  });

  it('toast.error creates error toast', () => {
    act(() => {
      toast.error('Error!', 'Something went wrong');
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts[0].type).toBe('error');
  });

  it('toast.info creates info toast', () => {
    act(() => {
      toast.info('Info', 'Here is some information');
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts[0].type).toBe('info');
  });

  it('toast.cart creates cart toast', () => {
    act(() => {
      toast.cart('Added to cart', '1 item added');
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts[0].type).toBe('cart');
  });

  it('toast.cart has shorter duration', () => {
    act(() => {
      toast.cart('Added');
    });

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

describe('ToastContainer', () => {
  beforeEach(() => {
    act(() => {
      useToastStore.getState().clearAll();
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it('renders toasts when present', () => {
    act(() => {
      toast.success('Test Toast');
    });

    render(<ToastContainer />);

    expect(screen.getByText('Test Toast')).toBeInTheDocument();
  });

  it('renders message when provided', () => {
    act(() => {
      toast.success('Title', 'Message body');
    });

    render(<ToastContainer />);

    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Message body')).toBeInTheDocument();
  });

  it('renders multiple toasts', () => {
    act(() => {
      toast.success('Toast 1');
      toast.error('Toast 2');
      toast.info('Toast 3');
    });

    render(<ToastContainer />);

    expect(screen.getByText('Toast 1')).toBeInTheDocument();
    expect(screen.getByText('Toast 2')).toBeInTheDocument();
    expect(screen.getByText('Toast 3')).toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    act(() => {
      toast.success('Accessible toast');
    });

    render(<ToastContainer />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('aria-live', 'polite');
  });

  it('close button removes toast', async () => {
    act(() => {
      toast.success('Closable toast');
    });

    render(<ToastContainer />);

    const closeButton = screen.getByRole('button', { name: /cerrar/i });
    expect(closeButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(closeButton);
    });

    expect(screen.queryByText('Closable toast')).not.toBeInTheDocument();
  });

  it('Escape key clears all toasts', async () => {
    act(() => {
      toast.success('Toast 1');
      toast.error('Toast 2');
    });

    render(<ToastContainer />);

    expect(screen.getByText('Toast 1')).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Toast 2')).not.toBeInTheDocument();
  });

  it('has correct styling for success toast', () => {
    act(() => {
      toast.success('Success');
    });

    render(<ToastContainer />);

    const toastElement = screen.getByRole('alert');
    expect(toastElement).toHaveClass('bg-green-600');
  });

  it('has correct styling for error toast', () => {
    act(() => {
      toast.error('Error');
    });

    render(<ToastContainer />);

    const toastElement = screen.getByRole('alert');
    expect(toastElement).toHaveClass('bg-red-600');
  });

  it('has correct styling for info toast', () => {
    act(() => {
      toast.info('Info');
    });

    render(<ToastContainer />);

    const toastElement = screen.getByRole('alert');
    expect(toastElement).toHaveClass('bg-blue-600');
  });

  it('has correct styling for cart toast', () => {
    act(() => {
      toast.cart('Cart');
    });

    render(<ToastContainer />);

    const toastElement = screen.getByRole('alert');
    expect(toastElement).toHaveClass('bg-brand-600');
  });
});
