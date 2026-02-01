'use client';

import { useState, useEffect } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { RequirePermission } from '@/components/RequirePermission';
import workforceService, {
  ShiftTemplate,
  Schedule,
  SHIFT_TYPE_LABELS,
  ShiftTemplateCreate,
  ScheduleCreate,
} from '@/lib/services/workforceService';
import employeeService, { EmployeeListItem } from '@/lib/services/employeeService';

export default function ShiftsPage() {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'schedules'>('templates');

  // Template form
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<ShiftTemplateCreate>({
    name: '',
    shift_type: 'morning',
    start_time: '07:00',
    end_time: '13:00',
    break_minutes: 0,
  });

  // Schedule form
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleCreate>({
    employee_id: '',
    schedule_date: '',
    start_time: '07:00',
    end_time: '13:00',
  });

  // Schedule filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 7); // Sunday
    return d.toISOString().split('T')[0];
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [tmpl, sched, emps] = await Promise.all([
        workforceService.getShiftTemplates(),
        workforceService.getSchedules({ date_from: dateFrom, date_to: dateTo }),
        employeeService.list({ is_active: true }),
      ]);
      setTemplates(tmpl);
      setSchedules(sched);
      setEmployees(emps);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateFrom, dateTo]);

  // --- Template handlers ---

  const handleEditTemplate = (t: ShiftTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({
      name: t.name,
      shift_type: t.shift_type,
      start_time: t.start_time,
      end_time: t.end_time,
      break_minutes: t.break_minutes,
    });
    setShowTemplateForm(true);
  };

  const handleSaveTemplate = async () => {
    try {
      if (editingTemplate) {
        await workforceService.updateShiftTemplate(editingTemplate.id, templateForm);
      } else {
        await workforceService.createShiftTemplate(templateForm);
      }
      setShowTemplateForm(false);
      setEditingTemplate(null);
      setTemplateForm({ name: '', shift_type: 'morning', start_time: '07:00', end_time: '13:00', break_minutes: 0 });
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al guardar plantilla');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Eliminar esta plantilla de turno?')) return;
    try {
      await workforceService.deleteShiftTemplate(id);
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al eliminar plantilla');
    }
  };

  const handleCancelTemplateForm = () => {
    setShowTemplateForm(false);
    setEditingTemplate(null);
    setTemplateForm({ name: '', shift_type: 'morning', start_time: '07:00', end_time: '13:00', break_minutes: 0 });
  };

  // --- Schedule handlers ---

  const handleCreateSchedule = async () => {
    try {
      await workforceService.createSchedule(scheduleForm);
      setShowScheduleForm(false);
      setScheduleForm({ employee_id: '', schedule_date: '', start_time: '07:00', end_time: '13:00' });
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al crear horario');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm('Eliminar este horario?')) return;
    try {
      await workforceService.deleteSchedule(id);
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al eliminar horario');
    }
  };

  const handleTemplateSelectForSchedule = (templateId: string) => {
    const t = templates.find(x => x.id === templateId);
    if (t) {
      setScheduleForm({ ...scheduleForm, shift_template_id: templateId, start_time: t.start_time, end_time: t.end_time });
    } else {
      setScheduleForm({ ...scheduleForm, shift_template_id: undefined });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Turnos & Horarios</h1>
          <p className="text-slate-500">Gestiona plantillas de turno y programa horarios.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'templates'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Plantillas de Turno
        </button>
        <button
          onClick={() => setActiveTab('schedules')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'schedules'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Horarios Programados
        </button>
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <RequirePermission permission="workforce.manage_shifts">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (showTemplateForm && !editingTemplate) {
                    handleCancelTemplateForm();
                  } else {
                    setEditingTemplate(null);
                    setTemplateForm({ name: '', shift_type: 'morning', start_time: '07:00', end_time: '13:00', break_minutes: 0 });
                    setShowTemplateForm(true);
                  }
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
              >
                + Nueva Plantilla
              </button>
            </div>

            {showTemplateForm && (
              <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
                <h3 className="font-semibold">
                  {editingTemplate ? 'Editar Plantilla de Turno' : 'Nueva Plantilla de Turno'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <input
                    type="text"
                    placeholder="Nombre (ej: Manana)"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <select
                    value={templateForm.shift_type}
                    onChange={(e) => setTemplateForm({ ...templateForm, shift_type: e.target.value as any })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {Object.entries(SHIFT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={templateForm.start_time}
                    onChange={(e) => setTemplateForm({ ...templateForm, start_time: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <input
                    type="time"
                    value={templateForm.end_time}
                    onChange={(e) => setTemplateForm({ ...templateForm, end_time: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                {editingTemplate && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-600">Activa:</label>
                    <input
                      type="checkbox"
                      checked={(templateForm as any).is_active !== false}
                      onChange={(e) => setTemplateForm({ ...templateForm, is_active: e.target.checked } as any)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveTemplate}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                  >
                    {editingTemplate ? 'Actualizar' : 'Guardar'}
                  </button>
                  <button
                    onClick={handleCancelTemplateForm}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </RequirePermission>

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Nombre</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Tipo</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Horario</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Descanso</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Estado</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Cargando...</td></tr>
                ) : templates.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No hay plantillas. Crea la primera.</td></tr>
                ) : (
                  templates.map((t) => (
                    <tr key={t.id} className="border-b border-slate-200">
                      <td className="px-6 py-4 font-medium text-slate-900">{t.name}</td>
                      <td className="px-6 py-4 text-slate-600">{SHIFT_TYPE_LABELS[t.shift_type] || t.shift_type}</td>
                      <td className="px-6 py-4 text-slate-600">{t.start_time} - {t.end_time}</td>
                      <td className="px-6 py-4 text-slate-600">{t.break_minutes} min</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                          {t.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <RequirePermission permission="workforce.manage_shifts">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditTemplate(t)}
                              className="p-1 text-slate-400 hover:text-blue-600"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTemplate(t.id)}
                              className="p-1 text-slate-400 hover:text-red-600"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </RequirePermission>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schedules Tab */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          <div className="flex gap-4 items-center justify-between">
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">Desde:</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">Hasta:</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <RequirePermission permission="workforce.manage_shifts">
              <button
                onClick={() => setShowScheduleForm(!showScheduleForm)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
              >
                + Asignar Horario
              </button>
            </RequirePermission>
          </div>

          {showScheduleForm && (
            <RequirePermission permission="workforce.manage_shifts">
              <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
                <h3 className="font-semibold">Asignar Horario</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Empleado *</label>
                    <select
                      value={scheduleForm.employee_id}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, employee_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="">Seleccionar empleado...</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Plantilla de turno (opcional)</label>
                    <select
                      value={scheduleForm.shift_template_id || ''}
                      onChange={(e) => handleTemplateSelectForSchedule(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="">Sin plantilla (personalizado)</option>
                      {templates.filter(t => t.is_active).map((t) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.start_time} - {t.end_time})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Fecha *</label>
                    <input
                      type="date"
                      value={scheduleForm.schedule_date}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Hora inicio</label>
                    <input
                      type="time"
                      value={scheduleForm.start_time}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Hora fin</label>
                    <input
                      type="time"
                      value={scheduleForm.end_time}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Notas</label>
                    <textarea
                      value={scheduleForm.notes || ''}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value || undefined })}
                      placeholder="Notas opcionales..."
                      rows={1}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateSchedule}
                    disabled={!scheduleForm.employee_id || !scheduleForm.schedule_date}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => {
                      setShowScheduleForm(false);
                      setScheduleForm({ employee_id: '', schedule_date: '', start_time: '07:00', end_time: '13:00' });
                    }}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </RequirePermission>
          )}

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Fecha</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Empleado</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Turno</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Horario</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Notas</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Cargando...</td></tr>
                ) : schedules.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No hay horarios programados para este periodo.</td></tr>
                ) : (
                  schedules.map((s) => (
                    <tr key={s.id} className="border-b border-slate-200">
                      <td className="px-6 py-4 text-slate-900">
                        {new Date(s.schedule_date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">{s.employee_name || '-'}</td>
                      <td className="px-6 py-4 text-slate-600">{s.shift_template_name || 'Personalizado'}</td>
                      <td className="px-6 py-4 text-slate-600">{s.start_time} - {s.end_time}</td>
                      <td className="px-6 py-4 text-slate-500 text-sm">{s.notes || '-'}</td>
                      <td className="px-6 py-4">
                        <RequirePermission permission="workforce.manage_shifts">
                          <button
                            onClick={() => handleDeleteSchedule(s.id)}
                            className="p-1 text-slate-400 hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </RequirePermission>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
