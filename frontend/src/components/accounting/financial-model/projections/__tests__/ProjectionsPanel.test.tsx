import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProjectionsPanel from '../ProjectionsPanel';
import { projectionService } from '../../../../../services/projectionService';
import { usePermissions } from '../../../../../hooks/usePermissions';
import type {
  ProjectionRunResponse, ProjectionListItem, ProjectionDetailResponse,
  ProjectionSummary, ProjectionAssumptions,
} from '../../../../../services/projectionService';

vi.mock('../../../../../services/projectionService', () => ({
  projectionService: {
    runProjection: vi.fn(),
    listProjections: vi.fn(),
    getProjection: vi.fn(),
    deleteProjection: vi.fn(),
  },
}));

vi.mock('../../../../../hooks/usePermissions');

// Mock recharts (ProjectionResults se renderiza al correr una proyección)
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 800, height: 300 }}>{children}</div>
    ),
  };
});

function setHasPermission(allowed: boolean) {
  (usePermissions as unknown as Mock).mockReturnValue({
    hasPermission: (code: string) => allowed && code === 'reports.financial',
    hasAnyPermission: vi.fn(),
    hasAllPermissions: vi.fn(),
    permissions: new Set(allowed ? ['reports.financial'] : []),
    maxDiscountPercent: 0,
    getConstraints: vi.fn(),
    canManageSchoolUsers: false,
  });
}

function makeAssumptions(): ProjectionAssumptions {
  return {
    name: 'P-Test',
    start_year: 2026,
    start_month: 5,
    months: 12,
    base_revenue_monthly: 7_500_000,
    seasonality: { 1: 1, 2: 1 },
    growth_rate_monthly: 0,
    cogs_pct: 0.62,
    fixed_costs_monthly: 1_100_000,
    payroll_monthly_base: 5_600_000,
    hiring_plan: [],
    new_branches: [],
    debts: [],
    formalization_layer: null,
    inflation_annual: 0.06,
    initial_cash: 12_000_000,
  };
}

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

function makeRunResponse(overrides: Partial<ProjectionRunResponse> = {}): ProjectionRunResponse {
  return {
    id: 'r-1',
    name: 'P-Test',
    assumptions: makeAssumptions(),
    months: [],
    summary: makeSummary(),
    generated_at: '2026-05-04T10:00:00',
    ...overrides,
  };
}

function makeListItem(overrides: Partial<ProjectionListItem> = {}): ProjectionListItem {
  return {
    id: 'p-saved',
    name: 'Guardada',
    scenario_label: 'B',
    months_count: 12,
    start_year: 2026,
    start_month: 5,
    summary: makeSummary(),
    created_at: '2026-05-04T10:00:00',
    ...overrides,
  };
}

function makeDetail(overrides: Partial<ProjectionDetailResponse> = {}): ProjectionDetailResponse {
  return {
    id: 'p-saved',
    name: 'Guardada',
    scenario_label: 'B',
    months_count: 12,
    start_year: 2026,
    start_month: 5,
    assumptions: makeAssumptions(),
    results: [],
    summary: makeSummary(),
    created_at: '2026-05-04T10:00:00',
    ...overrides,
  };
}

