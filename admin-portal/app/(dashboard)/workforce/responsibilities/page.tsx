'use client';

import { useState, useEffect, useMemo } from 'react';
import { Pencil, Trash2, User, Users } from 'lucide-react';
import { RequirePermission } from '@/components/RequirePermission';
import workforceService, {
  PositionResponsibility,
  PositionResponsibilityCreate,
  PositionResponsibilityUpdate,
  ResponsibilityCategory,
  RESPONSIBILITY_CATEGORY_LABELS,
  RESPONSIBILITY_CATEGORY_COLORS,
  AssignmentType,
  ASSIGNMENT_TYPE_LABELS,
  ASSIGNMENT_TYPE_COLORS,
} from '@/lib/services/workforceService';
import employeeService, { EmployeeListItem } from '@/lib/services/employeeService';

const ALL_CATEGORIES: ResponsibilityCategory[] = ['core', 'administrative', 'customer_service', 'operational'];

const EMPTY_FORM: PositionResponsibilityCreate = {
  assignment_type: 'position',
  position: '',
  employee_id: undefined,
  title: '',
  description: '',
  category: 'core',
  sort_order: 0,
};

export default function ResponsibilitiesPage() {
  const [responsibilities, setResponsibilities] = useState<PositionResponsibility[]>([]);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [filterPosition, setFilterPosition] = useState<string>('');
  const [filterAssignmentType, setFilterAssignmentType] = useState<string>('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PositionResponsibility | null>(null);
  const [form, setForm] = useState<PositionResponsibilityCreate>(EMPTY_FORM);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [respData, empData] = await Promise.all([
        workforceService.getResponsibilities(),
        employeeService.list({ is_active: true }),
      ]);
      setResponsibilities(respData);
      setEmployees(empData);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al cargar responsabilidades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Distinct positions for filter dropdown (from employees)
  const positions = useMemo(() => {
    const set = new Set(employees.map((e) => e.position).filter(Boolean));
    return Array.from(set).sort();
  }, [employees]);

  // Filtered list
  const filtered = useMemo(() => {
    let result = responsibilities;
    if (filterAssignmentType) {
      result = result.filter((r) => r.assignment_type === filterAssignmentType);
    }
    if (filterPosition) {
      result = result.filter((r) => r.position === filterPosition);
    }
    return result;
  }, [responsibilities, filterPosition, filterAssignmentType]);

  // --- Handlers ---

  const handleEdit = (r: PositionResponsibility) => {
    setEditing(r);
    setForm({
      assignment_type: r.assignment_type || 'position',
      position: r.position || '',
      employee_id: r.employee_id || undefined,
      title: r.title,
      description: r.description || '',
      category: r.category,
      sort_order: r.sort_order,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    try {
      setError(null);
      if (editing) {
        const updateData: PositionResponsibilityUpdate = {
          title: form.title,
          description: form.description || undefined,
          category: form.category,
          sort_order: form.sort_order,
        };
        await workforceService.updateResponsibility(editing.id, updateData);
      } else {
        // Build payload based on assignment type
        const payload: PositionResponsibilityCreate = {
          assignment_type: form.assignment_type,
          title: form.title,
          description: form.description || undefined,
          category: form.category,
          sort_order: form.sort_order,
        };
        if (form.assignment_type === 'position') {
          payload.position = form.position;
          payload.employee_id = undefined;
        } else {
          payload.employee_id = form.employee_id;
          payload.position = undefined;
        }
        await workforceService.createResponsibility(payload);
      }
      handleCancel();
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al guardar responsabilidad');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Eliminar esta responsabilidad?')) return;
    try {
      setError(null);
      await workforceService.deleteResponsibility(id);
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al eliminar responsabilidad');
    }
  };

  const handleToggleActive = async (r: PositionResponsibility) => {
    try {
      setError(null);
      await workforceService.updateResponsibility(r.id, { is_active: !r.is_active });
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al cambiar estado');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Responsabilidades</h1>
          <p className="text-slate-500">Define y gestiona responsabilidades por cargo o por empleado individual.</p>
        </div>
        <RequirePermission permission="workforce.manage_shifts">
          <button
            onClick={() => {
              if (showForm && !editing) {
                handleCancel();
              } else {
                setEditing(null);
                setForm(EMPTY_FORM);
                setShowForm(true);
              }
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
          >
            + Nueva Responsabilidad
          </button>
        </RequirePermission>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <RequirePermission permission="workforce.manage_shifts">
          <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
            <h3 className="font-semibold">
              {editing ? 'Editar Responsabilidad' : 'Nueva Responsabilidad'}
            </h3>

            {/* Assignment Type Selector - only when creating */}
            {!editing && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Tipo de Asignación *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="assignment_type"
                      value="position"
                      checked={form.assignment_type === 'position'}
                      onChange={() =>
                        setForm({ ...form, assignment_type: 'position', employee_id: undefined })
                      }
                      className="w-4 h-4 text-blue-600"
                    />
                    <Users className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-700">Por Cargo (todos los empleados)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="assignment_type"
                      value="employee"
                      checked={form.assignment_type === 'employee'}
                      onChange={() =>
                        setForm({ ...form, assignment_type: 'employee', position: '' })
                      }
                      className="w-4 h-4 text-blue-600"
                    />
                    <User className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-700">Por Empleado (individual)</span>
                  </label>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Position selector - shown when assignment_type is 'position' */}
              {form.assignment_type === 'position' && (
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Cargo *</label>
                  <select
                    value={form.position || ''}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                    disabled={!!editing}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">Seleccionar cargo...</option>
                    {positions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Employee selector - shown when assignment_type is 'employee' */}
              {form.assignment_type === 'employee' && (
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Empleado *</label>
                  <select
                    value={form.employee_id || ''}
                    onChange={(e) => setForm({ ...form, employee_id: e.target.value || undefined })}
                    disabled={!!editing}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">Seleccionar empleado...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.position})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-600 mb-1">Titulo *</label>
                <input
                  type="text"
                  placeholder="Ej: Atencion al cliente en tienda"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Categoria *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as ResponsibilityCategory })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  {ALL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {RESPONSIBILITY_CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Orden</label>
                <input
                  type="number"
                  min={0}
                  value={form.sort_order ?? 0}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-600 mb-1">Descripcion</label>
                <textarea
                  placeholder="Descripcion detallada de la responsabilidad..."
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={
                  !form.title.trim() ||
                  (form.assignment_type === 'position' && !form.position?.trim()) ||
                  (form.assignment_type === 'employee' && !form.employee_id)
                }
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editing ? 'Actualizar' : 'Guardar'}
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </RequirePermission>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Tipo:</label>
          <select
            value={filterAssignmentType}
            onChange={(e) => setFilterAssignmentType(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">Todos</option>
            <option value="position">Por Cargo</option>
            <option value="employee">Individual</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Cargo:</label>
          <select
            value={filterPosition}
            onChange={(e) => setFilterPosition(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">Todos los cargos</option>
            {positions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <span className="text-sm text-slate-400">
          {filtered.length} responsabilidad{filtered.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Tipo</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Asignado a</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Titulo</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Categoria</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Descripcion</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Orden</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Estado</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                  Cargando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                  No hay responsabilidades registradas.{' '}
                  {!filterPosition && !filterAssignmentType && 'Crea la primera.'}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-200">
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        ASSIGNMENT_TYPE_COLORS[r.assignment_type as AssignmentType] ||
                        'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {r.assignment_type === 'employee' ? (
                        <User className="w-3 h-3" />
                      ) : (
                        <Users className="w-3 h-3" />
                      )}
                      {ASSIGNMENT_TYPE_LABELS[r.assignment_type as AssignmentType] || 'Por Cargo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {r.assignment_type === 'employee' ? r.employee_name : r.position}
                  </td>
                  <td className="px-6 py-4 text-slate-900">{r.title}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        RESPONSIBILITY_CATEGORY_COLORS[r.category] || 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {RESPONSIBILITY_CATEGORY_LABELS[r.category] || r.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm max-w-xs truncate">
                    {r.description || '-'}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{r.sort_order}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(r)}
                      className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer ${
                        r.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                      title="Click para cambiar estado"
                    >
                      {r.is_active ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <RequirePermission permission="workforce.manage_shifts">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(r)}
                          className="p-1 text-slate-400 hover:text-blue-600"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
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
  );
}
