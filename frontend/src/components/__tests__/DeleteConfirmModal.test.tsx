import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeleteConfirmModal from '../DeleteConfirmModal';

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onConfirm: vi.fn().mockResolvedValue({ mode: 'deleted' as const, message: 'ok' }),
  title: 'Eliminar producto',
  entityName: 'Camiseta Blanca',
};

describe('DeleteConfirmModal', () => {
  it('returns null when isOpen=false', () => {
    const { container } = render(
      <DeleteConfirmModal {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows title and entityName when open', () => {
    render(<DeleteConfirmModal {...defaultProps} />);
    expect(screen.getByText('Eliminar producto')).toBeInTheDocument();
    expect(screen.getByText('Camiseta Blanca')).toBeInTheDocument();
  });

  it('shows confirmation question text', () => {
    render(<DeleteConfirmModal {...defaultProps} />);
    expect(screen.getByText('¿Está seguro de que desea eliminar?')).toBeInTheDocument();
  });

  it('calls onConfirm when delete button clicked', async () => {
    const onConfirm = vi.fn().mockResolvedValue({ mode: 'deleted', message: 'ok' });
    render(<DeleteConfirmModal {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Eliminar'));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledOnce();
    });
  });

  it('calls onClose when cancel button clicked', () => {
    const onClose = vi.fn();
    render(<DeleteConfirmModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows error message on confirm failure', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('No se puede eliminar'));
    render(<DeleteConfirmModal {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Eliminar'));
    await waitFor(() => {
      expect(screen.getByText('No se puede eliminar')).toBeInTheDocument();
    });
  });
});