describe('ProjectionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (projectionService.listProjections as Mock).mockResolvedValue([]);
  });

  describe('permission gating', () => {
    it('sin permiso reports.financial muestra banner "Acceso restringido"', () => {
      setHasPermission(false);
      render(<ProjectionsPanel />);

      expect(screen.getByText(/acceso restringido/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /nueva proyección/i })).not.toBeInTheDocument();
    });

    it('con permiso muestra ambos sub-tabs', () => {
      setHasPermission(true);
      render(<ProjectionsPanel />);

      expect(screen.getByRole('button', { name: /nueva proyección/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /escenarios guardados/i })).toBeInTheDocument();
    });
  });

  describe('navegación entre sub-tabs', () => {
    it('al cambiar a "Escenarios guardados" llama a listProjections', async () => {
      setHasPermission(true);
      (projectionService.listProjections as Mock).mockResolvedValue([]);

      render(<ProjectionsPanel />);
      fireEvent.click(screen.getByRole('button', { name: /escenarios guardados/i }));

      await waitFor(() => {
        expect(projectionService.listProjections).toHaveBeenCalled();
      });
    });

    it('refleja el conteo de items en el badge del sub-tab', async () => {
      setHasPermission(true);
      const items = [makeListItem({ id: 'a' }), makeListItem({ id: 'b' }), makeListItem({ id: 'c' })];
      (projectionService.listProjections as Mock).mockResolvedValue(items);

      render(<ProjectionsPanel />);
      fireEvent.click(screen.getByRole('button', { name: /escenarios guardados/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /escenarios guardados.*3/i })).toBeInTheDocument();
      });
    });
  });

  describe('correr proyección', () => {
    it('handleRun (vía submit del form) dispara runProjection con persist=true por default', async () => {
      setHasPermission(true);
      (projectionService.runProjection as Mock).mockResolvedValue(makeRunResponse());

      render(<ProjectionsPanel />);

      // El form se renderiza; click en "Calcular proyección"
      fireEvent.click(screen.getByRole('button', { name: /calcular proyección/i }));

      await waitFor(() => {
        expect(projectionService.runProjection).toHaveBeenCalled();
      });
      const [, options] = (projectionService.runProjection as Mock).mock.calls[0];
      expect(options).toEqual({ persist: true });
    });

    it('muestra ProjectionResults tras runProjection exitoso', async () => {
      setHasPermission(true);
      (projectionService.runProjection as Mock).mockResolvedValue(
        makeRunResponse({ name: 'Resultado X' }),
      );

      render(<ProjectionsPanel />);
      fireEvent.click(screen.getByRole('button', { name: /calcular proyección/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /resultado x/i, level: 3 })).toBeInTheDocument();
      });
    });

    it('error en runProjection muestra banner rojo con mensaje', async () => {
      setHasPermission(true);
      (projectionService.runProjection as Mock).mockRejectedValue(new Error('Backend caído'));

      render(<ProjectionsPanel />);
      fireEvent.click(screen.getByRole('button', { name: /calcular proyección/i }));

      await waitFor(() => {
        expect(screen.getByText(/backend caído/i)).toBeInTheDocument();
      });
    });

    it('error sin instancia Error muestra mensaje genérico', async () => {
      setHasPermission(true);
      (projectionService.runProjection as Mock).mockRejectedValue('string error');

      render(<ProjectionsPanel />);
      fireEvent.click(screen.getByRole('button', { name: /calcular proyección/i }));

      await waitFor(() => {
        expect(screen.getByText(/error al correr la proyección/i)).toBeInTheDocument();
      });
    });

    it('persist=true en el run dispara reload de la lista', async () => {
      setHasPermission(true);
      (projectionService.runProjection as Mock).mockResolvedValue(makeRunResponse());
      (projectionService.listProjections as Mock).mockResolvedValue([]);

      render(<ProjectionsPanel />);
      fireEvent.click(screen.getByRole('button', { name: /calcular proyección/i }));

      // listProjections debe ser llamado al volver a la pestaña saved después
      await waitFor(() => {
        expect(projectionService.runProjection).toHaveBeenCalled();
      });
      // Cambio a saved fuerza el efecto loadList
      fireEvent.click(screen.getByRole('button', { name: /escenarios guardados/i }));
      await waitFor(() => {
        expect(projectionService.listProjections).toHaveBeenCalled();
      });
    });
  });

  describe('ver detalle (handleViewSaved)', () => {
    it('al ver detalle, getProjection se llama y se cambia a sub-tab "Nueva"', async () => {
      setHasPermission(true);
      const items = [makeListItem({ id: 'p-saved', name: 'Guardada uno' })];
      (projectionService.listProjections as Mock).mockResolvedValue(items);
      (projectionService.getProjection as Mock).mockResolvedValue(makeDetail({ name: 'Guardada uno' }));

      render(<ProjectionsPanel />);
      fireEvent.click(screen.getByRole('button', { name: /escenarios guardados/i }));

      await waitFor(() => {
        expect(screen.getByText('Guardada uno')).toBeInTheDocument();
      });

      const viewBtn = screen.getByTitle(/ver detalle/i);
      fireEvent.click(viewBtn);

      await waitFor(() => {
        expect(projectionService.getProjection).toHaveBeenCalledWith('p-saved');
      });
      // Sub-tab cambia a "Nueva proyección" → form visible
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /calcular proyección/i })).toBeInTheDocument();
      });
    });

    it('error al cargar detalle muestra mensaje en el listado', async () => {
      setHasPermission(true);
      const items = [makeListItem({ id: 'p-saved' })];
      (projectionService.listProjections as Mock).mockResolvedValue(items);
      (projectionService.getProjection as Mock).mockRejectedValue(new Error('No encontrada'));

      render(<ProjectionsPanel />);
      fireEvent.click(screen.getByRole('button', { name: /escenarios guardados/i }));
      await waitFor(() => expect(screen.getByText('Guardada')).toBeInTheDocument());

      fireEvent.click(screen.getByTitle(/ver detalle/i));

      await waitFor(() => {
        expect(screen.getByText(/no encontrada/i)).toBeInTheDocument();
      });
    });
  });

  describe('eliminar (handleDelete)', () => {
    it('confirma y llama deleteProjection, removiendo el item de la lista', async () => {
      setHasPermission(true);
      const items = [makeListItem({ id: 'del-me', name: 'A borrar' })];
      (projectionService.listProjections as Mock).mockResolvedValue(items);
      (projectionService.deleteProjection as Mock).mockResolvedValue(undefined);

      render(<ProjectionsPanel />);
      fireEvent.click(screen.getByRole('button', { name: /escenarios guardados/i }));

      await waitFor(() => expect(screen.getByText('A borrar')).toBeInTheDocument());

      // 1er click: confirmación
      fireEvent.click(screen.getByTitle(/^eliminar$/i));
      // 2do click: confirma
      fireEvent.click(screen.getByTitle(/click otra vez para confirmar/i));

      await waitFor(() => {
        expect(projectionService.deleteProjection).toHaveBeenCalledWith('del-me');
      });
      await waitFor(() => {
        expect(screen.queryByText('A borrar')).not.toBeInTheDocument();
      });
    });

    it('error en delete muestra mensaje', async () => {
      setHasPermission(true);
      const items = [makeListItem({ id: 'del-me' })];
      (projectionService.listProjections as Mock).mockResolvedValue(items);
      (projectionService.deleteProjection as Mock).mockRejectedValue(new Error('No autorizado'));

      render(<ProjectionsPanel />);
      fireEvent.click(screen.getByRole('button', { name: /escenarios guardados/i }));
      await waitFor(() => expect(screen.getByText('Guardada')).toBeInTheDocument());

      fireEvent.click(screen.getByTitle(/^eliminar$/i));
      fireEvent.click(screen.getByTitle(/click otra vez para confirmar/i));

      await waitFor(() => {
        expect(screen.getByText(/no autorizado/i)).toBeInTheDocument();
      });
    });
  });

  describe('limpiar resultado', () => {
    it('botón "Limpiar resultado" remueve el currentResult', async () => {
      setHasPermission(true);
      (projectionService.runProjection as Mock).mockResolvedValue(
        makeRunResponse({ name: 'Mi resultado' }),
      );

      render(<ProjectionsPanel />);
      fireEvent.click(screen.getByRole('button', { name: /calcular proyección/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mi resultado/i, level: 3 })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /limpiar resultado/i }));

      expect(screen.queryByRole('heading', { name: /mi resultado/i, level: 3 })).not.toBeInTheDocument();
    });
  });
});
