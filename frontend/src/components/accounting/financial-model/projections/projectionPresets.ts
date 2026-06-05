/**
 * Projection Presets - UCR scenarios A/B/C from docs/formalization/financial-impact.md
 *
 * Each preset returns a fully-formed ProjectionAssumptions ready to feed into
 * runProjection. The user can edit any field after loading a preset.
 *
 * Defaults reflect:
 * - Base revenue 7.5M with school-cycle seasonality (jan-feb peak, may-jun low)
 * - Initial cash 12.08M (from prod snapshot 2026-05-02)
 * - 2 informal loans (interest-only) totalling 19M capital, 550k/mo interest
 * - Fixed costs 1.1M (arriendo + servicios + internet)
 * - Payroll base 5.6M (4 trabajadores SMMLV, informal hoy)
 */
import type { ProjectionAssumptions, ProjectionFormalizationLayer, ProjectionHire } from '../../../../services/projectionService';

const SEASONALITY_UCR: Record<number, number> = {
  1: 2.33,   // enero pico
  2: 1.95,   // febrero pico
  3: 0.91,   // marzo medio
  4: 0.58,   // abril bajo
  5: 0.58,   // mayo bajo
  6: 0.65,   // junio bajo
  7: 1.17,   // julio medio
  8: 0.91,   // agosto medio
  9: 0.65,   // septiembre bajo
  10: 0.71,  // octubre bajo
  11: 0.65,  // noviembre bajo
  12: 0.91,  // diciembre medio
};

const BASELINE: Omit<ProjectionAssumptions, 'name' | 'formalization_layer'> = {
  start_year: 2026,
  start_month: 5,
  months: 12,
  base_revenue_monthly: 7_500_000,
  seasonality: SEASONALITY_UCR,
  growth_rate_monthly: 0,
  cogs_pct: 0.62,
  fixed_costs_monthly: 1_100_000,
  payroll_monthly_base: 5_600_000,
  hiring_plan: [],
  new_branches: [],
  debts: [
    {
      name: 'Préstamo informal 1',
      capital: 12_000_000,
      monthly_payment: 300_000,
      interest_portion_monthly: 300_000,
      capital_portion_monthly: 0,
      starts_month_offset: 0,
      term_months: null,
    },
    {
      name: 'Préstamo informal 2',
      capital: 7_000_000,
      monthly_payment: 250_000,
      interest_portion_monthly: 250_000,
      capital_portion_monthly: 0,
      starts_month_offset: 0,
      term_months: null,
    },
  ],
  inflation_annual: 0.06,
  initial_cash: 12_080_000,
};

// ============================================
// Escenario A — Mínimo Viable Legal
// ============================================
//
// Cubre riesgos críticos sin sobrecostos. Operación informal de facto pero
// con seguros básicos. ARL para los 5, Felipe/Salomé/Santiago como
// independientes, contador freelance básico, FE económico, regularización DIAN.
// Total año 1: ~$10-14M COP

const FORMALIZATION_A: ProjectionFormalizationLayer = {
  scenario_label: 'A',
  one_time_costs: [
    { month_offset: 0, concept: 'contador_freelance_arranque', amount: 800_000 },
    { month_offset: 1, concept: 'regularizacion_dian_simple', amount: 1_500_000 },
    { month_offset: 1, concept: 'fe_setup_factus', amount: 150_000 },
    { month_offset: 7, concept: 'cierre_anual_freelance', amount: 1_000_000 },
  ],
  recurring_costs: [
    { concept: 'contador_freelance', amount_monthly: 200_000, starts_month_offset: 0, ends_month_offset: null },
    { concept: 'arl_5_personas', amount_monthly: 36_000, starts_month_offset: 0, ends_month_offset: null },
    { concept: 'fe_dian_economico', amount_monthly: 50_000, starts_month_offset: 1, ends_month_offset: null },
    { concept: 'auxilios_eps_afp_independientes', amount_monthly: 600_000, starts_month_offset: 0, ends_month_offset: null },
  ],
};

// ============================================
// Escenario B — Formalización Completa (recomendado)
// ============================================
//
// 100% formal antes de v3.1 (junio 2026). SAS, contratos formales,
// FE/nómina electrónica DIAN, regularización completa.
// Total año 1: ~$32-47M COP

