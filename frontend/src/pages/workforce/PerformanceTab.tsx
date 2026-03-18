import React, { useState, useEffect, useCallback } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';
import workforceService, {
  PerformanceSummaryItem,
  EmployeePerformanceMetrics,
  PerformanceReview,
  REVIEW_PERIOD_LABELS,
} from '../../services/workforceService';
import { EmployeeListItem } from '../../services/employeeService';
import { extractErrorMessage } from '../../utils/api-client';
import { getScoreColor, getScoreBadge, getScoreLabel, todayStr, daysAgoStr } from './helpers';

export default function PerformanceTab({ employees: _employees }: { employees: EmployeeListItem[] }) {
  const [periodDays, setPeriodDays] = useState(30);
  const [summary, setSummary] = useState<PerformanceSummaryItem[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [employeeMetrics, setEmployeeMetrics] = useState<EmployeePerformanceMetrics | null>(null);
  const [employeeReviews, setEmployeeReviews] = useState<PerformanceReview[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Inline note editing
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState('');

  const periodStart = daysAgoStr(periodDays);
  const periodEnd = todayStr();

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const data = await workforceService.getPerformanceSummary({
        period_start: periodStart,
        period_end: periodEnd,
      });
      setSummary(data);
    } catch (err) {
      console.error('Error loading performance summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, [periodStart, periodEnd]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const loadEmployeeDetail = useCallback(
    async (empId: string) => {
      setLoadingDetail(true);
      try {
        const [metrics, reviews] = await Promise.all([
          workforceService.getEmployeeMetrics(empId, periodStart, periodEnd),
          workforceService.getPerformanceReviews({ employee_id: empId }),
        ]);
        setEmployeeMetrics(metrics);
        setEmployeeReviews(reviews);
      } catch (err) {
        console.error('Error loading employee detail:', err);
      } finally {
        setLoadingDetail(false);
      }
    },
    [periodStart, periodEnd]
  );

  useEffect(() => {
    if (selectedEmployeeId) {
      loadEmployeeDetail(selectedEmployeeId);
    }
  }, [selectedEmployeeId, loadEmployeeDetail]);

  const handleRowClick = (empId: string) => {
    setSelectedEmployeeId(selectedEmployeeId === empId ? null : empId);
    setEmployeeMetrics(null);
    setEmployeeReviews([]);
  };

  const handleGenerateReview = async (period: 'weekly' | 'monthly' | 'quarterly') => {
    if (!selectedEmployeeId) {
      alert('Selecciona un empleado primero.');
      return;
    }
    const periodMap = { weekly: 7, monthly: 30, quarterly: 90 };
    const pStart = daysAgoStr(periodMap[period]);
    try {
      await workforceService.generatePerformanceReview({
        employee_id: selectedEmployeeId,
        review_period: period,
        period_start: pStart,
        period_end: todayStr(),
      });
      loadEmployeeDetail(selectedEmployeeId);
      loadSummary();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleStartEditNotes = (review: PerformanceReview) => {
    setEditingReviewId(review.id);
    setEditingNotes(review.reviewer_notes || '');
  };

  const handleSaveNotes = async (reviewId: string) => {
    try {
      await workforceService.updatePerformanceReview(reviewId, { reviewer_notes: editingNotes });
      setEditingReviewId(null);
      if (selectedEmployeeId) {
        loadEmployeeDetail(selectedEmployeeId);
      }
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleCancelEditNotes = () => {
    setEditingReviewId(null);
    setEditingNotes('');
  };

  // Summary stats
  const totalEmployees = summary.length;
  const avgScore =
    totalEmployees > 0
      ? Math.round(summary.reduce((acc, s) => acc + s.overall_score, 0) / totalEmployees)
      : 0;
  const topPerformers = summary.filter((s) => s.overall_score >= 90).length;
  const needsAttention = summary.filter((s) => s.overall_score < 50).length;

  return (
    <div className="space-y-4">
      {/* Period filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Periodo:</span>
          {[
            { val: 7, label: '7 dias' },
            { val: 30, label: '30 dias' },
            { val: 90, label: '90 dias' },
          ].map((p) => (
            <button
              key={p.val}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                periodDays === p.val
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              onClick={() => setPeriodDays(p.val)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <RequirePermission permission="workforce.manage_performance">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Generar reporte:</span>
            <button
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium"
              onClick={() => handleGenerateReview('weekly')}
            >
              Semanal
            </button>
            <button
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium"
              onClick={() => handleGenerateReview('monthly')}
            >
              Mensual
            </button>
            <button
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-medium"
              onClick={() => handleGenerateReview('quarterly')}
            >
              Trimestral
            </button>
          </div>
        </RequirePermission>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalEmployees}</p>
          <p className="text-xs text-gray-500 mt-1">Total Empleados</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className={`text-2xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}%</p>
          <p className="text-xs text-gray-500 mt-1">Score Promedio</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{topPerformers}</p>
          <p className="text-xs text-gray-500 mt-1">Top Performers (&gt;=90%)</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{needsAttention}</p>
          <p className="text-xs text-gray-500 mt-1">Requieren Atencion (&lt;50%)</p>
        </div>
      </div>

      {/* Ranking table */}
      {loadingSummary ? (
        <div className="text-center py-8 text-gray-500">Cargando rendimiento...</div>
      ) : summary.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No hay datos de rendimiento para este periodo.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Empleado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cargo</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Asistencia</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Puntualidad</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Checklists</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Score</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary
                .sort((a, b) => b.overall_score - a.overall_score)
                .map((item, idx) => (
                  <React.Fragment key={item.employee_id}>
                    <tr
                      className={`hover:bg-gray-50 cursor-pointer ${
                        selectedEmployeeId === item.employee_id ? 'bg-brand-50' : ''
                      }`}
                      onClick={() => handleRowClick(item.employee_id)}
                    >
                      <td className="px-4 py-3 text-gray-500 font-medium">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {item.employee_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.position || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={getScoreColor(item.attendance_rate)}>
                          {Math.round(item.attendance_rate)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={getScoreColor(item.punctuality_rate)}>
                          {Math.round(item.punctuality_rate)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={getScoreColor(item.checklist_completion_rate)}>
                          {Math.round(item.checklist_completion_rate)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${getScoreColor(item.overall_score)}`}>
                          {Math.round(item.overall_score)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreBadge(
                            item.overall_score
                          )}`}
                        >
                          {getScoreLabel(item.overall_score)}
                        </span>
                      </td>
                    </tr>
                    {/* Expanded detail */}
                    {selectedEmployeeId === item.employee_id && (
                      <tr>
                        <td colSpan={8} className="px-4 py-4 bg-gray-50">
                          {loadingDetail ? (
                            <div className="text-center py-4 text-gray-500">
                              Cargando detalle...
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {/* Metrics cards */}
                              {employeeMetrics && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                                    <div className="relative mx-auto w-16 h-16 mb-2">
                                      <svg className="w-16 h-16" viewBox="0 0 36 36">
                                        <path
                                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                          fill="none"
                                          stroke="#e5e7eb"
                                          strokeWidth="3"
                                        />
                                        <path
                                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                          fill="none"
                                          stroke={
                                            employeeMetrics.overall_score >= 90
                                              ? '#22c55e'
                                              : employeeMetrics.overall_score >= 70
                                              ? '#3b82f6'
                                              : employeeMetrics.overall_score >= 50
                                              ? '#eab308'
                                              : '#ef4444'
                                          }
                                          strokeWidth="3"
                                          strokeDasharray={`${employeeMetrics.overall_score}, 100`}
                                          strokeLinecap="round"
                                        />
                                      </svg>
                                      <span
                                        className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${getScoreColor(
                                          employeeMetrics.overall_score
                                        )}`}
                                      >
                                        {Math.round(employeeMetrics.overall_score)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500">Score General</p>
                                  </div>
                                  <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                                    <p
                                      className={`text-xl font-bold ${getScoreColor(
                                        employeeMetrics.attendance_rate
                                      )}`}
                                    >
                                      {Math.round(employeeMetrics.attendance_rate)}%
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">Asistencia</p>
                                  </div>
                                  <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                                    <p
                                      className={`text-xl font-bold ${getScoreColor(
                                        employeeMetrics.punctuality_rate
                                      )}`}
                                    >
                                      {Math.round(employeeMetrics.punctuality_rate)}%
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">Puntualidad</p>
                                  </div>
                                  <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                                    <p
                                      className={`text-xl font-bold ${getScoreColor(
                                        employeeMetrics.checklist_completion_rate
                                      )}`}
                                    >
                                      {Math.round(employeeMetrics.checklist_completion_rate)}%
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">Checklists</p>
                                  </div>
                                </div>
                              )}

                              {/* Review history */}
                              {employeeReviews.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-semibold text-gray-700 mb-2">
                                    Historial de Evaluaciones
                                  </h5>
                                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                          <th className="text-left px-3 py-2 font-medium text-gray-600">
                                            Periodo
                                          </th>
                                          <th className="text-left px-3 py-2 font-medium text-gray-600">
                                            Rango
                                          </th>
                                          <th className="text-center px-3 py-2 font-medium text-gray-600">
                                            Asistencia
                                          </th>
                                          <th className="text-center px-3 py-2 font-medium text-gray-600">
                                            Puntualidad
                                          </th>
                                          <th className="text-center px-3 py-2 font-medium text-gray-600">
                                            Checklists
                                          </th>
                                          <th className="text-center px-3 py-2 font-medium text-gray-600">
                                            Score
                                          </th>
                                          <th className="text-left px-3 py-2 font-medium text-gray-600">
                                            Notas
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {employeeReviews.map((rev) => (
                                          <tr key={rev.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 text-gray-600">
                                              {REVIEW_PERIOD_LABELS[rev.review_period] ||
                                                rev.review_period}
                                            </td>
                                            <td className="px-3 py-2 text-gray-500">
                                              {rev.period_start} - {rev.period_end}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              <span
                                                className={getScoreColor(rev.attendance_rate)}
                                              >
                                                {Math.round(rev.attendance_rate)}%
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              <span
                                                className={getScoreColor(rev.punctuality_rate)}
                                              >
                                                {Math.round(rev.punctuality_rate)}%
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              <span
                                                className={getScoreColor(
                                                  rev.checklist_completion_rate
                                                )}
                                              >
                                                {Math.round(rev.checklist_completion_rate)}%
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              <span
                                                className={`font-bold ${getScoreColor(
                                                  rev.overall_score
                                                )}`}
                                              >
                                                {Math.round(rev.overall_score)}%
                                              </span>
                                            </td>
                                            <td className="px-3 py-2">
                                              {editingReviewId === rev.id ? (
                                                <div className="flex items-center gap-1">
                                                  <input
                                                    type="text"
                                                    value={editingNotes}
                                                    onChange={(e) =>
                                                      setEditingNotes(e.target.value)
                                                    }
                                                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-brand-500"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter')
                                                        handleSaveNotes(rev.id);
                                                      if (e.key === 'Escape')
                                                        handleCancelEditNotes();
                                                    }}
                                                  />
                                                  <button
                                                    className="p-0.5 text-green-600 hover:text-green-700"
                                                    onClick={() => handleSaveNotes(rev.id)}
                                                  >
                                                    <Check size={14} />
                                                  </button>
                                                  <button
                                                    className="p-0.5 text-gray-400 hover:text-gray-600"
                                                    onClick={handleCancelEditNotes}
                                                  >
                                                    <X size={14} />
                                                  </button>
                                                </div>
                                              ) : (
                                                <div className="flex items-center gap-1">
                                                  <span className="text-gray-500 truncate max-w-[150px]">
                                                    {rev.reviewer_notes || '-'}
                                                  </span>
                                                  <RequirePermission permission="workforce.manage_performance">
                                                    <button
                                                      className="p-0.5 text-gray-400 hover:text-brand-600"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStartEditNotes(rev);
                                                      }}
                                                      title="Editar notas"
                                                    >
                                                      <Pencil size={12} />
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
                                </div>
                              )}

                              {employeeReviews.length === 0 && !loadingDetail && (
                                <p className="text-sm text-gray-500 text-center py-2">
                                  No hay evaluaciones. Genera una usando los botones de arriba.
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
