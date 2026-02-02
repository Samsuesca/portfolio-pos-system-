import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Users,
  ClipboardList,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Calendar,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import Layout from '../components/Layout';
import { RequirePermission } from '../components/RequirePermission';
import employeeService, { EmployeeListItem } from '../services/employeeService';
import workforceService, {
  ShiftTemplate,
  ShiftTemplateCreate,
  Schedule,
  ScheduleCreate,
  AttendanceRecord,
  AttendanceCreate,
  AttendanceStatus,
  DailyAttendanceSummary,
  AbsenceType,
  AbsenceRecord,
  AbsenceCreate,
  ChecklistTemplate,
  ChecklistTemplateCreate,
  DailyChecklist,
  DailyChecklistItem,
  ChecklistItemStatus,
  PerformanceSummaryItem,
  EmployeePerformanceMetrics,
  PerformanceReview,
  SHIFT_TYPE_LABELS,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_COLORS,
  ABSENCE_TYPE_LABELS,
  REVIEW_PERIOD_LABELS,
  PositionResponsibility,
  PositionResponsibilityCreate,
  ResponsibilityCategory,
  RESPONSIBILITY_CATEGORY_LABELS,
  RESPONSIBILITY_CATEGORY_COLORS,
} from '../services/workforceService';
import { extractErrorMessage } from '../utils/api-client';
import { getColombiaDateString, getColombiaNow } from '../utils/formatting';

// ============================================
// Score Helpers
// ============================================

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

function todayStr(): string {
  return getColombiaDateString();
}