const FORMALIZATION_B: ProjectionFormalizationLayer = {
  scenario_label: 'B',
  one_time_costs: [
    { month_offset: 0, concept: 'asesor_legal_sas', amount: 1_000_000 },
    { month_offset: 0, concept: 'contador_arranque', amount: 2_000_000 },
    { month_offset: 0, concept: 'asesor_laboral_dx', amount: 2_000_000 },
    { month_offset: 1, concept: 'constitucion_sas', amount: 950_000 },
    { month_offset: 1, concept: 'regularizacion_dian', amount: 2_250_000 },
    { month_offset: 1, concept: 'fe_setup_siigo', amount: 150_000 },
    { month_offset: 2, concept: 'pasivo_laboral_t1', amount: 2_250_000 },
    { month_offset: 4, concept: 'pasivo_laboral_t2', amount: 2_250_000 },
    { month_offset: 6, concept: 'pasivo_laboral_t3', amount: 2_000_000 },
    { month_offset: 7, concept: 'cierre_contable_anual', amount: 1_750_000 },
    { month_offset: 10, concept: 'renovacion_cc', amount: 550_000 },
  ],
  recurring_costs: [
    { concept: 'contador_externo', amount_monthly: 550_000, starts_month_offset: 0, ends_month_offset: null },
    { concept: 'arl_5_personas', amount_monthly: 36_000, starts_month_offset: 0, ends_month_offset: null },
    { concept: 'fe_dian_siigo', amount_monthly: 125_000, starts_month_offset: 1, ends_month_offset: null },
    { concept: 'nomina_electronica', amount_monthly: 55_000, starts_month_offset: 3, ends_month_offset: null },
    { concept: 'aportes_patronales_formales', amount_monthly: 2_000_000, starts_month_offset: 3, ends_month_offset: null },
  ],
};

// ============================================
// Escenario C — B2B Ready Premium
// ============================================
//
// B + certificaciones, RUP, BASC/ISO, marca registrada, contador full-time,
// asesor legal de cabecera. Para venta a Estado y corporativos exigentes.
// Total año 1: ~$50-80M COP

const FORMALIZATION_C: ProjectionFormalizationLayer = {
  scenario_label: 'C',
  one_time_costs: [
    ...FORMALIZATION_B.one_time_costs,
    { month_offset: 4, concept: 'web_profesional_marca', amount: 3_000_000 },
    { month_offset: 5, concept: 'marca_registrada_sic', amount: 2_000_000 },
    { month_offset: 6, concept: 'inscripcion_rup', amount: 1_000_000 },
    { month_offset: 8, concept: 'certificacion_iso_basc', amount: 5_000_000 },
  ],
  recurring_costs: [
    // Reemplazamos contador básico por full-time
    { concept: 'contador_full_time', amount_monthly: 800_000, starts_month_offset: 0, ends_month_offset: null },
    { concept: 'arl_5_personas', amount_monthly: 36_000, starts_month_offset: 0, ends_month_offset: null },
    { concept: 'fe_dian_siigo', amount_monthly: 125_000, starts_month_offset: 1, ends_month_offset: null },
    { concept: 'nomina_electronica', amount_monthly: 55_000, starts_month_offset: 3, ends_month_offset: null },
    { concept: 'aportes_patronales_formales', amount_monthly: 2_000_000, starts_month_offset: 3, ends_month_offset: null },
    { concept: 'asesor_legal_retainer', amount_monthly: 500_000, starts_month_offset: 0, ends_month_offset: null },
    { concept: 'asesor_comercial_b2b', amount_monthly: 600_000, starts_month_offset: 1, ends_month_offset: null },
  ],
};

// ============================================
// Public preset map
// ============================================

export interface PresetMeta {
  key: 'A' | 'B' | 'C' | 'baseline';
  label: string;
  description: string;
  badge: 'mínimo' | 'recomendado' | 'premium' | 'baseline';
  estimatedYearOneCost: string;
}

export const PRESET_META: PresetMeta[] = [
  {
    key: 'baseline',
    label: 'Sin formalización',
    description: 'Operación actual sin capa de formalización (para comparativo).',
    badge: 'baseline',
    estimatedYearOneCost: '$0',
  },
  {
    key: 'A',
    label: 'Escenario A — Mínimo viable',
    description: 'ARL + contador freelance + FE económico + regularización DIAN. Sin SAS.',
    badge: 'mínimo',
    estimatedYearOneCost: '$10M – $14M',
  },
  {
    key: 'B',
    label: 'Escenario B — Formalización completa',
    description: 'SAS + contratos formales + FE/nómina DIAN + regularización completa.',
    badge: 'recomendado',
    estimatedYearOneCost: '$32M – $47M',
  },
  {
    key: 'C',
    label: 'Escenario C — B2B Ready Premium',
    description: 'B + RUP + BASC/ISO + marca registrada + asesoría legal de cabecera.',
    badge: 'premium',
    estimatedYearOneCost: '$50M – $80M',
  },
];

