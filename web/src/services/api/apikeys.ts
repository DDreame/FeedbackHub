/* ═══════════════════════════════════════════
   FeedbackHub API — API Key Endpoints
   =========================================== */

import { DEV_API_BASE, extractErrorMessage, devApiFetch } from './client';
import type { ApiKeyRow } from './types';

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const response = await devApiFetch(`${DEV_API_BASE}/api-keys`, { method: 'GET' });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

export async function revokeApiKey(keyId: string): Promise<{ message: string }> {
  const response = await devApiFetch(`${DEV_API_BASE}/api-keys/${keyId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}
