/**
 * Notifications Settings Card
 * Toggles for different notification types.
 */
import React from 'react';
import { Bell } from 'lucide-react';

const SettingsNotificationsCard: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center mb-4">
        <Bell className="w-5 h-5 text-yellow-600 mr-2" />
        <h2 className="text-lg font-semibold text-stone-800">Notificaciones</h2>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-700">Stock bajo</span>
          <input type="checkbox" className="w-4 h-4 text-brand-600" defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-700">Nuevas ventas</span>
          <input type="checkbox" className="w-4 h-4 text-brand-600" defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-700">Encargos listos</span>
          <input type="checkbox" className="w-4 h-4 text-brand-600" defaultChecked />
        </div>
      </div>
    </div>
  );
};

export default React.memo(SettingsNotificationsCard);
