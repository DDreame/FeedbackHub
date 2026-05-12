/* ═══════════════════════════════════════════
   FeedbackHub API — Message Endpoints
   =========================================== */

import { API_BASE, DEV_API_BASE, extractErrorMessage, buildReporterHeaders, devApiFetch } from './client';
import type { MessageResponse, DevMessageResponse, AddMessageRequest, AddReplyRequest, AddInternalNoteRequest } from './types';

/* ── Reporter: list messages ── */
export async function listMessages(threadId: string): Promise<MessageResponse[]> {
  const response = await fetch(`${API_BASE}/feedback/threads/${threadId}/messages`, {
    method: 'GET', headers: buildReporterHeaders(),
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

/* ── Reporter: add message ── */
export async function addMessage(
  threadId: string,
  body: string,
  authorType: 'reporter' | 'developer' | 'system' = 'reporter'
): Promise<MessageResponse> {
  const response = await fetch(`${API_BASE}/feedback/threads/${threadId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...buildReporterHeaders() },
    body: JSON.stringify({ author_type: authorType, body } as AddMessageRequest),
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

/* ── Developer: list messages (includes internal notes) ── */
export async function devListMessages(threadId: string): Promise<DevMessageResponse[]> {
  const response = await devApiFetch(`${DEV_API_BASE}/feedback/threads/${threadId}/messages`, { method: 'GET' });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

/* ── Developer: add reply ── */
export async function devAddReply(
  threadId: string,
  body: string,
  attachments?: string[]
): Promise<DevMessageResponse> {
  const response = await devApiFetch(`${DEV_API_BASE}/feedback/threads/${threadId}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, attachments } as AddReplyRequest),
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

/* ── Developer: add internal note ── */
export async function devAddInternalNote(
  threadId: string,
  body: string,
  attachments?: string[]
): Promise<DevMessageResponse> {
  const response = await devApiFetch(`${DEV_API_BASE}/feedback/threads/${threadId}/internal-note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, attachments } as AddInternalNoteRequest),
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}
