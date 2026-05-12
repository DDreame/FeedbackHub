/* ═══════════════════════════════════════════
   FeedbackHub API — Tag Endpoints
   =========================================== */

import { DEV_API_BASE, extractErrorMessage, devApiFetch } from './client';
import type { TagResponse, CreateTagRequest } from './types';

export async function devListTags(): Promise<TagResponse[]> {
  const response = await devApiFetch(`${DEV_API_BASE}/tags`, { method: 'GET' });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

export async function devCreateTag(data: CreateTagRequest): Promise<TagResponse> {
  const response = await devApiFetch(`${DEV_API_BASE}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

export async function devDeleteTag(tagId: string): Promise<{ message: string }> {
  const response = await devApiFetch(`${DEV_API_BASE}/tags/${tagId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

export async function devListThreadTags(threadId: string): Promise<TagResponse[]> {
  const response = await devApiFetch(`${DEV_API_BASE}/feedback/threads/${threadId}/tags`, { method: 'GET' });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

export async function devAddTagToThread(threadId: string, tagId: string): Promise<{ message: string }> {
  const response = await devApiFetch(`${DEV_API_BASE}/feedback/threads/${threadId}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag_id: tagId }),
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

export async function devRemoveTagFromThread(threadId: string, tagId: string): Promise<{ message: string }> {
  const response = await devApiFetch(`${DEV_API_BASE}/feedback/threads/${threadId}/tags/${tagId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}
