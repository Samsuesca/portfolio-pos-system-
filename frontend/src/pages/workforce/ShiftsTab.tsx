import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';
import workforceService, {
  ShiftTemplate,
  ShiftTemplateCreate,
  Schedule,
  ScheduleCreate,
  SHIFT_TYPE_LABELS,
} from '../../services/workforceService';
import { EmployeeListItem } from '../../services/employeeService';
import { extractErrorMessage } from '../../utils/api-client';
import { todayStr, weekAgoStr } from './helpers';

export default function ShiftsTab({ employees }: { employees: EmployeeListItem[] }) {
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
