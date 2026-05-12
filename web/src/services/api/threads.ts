/* ═══════════════════════════════════════════
   FeedbackHub API — Thread Endpoints
   =========================================== */

import { API_BASE, DEV_API_BASE, extractErrorMessage, buildReporterHeaders, devApiFetch } from './client';
import type {
  CreateThreadRequest, CreateThreadResponse,
  CreateThreadAtomicRequest, CreateThreadAtomicResponse,
  ThreadResponse, PaginatedThreadsResponse, ThreadFilterParams,
  DeveloperThreadResponse, DevPaginatedThreadsResponse, DevThreadFilterParams,
  UpdateStatusRequest, ContextSnapshotInput,
} from './types';

/* ── Reporter: create thread ── */
export async function createThread(
  category: string,
  summary: string,
  reporterContact?: string,
  context?: Partial<ContextSnapshotInput>
): Promise<CreateThreadResponse> {
  const STORAGE_KEY = 'feedback_reporter_id';
  let reporterId = localStorage.getItem(STORAGE_KEY);
  if (!reporterId) { reporterId = crypto.randomUUID(); localStorage.setItem(STORAGE_KEY, reporterId); }

  const response = await fetch(`${API_BASE}/feedback/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...buildReporterHeaders() },
    body: JSON.stringify({
      reporter_id: reporterId,
      reporter_contact: reporterContact,
      category,
      summary,
      context: {
        app_version: context?.app_version || '1.0.0',
        build_number: context?.build_number,
        os_name: context?.os_name || 'Unknown',
        os_version: context?.os_version || 'Unknown',
        device_model: context?.device_model || 'Unknown',
        locale: context?.locale,
        current_route: context?.current_route || window.location.pathname,
        reporter_account_id: context?.reporter_account_id,
      },
    } as CreateThreadRequest),
  });

  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

/* ── Reporter: create thread atomic ── */
export async function createThreadAtomic(
  category: string,
  summary: string,
  initialMessage: string,
  reporterContact?: string,
  context?: Partial<ContextSnapshotInput>,
  attachments?: string[],
  notificationEmail?: string
): Promise<CreateThreadAtomicResponse> {
  const STORAGE_KEY = 'feedback_reporter_id';
  let reporterId = localStorage.getItem(STORAGE_KEY);
  if (!reporterId) { reporterId = crypto.randomUUID(); localStorage.setItem(STORAGE_KEY, reporterId); }

  const response = await fetch(`${API_BASE}/feedback/threads/atomic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...buildReporterHeaders() },
    body: JSON.stringify({
      reporter_id: reporterId,
      reporter_contact: reporterContact,
      category, summary,
      initial_message: initialMessage,
      attachments: attachments || [],
      notification_email: notificationEmail,
      context: {
        app_version: context?.app_version || '1.0.0',
        build_number: context?.build_number,
        os_name: context?.os_name || 'Unknown',
        os_version: context?.os_version || 'Unknown',
        device_model: context?.device_model || 'Unknown',
        locale: context?.locale,
        current_route: context?.current_route || window.location.pathname,
        reporter_account_id: context?.reporter_account_id,
      },
    } as CreateThreadAtomicRequest),
  });

  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

/* ── Reporter: list my threads ── */
export async function listMyThreads(
  appKey?: string,
  filters?: Omit<ThreadFilterParams, 'app_key'>
): Promise<PaginatedThreadsResponse> {
  const params = new URLSearchParams();
  if (appKey) params.set('app_key', appKey);
  if (filters?.keyword) params.set('keyword', filters.keyword);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.created_after) params.set('created_after', filters.created_after);
  if (filters?.created_before) params.set('created_before', filters.created_before);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.page_size) params.set('page_size', String(filters.page_size));

  const url = `${API_BASE}/feedback/threads${params.size > 0 ? `?${params.toString()}` : ''}`;
  const response = await fetch(url, { method: 'GET', headers: buildReporterHeaders() });

  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

/* ── Reporter: get single thread ── */
export async function getThread(threadId: string): Promise<ThreadResponse> {
  const response = await fetch(`${API_BASE}/feedback/threads/${threadId}`, {
    method: 'GET', headers: buildReporterHeaders(),
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

/* ── Reporter: delete thread (soft delete) ── */
export async function deleteThread(threadId: string): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/feedback/threads/${threadId}`, {
    method: 'DELETE', headers: buildReporterHeaders(),
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

/* ── Developer: list threads ── */
export async function devListThreads(
  filters?: DevThreadFilterParams
): Promise<DevPaginatedThreadsResponse> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.assignee_id) params.set('assignee_id', filters.assignee_id);
  if (filters?.keyword) params.set('keyword', filters.keyword);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));

  const url = `${DEV_API_BASE}/feedback/threads${params.size > 0 ? `?${params.toString()}` : ''}`;
  const response = await devApiFetch(url, { method: 'GET' });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

/* ── Developer: get single thread ── */
export async function devGetThread(threadId: string): Promise<DeveloperThreadResponse> {
  const response = await devApiFetch(`${DEV_API_BASE}/feedback/threads/${threadId}`, { method: 'GET' });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

/* ── Developer: update status ── */
export async function devUpdateStatus(threadId: string, status: string): Promise<DeveloperThreadResponse> {
  const response = await devApiFetch(`${DEV_API_BASE}/feedback/threads/${threadId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status } as UpdateStatusRequest),
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

/* ── Developer: bulk update status ── */
export async function devBulkUpdateStatus(
  threadIds: string[],
  status: string
): Promise<{ updated: number; failed: string[] }> {
  const results = await Promise.allSettled(threadIds.map((id) => devUpdateStatus(id, status)));
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? threadIds[i] : null))
    .filter((id): id is string => id !== null);
  return { updated: results.filter((r) => r.status === 'fulfilled').length, failed };
}

/* ── Developer: assign ── */
export async function devAssign(threadId: string, assigneeId: string): Promise<{ status: string }> {
  const response = await devApiFetch(`${DEV_API_BASE}/feedback/threads/${threadId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignee_id: assigneeId }),
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

/* ── Developer: unassign ── */
export async function devUnassign(threadId: string): Promise<{ status: string }> {
  const response = await devApiFetch(`${DEV_API_BASE}/feedback/threads/${threadId}/assign`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}
