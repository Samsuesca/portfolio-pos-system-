import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, X, Calendar, AlertCircle } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';
import workforceService, {
  AttendanceRecord,
  AttendanceCreate,
  AttendanceStatus,
  DailyAttendanceSummary,
  AbsenceType,
  AbsenceRecord,
  AbsenceCreate,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_COLORS,
  ABSENCE_TYPE_LABELS,
} from '../../services/workforceService';
import { EmployeeListItem } from '../../services/employeeService';
import { extractErrorMessage } from '../../utils/api-client';
import { todayStr } from './helpers';

export default function AttendanceTab({ employees }: { employees: EmployeeListItem[] }) {
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
