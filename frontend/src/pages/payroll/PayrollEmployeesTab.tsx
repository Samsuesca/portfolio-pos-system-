/**
 * PayrollEmployeesTab - Employee list table with filter and action bar.
 */
import React from 'react';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import { getPaymentFrequencyLabel, type EmployeeListItem } from '../../services/employeeService';
import type { EmployeeFilterType } from './types';

interface PayrollEmployeesTabProps {
  employees: EmployeeListItem[];
  filter: EmployeeFilterType;
  onFilterChange: (filter: EmployeeFilterType) => void;
  onNewEmployee: () => void;
  onEditEmployee: (emp: EmployeeListItem) => void;
  onDeleteEmployee: (id: string) => void;
}

const PayrollEmployeesTab: React.FC<PayrollEmployeesTabProps> = ({
  employees,
  filter,
  onFilterChange,
  onNewEmployee,
  onEditEmployee,
  onDeleteEmployee,
}) => {
  return (
    <>
      {/* Action Bar */}
      <div className="flex justify-between items-center mb-6">
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as EmployeeFilterType)}
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="all">Todos</option>
        </select>
        <button
          onClick={onNewEmployee}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Nuevo Empleado
        </button>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <table className="min-w-full divide-y divide-stone-100">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">Documento</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">Cargo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">Salario Base</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">Frecuencia</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-stone-100">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-stone-500">
                  No hay empleados registrados
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-stone-900">{emp.full_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600">
                    {emp.document_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600">
                    {emp.position}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-900">
                    {formatCurrency(emp.base_salary)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600">
                    {getPaymentFrequencyLabel(emp.payment_frequency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      emp.is_active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-stone-100 text-stone-600'
                    }`}>
                      {emp.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEditEmployee(emp)}
                        className="text-brand-600 hover:text-brand-700 p-1"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {emp.is_active && (
                        <button
                          onClick={() => onDeleteEmployee(emp.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Desactivar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default React.memo(PayrollEmployeesTab);
