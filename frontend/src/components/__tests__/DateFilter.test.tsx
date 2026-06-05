import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DateFilter from '../DateFilter';

describe('DateFilter', () => {
  const onChange = vi.fn();

  beforeEach(() => { vi.clearAllMocks(); });

  it('renders all preset buttons', () => {
    render(<DateFilter value={{}} onChange={onChange} />);
    expect(screen.getByText('Hoy')).toBeInTheDocument();
    expect(screen.getByText('Ayer')).toBeInTheDocument();
    expect(screen.getByText('7 dias')).toBeInTheDocument();
    expect(screen.getByText('Este mes')).toBeInTheDocument();
    expect(screen.getByText('Todo')).toBeInTheDocument();
  });

  it('calls onChange with date range when preset clicked', () => {
    render(<DateFilter value={{}} onChange={onChange} />);
    fireEvent.click(screen.getByText('Hoy'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const range = onChange.mock.calls[0][0];
    expect(range.start_date).toBeDefined();
    expect(range.end_date).toBeDefined();
    expect(range.start_date).toBe(range.end_date);
  });

  it('calls onChange with empty range for "Todo"', () => {
    render(<DateFilter value={{ start_date: '2026-01-01' }} onChange={onChange} />);
    fireEvent.click(screen.getByText('Todo'));
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('renders date inputs with current values', () => {
    render(<DateFilter value={{ start_date: '2026-01-01', end_date: '2026-01-31' }} onChange={onChange} />);
    const inputs = screen.getAllByDisplayValue(/2026/);
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onChange when start date input changes', () => {
    render(<DateFilter value={{ end_date: '2026-01-31' }} onChange={onChange} />);
    const startInput = screen.getByText('Desde:').nextElementSibling as HTMLInputElement;
    fireEvent.change(startInput, { target: { value: '2026-01-15' } });
    expect(onChange).toHaveBeenCalledWith({ start_date: '2026-01-15', end_date: '2026-01-31' });
  });

  it('calls onChange when end date input changes', () => {
    render(<DateFilter value={{ start_date: '2026-01-01' }} onChange={onChange} />);
    const endInput = screen.getByText('Hasta:').nextElementSibling as HTMLInputElement;
    fireEvent.change(endInput, { target: { value: '2026-01-15' } });
    expect(onChange).toHaveBeenCalledWith({ start_date: '2026-01-01', end_date: '2026-01-15' });
  });

  it('highlights active preset', () => {
    render(<DateFilter value={{}} onChange={onChange} />);
    const todoBtn = screen.getByText('Todo');
    expect(todoBtn.className).toContain('bg-brand-500');
  });
});
