import { useState, useEffect } from 'react';
import {
  Clock,
  Users,
  ClipboardList,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import Layout from '../../components/Layout';
import employeeService, { EmployeeListItem } from '../../services/employeeService';
import ShiftsTab from './ShiftsTab';
import AttendanceTab from './AttendanceTab';
import ChecklistsTab from './ChecklistsTab';
import PerformanceTab from './PerformanceTab';
import ResponsibilitiesTab from './ResponsibilitiesTab';

const MAIN_TABS = [
  { key: 'shifts', label: 'Turnos', icon: Clock },
  { key: 'attendance', label: 'Asistencia', icon: Users },
  { key: 'checklists', label: 'Checklists', icon: ClipboardList },
  { key: 'performance', label: 'Rendimiento', icon: BarChart3 },
  { key: 'responsibilities', label: 'Responsabilidades', icon: ShieldCheck },
];

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
