import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ProjectionResults from '../ProjectionResults';
import type {
  ProjectionRunResponse, ProjectionMonth, ProjectionSummary, ProjectionAssumptions,
} from '../../../../../services/projectionService';

// Recharts requiere ResponsiveContainer con tamaño; en jsdom devuelve 0×0 y no
// renderiza los SVG. Lo mockeamos para que pase los children (tests de cards y
// tabla siguen midiendo lo importante).
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 800, height: 300 }}>{children}</div>
    ),
  };
});

function makeAssumptions(): ProjectionAssumptions {
  return {
    name: 'Escenario Test',
    start_year: 2026,
    start_month: 5,
    months: 2,
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

function makeMonth(overrides: Partial<ProjectionMonth> = {}): ProjectionMonth {
  return {
    year: 2026,
    month: 5,
    period_label: 'Mayo 2026',
    revenue: 5_000_000,
    cogs: 3_100_000,
    gross_profit: 1_900_000,
    gross_margin_pct: 38,
    fixed_costs: 1_100_000,
    payroll: 5_600_000,
    formalization_cost_one_time: 0,
    formalization_cost_recurring: 0,
    total_opex: 6_700_000,
    operating_profit: -4_800_000,
    operating_margin_pct: -96,
    interest_expense: 550_000,
    debt_capital_payment: 0,
    net_profit: -5_350_000,
    net_margin_pct: -107,
    cash_inflow: 5_000_000,
    cash_outflow: 10_350_000,
    net_cash_flow: -5_350_000,
    cumulative_cash: 6_650_000,
    headcount: 4,
    below_breakeven: true,
    cash_negative: false,
    ...overrides,
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

function makeResult(overrides: Partial<ProjectionRunResponse> = {}): ProjectionRunResponse {
  return {
    id: 'r-1',
    name: 'Escenario Test',
    assumptions: makeAssumptions(),
    months: [makeMonth(), makeMonth({ month: 6, period_label: 'Junio 2026', cash_negative: true })],
    summary: makeSummary(),
    generated_at: '2026-05-04T10:00:00',
    ...overrides,
  };
}

describe('ProjectionResults', () => {
  describe('header', () => {
    it('muestra el nombre y meta del período', () => {
      const result = makeResult({ name: 'Mi proyección' });
      render(<ProjectionResults result={result} />);

      expect(screen.getByRole('heading', { name: /mi proyección/i, level: 3 })).toBeInTheDocument();
      expect(screen.getByText(/2 meses · inicia 5\/2026/i)).toBeInTheDocument();
    });

    it('muestra la etiqueta de escenario cuando hay formalization_layer', () => {
      const result = makeResult({
        assumptions: {
          ...makeAssumptions(),
          formalization_layer: { scenario_label: 'B', one_time_costs: [], recurring_costs: [] },
        },
      });

      render(<ProjectionResults result={result} />);

      expect(screen.getByText(/escenario b/i)).toBeInTheDocument();
    });

    it('muestra el id truncado cuando está presente', () => {
      const result = makeResult({ id: 'abcdef1234567890' });
      render(<ProjectionResults result={result} />);

      expect(screen.getByText(/abcdef12/)).toBeInTheDocument();
    });

    it('omite el id cuando es null', () => {
      const result = makeResult({ id: null });
      render(<ProjectionResults result={result} />);

      expect(screen.queryByText(/^ID:/)).not.toBeInTheDocument();
    });
  });

  describe('summary cards y tone', () => {
    it('utilidad neta positiva → tone good (clases emerald)', () => {
      const result = makeResult({ summary: makeSummary({ total_net_profit: 10_000_000 }) });
      const { container } = render(<ProjectionResults result={result} />);

      // Card "Utilidad neta total" tiene clase de tone good
      const card = container.querySelector('.bg-emerald-50');
      expect(card).toBeInTheDocument();
    });

    it('utilidad neta negativa → tone critical (clases red)', () => {
      const result = makeResult({ summary: makeSummary({ total_net_profit: -10_000_000 }) });
      const { container } = render(<ProjectionResults result={result} />);

      const criticalCards = container.querySelectorAll('.bg-red-50');
      expect(criticalCards.length).toBeGreaterThan(0);
    });

    it('months_cash_negative=0 → tone good "Sin déficit"', () => {
      const result = makeResult({ summary: makeSummary({ months_cash_negative: 0, ending_cash: 5_000_000, total_net_profit: 5_000_000 }) });
      render(<ProjectionResults result={result} />);

      expect(screen.getByText(/sin déficit/i)).toBeInTheDocument();
    });

    it('months_cash_negative>0 → hint "Revisar capa de costos"', () => {
      const result = makeResult({ summary: makeSummary({ months_cash_negative: 5 }) });
      render(<ProjectionResults result={result} />);

      expect(screen.getByText(/revisar capa de costos/i)).toBeInTheDocument();
    });
  });

  describe('sección de formalización', () => {
    it('NO se renderiza cuando ambos costos son 0', () => {
      const result = makeResult({
        summary: makeSummary({ total_formalization_one_time: 0, total_formalization_recurring: 0 }),
      });
      render(<ProjectionResults result={result} />);

      expect(screen.queryByText(/capa de formalización/i)).not.toBeInTheDocument();
    });

    it('se renderiza cuando hay costos one-time', () => {
      const result = makeResult({
        summary: makeSummary({ total_formalization_one_time: 17_000_000, total_formalization_recurring: 0 }),
      });
      render(<ProjectionResults result={result} />);

      expect(screen.getByText(/capa de formalización/i)).toBeInTheDocument();
    });

    it('se renderiza cuando hay costos recurrentes', () => {
      const result = makeResult({
        summary: makeSummary({ total_formalization_one_time: 0, total_formalization_recurring: 5_000_000 }),
      });
      render(<ProjectionResults result={result} />);

      expect(screen.getByText(/capa de formalización/i)).toBeInTheDocument();
    });
  });

  describe('tabla mes a mes', () => {
    it('renderiza una fila por cada mes', () => {
      const result = makeResult();
      render(<ProjectionResults result={result} />);

      expect(screen.getByText('Mayo 2026')).toBeInTheDocument();
      expect(screen.getByText('Junio 2026')).toBeInTheDocument();
    });

    it('muestra flag below_breakeven (icono ⚠)', () => {
      const result = makeResult({
        months: [makeMonth({ below_breakeven: true, cash_negative: false })],
      });
      render(<ProjectionResults result={result} />);

      const flag = screen.getByTitle(/bajo breakeven/i);
      expect(flag).toBeInTheDocument();
    });

    it('muestra flag cash_negative (icono ✕)', () => {
      const result = makeResult({
        months: [makeMonth({ below_breakeven: false, cash_negative: true })],
      });
      render(<ProjectionResults result={result} />);

      const flag = screen.getByTitle(/caja negativa/i);
      expect(flag).toBeInTheDocument();
    });

    it('muestra ambos flags simultáneamente', () => {
      const result = makeResult({
        months: [makeMonth({ below_breakeven: true, cash_negative: true })],
      });
      render(<ProjectionResults result={result} />);

      expect(screen.getByTitle(/bajo breakeven/i)).toBeInTheDocument();
      expect(screen.getByTitle(/caja negativa/i)).toBeInTheDocument();
    });
  });

  describe('charts (smoke)', () => {
    it('renderiza 3 ResponsiveContainers (P&L, cumulative cash, OpEx)', () => {
      const result = makeResult();
      render(<ProjectionResults result={result} />);

      const containers = screen.getAllByTestId('responsive-container');
      expect(containers).toHaveLength(3);
    });

    it('renderiza headers de los 3 charts', () => {
      const result = makeResult();
      render(<ProjectionResults result={result} />);

      expect(screen.getByText(/ingresos vs costos vs utilidad neta/i)).toBeInTheDocument();
      expect(screen.getByText(/caja acumulada/i)).toBeInTheDocument();
      expect(screen.getByText(/composición de opex/i)).toBeInTheDocument();
    });
  });

  describe('headcount card', () => {
    it('toma el headcount del último mes', () => {
      const result = makeResult({
        months: [
          makeMonth({ headcount: 4 }),
          makeMonth({ month: 6, headcount: 7, period_label: 'Junio 2026' }),
        ],
      });
      render(<ProjectionResults result={result} />);

      // SummaryCard layout: div.p-3 > div.flex (icon+label), div.text-lg (value)
      // Subimos al wrapper del card y luego buscamos el value.
      const labelSpan = screen.getByText(/headcount fin de período/i);
      const card = labelSpan.closest('div')?.parentElement;
      expect(card).not.toBeNull();
      if (card) {
        expect(within(card).getByText('7')).toBeInTheDocument();
      }
    });
  });
});
