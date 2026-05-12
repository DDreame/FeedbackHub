/* ═══════════════════════════════════════════
   FeedbackHub API — Notification Preferences
   =========================================== */

import { API_BASE, extractErrorMessage, buildReporterHeaders } from './client';
import type { NotificationPrefs, UpdateNotificationPrefsRequest } from './types';

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const response = await fetch(`${API_BASE}/feedback/notification-preferences`, {
    method: 'GET', headers: buildReporterHeaders(),
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

export async function updateNotificationPrefs(data: UpdateNotificationPrefsRequest): Promise<NotificationPrefs> {
  const response = await fetch(`${API_BASE}/feedback/notification-preferences`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...buildReporterHeaders() },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}