export function buildPresetAssumptions(key: PresetMeta['key']): ProjectionAssumptions {
  const baseName = `Proyección UCR — ${key === 'baseline' ? 'sin formalización' : `Escenario ${key}`}`;
  const formalization =
    key === 'A' ? FORMALIZATION_A
      : key === 'B' ? FORMALIZATION_B
        : key === 'C' ? FORMALIZATION_C
          : null;
  return {
    name: baseName,
    formalization_layer: formalization,
    ...BASELINE,
  };
}

export function buildEmptyAssumptions(): ProjectionAssumptions {
  return {
    name: 'Nueva proyección',
    formalization_layer: null,
    ...BASELINE,
    debts: [],
  };
}

export const SEASONALITY_DEFAULTS = SEASONALITY_UCR;

// ============================================
// PAYROLL SCENARIOS — Modelaje de nómina mes a mes con switch Fase 1 → Fase 2
// ============================================
//
// Estos presets aíslan la dimensión de NÓMINA del modelo. Para que el cálculo
// no se duplique con la nómina informal de BASELINE (5.6M/mes), estos presets
// ponen payroll_monthly_base = 0 y modelan TODO el personal vía hiring_plan
// (Consuelo founder + Felipe + Salomé + Santiago con switch de fase).
//
// Cifras 2026 oficiales: SMMLV $1,750,905 + auxilio transporte $249,095.
// Cost-to-company SMMLV formal SAS con exoneración Art. 114-1 ET ≈ $2,787,165.
// + Bono de estudio extralegal $300k → ~$3,087,000 por persona en Fase 2.
// Switch default mes 6 (noviembre 2026) per acuerdo owner.
//
// Ver docs/v3/formalization/equipo-roadmap-2026.md para fundamentación.

interface PayrollPhase {
  /** Compensación total al trabajador para esta fase (salario + bono + auxilios). */
  totalToWorker: number;
  /** % a aplicar sobre totalToWorker para llegar al cost-to-company UCR.
   *  0 = no hay parafiscales (fase informal). 0.5 = cost-to-company es 1.5× lo que recibe. */
  costMarkupPct: number;
  rolePrefix: string;
}

interface PayrollMember {
  /** Nombre que aparece en el role del hire. */
  name: string;
  /** Fracción de jornada: 1.0 = tiempo completo, 0.5 = medio tiempo. Multiplica totalToWorker. */
  ratio: number;
}

interface PayrollScenarioConfig {
  key: 'N1' | 'N2' | 'N3';
  label: string;
  consueloMonthly: number;
  jovenes: readonly PayrollMember[];
  /** Mes (offset) donde se salta de Fase 1 a Fase 2. -1 = no hay Fase 1 (arranca formal). */
  phaseSwitchMonth: number;
  fase1?: PayrollPhase;
  fase2: PayrollPhase;
}

// Jóvenes con su fracción de jornada. Santiago es MEDIO TIEMPO (ratio 0.5).
const JOVENES: readonly PayrollMember[] = [
  { name: 'Felipe', ratio: 1.0 },
  { name: 'Salomé', ratio: 1.0 },
  { name: 'Santiago', ratio: 0.5 },
] as const;

const PAYROLL_N1: PayrollScenarioConfig = {
  key: 'N1',
  label: 'Nómina conservadora',
  consueloMonthly: 3_500_000,
  jovenes: JOVENES,
  phaseSwitchMonth: 6,
  fase1: {
    totalToWorker: 1_300_000,
    costMarkupPct: 0,
    rolePrefix: 'F1 (informal)',
  },
  fase2: {
    totalToWorker: 3_087_000,
    costMarkupPct: 0,
    rolePrefix: 'F2 (SAS formal)',
  },
};

const PAYROLL_N2: PayrollScenarioConfig = {
  key: 'N2',
  label: 'Nómina base',
  consueloMonthly: 4_000_000,
  jovenes: JOVENES,
  phaseSwitchMonth: 6,
  fase1: {
    totalToWorker: 1_900_000,
    costMarkupPct: 0,
    rolePrefix: 'F1 (indep + SS)',
  },
  fase2: {
    totalToWorker: 3_087_000,
    costMarkupPct: 0,
    rolePrefix: 'F2 (SAS formal)',
  },
};

