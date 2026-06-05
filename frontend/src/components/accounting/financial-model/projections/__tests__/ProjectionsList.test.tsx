import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import ProjectionsList from '../ProjectionsList';
import type { ProjectionListItem, ProjectionSummary } from '../../../../../services/projectionService';

function makeSummary(overrides: Partial<ProjectionSummary> = {}): ProjectionSummary {
  return {
    total_revenue: 90_000_000,
    total_cogs: 55_800_000,
    total_gross_profit: 34_200_000,
    avg_gross_margin_pct: 38,
    total_opex: 80_400_000,
    total_formalization_one_time: 0,
    total_formalization_recurring: 0,
    total_operating_profit: -46_200_000,
    avg_operating_margin_pct: -51.3,
    total_interest_expense: 6_600_000,
    total_debt_capital_paid: 0,
    total_net_profit: -52_800_000,
    avg_net_margin_pct: -58.6,
    ending_cash: -34_120_000,
    min_cash: -34_120_000,
    months_cash_negative: 4,
    months_below_breakeven: 12,
    breakeven_revenue_monthly_avg: 17_600_000,
    ...overrides,
  };
}

function makeItem(overrides: Partial<ProjectionListItem> = {}): ProjectionListItem {
  return {
    id: 'p-1',
    name: 'Escenario test',
    scenario_label: 'B',
    months_count: 12,
    start_year: 2026,
    start_month: 5,
    summary: makeSummary(),
    created_at: '2026-05-04T10:00:00',
    ...overrides,
  };
}

function defaultProps(overrides: Partial<React.ComponentProps<typeof ProjectionsList>> = {}) {
  return {
    items: [],
    loading: false,
    error: null,
    canDelete: true,
    onView: vi.fn(),
    onDelete: vi.fn(),
    onRefresh: vi.fn(),
    onFilterScenario: vi.fn(),
    scenarioFilter: null,
    ...overrides,
  };
}

