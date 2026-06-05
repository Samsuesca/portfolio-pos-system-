/**
 * ProjectionsPanel - Orquestador del módulo de proyecciones financieras.
 *
 * Sub-tabs:
 *  - Nueva proyección: ProjectionForm + ProjectionResults (tras correr)
 *  - Escenarios guardados: ProjectionsList + comparativo
 *
 * Conecta con projectionService y respeta permisos `reports.financial`.
 */
import { useCallback, useEffect, useState } from 'react';
import { Sparkles, ListTodo, AlertCircle, Lock, Users } from 'lucide-react';
import { usePermissions } from '../../../../hooks/usePermissions';
import {
  projectionService,
  type ProjectionAssumptions,
  type ProjectionRunResponse,
  type ProjectionListItem,
  type ProjectionDetailResponse,
} from '../../../../services/projectionService';
import ProjectionForm from './ProjectionForm';
import ProjectionResults from './ProjectionResults';
import ProjectionsList from './ProjectionsList';
import PayrollScenariosCompare from './PayrollScenariosCompare';

type SubTab = 'new' | 'saved' | 'payroll';

function detailToRunResponse(detail: ProjectionDetailResponse): ProjectionRunResponse {
  return {
    id: detail.id,
    name: detail.name,
    assumptions: detail.assumptions,
    months: detail.results,
    summary: detail.summary,
    generated_at: detail.created_at,
  };
}

export default function ProjectionsPanel() {
  const { hasPermission } = usePermissions();
  const canRun = hasPermission('reports.financial');
  const canDelete = hasPermission('reports.financial');

  const [subTab, setSubTab] = useState<SubTab>('new');

  // New projection state
  const [submitting, setSubmitting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<ProjectionRunResponse | null>(null);
  const [draftAssumptions, setDraftAssumptions] = useState<ProjectionAssumptions | undefined>();

  // Saved projections state
  const [items, setItems] = useState<ProjectionListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [scenarioFilter, setScenarioFilter] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadList = useCallback(async () => {
    if (!canRun) return;
    setListLoading(true);
    setListError(null);
    try {
      const params: { limit: number; scenario?: string } = { limit: 50 };
      if (scenarioFilter) params.scenario = scenarioFilter;
      const res = await projectionService.listProjections(params);
      setItems(res);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Error al cargar el historial');
    } finally {
      setListLoading(false);
    }
  }, [canRun, scenarioFilter]);

  useEffect(() => {
    if (subTab === 'saved') {
      void loadList();
    }
  }, [subTab, loadList]);

  const handleRun = async (assumptions: ProjectionAssumptions, persist: boolean) => {
    setSubmitting(true);
    setRunError(null);
    setDraftAssumptions(assumptions);
    try {
      const result = await projectionService.runProjection(assumptions, { persist });
      setCurrentResult(result);
      if (persist) void loadList();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Error al correr la proyección');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewSaved = async (id: string) => {
    setDetailLoading(true);
    setRunError(null);
    try {
      const detail = await projectionService.getProjection(id);
      setCurrentResult(detailToRunResponse(detail));
      setDraftAssumptions(detail.assumptions);
      setSubTab('new');
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Error al cargar la proyección');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setListError(null);
    try {
      await projectionService.deleteProjection(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      if (currentResult?.id === id) setCurrentResult(null);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const handleNewProjection = () => {
    setCurrentResult(null);
    setDraftAssumptions(undefined);
    setRunError(null);
  };

  if (!canRun) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 flex items-start gap-3">
        <Lock className="w-5 h-5 text-yellow-700 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-yellow-900">Acceso restringido</p>
          <p className="text-sm text-yellow-800 mt-1">
            Necesitas el permiso <code className="font-mono text-xs bg-yellow-100 px-1 py-0.5 rounded">reports.financial</code> para
            usar las proyecciones financieras. Contacta al administrador para solicitar acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-stone-200">
        <button
          type="button"
          onClick={() => setSubTab('new')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            subTab === 'new'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Nueva proyección
        </button>
        <button
          type="button"
          onClick={() => setSubTab('saved')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            subTab === 'saved'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          <ListTodo className="w-4 h-4" />
          Escenarios guardados
          {items.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-stone-200 text-stone-700 rounded-full">{items.length}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('payroll')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            subTab === 'payroll'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Escenarios de nómina
        </button>
        {currentResult && (
          <button
            type="button"
            onClick={handleNewProjection}
            className="ml-auto text-xs text-stone-500 hover:text-stone-700 px-3 py-1"
          >
            Limpiar resultado
          </button>
        )}
      </div>

      {/* Run error */}
      {runError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
          <span className="text-sm text-red-700">{runError}</span>
        </div>
      )}

      {/* Detail loading overlay */}
      {detailLoading && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-md p-2">
          Cargando proyección guardada…
        </div>
      )}

      {/* Tab content */}
      {subTab === 'new' && (
        <div className="space-y-6">
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <h3 className="font-semibold text-stone-800 mb-1">Configurar assumptions</h3>
            <p className="text-xs text-stone-500 mb-4">
              Define ingresos, costos, formalización y deudas. Carga un preset y ajusta lo necesario.
            </p>
            <ProjectionForm
              initialAssumptions={draftAssumptions}
              onSubmit={handleRun}
              submitting={submitting}
              canRun={canRun}
            />
          </div>

          {currentResult && (
            <ProjectionResults result={currentResult} />
          )}
        </div>
      )}

      {subTab === 'saved' && (
        <ProjectionsList
          items={items}
          loading={listLoading}
          error={listError}
          canDelete={canDelete}
          onView={handleViewSaved}
          onDelete={handleDelete}
          onRefresh={loadList}
          onFilterScenario={setScenarioFilter}
          scenarioFilter={scenarioFilter}
        />
      )}

      {subTab === 'payroll' && <PayrollScenariosCompare />}
    </div>
  );
}
