/* ═══════════════════════════════════════════
   FeedbackHub API — Response Template Endpoints
   =========================================== */

import { DEV_API_BASE, extractErrorMessage, devApiFetch } from './client';
import type { ResponseTemplateRow, CreateTemplateRequest, UpdateTemplateRequest } from './types';

export async function listResponseTemplates(): Promise<ResponseTemplateRow[]> {
  const response = await devApiFetch(`${DEV_API_BASE}/response-templates`, { method: 'GET' });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

export async function createResponseTemplate(data: CreateTemplateRequest): Promise<ResponseTemplateRow> {
  const response = await devApiFetch(`${DEV_API_BASE}/response-templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

export async function updateResponseTemplate(id: string, data: UpdateTemplateRequest): Promise<ResponseTemplateRow> {
  const response = await devApiFetch(`${DEV_API_BASE}/response-templates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}

export async function deleteResponseTemplate(id: string): Promise<{ message: string }> {
  const response = await devApiFetch(`${DEV_API_BASE}/response-templates/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await extractErrorMessage(response));
  return response.json();
}
