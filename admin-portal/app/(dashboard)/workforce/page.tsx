'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RequirePermission } from '@/components/RequirePermission';
import workforceService, {
  DailyAttendanceSummary,
  ATTENDANCE_STATUS_LABELS,
} from '@/lib/services/workforceService';

export default function WorkforcePage() {
  const [summary, setSummary] = useState<DailyAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await workforceService.getDailyAttendanceSummary();
        setSummary(data);
      } catch {
        // Silently fail - module may not have data yet
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const cards = [
    {
      title: 'Turnos & Horarios',
      description: 'Gestiona plantillas de turnos y programa horarios semanales.',
      href: '/workforce/shifts',
      icon: '📅',
      color: 'bg-blue-50 border-blue-200',
    },
    {
      title: 'Control de Asistencia',
      description: 'Registra asistencia diaria y gestiona faltas y retardos.',
      href: '/workforce/attendance',
      icon: '✅',
      color: 'bg-green-50 border-green-200',
    },
    {
      title: 'Checklists Diarios',
      description: 'Checklists diarios por cargo. Seguimiento de tareas completadas.',
      href: '/workforce/checklists',
      icon: '📋',
      color: 'bg-purple-50 border-purple-200',
    },
    {
      title: 'Responsabilidades por Cargo',
      description: 'Define las responsabilidades de cada cargo. Categorias y orden de prioridad.',
      href: '/workforce/responsibilities',
      icon: '📌',
      color: 'bg-teal-50 border-teal-200',
    },
    {
      title: 'Performance',
      description: 'Metricas de rendimiento individual y evaluaciones periodicas.',
      href: '/workforce/performance',
      icon: '📊',
      color: 'bg-orange-50 border-orange-200',
    },
  ];

  return (
    <RequirePermission permissions={['workforce.view_attendance', 'workforce.view_shifts']}>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gestion Laboral</h1>
        <p className="mt-1 text-slate-500">
          Administra turnos, asistencia, responsabilidades y rendimiento de tu equipo.
        </p>
      </div>

      {/* Today's Attendance Summary */}
      {summary && !loading && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Asistencia Hoy - {new Date(summary.date).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{summary.total_employees}</div>
              <div className="text-sm text-slate-500">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.present}</div>
              <div className="text-sm text-slate-500">Presentes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{summary.absent}</div>
              <div className="text-sm text-slate-500">Ausentes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{summary.late}</div>
              <div className="text-sm text-slate-500">Tarde</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-400">{summary.not_logged}</div>
              <div className="text-sm text-slate-500">Sin Registrar</div>
            </div>
          </div>
        </div>
      )}

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`block p-6 rounded-lg border ${card.color} hover:shadow-md transition-shadow`}
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{card.icon}</span>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{card.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
    </RequirePermission>
  );
}
