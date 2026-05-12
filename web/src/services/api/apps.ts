/* ═══════════════════════════════════════════
   FeedbackHub API — App Endpoints
   =========================================== */

import { API_BASE, extractErrorMessage, buildReporterHeaders } from './client';
import type { AppResponse, CreateAppRequest } from './types';

export async function listApps(): Promise<AppResponse[]> {
  const response = await fetch(`${API_BASE}/feedback/apps`, {
    method: 'GET', headers: buildReporterHeaders(),
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

export async function createApp(data: CreateAppRequest): Promise<AppResponse> {
  const response = await fetch(`${API_BASE}/feedback/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...buildReporterHeaders() },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}
