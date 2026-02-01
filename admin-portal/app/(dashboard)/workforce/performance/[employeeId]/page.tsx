'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Check, X } from 'lucide-react';
import { RequirePermission } from '@/components/RequirePermission';
import workforceService, {
  EmployeePerformanceMetrics,
  PerformanceReview,
  REVIEW_PERIOD_LABELS,
} from '@/lib/services/workforceService';

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 70) return 'text-blue-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBg(score: number): string {
  if (score >= 90) return 'bg-green-500';
  if (score >= 70) return 'bg-blue-500';
  if (score >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excelente';
  if (score >= 70) return 'Bueno';
  if (score >= 50) return 'Regular';
  return 'Bajo';
}

export default function EmployeePerformancePage() {
  const params = useParams();
  const employeeId = params.employeeId as string;

  const [metrics, setMetrics] = useState<EmployeePerformanceMetrics | null>(null);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState('');

  const handleSaveNotes = async (reviewId: string) => {
    try {
      await workforceService.updatePerformanceReview(reviewId, { reviewer_notes: editingNotes });
      setEditingReviewId(null);
      setEditingNotes('');
      await loadData();
    } catch {
      alert('Error al guardar notas');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - periodDays);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      const [metricsData, reviewsData] = await Promise.all([
        workforceService.getEmployeeMetrics(employeeId, startStr, endStr),
        workforceService.getPerformanceReviews({ employee_id: employeeId }),
      ]);
      setMetrics(metricsData);
      setReviews(reviewsData);
    } catch {
      // No data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employeeId) loadData();
  }, [employeeId, periodDays]);

  const handleGenerate = async (period: 'weekly' | 'monthly' | 'quarterly') => {
    setGenerating(true);
    try {
      const end = new Date();
      const start = new Date();
      if (period === 'weekly') start.setDate(start.getDate() - 7);
      else if (period === 'monthly') start.setMonth(start.getMonth() - 1);
      else start.setMonth(start.getMonth() - 3);

      await workforceService.generatePerformanceReview({
        employee_id: employeeId,
        review_period: period,
        period_start: start.toISOString().split('T')[0],
        period_end: end.toISOString().split('T')[0],
      });
      await loadData();
    } catch {
      alert('Error al generar evaluacion');
    } finally {
      setGenerating(false);
    }
  };

  const metricCards = metrics
    ? [
        { label: 'Asistencia', value: metrics.attendance_rate, weight: '30%' },
        { label: 'Puntualidad', value: metrics.punctuality_rate, weight: '20%' },
        { label: 'Checklists', value: metrics.checklist_completion_rate, weight: '30%' },
        { label: 'Ventas', value: metrics.total_sales_count > 0 ? (metrics.overall_score > 0 ? metrics.total_sales_amount : 0) : null, isCurrency: true, weight: '20%' },
      ]
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Cargando datos de rendimiento...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {metrics?.employee_name || 'Empleado'}
          </h1>
          <p className="mt-1 text-slate-500">
            Detalle de rendimiento individual
          </p>
        </div>
        <Link
          href="/workforce/performance"
          className="text-sm text-brand-600 hover:text-brand-700"
        >
          &larr; Volver al Ranking
        </Link>
      </div>

      {/* Period Filter */}
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
            <button
              onClick={() => handleGenerate('weekly')}
              disabled={generating}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Evaluar Semanal
            </button>
            <button
              onClick={() => handleGenerate('monthly')}
              disabled={generating}
              className="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
            >
              Evaluar Mensual
            </button>
            <button
              onClick={() => handleGenerate('quarterly')}
              disabled={generating}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Evaluar Trimestral
            </button>
          </div>
        </RequirePermission>
      </div>

      {/* Overall Score */}
      {metrics && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center ${getScoreBg(metrics.overall_score)}`}>
                <span className="text-3xl font-bold text-white">
                  {Math.round(metrics.overall_score)}
                </span>
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Score General</h2>
              <p className={`text-lg font-medium ${getScoreColor(metrics.overall_score)}`}>
                {getScoreLabel(metrics.overall_score)}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Periodo: {metrics.period_start} a {metrics.period_end}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metric Breakdown */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Attendance */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-500">Asistencia</h3>
              <span className="text-xs text-slate-400">Peso: 30%</span>
            </div>
            <div className={`text-3xl font-bold ${getScoreColor(metrics.attendance_rate)}`}>
              {Math.round(metrics.attendance_rate)}%
            </div>
            <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getScoreBg(metrics.attendance_rate)}`}
                style={{ width: `${Math.min(100, metrics.attendance_rate)}%` }}
              />
            </div>
          </div>

          {/* Punctuality */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-500">Puntualidad</h3>
              <span className="text-xs text-slate-400">Peso: 20%</span>
            </div>
            <div className={`text-3xl font-bold ${getScoreColor(metrics.punctuality_rate)}`}>
              {Math.round(metrics.punctuality_rate)}%
            </div>
            <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getScoreBg(metrics.punctuality_rate)}`}
                style={{ width: `${Math.min(100, metrics.punctuality_rate)}%` }}
              />
            </div>
          </div>

          {/* Checklists */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-500">Checklists</h3>
              <span className="text-xs text-slate-400">Peso: 30%</span>
            </div>
            <div className={`text-3xl font-bold ${getScoreColor(metrics.checklist_completion_rate)}`}>
              {Math.round(metrics.checklist_completion_rate)}%
            </div>
            <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getScoreBg(metrics.checklist_completion_rate)}`}
                style={{ width: `${Math.min(100, metrics.checklist_completion_rate)}%` }}
              />
            </div>
          </div>

          {/* Sales */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-500">Ventas</h3>
              <span className="text-xs text-slate-400">Peso: 20%</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">
              {metrics.total_sales_count}
            </div>
            <div className="text-sm text-slate-500 mt-1">
              ${metrics.total_sales_amount.toLocaleString('es-CO')}
            </div>
          </div>
        </div>
      )}

      {/* Review History */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Historial de Evaluaciones</h2>
        </div>

        {reviews.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No hay evaluaciones registradas. Genera una evaluacion para comenzar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Periodo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Rango</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Asistencia</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Puntualidad</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Checklists</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {reviews.map((review) => (
                  <tr key={review.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-900">
                      {REVIEW_PERIOD_LABELS[review.review_period] || review.review_period}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {review.period_start} - {review.period_end}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={getScoreColor(review.attendance_rate)}>
                        {Math.round(review.attendance_rate)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={getScoreColor(review.punctuality_rate)}>
                        {Math.round(review.punctuality_rate)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={getScoreColor(review.checklist_completion_rate)}>
                        {Math.round(review.checklist_completion_rate)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-lg font-bold ${getScoreColor(review.overall_score)}`}>
                        {Math.round(review.overall_score)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs">
                      {editingReviewId === review.id ? (
                        <div className="flex items-center gap-2">
                          <textarea
                            value={editingNotes}
                            onChange={(e) => setEditingNotes(e.target.value)}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-sm resize-none"
                            rows={2}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveNotes(review.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Guardar"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingReviewId(null)}
                            className="p-1 text-slate-400 hover:bg-slate-50 rounded"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="truncate">{review.reviewer_notes || '-'}</span>
                          <RequirePermission permission="workforce.manage_performance">
                            <button
                              onClick={() => {
                                setEditingReviewId(review.id);
                                setEditingNotes(review.reviewer_notes || '');
                              }}
                              className="p-1 text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded flex-shrink-0"
                              title="Editar notas"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </RequirePermission>
                        </div>
                      )}
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