function weekAgoStr(): string {
  const d = getColombiaNow();
  d.setDate(d.getDate() - 7);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function daysAgoStr(days: number): string {
  const d = getColombiaNow();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

// ============================================
// Main Tabs Config
// ============================================

const MAIN_TABS = [
  { key: 'shifts', label: 'Turnos', icon: Clock },
  { key: 'attendance', label: 'Asistencia', icon: Users },
  { key: 'checklists', label: 'Checklists', icon: ClipboardList },
  { key: 'performance', label: 'Rendimiento', icon: BarChart3 },
  { key: 'responsibilities', label: 'Responsabilidades', icon: ShieldCheck },
];

// ============================================
// ShiftsTab
// ============================================

function ShiftsTab({ employees }: { employees: EmployeeListItem[] }) {
  const [subTab, setSubTab] = useState<'templates' | 'schedules'>('templates');

  // --- Templates state ---
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<ShiftTemplateCreate & { is_active?: boolean }>({
    name: '',
    shift_type: 'morning',
    start_time: '07:00',
    end_time: '13:00',
    break_minutes: 0,
    description: '',
  });
  const [templateError, setTemplateError] = useState('');

  // --- Schedules state ---
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleCreate>({
    employee_id: '',
    schedule_date: todayStr(),
    start_time: '07:00',
    end_time: '17:00',
    notes: '',
  });
  const [dateFrom, setDateFrom] = useState(weekAgoStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [scheduleError, setScheduleError] = useState('');

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const data = await workforceService.getShiftTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    setLoadingSchedules(true);
    try {
      const data = await workforceService.getSchedules({ date_from: dateFrom, date_to: dateTo });
      setSchedules(data);
    } catch (err) {
      console.error('Error loading schedules:', err);
    } finally {
      setLoadingSchedules(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (subTab === 'templates') {
      loadTemplates();
    } else {
      loadSchedules();
    }
  }, [subTab, loadTemplates, loadSchedules]);

  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      shift_type: 'morning',
      start_time: '07:00',
      end_time: '13:00',
      break_minutes: 0,
      description: '',
    });
    setEditingTemplate(null);
    setShowTemplateForm(false);
    setTemplateError('');
  };

  const handleEditTemplate = (t: ShiftTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({
      name: t.name,
      shift_type: t.shift_type,
      start_time: t.start_time,
      end_time: t.end_time,
      break_minutes: t.break_minutes,
      description: t.description || '',
      is_active: t.is_active,
    });
    setShowTemplateForm(true);
    setTemplateError('');
  };

  const handleSaveTemplate = async () => {
    setTemplateError('');
    if (!templateForm.name.trim()) {
      setTemplateError('El nombre es obligatorio.');
      return;
    }
    try {
      if (editingTemplate) {
        await workforceService.updateShiftTemplate(editingTemplate.id, {
          name: templateForm.name,
          shift_type: templateForm.shift_type,
          start_time: templateForm.start_time,
          end_time: templateForm.end_time,
          break_minutes: templateForm.break_minutes,
          description: templateForm.description || undefined,
          is_active: templateForm.is_active,
        });
      } else {
        await workforceService.createShiftTemplate({
          name: templateForm.name,
          shift_type: templateForm.shift_type,
          start_time: templateForm.start_time,
          end_time: templateForm.end_time,
          break_minutes: templateForm.break_minutes,
          description: templateForm.description || undefined,
        });
      }
      resetTemplateForm();
      loadTemplates();
    } catch (err) {
      setTemplateError(extractErrorMessage(err));
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Eliminar esta plantilla de turno?')) return;
    try {
      await workforceService.deleteShiftTemplate(id);
      loadTemplates();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const resetScheduleForm = () => {
    setScheduleForm({
      employee_id: '',
      schedule_date: todayStr(),
      start_time: '07:00',
      end_time: '17:00',
      notes: '',
    });
    setShowScheduleForm(false);
    setScheduleError('');
  };

  const handleTemplateSelect = (templateId: string) => {
    const t = templates.find((tpl) => tpl.id === templateId);
    if (t) {
      setScheduleForm((prev) => ({
        ...prev,
        shift_template_id: t.id,
        start_time: t.start_time,
        end_time: t.end_time,
      }));
    } else {
      setScheduleForm((prev) => {
        const { shift_template_id: _, ...rest } = prev as ScheduleCreate & { shift_template_id?: string };
        return rest;
      });
    }
  };

  const handleSaveSchedule = async () => {
    setScheduleError('');
    if (!scheduleForm.employee_id) {
      setScheduleError('Selecciona un empleado.');
      return;
    }
    try {
      const payload: ScheduleCreate = {
        employee_id: scheduleForm.employee_id,
        schedule_date: scheduleForm.schedule_date,
        start_time: scheduleForm.start_time,
        end_time: scheduleForm.end_time,
        notes: scheduleForm.notes || undefined,
      };
      const formWithTemplate = scheduleForm as ScheduleCreate & { shift_template_id?: string };
      if (formWithTemplate.shift_template_id) {
        (payload as ScheduleCreate & { shift_template_id?: string }).shift_template_id = formWithTemplate.shift_template_id;
      }
      await workforceService.createSchedule(payload);
      resetScheduleForm();
      loadSchedules();
    } catch (err) {
      setScheduleError(extractErrorMessage(err));
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm('Eliminar este horario?')) return;
    try {
      await workforceService.deleteSchedule(id);
      loadSchedules();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            subTab === 'templates'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setSubTab('templates')}
        >
          Plantillas
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            subTab === 'schedules'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setSubTab('schedules')}
        >
          Horarios
        </button>
      </div>

      {/* Templates sub-tab */}
      {subTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Plantillas de Turno</h3>
            <RequirePermission permission="workforce.manage_shifts">
              <button
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
                onClick={() => {
                  resetTemplateForm();
                  setShowTemplateForm(true);
                }}
              >
                <Plus size={16} /> Nueva Plantilla
              </button>
            </RequirePermission>
          </div>

          {showTemplateForm && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
              <h4 className="font-semibold text-gray-900">
                {editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}
              </h4>
              {templateError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle size={16} /> {templateError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="Turno manana"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={templateForm.shift_type}
                    onChange={(e) =>
                      setTemplateForm((p) => ({
                        ...p,
                        shift_type: e.target.value as ShiftTemplateCreate['shift_type'],
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  >
                    {Object.entries(SHIFT_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descanso (min)</label>
                  <input
                    type="number"
                    value={templateForm.break_minutes || 0}
                    onChange={(e) =>
                      setTemplateForm((p) => ({ ...p, break_minutes: parseInt(e.target.value) || 0 }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora Inicio</label>
                  <input
                    type="time"
                    value={templateForm.start_time}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, start_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora Fin</label>
                  <input
                    type="time"
                    value={templateForm.end_time}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, end_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                {editingTemplate && (
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="template-active"
                      checked={templateForm.is_active !== false}
                      onChange={(e) => setTemplateForm((p) => ({ ...p, is_active: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="template-active" className="text-sm text-gray-700">
                      Activo
                    </label>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
                  onClick={handleSaveTemplate}
                >
                  {editingTemplate ? 'Actualizar' : 'Crear'}
                </button>
                <button
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                  onClick={resetTemplateForm}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {loadingTemplates ? (
            <div className="text-center py-8 text-gray-500">Cargando plantillas...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No hay plantillas de turno creadas.</div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Horario</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Descanso</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {templates.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {SHIFT_TYPE_LABELS[t.shift_type] || t.shift_type}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {t.start_time} - {t.end_time}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{t.break_minutes} min</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            t.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {t.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RequirePermission permission="workforce.manage_shifts">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className="p-1.5 text-gray-500 hover:text-brand-600 hover:bg-gray-100 rounded"
                              onClick={() => handleEditTemplate(t)}
                              title="Editar"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded"
                              onClick={() => handleDeleteTemplate(t.id)}
                              title="Eliminar"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </RequirePermission>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Schedules sub-tab */}
      {subTab === 'schedules' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <button
                className="mt-5 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                onClick={loadSchedules}
              >
                Buscar
              </button>
            </div>
            <RequirePermission permission="workforce.manage_shifts">
              <button
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
                onClick={() => {
                  resetScheduleForm();
                  setShowScheduleForm(true);
                }}
              >
                <Plus size={16} /> Asignar Horario
              </button>
            </RequirePermission>
          </div>

          {showScheduleForm && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
              <h4 className="font-semibold text-gray-900">Asignar Horario</h4>
              {scheduleError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle size={16} /> {scheduleError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Empleado</label>
                  <select
                    value={scheduleForm.employee_id}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, employee_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  >
                    <option value="">Seleccionar...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plantilla (opcional)
                  </label>
                  <select
                    value={
                      (scheduleForm as ScheduleCreate & { shift_template_id?: string })
                        .shift_template_id || ''
                    }
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  >
                    <option value="">Sin plantilla</option>
                    {templates.filter((t) => t.is_active).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={scheduleForm.schedule_date}
                    onChange={(e) =>
                      setScheduleForm((p) => ({ ...p, schedule_date: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora Inicio</label>
                  <input
                    type="time"
                    value={scheduleForm.start_time}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, start_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora Fin</label>
                  <input
                    type="time"
                    value={scheduleForm.end_time}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, end_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <input
                    type="text"
                    value={scheduleForm.notes || ''}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
                  onClick={handleSaveSchedule}
                >
                  Guardar
                </button>
                <button
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                  onClick={resetScheduleForm}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {loadingSchedules ? (
            <div className="text-center py-8 text-gray-500">Cargando horarios...</div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay horarios para el rango seleccionado.
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Empleado</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Turno</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Horario</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Notas</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{s.schedule_date}</td>
                      <td className="px-4 py-3 text-gray-900">{s.employee_name || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{s.shift_template_name || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {s.start_time} - {s.end_time}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{s.notes || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <RequirePermission permission="workforce.manage_shifts">
                          <button
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded"
                            onClick={() => handleDeleteSchedule(s.id)}
                            title="Eliminar"
                          >
                            <Trash2 size={15} />
                          </button>
                        </RequirePermission>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// AttendanceTab
// ============================================

function AttendanceTab({ employees }: { employees: EmployeeListItem[] }) {
  const [subTab, setSubTab] = useState<'attendance' | 'absences'>('attendance');
  const [selectedDate, setSelectedDate] = useState(todayStr());

  // --- Attendance state ---
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<DailyAttendanceSummary | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRecord | null>(null);
  const [attendanceForm, setAttendanceForm] = useState<AttendanceCreate>({
    employee_id: '',
    record_date: todayStr(),
    status: 'present',
    check_in_time: '',
    check_out_time: '',
    notes: '',
  });
  const [attendanceError, setAttendanceError] = useState('');

  // --- Absences state ---
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [loadingAbsences, setLoadingAbsences] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [absenceForm, setAbsenceForm] = useState<AbsenceCreate>({
    employee_id: '',
    absence_type: 'absence_unjustified',
    absence_date: todayStr(),
    justification: '',
    is_deductible: false,
    deduction_amount: 0,
  });
  const [absenceError, setAbsenceError] = useState('');

  const loadAttendance = useCallback(async () => {
    setLoadingAttendance(true);
    try {
      const [recs, sum] = await Promise.all([
        workforceService.getAttendanceRecords({ record_date: selectedDate }),
        workforceService.getDailyAttendanceSummary(selectedDate),
      ]);
      setRecords(recs);
      setSummary(sum);
    } catch (err) {
      console.error('Error loading attendance:', err);
    } finally {
      setLoadingAttendance(false);
    }
  }, [selectedDate]);

  const loadAbsences = useCallback(async () => {
    setLoadingAbsences(true);
    try {
      const data = await workforceService.getAbsences({ date_from: selectedDate, date_to: selectedDate });
      setAbsences(data);
    } catch (err) {
      console.error('Error loading absences:', err);
    } finally {
      setLoadingAbsences(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadAttendance();
    loadAbsences();
  }, [loadAttendance, loadAbsences]);

  const resetAttendanceForm = () => {
    setAttendanceForm({
      employee_id: '',
      record_date: selectedDate,
      status: 'present',
      check_in_time: '',
      check_out_time: '',
      notes: '',
    });
    setEditingAttendance(null);
    setShowAttendanceModal(false);
    setAttendanceError('');
  };

  const handleEditAttendance = (rec: AttendanceRecord) => {
    setEditingAttendance(rec);
    setAttendanceForm({
      employee_id: rec.employee_id,
      record_date: rec.record_date,
      status: rec.status,
      check_in_time: rec.check_in_time || '',
      check_out_time: rec.check_out_time || '',
      notes: rec.notes || '',
    });
    setShowAttendanceModal(true);
    setAttendanceError('');
  };

  const handleSaveAttendance = async () => {
    setAttendanceError('');
    if (!editingAttendance && !attendanceForm.employee_id) {
      setAttendanceError('Selecciona un empleado.');
      return;
    }
    try {
      const payload: AttendanceCreate = {
        employee_id: attendanceForm.employee_id,
        record_date: attendanceForm.record_date,
        status: attendanceForm.status,
        check_in_time: attendanceForm.check_in_time || undefined,
        check_out_time: attendanceForm.check_out_time || undefined,
        notes: attendanceForm.notes || undefined,
      };
      if (editingAttendance) {
        await workforceService.updateAttendance(editingAttendance.id, {
          status: payload.status,
          check_in_time: payload.check_in_time,
          check_out_time: payload.check_out_time,
          notes: payload.notes,
        });
      } else {
        await workforceService.logAttendance(payload);
      }
      resetAttendanceForm();
      loadAttendance();
    } catch (err) {
      setAttendanceError(extractErrorMessage(err));
    }
  };

  const resetAbsenceForm = () => {
    setAbsenceForm({
      employee_id: '',
      absence_type: 'absence_unjustified',
      absence_date: selectedDate,
      justification: '',
      is_deductible: false,
      deduction_amount: 0,
    });
    setShowAbsenceModal(false);
    setAbsenceError('');
  };

  const handleSaveAbsence = async () => {
    setAbsenceError('');
    if (!absenceForm.employee_id) {
      setAbsenceError('Selecciona un empleado.');
      return;
    }
    try {
      await workforceService.createAbsence({
        employee_id: absenceForm.employee_id,
        absence_type: absenceForm.absence_type,
        absence_date: absenceForm.absence_date,
        justification: absenceForm.justification || undefined,
        is_deductible: absenceForm.is_deductible,
        deduction_amount: absenceForm.is_deductible ? absenceForm.deduction_amount : undefined,
      });
      resetAbsenceForm();
      loadAbsences();
    } catch (err) {
      setAbsenceError(extractErrorMessage(err));
    }
  };

  const handleApproveAbsence = async (id: string) => {
    try {
      await workforceService.approveAbsence(id);
      loadAbsences();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      {/* Date selector */}
      <div className="flex items-center gap-3">
        <Calendar size={18} className="text-gray-500" />
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{summary.total_employees}</p>
            <p className="text-xs text-gray-500 mt-1">Total Empleados</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{summary.present}</p>
            <p className="text-xs text-gray-500 mt-1">Presentes</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{summary.absent}</p>
            <p className="text-xs text-gray-500 mt-1">Ausentes</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{summary.late}</p>
            <p className="text-xs text-gray-500 mt-1">Tarde</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-400">{summary.not_logged}</p>
            <p className="text-xs text-gray-500 mt-1">Sin Registrar</p>
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            subTab === 'attendance'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setSubTab('attendance')}
        >
          Asistencia
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            subTab === 'absences'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setSubTab('absences')}
        >
          Faltas
        </button>
      </div>

      {/* Attendance sub-tab */}
      {subTab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Registros de Asistencia</h3>
            <RequirePermission permission="workforce.manage_attendance">
              <button
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
                onClick={() => {
                  resetAttendanceForm();
                  setShowAttendanceModal(true);
                }}
              >
                <Plus size={16} /> Registrar Asistencia
              </button>
            </RequirePermission>
          </div>

          {/* Attendance Modal */}
          {showAttendanceModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingAttendance ? 'Editar Asistencia' : 'Registrar Asistencia'}
                  </h3>
                  <button
                    className="p-1 text-gray-400 hover:text-gray-600"
                    onClick={resetAttendanceForm}
                  >
                    <X size={20} />
                  </button>
                </div>
                {attendanceError && (
                  <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                    <AlertCircle size={16} /> {attendanceError}
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Empleado</label>
                    <select
                      value={attendanceForm.employee_id}
                      onChange={(e) =>
                        setAttendanceForm((p) => ({ ...p, employee_id: e.target.value }))
                      }
                      disabled={!!editingAttendance}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-100"
                    >
                      <option value="">Seleccionar...</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                    <select
                      value={attendanceForm.status}
                      onChange={(e) =>
                        setAttendanceForm((p) => ({
                          ...p,
                          status: e.target.value as AttendanceStatus,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    >
                      {Object.entries(ATTENDANCE_STATUS_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hora Entrada
                      </label>
                      <input
                        type="time"
                        value={attendanceForm.check_in_time || ''}
                        onChange={(e) =>
                          setAttendanceForm((p) => ({ ...p, check_in_time: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hora Salida
                      </label>
                      <input
                        type="time"
                        value={attendanceForm.check_out_time || ''}
                        onChange={(e) =>
                          setAttendanceForm((p) => ({ ...p, check_out_time: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                    <input
                      type="text"
                      value={attendanceForm.notes || ''}
                      onChange={(e) =>
                        setAttendanceForm((p) => ({ ...p, notes: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="Opcional"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                    onClick={resetAttendanceForm}
                  >
                    Cancelar
                  </button>
                  <button
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
                    onClick={handleSaveAttendance}
                  >
                    {editingAttendance ? 'Actualizar' : 'Registrar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {loadingAttendance ? (
            <div className="text-center py-8 text-gray-500">Cargando asistencia...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay registros de asistencia para esta fecha.
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Empleado</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Entrada</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Salida</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Min. Tarde</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Notas</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {rec.employee_name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            ATTENDANCE_STATUS_COLORS[rec.status] || ''
                          }`}
                        >
                          {ATTENDANCE_STATUS_LABELS[rec.status] || rec.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{rec.check_in_time || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{rec.check_out_time || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {rec.minutes_late > 0 ? (
                          <span className="text-yellow-600">{rec.minutes_late}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
                        {rec.notes || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RequirePermission permission="workforce.manage_attendance">
                          <button
                            className="p-1.5 text-gray-500 hover:text-brand-600 hover:bg-gray-100 rounded"
                            onClick={() => handleEditAttendance(rec)}
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </button>
                        </RequirePermission>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Absences sub-tab */}
      {subTab === 'absences' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Faltas y Ausencias</h3>
            <RequirePermission permission="workforce.manage_absences">
              <button
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
                onClick={() => {
                  resetAbsenceForm();
                  setShowAbsenceModal(true);
                }}
              >
                <Plus size={16} /> Registrar Falta
              </button>
            </RequirePermission>
          </div>

          {/* Absence Modal */}
          {showAbsenceModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Registrar Falta</h3>
                  <button
                    className="p-1 text-gray-400 hover:text-gray-600"
                    onClick={resetAbsenceForm}
                  >
                    <X size={20} />
                  </button>
                </div>
                {absenceError && (
                  <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                    <AlertCircle size={16} /> {absenceError}
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Empleado</label>
                    <select
                      value={absenceForm.employee_id}
                      onChange={(e) =>
                        setAbsenceForm((p) => ({ ...p, employee_id: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    >
                      <option value="">Seleccionar...</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                      value={absenceForm.absence_type}
                      onChange={(e) =>
                        setAbsenceForm((p) => ({
                          ...p,
                          absence_type: e.target.value as AbsenceType,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    >
                      {Object.entries(ABSENCE_TYPE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={absenceForm.absence_date}
                      onChange={(e) =>
                        setAbsenceForm((p) => ({ ...p, absence_date: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Justificacion
                    </label>
                    <textarea
                      value={absenceForm.justification || ''}
                      onChange={(e) =>
                        setAbsenceForm((p) => ({ ...p, justification: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      rows={3}
                      placeholder="Motivo de la ausencia..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is-deductible"
                      checked={absenceForm.is_deductible}
                      onChange={(e) =>
                        setAbsenceForm((p) => ({ ...p, is_deductible: e.target.checked }))
                      }
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="is-deductible" className="text-sm text-gray-700">
                      Es deducible
                    </label>
                  </div>
                  {absenceForm.is_deductible && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Monto Deduccion ($)
                      </label>
                      <input
                        type="number"
                        value={absenceForm.deduction_amount || 0}
                        onChange={(e) =>
                          setAbsenceForm((p) => ({
                            ...p,
                            deduction_amount: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        min={0}
                        step={1000}
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                    onClick={resetAbsenceForm}
                  >
                    Cancelar
                  </button>
                  <button
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
                    onClick={handleSaveAbsence}
                  >
                    Registrar
                  </button>
                </div>
              </div>
            </div>
          )}

          {loadingAbsences ? (
            <div className="text-center py-8 text-gray-500">Cargando faltas...</div>
          ) : absences.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay faltas registradas para esta fecha.
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Empleado</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Justificacion</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Deducible</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Monto</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Aprobado</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {absences.map((abs) => (
                    <tr key={abs.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {abs.employee_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {ABSENCE_TYPE_LABELS[abs.absence_type] || abs.absence_type}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
                        {abs.justification || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            abs.is_deductible
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {abs.is_deductible ? 'Si' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {abs.deduction_amount > 0
                          ? `$${abs.deduction_amount.toLocaleString()}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {abs.approved_by ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Aprobado
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!abs.approved_by && (
                          <RequirePermission permission="workforce.manage_absences">
                            <button
                              className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
                              onClick={() => handleApproveAbsence(abs.id)}
                            >
                              Aprobar
                            </button>
                          </RequirePermission>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// ChecklistsTab
// ============================================

function ChecklistsTab({ employees: _employees }: { employees: EmployeeListItem[] }) {
  const [subTab, setSubTab] = useState<'daily' | 'templates'>('daily');
  const [selectedDate, setSelectedDate] = useState(todayStr());

  // --- Daily checklists state ---
  const [dailyChecklists, setDailyChecklists] = useState<DailyChecklist[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  // --- Templates state ---
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState<ChecklistTemplateCreate>({
    name: '',
    position: '',
    description: '',
    items: [],
  });
  const [newItemText, setNewItemText] = useState('');
  const [templateError, setTemplateError] = useState('');

  // --- Edit template modal state ---
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  const [editTemplateForm, setEditTemplateForm] = useState({ name: '', position: '', is_active: true });

  // --- Inline add item per template ---
  const [addingItemToTemplate, setAddingItemToTemplate] = useState<string | null>(null);
  const [inlineItemText, setInlineItemText] = useState('');

  const loadDailyChecklists = useCallback(async () => {
    setLoadingDaily(true);
    try {
      const data = await workforceService.getDailyChecklists({ checklist_date: selectedDate });
      setDailyChecklists(data);
    } catch (err) {
      console.error('Error loading daily checklists:', err);
    } finally {
      setLoadingDaily(false);
    }
  }, [selectedDate]);

  const loadChecklistTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const data = await workforceService.getChecklistTemplates();
      setChecklistTemplates(data);
    } catch (err) {
      console.error('Error loading checklist templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (subTab === 'daily') {
      loadDailyChecklists();
    } else {
      loadChecklistTemplates();
    }
  }, [subTab, loadDailyChecklists, loadChecklistTemplates]);

  const handleGenerateDaily = async () => {
    try {
      await workforceService.generateDailyChecklists(selectedDate);
      loadDailyChecklists();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleToggleItem = async (item: DailyChecklistItem) => {
    const newStatus: ChecklistItemStatus = item.status === 'completed' ? 'pending' : 'completed';
    try {
      await workforceService.updateChecklistItemStatus(item.id, { status: newStatus });
      loadDailyChecklists();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleVerifyChecklist = async (checklistId: string) => {
    try {
      await workforceService.verifyChecklist(checklistId);
      loadDailyChecklists();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const resetTemplateForm = () => {
    setTemplateForm({ name: '', position: '', description: '', items: [] });
    setNewItemText('');
    setShowTemplateForm(false);
    setTemplateError('');
  };

  const handleAddFormItem = () => {
    if (!newItemText.trim()) return;
    setTemplateForm((p) => ({
      ...p,
      items: [
        ...(p.items || []),
        {
          description: newItemText.trim(),
          sort_order: (p.items || []).length + 1,
          is_required: true,
        },
      ],
    }));
    setNewItemText('');
  };

  const handleRemoveFormItem = (idx: number) => {
    setTemplateForm((p) => ({
      ...p,
      items: (p.items || []).filter((_, i) => i !== idx),
    }));
  };

  const handleCreateTemplate = async () => {
    setTemplateError('');
    if (!templateForm.name.trim()) {
      setTemplateError('El nombre es obligatorio.');
      return;
    }
    if (!templateForm.position?.trim()) {
      setTemplateError('El cargo es obligatorio.');
      return;
    }
    try {
      await workforceService.createChecklistTemplate({
        name: templateForm.name,
        position: templateForm.position,
        description: templateForm.description || undefined,
        items: templateForm.items,
      });
      resetTemplateForm();
      loadChecklistTemplates();
    } catch (err) {
      setTemplateError(extractErrorMessage(err));
    }
  };

  const handleEditTemplateOpen = (t: ChecklistTemplate) => {
    setEditingTemplate(t);
    setEditTemplateForm({ name: t.name, position: t.position || '', is_active: t.is_active });
  };

  const handleEditTemplateSave = async () => {
    if (!editingTemplate) return;
    try {
      await workforceService.updateChecklistTemplate(editingTemplate.id, {
        name: editTemplateForm.name,
        position: editTemplateForm.position,
        is_active: editTemplateForm.is_active,
      });
      setEditingTemplate(null);
      loadChecklistTemplates();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleDeleteTemplateItem = async (itemId: string) => {
    if (!window.confirm('Eliminar este item?')) return;
    try {
      await workforceService.deleteChecklistTemplateItem(itemId);
      loadChecklistTemplates();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleAddInlineItem = async (templateId: string) => {
    if (!inlineItemText.trim()) return;
    try {
      await workforceService.addChecklistTemplateItem(templateId, {
        description: inlineItemText.trim(),
      });
      setInlineItemText('');
      setAddingItemToTemplate(null);
      loadChecklistTemplates();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            subTab === 'daily'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setSubTab('daily')}
        >
          Checklists del Dia
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            subTab === 'templates'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setSubTab('templates')}
        >
          Plantillas
        </button>
      </div>

      {/* Daily checklists sub-tab */}
      {subTab === 'daily' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Calendar size={18} className="text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
            <RequirePermission permission="workforce.manage_checklists">
              <button
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
                onClick={handleGenerateDaily}
              >
                <ClipboardList size={16} /> Generar Checklists del Dia
              </button>
            </RequirePermission>
          </div>

          {loadingDaily ? (
            <div className="text-center py-8 text-gray-500">Cargando checklists...</div>
          ) : dailyChecklists.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay checklists para esta fecha. Genera los checklists del dia.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dailyChecklists.map((cl) => {
                const rate = cl.total_items > 0 ? Math.round((cl.completed_items / cl.total_items) * 100) : 0;
                return (
                  <div
                    key={cl.id}
                    className="bg-white rounded-lg border border-gray-200 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900">{cl.employee_name || 'Empleado'}</h4>
                      <span className={`text-sm font-medium ${getScoreColor(rate)}`}>
                        {rate}%
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getScoreBg(rate)}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      {cl.completed_items} de {cl.total_items} items completados
                    </p>
                    {/* Items */}
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {cl.items.map((item) => (
                        <RequirePermission
                          key={item.id}
                          permissions={['workforce.manage_checklists', 'workforce.self_checklist']}
                          fallback={
                            <div className="flex items-center gap-2 py-1">
                              <span
                                className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                                  item.status === 'completed'
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'border-gray-300'
                                }`}
                              >
                                {item.status === 'completed' && <Check size={10} />}
                              </span>
                              <span
                                className={`text-sm ${
                                  item.status === 'completed'
                                    ? 'text-gray-400 line-through'
                                    : 'text-gray-700'
                                }`}
                              >
                                {item.description}
                              </span>
                            </div>
                          }
                        >
                          <button
                            className="flex items-center gap-2 py-1 w-full text-left hover:bg-gray-50 rounded px-1"
                            onClick={() => handleToggleItem(item)}
                          >
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center text-xs flex-shrink-0 ${
                                item.status === 'completed'
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-300'
                              }`}
                            >
                              {item.status === 'completed' && <Check size={10} />}
                            </span>
                            <span
                              className={`text-sm ${
                                item.status === 'completed'
                                  ? 'text-gray-400 line-through'
                                  : 'text-gray-700'
                              }`}
                            >
                              {item.description}
                            </span>
                          </button>
                        </RequirePermission>
                      ))}
                    </div>
                    {/* Verify button */}
                    {!cl.verified_by ? (
                      <RequirePermission permission="workforce.manage_checklists">
                        <button
                          className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                          onClick={() => handleVerifyChecklist(cl.id)}
                        >
                          Verificar
                        </button>
                      </RequirePermission>
                    ) : (
                      <p className="text-xs text-green-600 font-medium text-center">
                        Verificado
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Templates sub-tab */}
      {subTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Plantillas de Checklist</h3>
            <RequirePermission permission="workforce.manage_checklists">
              <button
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
                onClick={() => {
                  resetTemplateForm();
                  setShowTemplateForm(true);
                }}
              >
                <Plus size={16} /> Nueva Plantilla
              </button>
            </RequirePermission>
          </div>

          {/* Create template form */}
          {showTemplateForm && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
              <h4 className="font-semibold text-gray-900">Nueva Plantilla de Checklist</h4>
              {templateError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle size={16} /> {templateError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="Checklist apertura"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                  <input
                    type="text"
                    value={templateForm.position}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, position: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="Vendedor"
                  />
                </div>
              </div>
              {/* Items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
                {(templateForm.items || []).length > 0 && (
                  <ul className="space-y-1 mb-2">
                    {(templateForm.items || []).map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm"
                      >
                        <span className="text-gray-700">{item.description}</span>
                        <button
                          className="text-gray-400 hover:text-red-600"
                          onClick={() => handleRemoveFormItem(idx)}
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddFormItem()}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="Agregar item..."
                  />
                  <button
                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                    onClick={handleAddFormItem}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
                  onClick={handleCreateTemplate}
                >
                  Crear
                </button>
                <button
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                  onClick={resetTemplateForm}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Edit template modal */}
          {editingTemplate && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Editar Plantilla</h3>
                  <button
                    className="p-1 text-gray-400 hover:text-gray-600"
                    onClick={() => setEditingTemplate(null)}
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                    <input
                      type="text"
                      value={editTemplateForm.name}
                      onChange={(e) =>
                        setEditTemplateForm((p) => ({ ...p, name: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                    <input
                      type="text"
                      value={editTemplateForm.position}
                      onChange={(e) =>
                        setEditTemplateForm((p) => ({ ...p, position: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="edit-template-active"
                      checked={editTemplateForm.is_active}
                      onChange={(e) =>
                        setEditTemplateForm((p) => ({ ...p, is_active: e.target.checked }))
                      }
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="edit-template-active" className="text-sm text-gray-700">
                      Activo
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                    onClick={() => setEditingTemplate(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
                    onClick={handleEditTemplateSave}
                  >
                    Actualizar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Template cards */}
          {loadingTemplates ? (
            <div className="text-center py-8 text-gray-500">Cargando plantillas...</div>
          ) : checklistTemplates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No hay plantillas de checklist.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {checklistTemplates.map((t) => (
                <div
                  key={t.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                        {t.name}
                        <RequirePermission permission="workforce.manage_checklists">
                          <button
                            className="p-1 text-gray-400 hover:text-brand-600"
                            onClick={() => handleEditTemplateOpen(t)}
                            title="Editar plantilla"
                          >
                            <Pencil size={13} />
                          </button>
                        </RequirePermission>
                      </h4>
                      <p className="text-xs text-gray-500">{t.position}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        t.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {t.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {t.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between group text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded"
                      >
                        <span>{item.description}</span>
                        <RequirePermission permission="workforce.manage_checklists">
                          <button
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity"
                            onClick={() => handleDeleteTemplateItem(item.id)}
                            title="Eliminar item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </RequirePermission>
                      </li>
                    ))}
                  </ul>
                  {/* Inline add item */}
                  <RequirePermission permission="workforce.manage_checklists">
                    {addingItemToTemplate === t.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inlineItemText}
                          onChange={(e) => setInlineItemText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddInlineItem(t.id);
                            if (e.key === 'Escape') {
                              setAddingItemToTemplate(null);
                              setInlineItemText('');
                            }
                          }}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                          placeholder="Nuevo item..."
                          autoFocus
                        />
                        <button
                          className="p-1 text-green-600 hover:text-green-700"
                          onClick={() => handleAddInlineItem(t.id)}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          className="p-1 text-gray-400 hover:text-gray-600"
                          onClick={() => {
                            setAddingItemToTemplate(null);
                            setInlineItemText('');
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                        onClick={() => {
                          setAddingItemToTemplate(t.id);
                          setInlineItemText('');
                        }}
                      >
                        <Plus size={14} /> Agregar item
                      </button>
                    )}
                  </RequirePermission>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// PerformanceTab
// ============================================

function PerformanceTab({ employees: _employees }: { employees: EmployeeListItem[] }) {
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

// ============================================
// ResponsibilitiesTab
// ============================================

const EMPTY_RESP_FORM = {
  position: '',
  title: '',
  description: '',
  category: 'core' as ResponsibilityCategory,
  sort_order: 0,
};

function ResponsibilitiesTab() {
  const [responsibilities, setResponsibilities] = useState<PositionResponsibility[]>([]);
  const [respLoading, setRespLoading] = useState(false);
  const [respPositionFilter, setRespPositionFilter] = useState('');
  const [showRespModal, setShowRespModal] = useState(false);
  const [editingResp, setEditingResp] = useState<PositionResponsibility | null>(null);
  const [respForm, setRespForm] = useState({ ...EMPTY_RESP_FORM });
  const [respError, setRespError] = useState('');

  const loadResponsibilities = useCallback(async () => {
    setRespLoading(true);
    try {
      const params: { position?: string; is_active?: boolean } = { is_active: true };
      if (respPositionFilter) params.position = respPositionFilter;
      const data = await workforceService.getResponsibilities(params);
      setResponsibilities(data);
    } catch (err) {
      console.error('Error loading responsibilities:', err);
    } finally {
      setRespLoading(false);
    }
  }, [respPositionFilter]);

  useEffect(() => {
    loadResponsibilities();
  }, [loadResponsibilities]);

  // Unique positions for filter dropdown (filter out nulls)
  const uniquePositions = Array.from(new Set(responsibilities.map((r) => r.position).filter((p): p is string => p !== null))).sort();

  // Group by position, then by category
  const filtered = respPositionFilter
    ? responsibilities.filter((r) => r.position === respPositionFilter)
    : responsibilities;

  const groupedByPosition: Record<string, PositionResponsibility[]> = {};
  for (const r of filtered) {
    const pos = r.position || 'Sin cargo';
    if (!groupedByPosition[pos]) groupedByPosition[pos] = [];
    groupedByPosition[pos].push(r);
  }

  // Sort within each position group by category then sort_order
  const categoryOrder: ResponsibilityCategory[] = ['core', 'administrative', 'customer_service', 'operational'];
  for (const pos of Object.keys(groupedByPosition)) {
    groupedByPosition[pos].sort((a, b) => {
      const catDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
      if (catDiff !== 0) return catDiff;
      return a.sort_order - b.sort_order;
    });
  }

  const openCreateModal = () => {
    setEditingResp(null);
    setRespForm({ ...EMPTY_RESP_FORM });
    setRespError('');
    setShowRespModal(true);
  };

  const openEditModal = (resp: PositionResponsibility) => {
    setEditingResp(resp);
    setRespForm({
      position: resp.position || '',
      title: resp.title,
      description: resp.description || '',
      category: resp.category,
      sort_order: resp.sort_order,
    });
    setRespError('');
    setShowRespModal(true);
  };

  const handleSave = async () => {
    if (!respForm.position.trim() || !respForm.title.trim()) {
      setRespError('Cargo y titulo son obligatorios.');
      return;
    }
    try {
      if (editingResp) {
        await workforceService.updateResponsibility(editingResp.id, {
          title: respForm.title,
          description: respForm.description || undefined,
          category: respForm.category,
          sort_order: respForm.sort_order,
        });
      } else {
        const createData: PositionResponsibilityCreate = {
          position: respForm.position.trim(),
          title: respForm.title.trim(),
          description: respForm.description?.trim() || undefined,
          category: respForm.category,
          sort_order: respForm.sort_order,
        };
        await workforceService.createResponsibility(createData);
      }
      setShowRespModal(false);
      loadResponsibilities();
    } catch (err: any) {
      setRespError(extractErrorMessage(err));
    }
  };

  const handleDelete = async (resp: PositionResponsibility) => {
    if (!window.confirm(`Eliminar responsabilidad "${resp.title}"?`)) return;
    try {
      await workforceService.deleteResponsibility(resp.id);
      loadResponsibilities();
    } catch (err) {
      console.error('Error deleting responsibility:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Filtrar por cargo:</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500"
            value={respPositionFilter}
            onChange={(e) => setRespPositionFilter(e.target.value)}
          >
            <option value="">Todos</option>
            {uniquePositions.map((pos) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>
        <RequirePermission permission="workforce.manage_shifts">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
          >
            <Plus size={16} />
            Nueva Responsabilidad
          </button>
        </RequirePermission>
      </div>

      {/* Loading */}
      {respLoading && (
        <div className="text-center py-8 text-gray-500 text-sm">Cargando responsabilidades...</div>
      )}

      {/* Empty state */}
      {!respLoading && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <ShieldCheck size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No hay responsabilidades registradas</p>
          <p className="text-sm mt-1">Crea la primera responsabilidad para un cargo.</p>
        </div>
      )}

      {/* Grouped content */}
      {!respLoading && Object.keys(groupedByPosition).sort().map((position) => {
        const items = groupedByPosition[position];
        // Group by category within position
        const byCategory: Partial<Record<ResponsibilityCategory, PositionResponsibility[]>> = {};
        for (const item of items) {
          if (!byCategory[item.category]) byCategory[item.category] = [];
          byCategory[item.category]!.push(item);
        }

        return (
          <div key={position} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Position header */}
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-800">{position}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {items.length} responsabilidad{items.length !== 1 ? 'es' : ''}
              </p>
            </div>

            <div className="p-5 space-y-4">
              {categoryOrder.map((cat) => {
                const catItems = byCategory[cat];
                if (!catItems || catItems.length === 0) return null;
                return (
                  <div key={cat}>
                    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-2 ${RESPONSIBILITY_CATEGORY_COLORS[cat]}`}>
                      {RESPONSIBILITY_CATEGORY_LABELS[cat]}
                    </span>
                    <div className="space-y-2 ml-1">
                      {catItems.map((resp) => (
                        <div
                          key={resp.id}
                          className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900">{resp.title}</p>
                            {resp.description && (
                              <p className="text-xs text-slate-600 mt-0.5">{resp.description}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">Orden: {resp.sort_order}</p>
                          </div>
                          <RequirePermission permission="workforce.manage_shifts">
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => openEditModal(resp)}
                                className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded"
                                title="Editar"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(resp)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Eliminar"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </RequirePermission>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Create/Edit Modal */}
      {showRespModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingResp ? 'Editar Responsabilidad' : 'Nueva Responsabilidad'}
              </h2>
              <button onClick={() => setShowRespModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {respError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle size={16} />
                  {respError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo *</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Ej: Vendedora, Costurera, Administradora"
                  value={respForm.position}
                  onChange={(e) => setRespForm({ ...respForm, position: e.target.value })}
                  disabled={!!editingResp}
                />
                {editingResp && (
                  <p className="text-xs text-gray-400 mt-1">El cargo no se puede cambiar al editar.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titulo *</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Ej: Atender clientes en tienda"
                  value={respForm.title}
                  onChange={(e) => setRespForm({ ...respForm, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  rows={3}
                  placeholder="Descripcion detallada de la responsabilidad (opcional)"
                  value={respForm.description}
                  onChange={(e) => setRespForm({ ...respForm, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500"
                    value={respForm.category}
                    onChange={(e) => setRespForm({ ...respForm, category: e.target.value as ResponsibilityCategory })}
                  >
                    {(Object.keys(RESPONSIBILITY_CATEGORY_LABELS) as ResponsibilityCategory[]).map((cat) => (
                      <option key={cat} value={cat}>{RESPONSIBILITY_CATEGORY_LABELS[cat]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    min={0}
                    value={respForm.sort_order}
                    onChange={(e) => setRespForm({ ...respForm, sort_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowRespModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700"
              >
                {editingResp ? 'Guardar Cambios' : 'Crear Responsabilidad'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function Workforce() {
  const [activeTab, setActiveTab] = useState<string>('shifts');
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoadingEmployees(true);
      try {
        const data = await employeeService.getEmployees({ is_active: true });
        setEmployees(data);
      } catch (err) {
        console.error('Error loading employees:', err);
      } finally {
        setLoadingEmployees(false);
      }
    };
    load();
  }, []);

  return (
    <Layout>
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestion Laboral</h1>
        <p className="text-gray-500 mt-1">
          Turnos, asistencia, responsabilidades y rendimiento del equipo.
        </p>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {MAIN_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading employees indicator */}
      {loadingEmployees && (
        <div className="text-center py-4 text-gray-500 text-sm">Cargando empleados...</div>
      )}

      {/* Tab Content */}
      {!loadingEmployees && activeTab === 'shifts' && <ShiftsTab employees={employees} />}
      {!loadingEmployees && activeTab === 'attendance' && <AttendanceTab employees={employees} />}
      {!loadingEmployees && activeTab === 'checklists' && <ChecklistsTab employees={employees} />}
      {!loadingEmployees && activeTab === 'performance' && <PerformanceTab employees={employees} />}
      {!loadingEmployees && activeTab === 'responsibilities' && <ResponsibilitiesTab />}
    </div>
    </Layout>
  );
}
