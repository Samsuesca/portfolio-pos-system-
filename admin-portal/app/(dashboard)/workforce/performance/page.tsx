'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RequirePermission } from '@/components/RequirePermission';
import workforceService, {
  PerformanceSummaryItem,
  REVIEW_PERIOD_LABELS,
} from '@/lib/services/workforceService';

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 70) return 'text-blue-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBadge(score: number): string {
  if (score >= 90) return 'bg-green-100 text-green-800';
  if (score >= 70) return 'bg-blue-100 text-blue-800';
  if (score >= 50) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excelente';
  if (score >= 70) return 'Bueno';
  if (score >= 50) return 'Regular';
  return 'Bajo';
}

export default function PerformancePage() {
  const [summary, setSummary] = useState<PerformanceSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState(30);
  const [generating, setGenerating] = useState(false);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - periodDays);
      const data = await workforceService.getPerformanceSummary({
        period_start: start.toISOString().split('T')[0],
        period_end: end.toISOString().split('T')[0],
      });
      // Sort by overall_score descending
      data.sort((a, b) => b.overall_score - a.overall_score);
      setSummary(data);
    } catch {
      // No data yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [periodDays]);

  const handleGenerateReviews = async (period: 'weekly' | 'monthly' | 'quarterly') => {
    if (summary.length === 0) return;
    setGenerating(true);
    try {
      const end = new Date();
      const start = new Date();
      if (period === 'weekly') start.setDate(start.getDate() - 7);
      else if (period === 'monthly') start.setMonth(start.getMonth() - 1);
      else start.setMonth(start.getMonth() - 3);

      for (const emp of summary) {
        try {
          await workforceService.generatePerformanceReview({
            employee_id: emp.employee_id,
            review_period: period,
            period_start: start.toISOString().split('T')[0],
            period_end: end.toISOString().split('T')[0],
          });
        } catch {
          // Skip individual failures
        }
      }
      alert('Evaluaciones generadas exitosamente');
    } catch {
      alert('Error al generar evaluaciones');
    } finally {
      setGenerating(false);
    }
  };

  const avgScore = summary.length > 0
    ? Math.round(summary.reduce((sum, s) => sum + s.overall_score, 0) / summary.length)
    : 0;

  const topPerformers = summary.filter(s => s.overall_score >= 90).length;
  const needsAttention = summary.filter(s => s.overall_score < 50).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Performance</h1>
          <p className="mt-1 text-slate-500">
            Ranking de rendimiento del equipo basado en asistencia, puntualidad y responsabilidades.
          </p>
        </div>
        <Link
          href="/workforce"
          className="text-sm text-brand-600 hover:text-brand-700"
        >
          &larr; Volver
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Periodo</label>
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value={7}>Ultimos 7 dias</option>
            <option value={30}>Ultimos 30 dias</option>
            <option value={90}>Ultimos 90 dias</option>
          </select>
        </div>
        <RequirePermission permission="workforce.manage_performance">
          <div className="flex items-end gap-2">
            <span className="text-sm text-slate-500 self-center mr-1">Generar:</span>
            <button
              onClick={() => handleGenerateReviews('weekly')}
              disabled={generating || summary.length === 0}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {generating ? '...' : 'Semanal'}
            </button>
            <button
              onClick={() => handleGenerateReviews('monthly')}
              disabled={generating || summary.length === 0}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {generating ? '...' : 'Mensual'}
            </button>
            <button
              onClick={() => handleGenerateReviews('quarterly')}
              disabled={generating || summary.length === 0}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {generating ? '...' : 'Trimestral'}
            </button>
          </div>
        </RequirePermission>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Total Empleados</div>
          <div className="text-2xl font-bold text-slate-900">{summary.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Score Promedio</div>
          <div className={`text-2xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}%</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Top Performers (&ge;90%)</div>
          <div className="text-2xl font-bold text-green-600">{topPerformers}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Requieren Atencion (&lt;50%)</div>
          <div className="text-2xl font-bold text-red-600">{needsAttention}</div>
        </div>
      </div>

      {/* Ranking Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Ranking del Equipo</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando...</div>
        ) : summary.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No hay datos de rendimiento para el periodo seleccionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Empleado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cargo</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Asistencia</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Puntualidad</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Checklists</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Score</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {summary.map((emp, index) => (
                  <tr key={emp.employee_id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-500">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {emp.employee_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 capitalize">
                      {emp.position || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={getScoreColor(emp.attendance_rate)}>
                        {Math.round(emp.attendance_rate)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={getScoreColor(emp.punctuality_rate)}>
                        {Math.round(emp.punctuality_rate)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={getScoreColor(emp.checklist_completion_rate)}>
                        {Math.round(emp.checklist_completion_rate)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-lg font-bold ${getScoreColor(emp.overall_score)}`}>
                        {Math.round(emp.overall_score)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreBadge(emp.overall_score)}`}>
                        {getScoreLabel(emp.overall_score)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/workforce/performance/${emp.employee_id}`}
                        className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                      >
                        Ver Detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