const PAYROLL_N3: PayrollScenarioConfig = {
  key: 'N3',
  label: 'Formalización inmediata',
  consueloMonthly: 4_500_000,
  jovenes: JOVENES,
  phaseSwitchMonth: -1,
  fase2: {
    totalToWorker: 3_087_000,
    costMarkupPct: 0,
    rolePrefix: 'F2 (SAS formal desde mes 0)',
  },
};

const PAYROLL_CONFIGS: Record<'N1' | 'N2' | 'N3', PayrollScenarioConfig> = {
  N1: PAYROLL_N1,
  N2: PAYROLL_N2,
  N3: PAYROLL_N3,
};

function buildPayrollHires(config: PayrollScenarioConfig, months: number): ProjectionHire[] {
  const hires: ProjectionHire[] = [];

  // Consuelo (founder, sin fases)
  hires.push({
    month_offset: 0,
    end_month_offset: null,
    role: 'Consuelo (founder)',
    monthly_salary: config.consueloMonthly,
    parafiscales_pct: 0,
  });

  const hasFase1 = config.phaseSwitchMonth >= 0 && config.fase1 !== undefined;
  const fase1EndIdx = hasFase1 ? config.phaseSwitchMonth - 1 : -1;

  for (const joven of config.jovenes) {
    const ratioLabel = joven.ratio < 1 ? ` (½ tiempo)` : '';
    if (hasFase1 && config.fase1) {
      hires.push({
        month_offset: 0,
        end_month_offset: fase1EndIdx,
        role: `${joven.name}${ratioLabel} ${config.fase1.rolePrefix}`,
        monthly_salary: config.fase1.totalToWorker * joven.ratio,
        parafiscales_pct: config.fase1.costMarkupPct,
      });
    }
    const fase2Start = hasFase1 ? config.phaseSwitchMonth : 0;
    if (fase2Start < months) {
      hires.push({
        month_offset: fase2Start,
        end_month_offset: null,
        role: `${joven.name}${ratioLabel} ${config.fase2.rolePrefix}`,
        monthly_salary: config.fase2.totalToWorker * joven.ratio,
        parafiscales_pct: config.fase2.costMarkupPct,
      });
    }
  }

  return hires;
}

export interface PayrollScenarioMeta {
  key: 'N1' | 'N2' | 'N3';
  label: string;
  description: string;
  badge: 'conservador' | 'base' | 'agresivo';
  fase1TotalMonthly: string;
  fase2TotalMonthly: string;
}

export const PAYROLL_SCENARIO_META: PayrollScenarioMeta[] = [
  {
    key: 'N1',
    label: 'N1 — Nómina conservadora',
    description: 'Fase 1 (mes 0-5): $1.3M/joven informal (Santi ½ tiempo $650k). Fase 2 (mes 6-11): $3.09M cost-to-company formal (Santi $1.54M). Consuelo founder $3.5M.',
    badge: 'conservador',
    fase1TotalMonthly: '$6.75M/mes',
    fase2TotalMonthly: '$11.2M/mes',
  },
  {
    key: 'N2',
    label: 'N2 — Nómina base',
    description: 'Fase 1 (mes 0-5): $1.9M/joven (Santi ½ tiempo $950k). Fase 2 (mes 6-11): $3.09M formal (Santi $1.54M). Consuelo founder $4.0M.',
    badge: 'base',
    fase1TotalMonthly: '$8.75M/mes',
    fase2TotalMonthly: '$11.7M/mes',
  },
  {
    key: 'N3',
    label: 'N3 — Formalización inmediata',
    description: 'Sin Fase 1: $3.09M/joven desde mes 0 (Santi ½ tiempo $1.54M; SAS constituida antes). Consuelo founder $4.5M.',
    badge: 'agresivo',
    fase1TotalMonthly: '—',
    fase2TotalMonthly: '$12.2M/mes',
  },
];

export function buildPayrollScenarioAssumptions(key: 'N1' | 'N2' | 'N3'): ProjectionAssumptions {
  const config = PAYROLL_CONFIGS[key];
  const months = BASELINE.months;
  return {
    name: `UCR — ${config.label}`,
    formalization_layer: null,
    ...BASELINE,
    payroll_monthly_base: 0,
    hiring_plan: buildPayrollHires(config, months),
  };
}
