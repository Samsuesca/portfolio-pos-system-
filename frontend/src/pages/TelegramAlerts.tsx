/**
 * Telegram Alerts page — current user view.
 *
 * Lets the user link/unlink their Telegram chat_id and toggle which alert
 * types they want to receive. Subscriptions are grouped by category
 * (event / reminder / system) for scannability.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  Save,
  Send,
  Shield,
  Unlink,
} from 'lucide-react';
import toast from 'react-hot-toast';

import Layout from '../components/Layout';
import telegramAlertsService from '../services/telegramAlertsService';
import type {
  AlertTypeInfo,
  TelegramAlertCategory,
  TelegramAlertType,
  TelegramSubscription,
} from '../types/api';

const CATEGORY_LABEL: Record<TelegramAlertCategory, string> = {
  event: 'Eventos',
  reminder: 'Recordatorios',
  system: 'Sistema y resumen',
};

const CATEGORY_ICON: Record<TelegramAlertCategory, typeof Bell> = {
  event: Bell,
  reminder: Clock,
  system: Shield,
};

export default function TelegramAlerts() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const [isLinked, setIsLinked] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatIdInput, setChatIdInput] = useState('');

  const [alertTypes, setAlertTypes] = useState<AlertTypeInfo[]>([]);
  const [subscriptions, setSubscriptions] = useState<TelegramSubscription[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [types, mine] = await Promise.all([
        telegramAlertsService.listAlertTypes(),
        telegramAlertsService.getMySubscriptions(),
      ]);
      setAlertTypes(types);
      applyMine(mine);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      toast.error(detail || 'Error cargando alertas Telegram');
    } finally {
      setLoading(false);
    }
  };

  const applyMine = (mine: {
    is_linked: boolean;
    telegram_chat_id: string | null;
    subscriptions: TelegramSubscription[];
  }) => {
    setIsLinked(mine.is_linked);
    setChatId(mine.telegram_chat_id);
    setSubscriptions(mine.subscriptions);
  };

  const grouped = useMemo(() => {
    const subsByType = new Map<TelegramAlertType, boolean>(
      subscriptions.map((s) => [s.alert_type, s.is_active]),
    );
    const buckets: Record<TelegramAlertCategory, AlertTypeInfo[]> = {
      event: [],
      reminder: [],
      system: [],
    };
    for (const t of alertTypes) {
      buckets[t.category].push(t);
    }
    return { buckets, subsByType };
  }, [alertTypes, subscriptions]);

  const handleToggle = (alert_type: TelegramAlertType) => {
    if (!isLinked) return;
    setSubscriptions((prev) => {
      const exists = prev.some((s) => s.alert_type === alert_type);
      if (exists) {
        return prev.map((s) =>
          s.alert_type === alert_type ? { ...s, is_active: !s.is_active } : s,
        );
      }
      const info = alertTypes.find((a) => a.alert_type === alert_type);
      return [
        ...prev,
        {
          alert_type,
          description: info?.description || alert_type,
          is_active: true,
        },
      ];
    });
  };

  const handleLink = async () => {
    const trimmed = chatIdInput.trim();
    if (!trimmed) {
      toast.error('Ingresa tu chat_id de Telegram');
      return;
    }
    setLinking(true);
    try {
      const result = await telegramAlertsService.linkTelegram(trimmed);
      applyMine(result);
      setChatIdInput('');
      toast.success('Telegram vinculado correctamente');
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      toast.error(detail || 'No se pudo vincular Telegram');
    } finally {
      setLinking(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only send alert types the backend offered this user; drops any
      // admin-only subscription left over from a previous, higher role.
      const allowed = new Set(alertTypes.map((t) => t.alert_type));
      const active = subscriptions
        .filter((s) => s.is_active && allowed.has(s.alert_type))
        .map((s) => s.alert_type);
      const result = await telegramAlertsService.updateMySubscriptions(active);
      applyMine(result);
      toast.success('Suscripciones actualizadas');
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      toast.error(detail || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Desvincular Telegram eliminará todas tus suscripciones. ¿Continuar?')) {
      return;
    }
    setUnlinking(true);
    try {
      await telegramAlertsService.unlinkTelegram();
      setIsLinked(false);
      setChatId(null);
      setSubscriptions([]);
      toast.success('Telegram desvinculado');
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      toast.error(detail || 'No se pudo desvincular');
    } finally {
      setUnlinking(false);
    }
  };

  const copyChatId = async () => {
    if (!chatId) return;
    try {
      await navigator.clipboard.writeText(chatId);
      toast.success('chat_id copiado');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800 flex items-center">
          <Send className="w-6 h-6 text-blue-600 mr-2" />
          Alertas Telegram
        </h1>
        <p className="text-stone-600 mt-1">
          Recibe notificaciones del sistema en tu Telegram personal.
        </p>
      </div>

      {!isLinked ? (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center mb-4">
            <LinkIcon className="w-5 h-5 text-brand-600 mr-2" />
            <h2 className="text-lg font-semibold text-stone-800">Vincula tu Telegram</h2>
          </div>

          <ol className="text-sm text-stone-700 space-y-2 mb-4 list-decimal pl-5">
            <li>
              Abre Telegram y busca el bot{' '}
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:underline inline-flex items-center"
              >
                @userinfobot <ExternalLink className="w-3 h-3 ml-1" />
              </a>
              .
            </li>
            <li>Envíale cualquier mensaje (por ejemplo <code>/start</code>).</li>
            <li>El bot responde con tu información — copia el número que dice "Id".</li>
            <li>Pega ese número aquí abajo y vincula.</li>
            <li>
              Después abre el bot del sistema y envíale <code>/start</code> para que
              pueda escribirte.
            </li>
          </ol>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={chatIdInput}
              onChange={(e) => setChatIdInput(e.target.value)}
              placeholder="Ej: 123456789"
              className="flex-1 px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent"
            />
            <button
              onClick={handleLink}
              disabled={linking}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition flex items-center justify-center disabled:opacity-50"
            >
              {linking ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LinkIcon className="w-4 h-4 mr-2" />
              )}
              Vincular
            </button>
          </div>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-start">
            <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
            <span>
              Al vincular se crearán suscripciones por defecto según tu rol. Puedes
              ajustarlas después.
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-4 gap-2 flex-wrap">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-stone-800">Telegram vinculado</h2>
                <div className="text-sm text-stone-600 flex items-center gap-2">
                  <span>chat_id:</span>
                  <code className="px-1.5 py-0.5 bg-stone-100 rounded text-xs">{chatId}</code>
                  <button
                    onClick={copyChatId}
                    className="text-stone-400 hover:text-stone-600"
                    title="Copiar chat_id"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={handleUnlink}
              disabled={unlinking}
              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition flex items-center disabled:opacity-50"
            >
              {unlinking ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Unlink className="w-4 h-4 mr-1.5" />
              )}
              Desvincular
            </button>
          </div>
        </div>
      )}

      {isLinked && (
        <>
          {(['event', 'reminder', 'system'] as TelegramAlertCategory[]).map((cat) => {
            const items = grouped.buckets[cat];
            if (items.length === 0) return null;
            const Icon = CATEGORY_ICON[cat];
            return (
              <div key={cat} className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <div className="flex items-center mb-4">
                  <Icon className="w-5 h-5 text-brand-600 mr-2" />
                  <h2 className="text-lg font-semibold text-stone-800">
                    {CATEGORY_LABEL[cat]}
                  </h2>
                </div>
                <div className="divide-y divide-stone-100">
                  {items.map((info) => {
                    const active = grouped.subsByType.get(info.alert_type) ?? false;
                    return (
                      <label
                        key={info.alert_type}
                        className="flex items-center justify-between py-3 cursor-pointer hover:bg-stone-50 -mx-2 px-2 rounded"
                      >
                        <div className="flex-1 pr-4">
                          <div className="text-sm font-medium text-stone-800">
                            {info.description}
                          </div>
                          <div className="text-xs text-stone-500 font-mono mt-0.5">
                            {info.alert_type}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => handleToggle(info.alert_type)}
                          className="w-5 h-5 text-brand-600 rounded"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex justify-end sticky bottom-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg shadow-md transition flex items-center disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar cambios
            </button>
          </div>
        </>
      )}
    </Layout>
  );
}
