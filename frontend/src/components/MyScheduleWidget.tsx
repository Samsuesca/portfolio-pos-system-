import { useState, useEffect } from 'react';
import workforceService, { Schedule } from '../services/workforceService';
import { getColombiaDateString, getColombiaNow } from '../utils/formatting';

interface Props {
  employeeId: string;
}

export default function MyScheduleWidget({ employeeId }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = getColombiaNow();
        const endDate = getColombiaNow();
        endDate.setDate(today.getDate() + 6);
        const data = await workforceService.getEmployeeSchedule(
          employeeId,
          getColombiaDateString(),
          endDate.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
        );
        setSchedules(data);
      } catch {
        // No schedule data
      } finally {
        setLoading(false);
      }
    };
    if (employeeId) load();
  }, [employeeId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Mi Horario</h3>
        <p className="text-sm text-slate-400">Cargando...</p>
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Mi Horario</h3>
        <p className="text-sm text-slate-400">Sin horarios programados esta semana.</p>
      </div>
    );
  }

  const dayNames: Record<number, string> = {
    0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb',
  };

  const today = getColombiaDateString();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Mi Horario - Próximos 7 días</h3>
      <div className="space-y-2">
        {schedules.map((s) => {
          const date = new Date(s.schedule_date + 'T12:00:00');
          const isToday = s.schedule_date === today;
          return (
            <div
              key={s.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                isToday ? 'bg-brand-50 border border-brand-200' : 'bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`font-medium ${isToday ? 'text-brand-700' : 'text-slate-700'}`}>
                  {dayNames[date.getDay()]} {date.getDate()}
                </span>
                {isToday && (
                  <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                    Hoy
                  </span>
                )}
              </div>
              <span className="text-slate-600">
                {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
