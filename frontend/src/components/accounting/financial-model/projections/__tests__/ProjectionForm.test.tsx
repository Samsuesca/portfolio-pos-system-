import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ProjectionForm from '../ProjectionForm';
import { buildEmptyAssumptions, buildPresetAssumptions, SEASONALITY_DEFAULTS } from '../projectionPresets';
import type { ProjectionAssumptions } from '../../../../../services/projectionService';

function defaultProps(overrides: Partial<React.ComponentProps<typeof ProjectionForm>> = {}) {
  return {
    onSubmit: vi.fn(),
    submitting: false,
    canRun: true,
    ...overrides,
  };
}

function clickSubmit() {
  fireEvent.click(screen.getByRole('button', { name: /calcular proyección/i }));
}

describe('ProjectionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validación', () => {
    it('bloquea submit si el nombre está vacío', () => {
      const onSubmit = vi.fn();
      const initial: ProjectionAssumptions = { ...buildEmptyAssumptions(), name: '' };
      render(<ProjectionForm {...defaultProps({ onSubmit })} initialAssumptions={initial} />);

      clickSubmit();

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText(/nombre de la proyección es obligatorio/i)).toBeInTheDocument();
    });

    it('bloquea submit cuando base_revenue_monthly es 0', () => {
      const onSubmit = vi.fn();
      const initial: ProjectionAssumptions = {
        ...buildEmptyAssumptions(),
        name: 'Test',
        base_revenue_monthly: 0,
      };
      render(<ProjectionForm {...defaultProps({ onSubmit })} initialAssumptions={initial} />);

      clickSubmit();

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText(/ingresos base mensuales deben ser mayores a 0/i)).toBeInTheDocument();
    });

    it('bloquea submit cuando months está fuera de [1, 36]', () => {
      const onSubmit = vi.fn();
      const initial: ProjectionAssumptions = {
        ...buildEmptyAssumptions(),
        name: 'Test',
        base_revenue_monthly: 1_000_000,
        months: 0,
      };
      render(<ProjectionForm {...defaultProps({ onSubmit })} initialAssumptions={initial} />);

      clickSubmit();

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText(/horizonte debe estar entre 1 y 36 meses/i)).toBeInTheDocument();
    });

    it('bloquea submit cuando start_month está fuera de [1, 12]', () => {
      const onSubmit = vi.fn();
      const initial: ProjectionAssumptions = {
        ...buildEmptyAssumptions(),
        name: 'Test',
        base_revenue_monthly: 1_000_000,
        months: 12,
        start_month: 13,
      };
      render(<ProjectionForm {...defaultProps({ onSubmit })} initialAssumptions={initial} />);

      clickSubmit();

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText(/mes de inicio debe estar entre 1 y 12/i)).toBeInTheDocument();
    });

    it('llama onSubmit con assumptions y persist=true cuando todo es válido', () => {
      const onSubmit = vi.fn();
      const initial = buildPresetAssumptions('B');
      render(<ProjectionForm {...defaultProps({ onSubmit })} initialAssumptions={initial} />);

      clickSubmit();

      expect(onSubmit).toHaveBeenCalledTimes(1);
      const [submitted, persist] = onSubmit.mock.calls[0];
      expect(submitted.name).toBe(initial.name);
      expect(persist).toBe(true);
    });
  });

  describe('presets', () => {
    it('cargar preset B configura formalization_layer con scenario_label B', () => {
      const onSubmit = vi.fn();
      render(<ProjectionForm {...defaultProps({ onSubmit })} />);

      fireEvent.click(screen.getByRole('button', { name: /escenario b/i }));
      clickSubmit();

      expect(onSubmit).toHaveBeenCalledTimes(1);
      const submitted: ProjectionAssumptions = onSubmit.mock.calls[0][0];
      expect(submitted.formalization_layer?.scenario_label).toBe('B');
    });

    it('cargar preset baseline deja formalization_layer en null', () => {
      const onSubmit = vi.fn();
      render(<ProjectionForm {...defaultProps({ onSubmit })} />);

      fireEvent.click(screen.getByRole('button', { name: /baseline/i }));
      clickSubmit();

      expect(onSubmit).toHaveBeenCalledTimes(1);
      const submitted: ProjectionAssumptions = onSubmit.mock.calls[0][0];
      expect(submitted.formalization_layer).toBeNull();
    });

    it('"Reset al patrón UCR" restaura SEASONALITY_DEFAULTS', () => {
      const onSubmit = vi.fn();
      const initial: ProjectionAssumptions = {
        ...buildEmptyAssumptions(),
        name: 'Test',
        base_revenue_monthly: 1_000_000,
        seasonality: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1 },
      };
      render(<ProjectionForm {...defaultProps({ onSubmit })} initialAssumptions={initial} />);

      fireEvent.click(screen.getByRole('button', { name: /reset al patrón ucr/i }));
      clickSubmit();

      const submitted: ProjectionAssumptions = onSubmit.mock.calls[0][0];
      expect(submitted.seasonality).toEqual(SEASONALITY_DEFAULTS);
    });
  });

  describe('hiring plan (sub-array)', () => {
    it('"Agregar contratación" añade una hire al plan', () => {
      const onSubmit = vi.fn();
      const initial: ProjectionAssumptions = {
        ...buildEmptyAssumptions(),
        name: 'Test',
        base_revenue_monthly: 1_000_000,
      };
      render(<ProjectionForm {...defaultProps({ onSubmit })} initialAssumptions={initial} />);

      fireEvent.click(screen.getByRole('button', { name: /personal/i }));
      fireEvent.click(screen.getByRole('button', { name: /agregar contratación/i }));
      clickSubmit();

      const submitted: ProjectionAssumptions = onSubmit.mock.calls[0][0];
      expect(submitted.hiring_plan).toHaveLength(1);
      expect(submitted.hiring_plan[0].role).toBe('Nuevo cargo');
    });
  });

  describe('formalization layer toggling', () => {
    // El preset baseline contiene "sin capa de formalización" en su descripción,
    // colisionando con el header de sección. Anclamos al inicio del nombre accesible.
    it('"Activar capa de formalización" inicializa el layer con scenario custom', () => {
      const onSubmit = vi.fn();
      const initial: ProjectionAssumptions = {
        ...buildEmptyAssumptions(),
        name: 'Test',
        base_revenue_monthly: 1_000_000,
      };
      render(<ProjectionForm {...defaultProps({ onSubmit })} initialAssumptions={initial} />);

      fireEvent.click(screen.getByRole('button', { name: /^Capa de formalización Sin capa$/i }));
      fireEvent.click(screen.getByRole('button', { name: /activar capa de formalización/i }));
      clickSubmit();

      const submitted: ProjectionAssumptions = onSubmit.mock.calls[0][0];
      expect(submitted.formalization_layer).not.toBeNull();
      expect(submitted.formalization_layer?.scenario_label).toBe('custom');
    });

    it('"Quitar capa" elimina el formalization_layer', () => {
      const onSubmit = vi.fn();
      const initial = buildPresetAssumptions('B');
      render(<ProjectionForm {...defaultProps({ onSubmit })} initialAssumptions={initial} />);

      fireEvent.click(screen.getByRole('button', { name: /^Capa de formalización Esc\. B/i }));
      fireEvent.click(screen.getByRole('button', { name: /quitar capa/i }));
      clickSubmit();

      const submitted: ProjectionAssumptions = onSubmit.mock.calls[0][0];
      expect(submitted.formalization_layer).toBeNull();
    });
  });

  describe('persist toggle', () => {
    it('cuando se desmarca el checkbox, onSubmit recibe persist=false', () => {
      const onSubmit = vi.fn();
      const initial = buildPresetAssumptions('baseline');
      render(<ProjectionForm {...defaultProps({ onSubmit })} initialAssumptions={initial} />);

      const checkbox = screen.getByRole('checkbox', { name: /guardar proyección en historial/i });
      fireEvent.click(checkbox);
      clickSubmit();

      expect(onSubmit).toHaveBeenCalledTimes(1);
      const persist = onSubmit.mock.calls[0][1];
      expect(persist).toBe(false);
    });
  });

  describe('permisos y estado', () => {
    it('canRun=false deshabilita el botón Calcular', () => {
      render(<ProjectionForm {...defaultProps({ canRun: false })} initialAssumptions={buildPresetAssumptions('B')} />);

      const button = screen.getByRole('button', { name: /calcular proyección/i });
      expect(button).toBeDisabled();
    });

    it('submitting=true deshabilita el botón Calcular y muestra el loader', () => {
      const { container } = render(
        <ProjectionForm {...defaultProps({ submitting: true })} initialAssumptions={buildPresetAssumptions('B')} />,
      );

      const button = screen.getByRole('button', { name: /calcular proyección/i });
      expect(button).toBeDisabled();
      // Loader es un Loader2 de lucide con animate-spin
      const loader = container.querySelector('.animate-spin');
      expect(loader).toBeInTheDocument();
    });

    it('renderiza botón Cancelar cuando se pasa onCancel', () => {
      const onCancel = vi.fn();
      render(
        <ProjectionForm {...defaultProps()} onCancel={onCancel} initialAssumptions={buildPresetAssumptions('A')} />,
      );

      const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
      fireEvent.click(cancelBtn);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('renderizado inicial', () => {
    it('expande la sección Período por default y muestra el badge con horizonte', () => {
      render(<ProjectionForm {...defaultProps()} initialAssumptions={buildPresetAssumptions('B')} />);

      // El badge dentro del header de Período debe mostrar "12 meses"
      const periodHeader = screen.getByRole('button', { name: /período/i });
      expect(within(periodHeader).getByText(/12 meses/i)).toBeInTheDocument();
    });

    it('muestra los 4 presets predefinidos', () => {
      render(<ProjectionForm {...defaultProps()} />);

      expect(screen.getByRole('button', { name: /baseline/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /escenario a/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /escenario b/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /escenario c/i })).toBeInTheDocument();
    });
  });
});
