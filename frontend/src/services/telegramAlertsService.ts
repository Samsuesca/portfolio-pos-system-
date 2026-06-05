/**
 * Telegram Alerts Service - link, unlink, and manage subscriptions
 */
import apiClient from '../utils/api-client';
import type {
  AlertTypeInfo,
  MyTelegramSubscriptions,
  TelegramAlertType,
  TelegramLinkRequest,
  TelegramUpdateSubscriptionsRequest,
  UserTelegramInfo,
} from '../types/api';

const BASE = '/telegram-alerts';

export const telegramAlertsService = {
  async listAlertTypes(): Promise<AlertTypeInfo[]> {
    const response = await apiClient.get<AlertTypeInfo[]>(`${BASE}/alert-types`);
    return response.data;
  },

  async getMySubscriptions(): Promise<MyTelegramSubscriptions> {
    const response = await apiClient.get<MyTelegramSubscriptions>(`${BASE}/my-subscriptions`);
    return response.data;
  },

  async updateMySubscriptions(alert_types: TelegramAlertType[]): Promise<MyTelegramSubscriptions> {
    const body: TelegramUpdateSubscriptionsRequest = { alert_types };
    const response = await apiClient.put<MyTelegramSubscriptions>(
      `${BASE}/my-subscriptions`,
      body,
    );
    return response.data;
  },

  async linkTelegram(chat_id: string): Promise<MyTelegramSubscriptions> {
    const body: TelegramLinkRequest = { chat_id };
    const response = await apiClient.post<MyTelegramSubscriptions>(`${BASE}/link`, body);
    return response.data;
  },

  async unlinkTelegram(): Promise<void> {
    await apiClient.delete(`${BASE}/unlink`);
  },

  // ── Admin (superuser) ──────────────────────────────────────────
  async listUsersTelegram(): Promise<UserTelegramInfo[]> {
    const response = await apiClient.get<UserTelegramInfo[]>(`${BASE}/users`);
    return response.data;
  },

  async adminUpdateSubscriptions(
    user_id: string,
    alert_types: TelegramAlertType[],
  ): Promise<UserTelegramInfo> {
    const body: TelegramUpdateSubscriptionsRequest = { alert_types };
    const response = await apiClient.put<UserTelegramInfo>(
      `${BASE}/users/${user_id}/subscriptions`,
      body,
    );
    return response.data;
  },

  async adminLinkTelegram(user_id: string, chat_id: string): Promise<UserTelegramInfo> {
    const body: TelegramLinkRequest = { chat_id };
    const response = await apiClient.put<UserTelegramInfo>(`${BASE}/users/${user_id}/link`, body);
    return response.data;
  },

  async adminUnlinkTelegram(user_id: string): Promise<void> {
    await apiClient.delete(`${BASE}/users/${user_id}/unlink`);
  },
};

export default telegramAlertsService;
