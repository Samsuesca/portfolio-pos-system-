import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PaymentMethodSelector from '../PaymentMethodSelector';

describe('PaymentMethodSelector', () => {
  const onChange = vi.fn();

  beforeEach(() => { vi.clearAllMocks(); });

  it('renders all payment method options', () => {
    render(<PaymentMethodSelector value="" onChange={onChange} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('Efectivo')).toBeInTheDocument();
    expect(screen.getByText('Nequi')).toBeInTheDocument();
    expect(screen.getByText('Transferencia')).toBeInTheDocument();
    expect(screen.getByText('Tarjeta')).toBeInTheDocument();
  });

  it('calls onChange when selection changes', () => {
    render(<PaymentMethodSelector value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'cash' } });
    expect(onChange).toHaveBeenCalledWith('cash');
  });

  it('shows label when provided', () => {
    render(<PaymentMethodSelector value="" onChange={onChange} label="Metodo de Pago" />);
    expect(screen.getByText('Metodo de Pago')).toBeInTheDocument();
  });

  it('disables select when disabled', () => {
    render(<PaymentMethodSelector value="" onChange={onChange} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('includes credit option when includeCredit is true', () => {
    render(<PaymentMethodSelector value="" onChange={onChange} includeCredit />);
    expect(screen.getByText('Credito')).toBeInTheDocument();
  });

  it('does not include credit by default', () => {
    render(<PaymentMethodSelector value="" onChange={onChange} />);
    expect(screen.queryByText('Credito')).not.toBeInTheDocument();
  });
});
