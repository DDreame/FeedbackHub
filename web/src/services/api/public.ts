/* ═══════════════════════════════════════════
   FeedbackHub API — Public Endpoints (no auth)
   =========================================== */

import { API_BASE, extractErrorMessage } from './client';
import type { PublicStatusResponse } from './types';

export async function getPublicThreadStatus(threadId: string): Promise<PublicStatusResponse> {
  const response = await fetch(`${API_BASE}/public/threads/${threadId}/status`, { method: 'GET' });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}
