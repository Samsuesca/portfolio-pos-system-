/**
 * Telegram Alerts Settings Card — entry point to /alertas-telegram.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Send, Users } from 'lucide-react';

import telegramAlertsService from '../../services/telegramAlertsService';
import { useAuthStore } from '../../stores/authStore';

const SettingsTelegramCard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [isLinked, setIsLinked] = useState(false);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    telegramAlertsService
      .getMySubscriptions()
      .then((mine) => {
        if (cancelled) return;
        setIsLinked(mine.is_linked);
        setActiveCount(mine.subscriptions.filter((s) => s.is_active).length);
      })
      .catch(() => {
        // Silent: card just shows "no vinculado" state on failure.
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center mb-4">
        <Send className="w-5 h-5 text-blue-600 mr-2" />
        <h2 className="text-lg font-semibold text-stone-800">Alertas Telegram</h2>
      </div>

      <p className="text-sm text-stone-600 mb-4">
        Recibe notificaciones del sistema (ventas, pedidos, recordatorios) en tu
        Telegram personal.
      </p>

      <div className="text-sm mb-4 min-h-[1.25rem]">
        {loading ? (
          <span className="text-stone-400 inline-flex items-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
            Cargando…
          </span>
        ) : isLinked ? (
          <span className="text-green-700">
            Vinculado · <strong>{activeCount}</strong> suscripciones activas
          </span>
        ) : (
          <span className="text-stone-500">No vinculado</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => navigate('/alertas-telegram')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center"
        >
          {isLinked ? 'Administrar' : 'Vincular Telegram'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </button>

        {user?.is_superuser && (
          <button
            onClick={() => navigate('/admin/alertas-telegram')}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg transition flex items-center"
          >
            <Users className="w-4 h-4 mr-2" />
            Gestionar usuarios
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(SettingsTelegramCard);
