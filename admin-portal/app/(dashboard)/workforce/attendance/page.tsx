'use client';

import { useState, useEffect } from 'react';
import { Pencil, Check } from 'lucide-react';
import { RequirePermission } from '@/components/RequirePermission';
import employeeService, { EmployeeListItem } from '@/lib/services/employeeService';
import workforceService, {
  AttendanceRecord,
  AbsenceRecord,
  DailyAttendanceSummary,
  AttendanceCreate,
  AbsenceCreate,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_COLORS,
  ABSENCE_TYPE_LABELS,
  AbsenceType,
} from '@/lib/services/workforceService';

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [summary, setSummary] = useState<DailyAttendanceSummary | null>(null);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'attendance' | 'absences'>('attendance');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Attendance modal
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRecord | null>(null);
  const [attendanceForm, setAttendanceForm] = useState<AttendanceCreate>({
    employee_id: '',
    record_date: '',
    status: 'present',
  });

  // Absence modal
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [absenceForm, setAbsenceForm] = useState<AbsenceCreate>({
    employee_id: '',
    absence_type: 'absence_unjustified',
    absence_date: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [recs, summ, abs, emps] = await Promise.all([
        workforceService.getAttendanceRecords({ record_date: selectedDate }),
        workforceService.getDailyAttendanceSummary(selectedDate),
        workforceService.getAbsences({ date_from: selectedDate, date_to: selectedDate }),
        employeeService.list({ is_active: true }),
      ]);
      setRecords(recs);
      setSummary(summ);
      setAbsences(abs);
      setEmployees(emps);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  // --- Attendance handlers ---
  const handleOpenAttendanceModal = (record?: AttendanceRecord) => {
    if (record) {
      setEditingAttendance(record);
      setAttendanceForm({
        employee_id: record.employee_id,
        record_date: record.record_date,
        status: record.status,
        check_in_time: record.check_in_time || undefined,
        check_out_time: record.check_out_time || undefined,
        notes: record.notes || undefined,
      });
    } else {
      setEditingAttendance(null);
      setAttendanceForm({
        employee_id: '',
        record_date: selectedDate,
        status: 'present',
      });
    }
    setShowAttendanceModal(true);
  };

  const handleSaveAttendance = async () => {
    try {
      if (editingAttendance) {
        await workforceService.updateAttendance(editingAttendance.id, attendanceForm);
      } else {
        await workforceService.logAttendance({ ...attendanceForm, record_date: selectedDate });
      }
      setShowAttendanceModal(false);
      setEditingAttendance(null);
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al guardar asistencia');
    }
  };

  // --- Absence handlers ---
  const handleOpenAbsenceModal = () => {
    setAbsenceForm({
      employee_id: '',
      absence_type: 'absence_unjustified',
      absence_date: selectedDate,
    });
    setShowAbsenceModal(true);
  };

  const handleSaveAbsence = async () => {
    try {
      await workforceService.createAbsence(absenceForm);
      setShowAbsenceModal(false);
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al registrar falta');
    }
  };

  const handleApproveAbsence = async (id: string) => {
    if (!window.confirm('Aprobar esta falta?')) return;
    try {
      await workforceService.approveAbsence(id);
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al aprobar falta');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Control de Asistencia</h1>
          <p className="text-slate-500">Registro diario de asistencia y gestion de faltas.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Fecha:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Empleados', value: summary.total_employees, color: 'text-slate-900' },
            { label: 'Presentes', value: summary.present, color: 'text-green-600' },
            { label: 'Ausentes', value: summary.absent, color: 'text-red-600' },
            { label: 'Tarde', value: summary.late, color: 'text-yellow-600' },
            { label: 'Sin Registrar', value: summary.not_logged, color: 'text-slate-400' },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-lg border border-slate-200 p-4 text-center">
              <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
              <div className="text-sm text-slate-500">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'attendance' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Asistencia del Dia
        </button>
        <button
          onClick={() => setActiveTab('absences')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'absences' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Faltas Registradas
        </button>
      </div>

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <RequirePermission permission="manage_attendance">
              <button
                onClick={() => handleOpenAttendanceModal()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
              >
                + Registrar Asistencia
              </button>
            </RequirePermission>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Empleado</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Estado</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Entrada</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Salida</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Min. Tarde</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Notas</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">Cargando...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">No hay registros de asistencia para esta fecha.</td></tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id} className="border-b border-slate-200">
                      <td className="px-6 py-4 font-medium text-slate-900">{r.employee_name || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${ATTENDANCE_STATUS_COLORS[r.status]}`}>
                          {ATTENDANCE_STATUS_LABELS[r.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{r.check_in_time || '-'}</td>
                      <td className="px-6 py-4 text-slate-600">{r.check_out_time || '-'}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {r.minutes_late > 0 ? (
                          <span className="text-yellow-600 font-medium">{r.minutes_late} min</span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm">{r.notes || '-'}</td>
                      <td className="px-6 py-4">
                        <RequirePermission permission="manage_attendance">
                          <button
                            onClick={() => handleOpenAttendanceModal(r)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100"
                            title="Editar"
                          >
                            <Pencil size={16} />
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

      {/* Absences Tab */}
      {activeTab === 'absences' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <RequirePermission permission="manage_absences">
              <button
                onClick={handleOpenAbsenceModal}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
              >
                + Registrar Falta
              </button>
            </RequirePermission>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Empleado</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Tipo</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Justificacion</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Deducible</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Monto</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Aprobado</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">Cargando...</td></tr>
                ) : absences.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">No hay faltas registradas para esta fecha.</td></tr>
                ) : (
                  absences.map((a) => (
                    <tr key={a.id} className="border-b border-slate-200">
                      <td className="px-6 py-4 font-medium text-slate-900">{a.employee_name || '-'}</td>
                      <td className="px-6 py-4 text-slate-600">{ABSENCE_TYPE_LABELS[a.absence_type] || a.absence_type}</td>
                      <td className="px-6 py-4 text-slate-500 text-sm">{a.justification || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${a.is_deductible ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'}`}>
                          {a.is_deductible ? 'Si' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-900 font-medium">
                        {a.deduction_amount > 0 ? `$${Number(a.deduction_amount).toLocaleString('es-CO')}` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        {a.approved_by ? (
                          <span className="text-green-600 text-sm">Aprobado</span>
                        ) : (
                          <span className="text-yellow-600 text-sm">Pendiente</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {!a.approved_by && (
                          <RequirePermission permission="manage_absences">
                            <button
                              onClick={() => handleApproveAbsence(a.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100"
                              title="Aprobar falta"
                            >
                              <Check size={14} />
                              Aprobar
                            </button>
                          </RequirePermission>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold text-lg">
              {editingAttendance ? 'Editar Asistencia' : 'Registrar Asistencia'}
            </h3>

            {/* Employee */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Empleado</label>
              <select
                value={attendanceForm.employee_id}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, employee_id: e.target.value })}
                disabled={!!editingAttendance}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100"
              >
                <option value="">Seleccionar empleado...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
              <select
                value={attendanceForm.status}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value as AttendanceCreate['status'] })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Check-in time */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hora de Entrada</label>
              <input
                type="time"
                value={attendanceForm.check_in_time || ''}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, check_in_time: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            {/* Check-out time */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hora de Salida</label>
              <input
                type="time"
                value={attendanceForm.check_out_time || ''}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, check_out_time: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
              <textarea
                value={attendanceForm.notes || ''}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value || undefined })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none"
                placeholder="Observaciones opcionales..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setShowAttendanceModal(false); setEditingAttendance(null); }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAttendance}
                disabled={!attendanceForm.employee_id}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Absence Modal */}
      {showAbsenceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold text-lg">Registrar Falta</h3>

            {/* Employee */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Empleado</label>
              <select
                value={absenceForm.employee_id}
                onChange={(e) => setAbsenceForm({ ...absenceForm, employee_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">Seleccionar empleado...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
              </select>
            </div>

            {/* Absence type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Falta</label>
              <select
                value={absenceForm.absence_type}
                onChange={(e) => setAbsenceForm({ ...absenceForm, absence_type: e.target.value as AbsenceType })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                {Object.entries(ABSENCE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Absence date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
              <input
                type="date"
                value={absenceForm.absence_date}
                onChange={(e) => setAbsenceForm({ ...absenceForm, absence_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            {/* Justification */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Justificacion</label>
              <textarea
                value={absenceForm.justification || ''}
                onChange={(e) => setAbsenceForm({ ...absenceForm, justification: e.target.value || undefined })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none"
                placeholder="Motivo de la falta..."
              />
            </div>

            {/* Is deductible */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_deductible"
                checked={absenceForm.is_deductible || false}
                onChange={(e) => setAbsenceForm({ ...absenceForm, is_deductible: e.target.checked })}
                className="rounded border-slate-300"
              />
              <label htmlFor="is_deductible" className="text-sm text-slate-700">Es deducible del salario</label>
            </div>

            {/* Deduction amount */}
            {absenceForm.is_deductible && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto de deduccion</label>
                <input
                  type="number"
                  min="0"
                  value={absenceForm.deduction_amount || ''}
                  onChange={(e) => setAbsenceForm({ ...absenceForm, deduction_amount: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="0"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAbsenceModal(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAbsence}
                disabled={!absenceForm.employee_id}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
