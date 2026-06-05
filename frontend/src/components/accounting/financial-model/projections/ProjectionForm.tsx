/**
 * ProjectionForm - Captura los assumptions de una proyección financiera multi-mes.
 *
 * Estructura por secciones colapsables:
 *  - Período (start_year, start_month, months)
 *  - Ingresos (base + estacionalidad + crecimiento)
 *  - COGS (% sobre ingresos)
 *  - Costos fijos
 *  - Personal (payroll base + plan de contrataciones)
 *  - Sucursales nuevas
 *  - Deudas
 *  - Capa de formalización (one-time + recurring)
 *  - Macro (inflación + caja inicial)
 */
import { useState } from 'react';
import {
  ChevronDown, ChevronRight, Plus, Trash2, Sparkles, Calendar, DollarSign,
  Percent, Building2, Users, CreditCard, Briefcase, Globe, Loader2,
} from 'lucide-react';
import { formatCurrency } from '../../../../utils/formatting';
import type {
  ProjectionAssumptions, ProjectionHire, ProjectionDebt, ProjectionNewBranch,
  FormalizationOneTimeCost, FormalizationRecurringCost,
} from '../../../../services/projectionService';
import {
  PRESET_META, buildPresetAssumptions, buildEmptyAssumptions, SEASONALITY_DEFAULTS,
} from './projectionPresets';

interface Props {
  initialAssumptions?: ProjectionAssumptions;
  onSubmit: (assumptions: ProjectionAssumptions, persist: boolean) => void;
  onCancel?: () => void;
  submitting?: boolean;
  canRun: boolean;
}

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface SectionProps {
  icon: typeof Calendar;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

function Section({ icon: Icon, title, children, defaultOpen = false, badge }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-stone-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 text-stone-500" /> : <ChevronRight className="w-4 h-4 text-stone-500" />}
        <Icon className="w-5 h-5 text-brand-600" />
        <span className="font-medium text-stone-800">{title}</span>
        {badge && (
          <span className="ml-auto text-xs px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full">{badge}</span>
        )}
      </button>
      {open && <div className="p-4 space-y-3 bg-white">{children}</div>}
    </div>
  );
}

function NumberField({
  label, value, onChange, step, min, max, suffix, hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-stone-600 block mb-1">{label}</span>
      <div className="relative">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          step={step}
          min={min}
          max={max}
          className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">{suffix}</span>
        )}
      </div>
      {hint && <p className="text-xs text-stone-400 mt-1">{hint}</p>}
    </label>
  );
}

function TextField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm text-stone-600 block mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
      />
    </label>
  );
}

