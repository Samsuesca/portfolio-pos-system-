import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CurrencyInput from '../CurrencyInput';

describe('CurrencyInput', () => {
  it('renders with formatted value when not focused', () => {
    render(<CurrencyInput value={1500000} onChange={vi.fn()} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('$1.500.000');
  });

  it('shows raw number when focused', () => {
    render(<CurrencyInput value={1500000} onChange={vi.fn()} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    expect(input).toHaveValue('1500000');
  });

  it('calls onChange with parsed number', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value={0} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '25000' } });
    expect(onChange).toHaveBeenCalledWith(25000);
  });

  it('strips non-numeric characters', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value={0} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc123def' } });
    expect(onChange).toHaveBeenCalledWith(123);
  });

  it('respects disabled state', () => {
    render(<CurrencyInput value={100} onChange={vi.fn()} disabled />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('hides DollarSign icon when showIcon=false', () => {
    const { container } = render(
      <CurrencyInput value={100} onChange={vi.fn()} showIcon={false} />
    );
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});
