import { describe, it, expect } from 'vitest';
import {
  PRESET_META, buildPresetAssumptions, buildEmptyAssumptions, SEASONALITY_DEFAULTS,
} from '../projectionPresets';

describe('projectionPresets', () => {
  describe('PRESET_META', () => {
    it('exposes 4 presets including baseline', () => {
      expect(PRESET_META).toHaveLength(4);
      expect(PRESET_META.map((p) => p.key)).toEqual(['baseline', 'A', 'B', 'C']);
    });

    it('marks B as recomendado', () => {
      const b = PRESET_META.find((p) => p.key === 'B');
      expect(b?.badge).toBe('recomendado');
    });
  });

  describe('buildPresetAssumptions', () => {
    it('baseline has no formalization layer', () => {
      const a = buildPresetAssumptions('baseline');
      expect(a.formalization_layer).toBeNull();
    });

    it('escenario A returns scenario_label A and includes ARL recurring', () => {
      const a = buildPresetAssumptions('A');
      expect(a.formalization_layer?.scenario_label).toBe('A');
      const concepts = a.formalization_layer?.recurring_costs.map((c) => c.concept) ?? [];
      expect(concepts).toContain('arl_5_personas');
    });

    it('escenario B aggregate one-time matches doc target ~$17M', () => {
      const a = buildPresetAssumptions('B');
      const total = a.formalization_layer?.one_time_costs.reduce((sum, c) => sum + c.amount, 0) ?? 0;
      // Doc says one-time total ~$17M for the example cash-flow execution
      expect(total).toBeGreaterThanOrEqual(15_000_000);
      expect(total).toBeLessThanOrEqual(20_000_000);
    });

    it('escenario C extends B with extra one-time costs and replaces contador', () => {
      const b = buildPresetAssumptions('B');
      const c = buildPresetAssumptions('C');
      const cOneTime = c.formalization_layer?.one_time_costs.length ?? 0;
      const bOneTime = b.formalization_layer?.one_time_costs.length ?? 0;
      expect(cOneTime).toBeGreaterThan(bOneTime);

      const cConcepts = c.formalization_layer?.recurring_costs.map((c) => c.concept) ?? [];
      expect(cConcepts).toContain('contador_full_time');
      expect(cConcepts).not.toContain('contador_externo');
    });

    it('all presets share UCR baseline (start_month=5, start_year=2026, 12 meses)', () => {
      for (const key of ['baseline', 'A', 'B', 'C'] as const) {
        const a = buildPresetAssumptions(key);
        expect(a.start_year).toBe(2026);
        expect(a.start_month).toBe(5);
        expect(a.months).toBe(12);
      }
    });

    it('all presets include the 2 informal loans by default', () => {
      const b = buildPresetAssumptions('B');
      expect(b.debts).toHaveLength(2);
      const totalCapital = b.debts.reduce((sum, d) => sum + d.capital, 0);
      expect(totalCapital).toBe(19_000_000);
    });
  });

  describe('buildEmptyAssumptions', () => {
    it('returns zero debts and no formalization layer', () => {
      const a = buildEmptyAssumptions();
      expect(a.formalization_layer).toBeNull();
      expect(a.debts).toEqual([]);
    });
  });

  describe('SEASONALITY_DEFAULTS', () => {
    it('peaks in january and february', () => {
      const peak = Math.max(SEASONALITY_DEFAULTS[1], SEASONALITY_DEFAULTS[2]);
      const trough = Math.min(SEASONALITY_DEFAULTS[4], SEASONALITY_DEFAULTS[5]);
      expect(peak).toBeGreaterThan(1.5);
      expect(trough).toBeLessThan(0.7);
    });

    it('averages close to 1.0 across the 12 months', () => {
      const sum = Object.values(SEASONALITY_DEFAULTS).reduce((acc, v) => acc + v, 0);
      const avg = sum / 12;
      expect(avg).toBeGreaterThan(0.9);
      expect(avg).toBeLessThan(1.1);
    });
  });
});