export default function ProjectionForm({
  initialAssumptions,
  onSubmit,
  onCancel,
  submitting = false,
  canRun,
}: Props) {
  const [assumptions, setAssumptions] = useState<ProjectionAssumptions>(
    initialAssumptions ?? buildEmptyAssumptions(),
  );
  const [persist, setPersist] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const update = <K extends keyof ProjectionAssumptions>(
    key: K, value: ProjectionAssumptions[K],
  ) => {
    setAssumptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleLoadPreset = (key: 'A' | 'B' | 'C' | 'baseline') => {
    setAssumptions(buildPresetAssumptions(key));
  };

  const handleResetSeasonality = () => {
    update('seasonality', { ...SEASONALITY_DEFAULTS });
  };

  const updateSeasonalityMonth = (m: number, value: number) => {
    update('seasonality', { ...assumptions.seasonality, [m]: value });
  };

  // Hiring plan
  const addHire = () => {
    const next: ProjectionHire = {
      month_offset: 0,
      end_month_offset: null,
      role: 'Nuevo cargo',
      monthly_salary: 1_400_000,
      parafiscales_pct: 0.30,
    };
    update('hiring_plan', [...assumptions.hiring_plan, next]);
  };
  const removeHire = (idx: number) => {
    update('hiring_plan', assumptions.hiring_plan.filter((_, i) => i !== idx));
  };
  const updateHire = (idx: number, patch: Partial<ProjectionHire>) => {
    const next = [...assumptions.hiring_plan];
    next[idx] = { ...next[idx], ...patch };
    update('hiring_plan', next);
  };

  // New branches
  const addBranch = () => {
    const next: ProjectionNewBranch = {
      month_offset: 6,
      name: 'Nueva sucursal',
      fixed_costs_monthly: 1_500_000,
      payroll_monthly: 4_000_000,
      revenue_ramp: [],
    };
    update('new_branches', [...assumptions.new_branches, next]);
  };
  const removeBranch = (idx: number) => {
    update('new_branches', assumptions.new_branches.filter((_, i) => i !== idx));
  };
  const updateBranch = (idx: number, patch: Partial<ProjectionNewBranch>) => {
    const next = [...assumptions.new_branches];
    next[idx] = { ...next[idx], ...patch };
    update('new_branches', next);
  };

  // Debts
  const addDebt = () => {
    const next: ProjectionDebt = {
      name: 'Nueva deuda',
      capital: 5_000_000,
      monthly_payment: 200_000,
      interest_portion_monthly: 200_000,
      capital_portion_monthly: 0,
      starts_month_offset: 0,
      term_months: null,
    };
    update('debts', [...assumptions.debts, next]);
  };
  const removeDebt = (idx: number) => {
    update('debts', assumptions.debts.filter((_, i) => i !== idx));
  };
  const updateDebt = (idx: number, patch: Partial<ProjectionDebt>) => {
    const next = [...assumptions.debts];
    next[idx] = { ...next[idx], ...patch };
    update('debts', next);
  };

  // Formalization layer
  const ensureFormalization = () => {
    if (!assumptions.formalization_layer) {
      update('formalization_layer', {
        scenario_label: 'custom',
        one_time_costs: [],
        recurring_costs: [],
      });
    }
  };
  const updateFormalization = (patch: Partial<NonNullable<ProjectionAssumptions['formalization_layer']>>) => {
    if (!assumptions.formalization_layer) return;
    update('formalization_layer', { ...assumptions.formalization_layer, ...patch });
  };
  const clearFormalization = () => update('formalization_layer', null);

  const addOneTime = () => {
    ensureFormalization();
    const next: FormalizationOneTimeCost = { month_offset: 0, concept: 'Nuevo costo', amount: 500_000 };
    setAssumptions((prev) => ({
      ...prev,
      formalization_layer: prev.formalization_layer
        ? { ...prev.formalization_layer, one_time_costs: [...prev.formalization_layer.one_time_costs, next] }
        : { scenario_label: 'custom', one_time_costs: [next], recurring_costs: [] },
    }));
  };
  const removeOneTime = (idx: number) => {
    if (!assumptions.formalization_layer) return;
    updateFormalization({
      one_time_costs: assumptions.formalization_layer.one_time_costs.filter((_, i) => i !== idx),
    });
  };
  const updateOneTime = (idx: number, patch: Partial<FormalizationOneTimeCost>) => {
    if (!assumptions.formalization_layer) return;
    const next = [...assumptions.formalization_layer.one_time_costs];
    next[idx] = { ...next[idx], ...patch };
    updateFormalization({ one_time_costs: next });
  };

  const addRecurring = () => {
    ensureFormalization();
    const next: FormalizationRecurringCost = {
      concept: 'Nuevo costo recurrente',
      amount_monthly: 200_000,
      starts_month_offset: 0,
      ends_month_offset: null,
    };
    setAssumptions((prev) => ({
      ...prev,
      formalization_layer: prev.formalization_layer
        ? { ...prev.formalization_layer, recurring_costs: [...prev.formalization_layer.recurring_costs, next] }
        : { scenario_label: 'custom', one_time_costs: [], recurring_costs: [next] },
    }));
  };
  const removeRecurring = (idx: number) => {
    if (!assumptions.formalization_layer) return;
    updateFormalization({
      recurring_costs: assumptions.formalization_layer.recurring_costs.filter((_, i) => i !== idx),
    });
  };
  const updateRecurring = (idx: number, patch: Partial<FormalizationRecurringCost>) => {
    if (!assumptions.formalization_layer) return;
    const next = [...assumptions.formalization_layer.recurring_costs];
    next[idx] = { ...next[idx], ...patch };
    updateFormalization({ recurring_costs: next });
  };

  const handleSubmit = () => {
    setValidationError(null);
    if (!assumptions.name.trim()) {
      setValidationError('El nombre de la proyección es obligatorio.');
      return;
    }
    if (assumptions.base_revenue_monthly <= 0) {
      setValidationError('Los ingresos base mensuales deben ser mayores a 0.');
      return;
    }
    if (assumptions.months < 1 || assumptions.months > 36) {
      setValidationError('El horizonte debe estar entre 1 y 36 meses.');
      return;
    }
    if (assumptions.start_month < 1 || assumptions.start_month > 12) {
      setValidationError('El mes de inicio debe estar entre 1 y 12.');
      return;
    }
    onSubmit(assumptions, persist);
  };

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div className="bg-gradient-to-br from-brand-50 to-stone-50 border border-brand-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-brand-600" />
          <h3 className="font-medium text-stone-800">Cargar escenario preconfigurado</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {PRESET_META.map((meta) => (
            <button
              key={meta.key}
              type="button"
              onClick={() => handleLoadPreset(meta.key)}
              className="text-left p-3 bg-white rounded-md border border-stone-200 hover:border-brand-400 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-stone-800">{meta.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold ${
                  meta.badge === 'recomendado' ? 'bg-emerald-100 text-emerald-700'
                    : meta.badge === 'mínimo' ? 'bg-yellow-100 text-yellow-700'
                      : meta.badge === 'premium' ? 'bg-purple-100 text-purple-700'
                        : 'bg-stone-100 text-stone-600'
                }`}>
                  {meta.badge}
                </span>
              </div>
              <p className="text-xs text-stone-500 mb-1">{meta.description}</p>
              <p className="text-xs font-medium text-stone-700">Año 1: {meta.estimatedYearOneCost}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Identity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TextField
          label="Nombre de la proyección"
          value={assumptions.name}
          onChange={(v) => update('name', v)}
        />
        <div className="flex items-end text-xs text-stone-500">
          <span>El nombre ayuda a identificar la proyección al guardarla.</span>
        </div>
      </div>

      {/* Período */}
      <Section icon={Calendar} title="Período" defaultOpen badge={`${assumptions.months} meses`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <NumberField
            label="Año de inicio" value={assumptions.start_year}
            onChange={(v) => update('start_year', v)} min={2024} max={2035} step={1}
          />
          <label className="block">
            <span className="text-sm text-stone-600 block mb-1">Mes de inicio</span>
            <select
              value={assumptions.start_month}
              onChange={(e) => update('start_month', Number(e.target.value))}
              className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:ring-2 focus:ring-brand-500"
            >
              {MONTH_LABELS.map((label, i) => (
                <option key={i} value={i + 1}>{label}</option>
              ))}
            </select>
          </label>
          <NumberField
            label="Horizonte (meses)" value={assumptions.months}
            onChange={(v) => update('months', v)} min={1} max={36} step={1}
          />
        </div>
      </Section>

      {/* Ingresos */}
      <Section
        icon={DollarSign} title="Ingresos"
        badge={formatCurrency(assumptions.base_revenue_monthly)}
        defaultOpen
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <NumberField
            label="Ingresos base mensuales" value={assumptions.base_revenue_monthly}
            onChange={(v) => update('base_revenue_monthly', v)} min={0} step={100_000} suffix="COP"
            hint="Sin estacionalidad. La estacionalidad se aplica como multiplicador."
          />
          <NumberField
            label="Crecimiento mensual (%)" value={assumptions.growth_rate_monthly * 100}
            onChange={(v) => update('growth_rate_monthly', v / 100)} step={0.1} suffix="%"
            hint="Ej: 2 = 2% MoM acumulativo."
          />
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-stone-700">Estacionalidad por mes</span>
            <button
              type="button"
              onClick={handleResetSeasonality}
              className="text-xs text-brand-600 hover:text-brand-700"
            >
              Reset al patrón UCR
            </button>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {MONTH_LABELS.map((label, i) => {
              const m = i + 1;
              return (
                <label key={m} className="block">
                  <span className="text-xs text-stone-500 block">{label.slice(0, 3)}</span>
                  <input
                    type="number"
                    step={0.05}
                    min={0}
                    value={assumptions.seasonality[m] ?? 1.0}
                    onChange={(e) => updateSeasonalityMonth(m, Number(e.target.value))}
                    className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                  />
                </label>
              );
            })}
          </div>
          <p className="text-xs text-stone-400 mt-1">1.0 = neutro. UCR: pico ene-feb (~2.3x), bajo abr-jun (~0.6x).</p>
        </div>
      </Section>

      {/* COGS + Costos fijos */}
      <Section icon={Percent} title="Costos directos y fijos" badge={`${(assumptions.cogs_pct * 100).toFixed(0)}% COGS`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <NumberField
            label="COGS (% sobre ingresos)" value={assumptions.cogs_pct * 100}
            onChange={(v) => update('cogs_pct', v / 100)} min={0} max={100} step={1} suffix="%"
            hint="Costo de mercancía vendida. Default 62%."
          />
          <NumberField
            label="Costos fijos mensuales (sin nómina)" value={assumptions.fixed_costs_monthly}
            onChange={(v) => update('fixed_costs_monthly', v)} step={50_000} suffix="COP"
            hint="Arriendo, servicios, internet."
          />
        </div>
      </Section>

      {/* Personal */}
      <Section
        icon={Users} title="Personal"
        badge={`${assumptions.hiring_plan.length} contrataciones planeadas`}
      >
        <NumberField
          label="Nómina base mensual (incluye parafiscales si aplica)"
          value={assumptions.payroll_monthly_base}
          onChange={(v) => update('payroll_monthly_base', v)} step={100_000} suffix="COP"
        />
        <div className="space-y-2 mt-3">
          {assumptions.hiring_plan.map((hire, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end p-3 bg-stone-50 rounded-md">
              <TextField label="Cargo" value={hire.role} onChange={(v) => updateHire(idx, { role: v })} />
              <NumberField
                label="Desde mes" value={hire.month_offset}
                onChange={(v) => updateHire(idx, { month_offset: v })} min={0} max={assumptions.months - 1} step={1}
              />
              <NumberField
                label="Hasta mes (0 = ∞)"
                value={hire.end_month_offset ?? 0}
                onChange={(v) => updateHire(idx, { end_month_offset: v > 0 ? v : null })}
                min={0} max={assumptions.months - 1} step={1}
              />
              <NumberField
                label="Salario" value={hire.monthly_salary}
                onChange={(v) => updateHire(idx, { monthly_salary: v })} step={100_000} suffix="COP"
              />
              <NumberField
                label="Parafiscales" value={hire.parafiscales_pct * 100}
                onChange={(v) => updateHire(idx, { parafiscales_pct: v / 100 })} step={1} suffix="%"
              />
              <button
                type="button"
                onClick={() => removeHire(idx)}
                className="text-red-600 hover:text-red-700 text-sm flex items-center justify-center gap-1 px-2 py-2"
              >
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addHire}
            className="text-brand-600 hover:text-brand-700 text-sm flex items-center gap-1 mt-2"
          >
            <Plus className="w-4 h-4" /> Agregar contratación
          </button>
        </div>
      </Section>

      {/* Sucursales nuevas */}
      <Section
        icon={Building2} title="Sucursales nuevas"
        badge={`${assumptions.new_branches.length}`}
      >
        <div className="space-y-2">
          {assumptions.new_branches.map((branch, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end p-3 bg-stone-50 rounded-md">
              <TextField label="Nombre" value={branch.name} onChange={(v) => updateBranch(idx, { name: v })} />
              <NumberField
                label="Mes apertura" value={branch.month_offset}
                onChange={(v) => updateBranch(idx, { month_offset: v })} min={0} max={assumptions.months - 1} step={1}
              />
              <NumberField
                label="Costos fijos/mes" value={branch.fixed_costs_monthly}
                onChange={(v) => updateBranch(idx, { fixed_costs_monthly: v })} step={50_000} suffix="COP"
              />
              <NumberField
                label="Nómina/mes" value={branch.payroll_monthly}
                onChange={(v) => updateBranch(idx, { payroll_monthly: v })} step={100_000} suffix="COP"
              />
              <button
                type="button"
                onClick={() => removeBranch(idx)}
                className="text-red-600 hover:text-red-700 text-sm flex items-center justify-center gap-1 px-2 py-2"
              >
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addBranch}
            className="text-brand-600 hover:text-brand-700 text-sm flex items-center gap-1 mt-2"
          >
            <Plus className="w-4 h-4" /> Agregar sucursal
          </button>
          <p className="text-xs text-stone-400 mt-1">
            La sucursal aporta ingresos desde su mes de apertura usando un ramp conservador (60% del base × estacionalidad).
            Para personalizar el ramp edita el JSON manualmente.
          </p>
        </div>
      </Section>

      {/* Deudas */}
      <Section
        icon={CreditCard} title="Deudas"
        badge={`${assumptions.debts.length} obligaciones`}
      >
        <div className="space-y-2">
          {assumptions.debts.map((debt, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end p-3 bg-stone-50 rounded-md">
              <TextField label="Nombre" value={debt.name} onChange={(v) => updateDebt(idx, { name: v })} />
              <NumberField
                label="Capital" value={debt.capital}
                onChange={(v) => updateDebt(idx, { capital: v })} step={500_000} suffix="COP"
              />
              <NumberField
                label="Cuota mensual" value={debt.monthly_payment}
                onChange={(v) => updateDebt(idx, { monthly_payment: v })} step={50_000} suffix="COP"
              />
              <NumberField
                label="Interés (mes)" value={debt.interest_portion_monthly}
                onChange={(v) => updateDebt(idx, { interest_portion_monthly: v })} step={10_000} suffix="COP"
              />
              <NumberField
                label="Plazo (meses, 0=bullet)" value={debt.term_months ?? 0}
                onChange={(v) => updateDebt(idx, { term_months: v === 0 ? null : v })} min={0} step={1}
              />
              <button
                type="button"
                onClick={() => removeDebt(idx)}
                className="text-red-600 hover:text-red-700 text-sm flex items-center justify-center gap-1 px-2 py-2"
              >
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addDebt}
            className="text-brand-600 hover:text-brand-700 text-sm flex items-center gap-1 mt-2"
          >
            <Plus className="w-4 h-4" /> Agregar deuda
          </button>
          <p className="text-xs text-stone-400 mt-1">
            Capital portion = cuota - interés. Si el plazo es 0 se trata como bullet (interest-only).
          </p>
        </div>
      </Section>

      {/* Capa de formalización */}
      <Section
        icon={Briefcase} title="Capa de formalización"
        badge={
          assumptions.formalization_layer
            ? `Esc. ${assumptions.formalization_layer.scenario_label} · ${assumptions.formalization_layer.one_time_costs.length} one-time + ${assumptions.formalization_layer.recurring_costs.length} recurrentes`
            : 'Sin capa'
        }
      >
        {!assumptions.formalization_layer ? (
          <div className="text-center py-4">
            <p className="text-sm text-stone-500 mb-3">
              No hay capa de formalización. Agrega costos para modelar SAS, contador, FE DIAN, parafiscales, etc.
            </p>
            <button
              type="button"
              onClick={ensureFormalization}
              className="px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-md text-sm"
            >
              Activar capa de formalización
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <label className="block">
                <span className="text-sm text-stone-600 block mb-1">Etiqueta de escenario</span>
                <select
                  value={assumptions.formalization_layer.scenario_label}
                  onChange={(e) => updateFormalization({
                    scenario_label: e.target.value as 'A' | 'B' | 'C' | 'custom',
                  })}
                  className="px-3 py-2 border border-stone-300 rounded-md text-sm"
                >
                  <option value="A">A — Mínimo viable</option>
                  <option value="B">B — Formalización completa</option>
                  <option value="C">C — B2B premium</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <button
                type="button"
                onClick={clearFormalization}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Quitar capa
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-stone-700 mb-2">Costos one-time</h4>
                {assumptions.formalization_layer.one_time_costs.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end p-2 bg-stone-50 rounded mb-1">
                    <NumberField
                      label="Mes (offset)" value={c.month_offset}
                      onChange={(v) => updateOneTime(idx, { month_offset: v })} min={0} step={1}
                    />
                    <TextField label="Concepto" value={c.concept} onChange={(v) => updateOneTime(idx, { concept: v })} />
                    <NumberField
                      label="Monto" value={c.amount}
                      onChange={(v) => updateOneTime(idx, { amount: v })} step={50_000} suffix="COP"
                    />
                    <button
                      type="button"
                      onClick={() => removeOneTime(idx)}
                      className="text-red-600 hover:text-red-700 text-xs flex items-center justify-center gap-1 px-2 py-2"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addOneTime}
                  className="text-brand-600 hover:text-brand-700 text-xs flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Agregar one-time
                </button>
              </div>

              <div>
                <h4 className="text-sm font-medium text-stone-700 mb-2">Costos recurrentes</h4>
                {assumptions.formalization_layer.recurring_costs.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end p-2 bg-stone-50 rounded mb-1">
                    <TextField label="Concepto" value={c.concept} onChange={(v) => updateRecurring(idx, { concept: v })} />
                    <NumberField
                      label="Monto/mes" value={c.amount_monthly}
                      onChange={(v) => updateRecurring(idx, { amount_monthly: v })} step={10_000} suffix="COP"
                    />
                    <NumberField
                      label="Inicio (offset)" value={c.starts_month_offset}
                      onChange={(v) => updateRecurring(idx, { starts_month_offset: v })} min={0} step={1}
                    />
                    <NumberField
                      label="Fin (offset, 0=∞)" value={c.ends_month_offset ?? 0}
                      onChange={(v) => updateRecurring(idx, { ends_month_offset: v === 0 ? null : v })} min={0} step={1}
                    />
                    <button
                      type="button"
                      onClick={() => removeRecurring(idx)}
                      className="text-red-600 hover:text-red-700 text-xs flex items-center justify-center gap-1 px-2 py-2"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addRecurring}
                  className="text-brand-600 hover:text-brand-700 text-xs flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Agregar recurrente
                </button>
              </div>
            </div>
          </>
        )}
      </Section>

      {/* Macro */}
      <Section icon={Globe} title="Macro" badge={`${(assumptions.inflation_annual * 100).toFixed(1)}% inflación`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <NumberField
            label="Inflación anual (%)" value={assumptions.inflation_annual * 100}
            onChange={(v) => update('inflation_annual', v / 100)} step={0.1} suffix="%"
          />
          <NumberField
            label="Caja inicial" value={assumptions.initial_cash}
            onChange={(v) => update('initial_cash', v)} step={500_000} suffix="COP"
          />
        </div>
      </Section>

      {/* Validation error */}
      {validationError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">
          {validationError}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-stone-200">
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            checked={persist}
            onChange={(e) => setPersist(e.target.checked)}
            className="rounded border-stone-300"
          />
          Guardar proyección en historial
        </label>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-stone-600 hover:text-stone-800 text-sm"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !canRun}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canRun ? 'No tienes permisos para correr proyecciones' : undefined}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Calcular proyección
          </button>
        </div>
      </div>
    </div>
  );
}
