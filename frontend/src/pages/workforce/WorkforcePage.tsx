import { useState, useEffect } from 'react';
import {
  Clock,
  Users,
  ClipboardList,
  BarChart3,
  ShieldCheck,
  AlertCircle,
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
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadEmployees = async () => {
    setLoadingEmployees(true);
    setLoadError(null);
    try {
      const result = await employeeService.getEmployees({ is_active: true });
      setEmployees(result.items);
    } catch (err) {
      console.error('Error loading employees:', err);
      setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar los empleados.');
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  return (
    <Layout>
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Gestion Laboral</h1>
        <p className="text-stone-500 mt-1">
          Turnos, asistencia, responsabilidades y rendimiento del equipo.
        </p>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 border-b border-stone-200">
        {MAIN_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Load error banner */}
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="text-sm text-red-700 flex-1">{loadError}</div>
          <button
            onClick={() => loadEmployees()}
            className="text-sm text-red-700 underline hover:text-red-800"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Loading employees indicator */}
      {loadingEmployees && (
        <div className="text-center py-4 text-stone-500 text-sm">Cargando empleados...</div>
      )}

      {/* Tab Content */}
      {!loadingEmployees && !loadError && activeTab === 'shifts' && <ShiftsTab employees={employees} />}
      {!loadingEmployees && !loadError && activeTab === 'attendance' && <AttendanceTab employees={employees} />}
      {!loadingEmployees && !loadError && activeTab === 'checklists' && <ChecklistsTab employees={employees} />}
      {!loadingEmployees && !loadError && activeTab === 'performance' && <PerformanceTab employees={employees} />}
      {!loadingEmployees && !loadError && activeTab === 'responsibilities' && <ResponsibilitiesTab />}
    </div>
    </Layout>
  );
}
