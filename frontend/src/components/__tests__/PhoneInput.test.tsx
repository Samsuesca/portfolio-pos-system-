import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PhoneInput from '../PhoneInput';

describe('PhoneInput', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
  };

  beforeEach(() => { vi.clearAllMocks(); });

  it('renders with default label', () => {
    render(<PhoneInput {...defaultProps} />);
    expect(screen.getByText('Telefono')).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<PhoneInput {...defaultProps} label="Celular" />);
    expect(screen.getByText('Celular')).toBeInTheDocument();
  });

  it('shows required asterisk when required', () => {
    render(<PhoneInput {...defaultProps} required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('strips non-digit characters on change', () => {
    render(<PhoneInput {...defaultProps} />);
    const input = screen.getByPlaceholderText('3001234567');
    fireEvent.change(input, { target: { value: '300-123-abcd' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('300123');
  });

  it('limits to 10 characters', () => {
    render(<PhoneInput {...defaultProps} />);
    const input = screen.getByPlaceholderText('3001234567');
    fireEvent.change(input, { target: { value: '30012345678901' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('3001234567');
  });

  it('shows validation error for phone not starting with 3 after blur', () => {
    render(<PhoneInput {...defaultProps} value="5001234567" />);
    const input = screen.getByPlaceholderText('3001234567');
    fireEvent.blur(input);
    expect(screen.getByText('Debe iniciar con 3')).toBeInTheDocument();
  });

  it('shows error for incomplete phone after blur', () => {
    render(<PhoneInput {...defaultProps} value="300" />);
    const input = screen.getByPlaceholderText('3001234567');
    fireEvent.blur(input);
    expect(screen.getByText('Debe tener 10 digitos')).toBeInTheDocument();
  });

  it('shows valid message for correct phone after blur', () => {
    render(<PhoneInput {...defaultProps} value="3001234567" />);
    const input = screen.getByPlaceholderText('3001234567');
    fireEvent.blur(input);
    expect(screen.getByText('Telefono valido')).toBeInTheDocument();
  });

  it('does not show validation when showValidation is false', () => {
    render(<PhoneInput {...defaultProps} value="5001234567" showValidation={false} />);
    const input = screen.getByPlaceholderText('3001234567');
    fireEvent.blur(input);
    expect(screen.queryByText('Debe iniciar con 3')).not.toBeInTheDocument();
  });

  it('disables input when disabled prop is true', () => {
    render(<PhoneInput {...defaultProps} disabled />);
    const input = screen.getByPlaceholderText('3001234567');
    expect(input).toBeDisabled();
  });
});
