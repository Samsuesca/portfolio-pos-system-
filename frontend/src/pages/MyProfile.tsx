/**
 * MyProfile Page - "Mi Perfil Laboral"
 *
 * Employee self-service page showing their own workforce data:
 * personal info, schedule, checklist, attendance, performance, and responsibilities.
 */
import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import {
  User,
  Calendar,
  ClipboardCheck,
  Clock,
  BarChart3,
  Briefcase,
  Loader2,
  AlertCircle,
  CheckCircle,
  Circle,
  SkipForward,
  ShieldCheck,
  Info,
} from 'lucide-react';
import {
  EmployeeResponse,
  getMyEmployee,
  getPaymentFrequencyLabel,
} from '../services/employeeService';
import workforceService, {
  Schedule,
  DailyChecklist,
  DailyChecklistItem,
  AttendanceRecord,
  EmployeePerformanceMetrics,
  PerformanceReview,
  PositionResponsibility,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_COLORS,
  RESPONSIBILITY_CATEGORY_LABELS,
  RESPONSIBILITY_CATEGORY_COLORS,
  REVIEW_PERIOD_LABELS,
  ResponsibilityCategory,
} from '../services/workforceService';

type TabKey = 'info' | 'schedule' | 'checklist' | 'attendance' | 'performance' | 'responsibilities';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'info', label: 'Información', icon: <User size={16} /> },
  { key: 'schedule', label: 'Mi Horario', icon: <Calendar size={16} /> },
  { key: 'checklist', label: 'Mi Checklist', icon: <ClipboardCheck size={16} /> },
  { key: 'attendance', label: 'Mi Asistencia', icon: <Clock size={16} /> },
  { key: 'performance', label: 'Mi Desempeño', icon: <BarChart3 size={16} /> },
  { key: 'responsibilities', label: 'Mis Responsabilidades', icon: <Briefcase size={16} /> },
];

const formatCOP = (value: number): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);

const getColombiaToday = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const formatDateCol = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

const getDayName = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('es-CO', { weekday: 'long' });
};

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
};

