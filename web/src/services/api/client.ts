/* ═══════════════════════════════════════════
   FeedbackHub API — Client & Auth Helpers
   =========================================== */

export const API_BASE = '/v1';
export const DEV_API_BASE = '/v1/dev';

/* ── Error handling ── */
export async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body?.error || body?.message || response.statusText || 'Unknown error';
  } catch {
    try {
      const text = await response.clone().text();
      if (text) return text.slice(0, 200);
    } catch {
      // ignore text fallback failures
    }
    return response.statusText || `HTTP ${response.status}`;
  }
}

/* ── Reporter Identity ── */
interface ReporterIdentity {
  id: string;
}

function getReporterIdentity(): ReporterIdentity {
  const STORAGE_KEY = 'feedback_reporter_id';
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return { id };
}

export function buildReporterHeaders(): Record<string, string> {
  const identity = getReporterIdentity();
  return {
    'X-Reporter-Id': identity.id,
  };
}

/* ── Developer API Key ── */
const DEV_API_KEY_STORAGE = 'feedback_dev_api_key';

export function getDevApiKey(): string | null {
  return localStorage.getItem(DEV_API_KEY_STORAGE);
}

export function setDevApiKey(key: string): void {
  localStorage.setItem(DEV_API_KEY_STORAGE, key);
}

export function clearDevApiKey(): void {
  localStorage.removeItem(DEV_API_KEY_STORAGE);
}

export function buildDevAuthHeaders(): Record<string, string> {
  const key = getDevApiKey();
  if (!key) return {};
  return { 'X-API-Key': key };
}

/* ── Dev API Fetch ── */
export async function devApiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = {
    ...options.headers,
    ...buildDevAuthHeaders(),
  };
  return fetch(url, { ...options, headers });
}
