/**
 * Telegram Alerts admin page — superuser only.
 *
 * Lists every active user with their Telegram link state and active
 * subscription count. Lets the superuser link/unlink a user's chat_id and
 * edit their subscription set inline.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Edit3,
  Loader2,
  Save,
  Search,
  Send,
  Unlink,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import Layout from '../components/Layout';
import telegramAlertsService from '../services/telegramAlertsService';
import { useAuthStore } from '../stores/authStore';
import type {
  AlertTypeInfo,
  TelegramAlertCategory,
  TelegramAlertType,
  UserTelegramInfo,
} from '../types/api';

const CATEGORY_LABEL: Record<TelegramAlertCategory, string> = {
  event: 'Eventos',
  reminder: 'Recordatorios',
  system: 'Sistema',
};

export default function TelegramAlertsAdmin() {
  const { user: currentUser } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserTelegramInfo[]>([]);
  const [alertTypes, setAlertTypes] = useState<AlertTypeInfo[]>([]);
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<string | null>(null);
  const [chatIdInput, setChatIdInput] = useState('');
  const [editSelected, setEditSelected] = useState<Set<TelegramAlertType>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [types, list] = await Promise.all([
        telegramAlertsService.listAlertTypes(),
        telegramAlertsService.listUsersTelegram(),
      ]);
      setAlertTypes(types);
      setUsers(list);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      toast.error(detail || 'Error cargando usuarios');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.full_name?.toLowerCase().includes(q) ?? false),
    );
  }, [users, search]);

  const groupedTypes = useMemo(() => {
    const buckets: Record<TelegramAlertCategory, AlertTypeInfo[]> = {
      event: [],
      reminder: [],
      system: [],
    };
    for (const t of alertTypes) buckets[t.category].push(t);
    return buckets;
  }, [alertTypes]);

  const startEdit = (u: UserTelegramInfo) => {
    setEditing(u.user_id);
    setChatIdInput(u.telegram_chat_id || '');
    setEditSelected(
      new Set(u.subscriptions.filter((s) => s.is_active).map((s) => s.alert_type)),
    );
  };

  const cancelEdit = () => {
    setEditing(null);
    setChatIdInput('');
    setEditSelected(new Set());
  };

  const toggleEditAlert = (alert_type: TelegramAlertType) => {
    setEditSelected((prev) => {
      const next = new Set(prev);
      if (next.has(alert_type)) next.delete(alert_type);
      else next.add(alert_type);
      return next;
    });
  };

  const handleSaveEdit = async (u: UserTelegramInfo) => {
    setSaving(true);
    try {
      const trimmedChatId = chatIdInput.trim();
      const justLinked = !u.is_linked && !!trimmedChatId;
      let updated: UserTelegramInfo = u;

      if (trimmedChatId && trimmedChatId !== u.telegram_chat_id) {
        updated = await telegramAlertsService.adminLinkTelegram(u.user_id, trimmedChatId);
      }

      // Only push subscription changes for users who were already linked.
      // Newly-linked users get role-based defaults from the backend; the admin
      // can re-open the editor to adjust them on a separate save.
      if (updated.is_linked && !justLinked) {
        updated = await telegramAlertsService.adminUpdateSubscriptions(
          u.user_id,
          Array.from(editSelected),
        );
      }

      setUsers((prev) => prev.map((x) => (x.user_id === u.user_id ? updated : x)));
      toast.success(justLinked ? 'Usuario vinculado con suscripciones por defecto' : 'Usuario actualizado');
      cancelEdit();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      toast.error(detail || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async (u: UserTelegramInfo) => {
    if (!confirm(`Desvincular Telegram de ${u.username}?`)) return;
    try {
      await telegramAlertsService.adminUnlinkTelegram(u.user_id);
      setUsers((prev) =>
        prev.map((x) =>
          x.user_id === u.user_id
            ? { ...x, is_linked: false, telegram_chat_id: null, subscriptions: [] }
            : x,
        ),
      );
      toast.success('Telegram desvinculado');
      if (editing === u.user_id) cancelEdit();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      toast.error(detail || 'No se pudo desvincular');
    }
  };

  if (!currentUser?.is_superuser) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center text-red-700">
          <AlertCircle className="w-5 h-5 mr-2" />
          Acceso restringido a superusuarios.
        </div>
      </Layout>
    );
  }

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
          Alertas Telegram — Administración
        </h1>
        <p className="text-stone-600 mt-1">
          Vincula y administra suscripciones de cada usuario.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por usuario o nombre…"
            className="w-full pl-10 pr-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">chat_id</th>
              <th className="px-4 py-3 font-medium">Suscripciones</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                  No hay usuarios para mostrar.
                </td>
              </tr>
            )}
            {filtered.map((u) => {
              const activeCount = u.subscriptions.filter((s) => s.is_active).length;
              const isEditing = editing === u.user_id;
              return (
                <Fragment key={u.user_id}>
                  <tr className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-stone-800">{u.username}</div>
                      {u.full_name && (
                        <div className="text-xs text-stone-500">{u.full_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.is_linked ? (
                        <span className="inline-flex items-center text-green-700 text-xs font-medium">
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Vinculado
                        </span>
                      ) : (
                        <span className="text-stone-400 text-xs">No vinculado</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-600">
                      {u.telegram_chat_id || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-stone-700">
                        {activeCount} / {alertTypes.length}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isEditing && (
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => startEdit(u)}
                            className="px-2 py-1 text-stone-600 hover:bg-stone-100 rounded transition flex items-center text-xs"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1" />
                            Editar
                          </button>
                          {u.is_linked && (
                            <button
                              onClick={() => handleUnlink(u)}
                              className="px-2 py-1 text-red-600 hover:bg-red-50 rounded transition flex items-center text-xs"
                            >
                              <Unlink className="w-3.5 h-3.5 mr-1" />
                              Desvincular
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="bg-blue-50/40">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="mb-4">
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            chat_id
                          </label>
                          <input
                            type="text"
                            value={chatIdInput}
                            onChange={(e) => setChatIdInput(e.target.value)}
                            placeholder="Ej: 123456789"
                            className="w-full max-w-xs px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent text-sm"
                          />
                        </div>

                        {(['event', 'reminder', 'system'] as TelegramAlertCategory[]).map(
                          (cat) => {
                            const items = groupedTypes[cat];
                            if (items.length === 0) return null;
                            return (
                              <div key={cat} className="mb-3">
                                <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">
                                  {CATEGORY_LABEL[cat]}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {items.map((info) => (
                                    <label
                                      key={info.alert_type}
                                      className="flex items-center text-sm text-stone-700 hover:bg-white px-2 py-1 rounded cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={editSelected.has(info.alert_type)}
                                        onChange={() => toggleEditAlert(info.alert_type)}
                                        className="w-4 h-4 text-brand-600 mr-2"
                                      />
                                      <span className="truncate">{info.description}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          },
                        )}

                        <div className="flex justify-end gap-2 mt-3">
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1.5 text-sm text-stone-600 hover:text-stone-800 transition flex items-center"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleSaveEdit(u)}
                            disabled={saving}
                            className="px-3 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition flex items-center disabled:opacity-50"
                          >
                            {saving ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4 mr-1" />
                            )}
                            Guardar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
