import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KPIDashboard from '../KPIDashboard';
import type { KPIDashboardResponse, KPIValue } from '../../../../services/financialModelService';

function makeKpi(overrides: Partial<KPIValue> = {}): KPIValue {
  return {
    key: 'gross_margin',
    label: 'Margen Bruto',
    value: 62.6,
    formatted_value: '62.6%',
    unit: '%',
    trend: [60, 61, 62, 63],
    trend_labels: [],
    status: 'good',
    tooltip: 'Porcentaje de ingresos que queda después del costo de la mercancía',
    ...overrides,
  };
}

function makeResponse(kpis: KPIValue[], overrides: Partial<KPIDashboardResponse> = {}): KPIDashboardResponse {
  return {
    period: '2025-11-04 a 2026-05-04',
    period_label: 'Últimos 6 meses (2025-11-04 → 2026-05-04)',
    period_warning: null,
    generated_at: '2026-05-04T10:00:00',
    kpis,
    ...overrides,
  };
}

describe('KPIDashboard', () => {
  describe('estados base', () => {
    it('muestra empty state cuando data es null', () => {
      render(<KPIDashboard data={null} />);
      expect(screen.getByText(/no hay datos de kpis disponibles/i)).toBeInTheDocument();
    });

    it('renderiza header con period_label', () => {
      const data = makeResponse([makeKpi()]);
      render(<KPIDashboard data={data} />);
      expect(screen.getByText(/Últimos 6 meses/i)).toBeInTheDocument();
    });

    it('renderiza una card por cada KPI', () => {
      const data = makeResponse([
        makeKpi({ key: 'gross_margin', label: 'Margen Bruto' }),
        makeKpi({ key: 'roa', label: 'ROA', value: -10, formatted_value: '-10.0%' }),
      ]);
      render(<KPIDashboard data={data} />);
      expect(screen.getByText('Margen Bruto')).toBeInTheDocument();
      expect(screen.getByText('ROA')).toBeInTheDocument();
    });
  });

  describe('renderizado de KPI con value=null', () => {
    it('muestra "—" en el valor cuando value es null', () => {
      const kpi = makeKpi({
        key: 'current_ratio',
        label: 'Liquidez Corriente',
        value: null,
        formatted_value: '—',
        status: 'neutral',
        tooltip_unavailable: 'Sin pasivos corrientes registrados — el ratio no aplica.',
      });
      render(<KPIDashboard data={makeResponse([kpi])} />);

      expect(screen.getByText('—')).toBeInTheDocument();
      expect(screen.queryByText('999.00')).not.toBeInTheDocument();
    });

    it('expone el tooltip_unavailable en el DOM (visible al hover via group-hover)', () => {
      const kpi = makeKpi({
        value: null,
        formatted_value: '—',
        tooltip_unavailable: 'Sin patrimonio registrado — el ROE no aplica.',
      });
      render(<KPIDashboard data={makeResponse([kpi])} />);

      // El texto está en el DOM aunque el group-hover lo oculte visualmente
      expect(screen.getByText(/sin patrimonio registrado/i)).toBeInTheDocument();
    });

    it('NO renderiza sparkline cuando value es null (evita gráfica fantasma)', () => {
      const kpi = makeKpi({
        value: null,
        formatted_value: '—',
        trend: [1, 2, 3, 4],  // backend podría enviar trend pero igual no se grafica
      });
      const { container } = render(<KPIDashboard data={makeResponse([kpi])} />);
      // MiniSparkline renderiza un SVG; cuando value es null no debe haber polyline.
      const polylines = container.querySelectorAll('svg polyline');
      expect(polylines.length).toBe(0);
    });

    it('aplica color stone (gris) en lugar de rojo/verde cuando es unavailable', () => {
      const kpi = makeKpi({
        value: null,
        formatted_value: '—',
        status: 'neutral',
      });
      const { container } = render(<KPIDashboard data={makeResponse([kpi])} />);
      // El valor "—" se renderiza en gris (text-stone-400)
      const valueEl = screen.getByText('—');
      expect(valueEl.className).toContain('text-stone-400');
      // No hay clase emerald ni red en el card
      const card = container.querySelector('.bg-stone-50');
      expect(card).toBeInTheDocument();
    });
  });

  describe('renderizado de KPI con value numérico', () => {
    it('muestra el formatted_value normal', () => {
      const kpi = makeKpi({ value: 62.6, formatted_value: '62.6%', status: 'good' });
      render(<KPIDashboard data={makeResponse([kpi])} />);
      expect(screen.getByText('62.6%')).toBeInTheDocument();
    });

    it('renderiza sparkline cuando hay trend de al menos 2 puntos', () => {
      const kpi = makeKpi({ trend: [10, 12, 15, 13] });
      const { container } = render(<KPIDashboard data={makeResponse([kpi])} />);
      const polylines = container.querySelectorAll('svg polyline');
      expect(polylines.length).toBeGreaterThan(0);
    });

    it('aplica color del status (good=emerald)', () => {
      const kpi = makeKpi({ status: 'good' });
      const { container } = render(<KPIDashboard data={makeResponse([kpi])} />);
      expect(container.querySelector('.bg-green-50')).toBeInTheDocument();
    });
  });

  describe('period_warning banner', () => {
    it('renderiza banner amarillo cuando hay period_warning', () => {
      const data = makeResponse([makeKpi()], {
        period_warning: 'Mes parcial: solo 4 de 31 días transcurridos.',
      });
      render(<KPIDashboard data={data} />);
      expect(screen.getByText(/mes parcial: solo 4 de 31 días/i)).toBeInTheDocument();
    });

    it('NO renderiza banner cuando period_warning es null', () => {
      const data = makeResponse([makeKpi()], { period_warning: null });
      const { container } = render(<KPIDashboard data={data} />);
      // No hay banner amarillo en el DOM
      expect(container.querySelector('.bg-yellow-50')).not.toBeInTheDocument();
    });
  });

  describe('escenario QA real (regresión)', () => {
    it('muestra todos los KPIs centinela como "—" cuando el negocio no tiene pasivos/equity', () => {
      const data = makeResponse([
        makeKpi({ key: 'current_ratio', label: 'Liquidez Corriente', value: null, formatted_value: '—', status: 'neutral', tooltip_unavailable: 'Sin pasivos.' }),
        makeKpi({ key: 'acid_test', label: 'Prueba Ácida', value: null, formatted_value: '—', status: 'neutral', tooltip_unavailable: 'Sin pasivos.' }),
        makeKpi({ key: 'ap_turnover', label: 'Rotación de CxP', value: null, formatted_value: '—', status: 'neutral', tooltip_unavailable: 'Sin AP.' }),
        makeKpi({ key: 'roe', label: 'ROE', value: null, formatted_value: '—', status: 'neutral', tooltip_unavailable: 'Sin equity.' }),
        makeKpi({ key: 'breakeven', label: 'Punto de Equilibrio', value: null, formatted_value: '—', status: 'neutral', tooltip_unavailable: 'Sin costos fijos.' }),
      ]);
      render(<KPIDashboard data={data} />);

      // Ningún valor centinela visible en el DOM
      expect(screen.queryByText(/999/)).not.toBeInTheDocument();
      expect(screen.queryByText(/43971599/)).not.toBeInTheDocument();
      expect(screen.queryByText('$0')).not.toBeInTheDocument();
      // Todos los "—" presentes (uno por KPI, 5 cards)
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBe(5);
    });
  });
});
