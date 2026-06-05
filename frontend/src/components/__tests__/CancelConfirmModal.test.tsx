import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CancelConfirmModal from '../CancelConfirmModal';

describe('CancelConfirmModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    title: 'Cancelar Venta',
    entityCode: 'CARACAS-001-VNT-2026-0001',
    warnings: ['Se revertirá el inventario', 'Se reversarán los pagos'],
  };

  beforeEach(() => { vi.clearAllMocks(); });

  it('returns null when isOpen is false', () => {
    const { container } = render(<CancelConfirmModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows title and entity code', () => {
    render(<CancelConfirmModal {...defaultProps} />);
    expect(screen.getByText('Cancelar Venta')).toBeInTheDocument();
    expect(screen.getByText('CARACAS-001-VNT-2026-0001')).toBeInTheDocument();
  });

  it('shows warning list', () => {
    render(<CancelConfirmModal {...defaultProps} />);
    expect(screen.getByText('Se revertirá el inventario')).toBeInTheDocument();
    expect(screen.getByText('Se reversarán los pagos')).toBeInTheDocument();
  });

  it('calls onClose when Volver button clicked', () => {
    render(<CancelConfirmModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Volver'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('submit button is disabled when reason is too short', () => {
    render(<CancelConfirmModal {...defaultProps} />);
    const submitBtn = screen.getByText('Confirmar Cancelación');
    expect(submitBtn).toBeDisabled();
  });

  it('calls onConfirm with reason when form submitted', async () => {
    render(<CancelConfirmModal {...defaultProps} />);
    const textarea = screen.getByPlaceholderText('Escriba la razón de la cancelación...');
    fireEvent.change(textarea, { target: { value: 'Error en la venta' } });

    const submitBtn = screen.getByText('Confirmar Cancelación');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(defaultProps.onConfirm).toHaveBeenCalledWith('Error en la venta');
    });
  });

  it('shows validation error when reason is less than 5 chars', async () => {
    render(<CancelConfirmModal {...defaultProps} />);
    const textarea = screen.getByPlaceholderText('Escriba la razón de la cancelación...');
    fireEvent.change(textarea, { target: { value: 'ab' } });

    // Force submit via form
    const form = textarea.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('La razón debe tener al menos 5 caracteres')).toBeInTheDocument();
    });
  });

  it('shows error from failed confirm', async () => {
    const failProps = { ...defaultProps, onConfirm: vi.fn().mockRejectedValue(new Error('Server error')) };
    render(<CancelConfirmModal {...failProps} />);

    const textarea = screen.getByPlaceholderText('Escriba la razón de la cancelación...');
    fireEvent.change(textarea, { target: { value: 'Razon valida aqui' } });
    fireEvent.click(screen.getByText('Confirmar Cancelación'));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });
});