export default function MyProfile() {
  const [employee, setEmployee] = useState<EmployeeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notLinked, setNotLinked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('info');

  // Tab data
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [checklist, setChecklist] = useState<DailyChecklist | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [metrics, setMetrics] = useState<EmployeePerformanceMetrics | null>(null);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [responsibilities, setResponsibilities] = useState<PositionResponsibility[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);

  // Attendance date range
  const [attendanceDateFrom, setAttendanceDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  });
  const [attendanceDateTo, setAttendanceDateTo] = useState(() => getColombiaToday());

  // Checklist toggling state
  const [togglingItem, setTogglingItem] = useState<string | null>(null);

  // Load employee on mount
  useEffect(() => {
    const loadEmployee = async () => {
      try {
        setLoading(true);
        setError(null);
        const emp = await getMyEmployee();
        setEmployee(emp);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setNotLinked(true);
        } else {
          setError('Error al cargar tu perfil laboral. Intenta de nuevo.');
        }
      } finally {
        setLoading(false);
      }
    };
    loadEmployee();
  }, []);

  // Load tab data when tab changes
  const loadTabData = useCallback(async () => {
    if (!employee) return;
    setTabLoading(true);
    setTabError(null);

    try {
      switch (activeTab) {
        case 'schedule': {
          const today = getColombiaToday();
          const nextWeek = new Date();
          nextWeek.setDate(nextWeek.getDate() + 6);
          const dateTo = nextWeek.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
          const data = await workforceService.getEmployeeSchedule(employee.id, today, dateTo);
          setSchedules(data);
          break;
        }
        case 'checklist': {
          const today = getColombiaToday();
          const lists = await workforceService.getDailyChecklists({
            employee_id: employee.id,
            checklist_date: today,
          });
          setChecklist(lists.length > 0 ? lists[0] : null);
          break;
        }
        case 'attendance': {
          const records = await workforceService.getAttendanceRecords({
            employee_id: employee.id,
            date_from: attendanceDateFrom,
            date_to: attendanceDateTo,
          });
          setAttendance(records);
          break;
        }
        case 'performance': {
          const today = getColombiaToday();
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const periodStart = thirtyDaysAgo.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
          const [metricsData, reviewsData] = await Promise.all([
            workforceService.getEmployeeMetrics(employee.id, periodStart, today).catch(() => null),
            workforceService.getPerformanceReviews({ employee_id: employee.id }),
          ]);
          setMetrics(metricsData);
          setReviews(reviewsData);
          break;
        }
        case 'responsibilities': {
          const data = await workforceService.getResponsibilities({
            position: employee.position,
            is_active: true,
          });
          setResponsibilities(data);
          break;
        }
        default:
          break;
      }
    } catch {
      setTabError('Error al cargar los datos. Intenta de nuevo.');
    } finally {
      setTabLoading(false);
    }
  }, [employee, activeTab, attendanceDateFrom, attendanceDateTo]);

  useEffect(() => {
    if (activeTab !== 'info') {
      loadTabData();
    }
  }, [activeTab, loadTabData]);

  // Toggle checklist item
  const handleToggleItem = async (item: DailyChecklistItem) => {
    if (togglingItem) return;
    setTogglingItem(item.id);
    try {
      const newStatus = item.status === 'completed' ? 'pending' : 'completed';
      const updated = await workforceService.updateChecklistItemStatus(item.id, { status: newStatus });
      setChecklist((prev) => {
        if (!prev) return prev;
        const newItems = prev.items.map((i) => (i.id === updated.id ? updated : i));
        const completedCount = newItems.filter((i) => i.status === 'completed').length;
        return {
          ...prev,
          items: newItems,
          completed_items: completedCount,
          completion_rate: prev.total_items > 0 ? (completedCount / prev.total_items) * 100 : 0,
        };
      });
    } catch {
      setTabError('Error al actualizar el item.');
    } finally {
      setTogglingItem(null);
    }
  };

  // Render loading
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="animate-spin text-brand-600" size={40} />
        </div>
      </Layout>
    );
  }

  // Render not linked
  if (notLinked) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto mt-20">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <Info className="mx-auto mb-3 text-yellow-500" size={40} />
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">Sin Perfil Laboral</h2>
            <p className="text-yellow-700">
              No tienes un perfil laboral vinculado. Contacta al administrador.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  // Render error
  if (error || !employee) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto mt-20">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertCircle className="mx-auto mb-3 text-red-500" size={40} />
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
            <p className="text-red-700">{error || 'No se pudo cargar el perfil.'}</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Attendance summary
  const attendanceSummary = {
    total: attendance.length,
    present: attendance.filter((a) => a.status === 'present').length,
    absent: attendance.filter((a) => a.status === 'absent').length,
    late: attendance.filter((a) => a.status === 'late').length,
    excused: attendance.filter((a) => a.status === 'excused').length,
  };

  // Group responsibilities by category
  const groupedResponsibilities = responsibilities.reduce<Record<string, PositionResponsibility[]>>(
    (acc, r) => {
      const cat = r.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(r);
      return acc;
    },
    {}
  );

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mi Perfil Laboral</h1>
          <p className="text-slate-500 mt-1">
            {employee.full_name} &mdash; {employee.position}
          </p>
        </div>

        {/* Tab Bar */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Loading */}
        {tabLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-brand-600" size={32} />
          </div>
        )}

        {/* Tab Error */}
        {tabError && !tabLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
            <p className="text-red-700 text-sm">{tabError}</p>
          </div>
        )}

        {/* Tab Content */}
        {!tabLoading && !tabError && (
          <>
            {/* Tab 1: Informacion */}
            {activeTab === 'info' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Datos Personales</h3>
                  <dl className="space-y-3">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Nombre</dt>
                      <dd className="font-medium text-slate-800">{employee.full_name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Cargo</dt>
                      <dd className="font-medium text-slate-800">{employee.position}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Fecha de Ingreso</dt>
                      <dd className="font-medium text-slate-800">{formatDateCol(employee.hire_date)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Documento</dt>
                      <dd className="font-medium text-slate-800">
                        {employee.document_type?.toUpperCase()} {employee.document_id}
                      </dd>
                    </div>
                    {employee.phone && (
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Telefono</dt>
                        <dd className="font-medium text-slate-800">{employee.phone}</dd>
                      </div>
                    )}
                    {employee.email && (
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Email</dt>
                        <dd className="font-medium text-slate-800">{employee.email}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Informacion Salarial</h3>
                  <dl className="space-y-3">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Salario Base</dt>
                      <dd className="font-semibold text-slate-800">{formatCOP(employee.base_salary)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Frecuencia de Pago</dt>
                      <dd className="font-medium text-slate-800">
                        {getPaymentFrequencyLabel(employee.payment_frequency)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Metodo de Pago</dt>
                      <dd className="font-medium text-slate-800 capitalize">{employee.payment_method}</dd>
                    </div>
                    {employee.bank_name && (
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Banco</dt>
                        <dd className="font-medium text-slate-800">{employee.bank_name}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>
            )}

            {/* Tab 2: Mi Horario */}
            {activeTab === 'schedule' && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Horario - Proximos 7 dias</h3>
                {schedules.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">Sin horarios programados esta semana.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-medium text-slate-600">Fecha</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-600">Dia</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-600">Hora Inicio</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-600">Hora Fin</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-600">Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedules.map((s) => {
                          const isToday = s.schedule_date === getColombiaToday();
                          return (
                            <tr
                              key={s.id}
                              className={`border-b border-slate-100 ${
                                isToday ? 'bg-brand-50 font-semibold' : ''
                              }`}
                            >
                              <td className="py-3 px-4">{formatDateCol(s.schedule_date)}</td>
                              <td className="py-3 px-4 capitalize">{getDayName(s.schedule_date)}</td>
                              <td className="py-3 px-4">{s.start_time}</td>
                              <td className="py-3 px-4">{s.end_time}</td>
                              <td className="py-3 px-4 text-slate-500">{s.notes || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Mi Checklist */}
            {activeTab === 'checklist' && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  Checklist del Dia &mdash; {formatDateCol(getColombiaToday())}
                </h3>
                {!checklist ? (
                  <p className="text-slate-500 text-center py-8">No hay checklist asignado para hoy.</p>
                ) : (
                  <div className="space-y-4">
                    {/* Progress */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600">
                          Completado: {checklist.completed_items} / {checklist.total_items}
                        </span>
                        <span className="font-medium text-slate-800">
                          {Math.round(checklist.completion_rate)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3">
                        <div
                          className="bg-brand-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${checklist.completion_rate}%` }}
                        />
                      </div>
                    </div>

                    {/* Verified badge */}
                    {checklist.verified_by && (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                        <ShieldCheck size={18} className="text-green-600" />
                        <span className="text-sm font-medium text-green-700">
                          Verificado por supervisor
                        </span>
                      </div>
                    )}

                    {/* Items */}
                    <ul className="space-y-2">
                      {checklist.items
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((item) => (
                          <li
                            key={item.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              item.status === 'completed'
                                ? 'bg-green-50 border-green-200'
                                : item.status === 'skipped'
                                ? 'bg-slate-50 border-slate-200'
                                : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <button
                              onClick={() => handleToggleItem(item)}
                              disabled={togglingItem === item.id || !!checklist.verified_by}
                              className="flex-shrink-0 disabled:opacity-50"
                            >
                              {togglingItem === item.id ? (
                                <Loader2 size={20} className="animate-spin text-brand-500" />
                              ) : item.status === 'completed' ? (
                                <CheckCircle size={20} className="text-green-600" />
                              ) : item.status === 'skipped' ? (
                                <SkipForward size={20} className="text-slate-400" />
                              ) : (
                                <Circle size={20} className="text-slate-300" />
                              )}
                            </button>
                            <span
                              className={`flex-1 text-sm ${
                                item.status === 'completed'
                                  ? 'line-through text-green-700'
                                  : 'text-slate-700'
                              }`}
                            >
                              {item.description}
                              {item.is_required && (
                                <span className="ml-1 text-red-400 text-xs">*</span>
                              )}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Mi Asistencia */}
            {activeTab === 'attendance' && (
              <div className="space-y-6">
                {/* Date range filter */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex flex-wrap items-end gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Desde</label>
                    <input
                      type="date"
                      value={attendanceDateFrom}
                      onChange={(e) => setAttendanceDateFrom(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Hasta</label>
                    <input
                      type="date"
                      value={attendanceDateTo}
                      onChange={(e) => setAttendanceDateTo(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 text-center">
                    <p className="text-2xl font-bold text-slate-800">{attendanceSummary.total}</p>
                    <p className="text-xs text-slate-500 mt-1">Total Dias</p>
                  </div>
                  <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{attendanceSummary.present}</p>
                    <p className="text-xs text-green-600 mt-1">Presentes</p>
                  </div>
                  <div className="bg-red-50 rounded-lg shadow-sm border border-red-200 p-4 text-center">
                    <p className="text-2xl font-bold text-red-600">{attendanceSummary.absent}</p>
                    <p className="text-xs text-red-600 mt-1">Ausentes</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg shadow-sm border border-yellow-200 p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{attendanceSummary.late}</p>
                    <p className="text-xs text-yellow-600 mt-1">Tarde</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg shadow-sm border border-blue-200 p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{attendanceSummary.excused}</p>
                    <p className="text-xs text-blue-600 mt-1">Excusados</p>
                  </div>
                </div>

                {/* Attendance table */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  {attendance.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">Sin registros de asistencia en este periodo.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-3 px-4 font-medium text-slate-600">Fecha</th>
                            <th className="text-left py-3 px-4 font-medium text-slate-600">Estado</th>
                            <th className="text-left py-3 px-4 font-medium text-slate-600">Hora Entrada</th>
                            <th className="text-left py-3 px-4 font-medium text-slate-600">Hora Salida</th>
                            <th className="text-left py-3 px-4 font-medium text-slate-600">Min. Tarde</th>
                            <th className="text-left py-3 px-4 font-medium text-slate-600">Notas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendance.map((a) => (
                            <tr key={a.id} className="border-b border-slate-100">
                              <td className="py-3 px-4">{formatDateCol(a.record_date)}</td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                    ATTENDANCE_STATUS_COLORS[a.status]
                                  }`}
                                >
                                  {ATTENDANCE_STATUS_LABELS[a.status]}
                                </span>
                              </td>
                              <td className="py-3 px-4">{a.check_in_time || '-'}</td>
                              <td className="py-3 px-4">{a.check_out_time || '-'}</td>
                              <td className="py-3 px-4">
                                {a.minutes_late > 0 ? (
                                  <span className="text-yellow-600 font-medium">{a.minutes_late}</span>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                                {a.notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 5: Mi Desempeño */}
            {activeTab === 'performance' && (
              <div className="space-y-6">
                {/* Metric cards */}
                {metrics ? (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Asistencia', value: metrics.attendance_rate },
                      { label: 'Puntualidad', value: metrics.punctuality_rate },
                      { label: 'Checklists', value: metrics.checklist_completion_rate },
                      { label: 'Score General', value: metrics.overall_score },
                    ].map((m) => (
                      <div
                        key={m.label}
                        className={`rounded-lg border p-4 text-center ${getScoreColor(m.value)}`}
                      >
                        <p className="text-3xl font-bold">{Math.round(m.value)}%</p>
                        <p className="text-sm mt-1 font-medium">{m.label}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
                    <p className="text-slate-500">No hay metricas disponibles para el periodo actual.</p>
                  </div>
                )}

                {/* Reviews table */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Evaluaciones de Desempeno</h3>
                  {reviews.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">Sin evaluaciones registradas.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-3 px-3 font-medium text-slate-600">Periodo</th>
                            <th className="text-left py-3 px-3 font-medium text-slate-600">Fechas</th>
                            <th className="text-center py-3 px-3 font-medium text-slate-600">Asistencia</th>
                            <th className="text-center py-3 px-3 font-medium text-slate-600">Puntualidad</th>
                            <th className="text-center py-3 px-3 font-medium text-slate-600">Checklists</th>
                            <th className="text-center py-3 px-3 font-medium text-slate-600">Score</th>
                            <th className="text-left py-3 px-3 font-medium text-slate-600">Notas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reviews.map((r) => (
                            <tr key={r.id} className="border-b border-slate-100">
                              <td className="py-3 px-3">
                                <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                                  {REVIEW_PERIOD_LABELS[r.review_period] || r.review_period}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-600">
                                {formatDateCol(r.period_start)} - {formatDateCol(r.period_end)}
                              </td>
                              <td className="py-3 px-3 text-center">{Math.round(r.attendance_rate)}%</td>
                              <td className="py-3 px-3 text-center">{Math.round(r.punctuality_rate)}%</td>
                              <td className="py-3 px-3 text-center">
                                {Math.round(r.checklist_completion_rate)}%
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`inline-flex px-2 py-1 rounded-full text-xs font-bold ${getScoreColor(
                                    r.overall_score
                                  )}`}
                                >
                                  {Math.round(r.overall_score)}%
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-500 max-w-xs truncate">
                                {r.reviewer_notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 6: Mis Responsabilidades */}
            {activeTab === 'responsibilities' && (
              <div className="space-y-6">
                {responsibilities.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 text-center">
                    <p className="text-slate-500">No hay responsabilidades definidas para tu cargo.</p>
                  </div>
                ) : (
                  Object.entries(groupedResponsibilities).map(([category, items]) => (
                    <div
                      key={category}
                      className="bg-white rounded-lg shadow-sm border border-slate-200 p-6"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                            RESPONSIBILITY_CATEGORY_COLORS[category as ResponsibilityCategory] ||
                            'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {RESPONSIBILITY_CATEGORY_LABELS[category as ResponsibilityCategory] || category}
                        </span>
                      </div>
                      <ul className="space-y-3">
                        {items
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((r) => (
                            <li key={r.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                              <p className="font-medium text-slate-800">{r.title}</p>
                              {r.description && (
                                <p className="text-sm text-slate-500 mt-1">{r.description}</p>
                              )}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
