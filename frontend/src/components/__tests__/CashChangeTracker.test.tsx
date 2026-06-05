import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CashChangeTracker from '../CashChangeTracker';

describe('CashChangeTracker', () => {
  it('renders amount input field', () => {
    render(
      <CashChangeTracker
        amountDue={50000}
        amountReceived={undefined}
        onAmountReceivedChange={vi.fn()}
      />
    );
    expect(screen.getByText('Monto Recibido del Cliente')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('shows "Devueltas" with change amount when amountReceived > amountDue', () => {
    render(
      <CashChangeTracker
        amountDue={50000}
        amountReceived={60000}
        onAmountReceivedChange={vi.fn()}
      />
    );
    expect(screen.getByText('Devueltas:')).toBeInTheDocument();
    expect(screen.getByText(/10[.,]000/)).toBeInTheDocument();
  });

  it('shows "Monto insuficiente" when amountReceived < amountDue', () => {
    render(
      <CashChangeTracker
        amountDue={50000}
        amountReceived={30000}
        onAmountReceivedChange={vi.fn()}
      />
    );
    expect(screen.getByText(/Monto insuficiente/)).toBeInTheDocument();
  });

  it('does not show change or error when amountReceived is undefined', () => {
    render(
      <CashChangeTracker
        amountDue={50000}
        amountReceived={undefined}
        onAmountReceivedChange={vi.fn()}
      />
    );
    expect(screen.queryByText('Devueltas:')).not.toBeInTheDocument();
    expect(screen.queryByText(/Monto insuficiente/)).not.toBeInTheDocument();
  });
});
