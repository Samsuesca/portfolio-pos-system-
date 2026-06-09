/**
 * Financial Model Tab - Main orchestrator for all 7 financial model modules
 *
 * Sub-navigation: KPIs | Rentabilidad | Tendencias | Presupuesto | Proyección | Alertas | Resumen
 */
import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  BarChart3, TrendingUp, Target, LineChart, AlertTriangle, FileText, Building2,
  Loader2, AlertCircle, RefreshCw, Sparkles
} from 'lucide-react';
import { financialModelService } from '../../../services/financialModelService';
import type {
  KPIDashboardResponse, ProfitabilityResponse, TrendAnalysisResponse,
  BudgetVsActualResponse, CashForecastResponse, HealthAlertsResponse,
  ExecutiveSummaryResponse, BudgetItem
} from '../../../services/financialModelService';

import KPIDashboard from './KPIDashboard';
import AlertsPanel from './AlertsPanel';
import ExecutiveSummaryPanel from './ExecutiveSummaryPanel';

// Paneles con Recharts (y el de escenarios): lazy para sacar la librería de
// gráficas del bundle inicial del tab; el usuario aterriza en "Indicadores",
// que no usa Recharts.
const ProfitabilityPanel = lazy(() => import('./ProfitabilityPanel'));
const TrendsPanel = lazy(() => import('./TrendsPanel'));
const BudgetPanel = lazy(() => import('./BudgetPanel'));
const CashForecastPanel = lazy(() => import('./CashForecastPanel'));
const ProjectionsPanel = lazy(() => import('./projections/ProjectionsPanel'));

type SubTab = 'kpis' | 'profitability' | 'trends' | 'budget' | 'forecast' | 'projections' | 'alerts' | 'summary';

const SUB_TABS: { key: SubTab; label: string; icon: typeof BarChart3 }[] = [
  { key: 'kpis', label: 'Indicadores', icon: BarChart3 },
  { key: 'profitability', label: 'Rentabilidad', icon: Building2 },
  { key: 'trends', label: 'Tendencias', icon: TrendingUp },
  { key: 'budget', label: 'Presupuesto', icon: Target },
  { key: 'forecast', label: 'Proyección caja', icon: LineChart },
  { key: 'projections', label: 'Escenarios', icon: Sparkles },
  { key: 'alerts', label: 'Alertas', icon: AlertTriangle },
  { key: 'summary', label: 'Resumen', icon: FileText },
];

export default function FinancialModelTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('kpis');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [kpiData, setKpiData] = useState<KPIDashboardResponse | null>(null);
  const [profitabilityData, setProfitabilityData] = useState<ProfitabilityResponse | null>(null);
  const [trendsData, setTrendsData] = useState<TrendAnalysisResponse | null>(null);
  const [budgetVsActual, setBudgetVsActual] = useState<BudgetVsActualResponse | null>(null);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [forecastData, setForecastData] = useState<CashForecastResponse | null>(null);
  const [alertsData, setAlertsData] = useState<HealthAlertsResponse | null>(null);
  const [summaryData, setSummaryData] = useState<ExecutiveSummaryResponse | null>(null);

  const loadTabData = useCallback(async (tab: SubTab) => {
    if (tab === 'projections') {
      // Projections sub-panel manages its own data fetching.
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      switch (tab) {
        case 'kpis':
          setKpiData(await financialModelService.getKPIs({ months: 6 }));
          break;
        case 'profitability':
          setProfitabilityData(await financialModelService.getProfitabilityBySchool());
          break;
        case 'trends':
          setTrendsData(await financialModelService.getTrends());
          break;
        case 'budget': {
          const b = await financialModelService.getBudgets();
          setBudgets(b);
          // Try to load budget vs actual for current month
          const now = new Date();
          const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          try {
            const bva = await financialModelService.getBudgetVsActual({
              period_type: 'monthly',
              period_start: periodStart,
            });
            setBudgetVsActual(bva);
          } catch {
            setBudgetVsActual(null);
          }
          break;
        }
        case 'forecast':
          setForecastData(await financialModelService.getCashForecast());
          break;
        case 'alerts':
          setAlertsData(await financialModelService.getHealthAlerts());
          break;
        case 'summary':
          setSummaryData(await financialModelService.getExecutiveSummary());
          break;
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Error al cargar datos del modelo financiero');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTabData(activeSubTab);
  }, [activeSubTab, loadTabData]);

  const alertCount = alertsData
    ? alertsData.critical_count + alertsData.warning_count
    : 0;

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-1">
        <div className="flex flex-wrap gap-1">
          {SUB_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSubTab(key)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative
                ${activeSubTab === key
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-stone-600 hover:bg-stone-100'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
              {key === 'alerts' && alertCount > 0 && (
                <span className={`
                  absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold
                  ${alertsData?.critical_count ? 'bg-red-500 text-white' : 'bg-yellow-400 text-yellow-900'}
                `}>
                  {alertCount}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => loadTabData(activeSubTab)}
            className="ml-auto flex items-center gap-1 px-3 py-2 text-sm text-stone-500 hover:text-stone-700 transition-colors"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
          <button
            onClick={() => loadTabData(activeSubTab)}
            className="ml-auto text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          <span className="ml-3 text-stone-500">Cargando datos...</span>
        </div>
      )}

      {/* Tab content. Suspense cubre la carga del chunk de los paneles lazy. */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
            <span className="ml-3 text-stone-500">Cargando panel...</span>
          </div>
        }
      >
        {!loading && !error && (
          <>
            {activeSubTab === 'kpis' && <KPIDashboard data={kpiData} />}
            {activeSubTab === 'profitability' && <ProfitabilityPanel data={profitabilityData} />}
            {activeSubTab === 'trends' && <TrendsPanel data={trendsData} />}
            {activeSubTab === 'budget' && (
              <BudgetPanel
                budgetVsActual={budgetVsActual}
                budgets={budgets}
                onRefresh={() => loadTabData('budget')}
              />
            )}
            {activeSubTab === 'forecast' && <CashForecastPanel data={forecastData} />}
            {activeSubTab === 'alerts' && <AlertsPanel data={alertsData} />}
            {activeSubTab === 'summary' && <ExecutiveSummaryPanel data={summaryData} />}
          </>
        )}

        {/* Projections panel manages its own loading/error state */}
        {activeSubTab === 'projections' && <ProjectionsPanel />}
      </Suspense>
    </div>
  );
}