describe('ProjectionsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  describe('estados base', () => {
    it('muestra spinner cuando loading=true', () => {
      const { container } = render(<ProjectionsList {...defaultProps({ loading: true })} />);

      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('muestra banner de error cuando hay error', () => {
      render(<ProjectionsList {...defaultProps({ error: 'Algo se rompió' })} />);

      expect(screen.getByText(/algo se rompió/i)).toBeInTheDocument();
    });

    it('empty state genérico cuando items=[] y sin filtro', () => {
      render(<ProjectionsList {...defaultProps()} />);

      expect(screen.getByText(/no hay proyecciones guardadas\./i)).toBeInTheDocument();
    });

    it('empty state menciona el filtro activo', () => {
      render(<ProjectionsList {...defaultProps({ scenarioFilter: 'A' })} />);

      expect(screen.getByText(/no hay proyecciones guardadas para escenario a/i)).toBeInTheDocument();
    });
  });

  describe('listado y selección para comparativo', () => {
    it('renderiza una fila por cada item', () => {
      const items = [
        makeItem({ id: 'a', name: 'Escenario A test', scenario_label: 'A' }),
        makeItem({ id: 'b', name: 'Escenario B test', scenario_label: 'B' }),
      ];
      render(<ProjectionsList {...defaultProps({ items })} />);

      expect(screen.getByText('Escenario A test')).toBeInTheDocument();
      expect(screen.getByText('Escenario B test')).toBeInTheDocument();
    });

    it('seleccionar 2 items muestra el bloque comparativo', () => {
      const items = [
        makeItem({ id: 'a', name: 'A item', scenario_label: 'A' }),
        makeItem({ id: 'b', name: 'B item', scenario_label: 'B' }),
        makeItem({ id: 'c', name: 'C item', scenario_label: 'C' }),
      ];
      render(<ProjectionsList {...defaultProps({ items })} />);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      expect(screen.getByText(/comparativo de escenarios \(2\)/i)).toBeInTheDocument();
    });

    it('seleccionar 1 solo item NO muestra comparativo', () => {
      const items = [makeItem({ id: 'a', name: 'A item' }), makeItem({ id: 'b', name: 'B item' })];
      render(<ProjectionsList {...defaultProps({ items })} />);

      fireEvent.click(screen.getAllByRole('checkbox')[0]);

      expect(screen.queryByText(/comparativo de escenarios/i)).not.toBeInTheDocument();
    });

    it('máximo 3 items seleccionables — el 4to checkbox queda disabled', () => {
      const items = [
        makeItem({ id: 'a', name: 'A' }),
        makeItem({ id: 'b', name: 'B' }),
        makeItem({ id: 'c', name: 'C' }),
        makeItem({ id: 'd', name: 'D' }),
      ];
      render(<ProjectionsList {...defaultProps({ items })} />);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
      fireEvent.click(checkboxes[2]);

      expect(checkboxes[3]).toBeDisabled();
    });

    it('deseleccionar un item lo retira del comparativo', () => {
      const items = [makeItem({ id: 'a', name: 'A' }), makeItem({ id: 'b', name: 'B' })];
      render(<ProjectionsList {...defaultProps({ items })} />);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
      expect(screen.getByText(/comparativo de escenarios \(2\)/i)).toBeInTheDocument();

      fireEvent.click(checkboxes[0]);
      expect(screen.queryByText(/comparativo de escenarios \(2\)/i)).not.toBeInTheDocument();
    });
  });

  describe('comparativo (highlight max/min)', () => {
    it('aplica clase emerald al mejor valor (max) y red al peor', () => {
      const items = [
        makeItem({ id: 'win', name: 'Winner', summary: makeSummary({ total_net_profit: 10_000_000 }) }),
        makeItem({ id: 'lose', name: 'Loser', summary: makeSummary({ total_net_profit: -50_000_000 }) }),
      ];
      const { container } = render(<ProjectionsList {...defaultProps({ items })} />);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      // Comparativo activo. Buscamos celda con clase emerald (max).
      const emeraldCells = container.querySelectorAll('.text-emerald-700.font-medium');
      const redCells = container.querySelectorAll('.text-red-600');
      expect(emeraldCells.length).toBeGreaterThan(0);
      expect(redCells.length).toBeGreaterThan(0);
    });
  });

  describe('filtros', () => {
    it('click en filtro "B" llama onFilterScenario("B")', () => {
      const onFilterScenario = vi.fn();
      render(<ProjectionsList {...defaultProps({ onFilterScenario })} />);

      const filterButtons = screen.getAllByRole('button');
      const bButton = filterButtons.find((b) => b.textContent === 'B');
      expect(bButton).toBeDefined();
      fireEvent.click(bButton!);

      expect(onFilterScenario).toHaveBeenCalledWith('B');
    });

    it('click sobre el filtro activo lo toggle a null', () => {
      const onFilterScenario = vi.fn();
      render(<ProjectionsList {...defaultProps({ onFilterScenario, scenarioFilter: 'B' })} />);

      const filterButtons = screen.getAllByRole('button');
      const bButton = filterButtons.find((b) => b.textContent === 'B');
      fireEvent.click(bButton!);

      expect(onFilterScenario).toHaveBeenCalledWith(null);
    });

    it('botón "limpiar" se muestra solo cuando hay filtro y limpia al click', () => {
      const onFilterScenario = vi.fn();
      const { rerender } = render(<ProjectionsList {...defaultProps({ onFilterScenario })} />);
      expect(screen.queryByRole('button', { name: /limpiar/i })).not.toBeInTheDocument();

      rerender(<ProjectionsList {...defaultProps({ onFilterScenario, scenarioFilter: 'A' })} />);
      const limpiarBtn = screen.getByRole('button', { name: /limpiar/i });
      fireEvent.click(limpiarBtn);

      expect(onFilterScenario).toHaveBeenCalledWith(null);
    });
  });

  describe('refresh', () => {
    it('click en "Actualizar" dispara onRefresh', () => {
      const onRefresh = vi.fn();
      render(<ProjectionsList {...defaultProps({ onRefresh })} />);

      fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('view y delete', () => {
    it('click en ojo (Ver detalle) llama onView con el id', () => {
      const onView = vi.fn();
      const items = [makeItem({ id: 'view-me', name: 'View target' })];
      render(<ProjectionsList {...defaultProps({ items, onView })} />);

      const viewBtn = screen.getByTitle(/ver detalle/i);
      fireEvent.click(viewBtn);

      expect(onView).toHaveBeenCalledWith('view-me');
    });

    it('click en eliminar 1 vez activa modo confirmación, no borra todavía', () => {
      const onDelete = vi.fn();
      const items = [makeItem({ id: 'del-me', name: 'Delete target' })];
      render(<ProjectionsList {...defaultProps({ items, onDelete })} />);

      fireEvent.click(screen.getByTitle(/^eliminar$/i));

      expect(onDelete).not.toHaveBeenCalled();
      // El title del botón cambia
      expect(screen.getByTitle(/click otra vez para confirmar/i)).toBeInTheDocument();
    });

    it('segundo click confirma y dispara onDelete', () => {
      const onDelete = vi.fn();
      const items = [makeItem({ id: 'del-me', name: 'Delete target' })];
      render(<ProjectionsList {...defaultProps({ items, onDelete })} />);

      fireEvent.click(screen.getByTitle(/^eliminar$/i));
      fireEvent.click(screen.getByTitle(/click otra vez para confirmar/i));

      expect(onDelete).toHaveBeenCalledWith('del-me');
    });

    it('canDelete=false oculta el botón de eliminar', () => {
      const items = [makeItem({ id: 'del-me' })];
      render(<ProjectionsList {...defaultProps({ items, canDelete: false })} />);

      expect(screen.queryByTitle(/eliminar/i)).not.toBeInTheDocument();
    });

    it('confirmación expira después de 4s', () => {
      const onDelete = vi.fn();
      const items = [makeItem({ id: 'del-me' })];
      render(<ProjectionsList {...defaultProps({ items, onDelete })} />);

      fireEvent.click(screen.getByTitle(/^eliminar$/i));
      expect(screen.getByTitle(/click otra vez para confirmar/i)).toBeInTheDocument();

      // act() para que React flushee el setState disparado por el setTimeout
      act(() => {
        vi.advanceTimersByTime(4001);
      });

      expect(screen.getByTitle(/^eliminar$/i)).toBeInTheDocument();
      expect(screen.queryByTitle(/click otra vez para confirmar/i)).not.toBeInTheDocument();
    });
  });

  describe('scenario badge', () => {
    it('renderiza la etiqueta del escenario en cada fila', () => {
      const items = [
        makeItem({ id: 'a', name: 'A item', scenario_label: 'A' }),
        makeItem({ id: 'b', name: 'B item', scenario_label: 'B' }),
        makeItem({ id: 'c', name: 'C item', scenario_label: 'C' }),
        makeItem({ id: 'cu', name: 'Custom item', scenario_label: 'custom' }),
      ];
      const { container } = render(<ProjectionsList {...defaultProps({ items })} />);

      const rows = container.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(4);
      // Primera fila contiene badge "A"
      const firstRow = rows[0];
      expect(within(firstRow as HTMLElement).getByText('A')).toBeInTheDocument();
    });

    it('scenario_label null se muestra como "—"', () => {
      const items = [makeItem({ id: 'a', name: 'No label', scenario_label: null })];
      render(<ProjectionsList {...defaultProps({ items })} />);

      const rows = screen.getAllByRole('row');
      // Header + 1 fila
      expect(rows.length).toBeGreaterThanOrEqual(2);
      const dataRow = rows[1];
      expect(within(dataRow).getByText('—')).toBeInTheDocument();
    });
  });
});
