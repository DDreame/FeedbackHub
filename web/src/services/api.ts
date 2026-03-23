// API service for feedback system
// Backend base URL - per #t6 contract, all endpoints are under /v1
const API_BASE = '/v1';

export interface ContextSnapshotInput {
  app_version: string;
  build_number?: string;
  os_name: string;
  os_version: string;
  device_model: string;
  locale?: string;
  current_route: string;
  reporter_account_id?: string;
}

export interface CreateThreadRequest {
  reporter_id: string;
  reporter_contact?: string;
  category: string;
  summary: string;
  context: ContextSnapshotInput;
}

export interface CreateThreadResponse {
  id: string;
}

export interface CreateThreadAtomicRequest {
  reporter_id: string;
  reporter_contact?: string;
  category: string;
  summary: string;
  context: ContextSnapshotInput;
  initial_message?: string;
  attachments?: string[];
  notification_email?: string;
}

export interface CreateThreadAtomicResponse {
  thread_id: string;
  message_id?: string;
}

export interface ThreadResponse {
  id: string;
  reporter_id: string;
  reporter_contact?: string;
  category: string;
  status: string;
  summary: string;
  latest_public_message_at: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  context: {
    app_version: string;
    build_number?: string;
    os_name: string;
    os_version: string;
    device_model: string;
    locale?: string;
    current_route: string;
    captured_at: string;
    reporter_account_id?: string;
  };
}

export interface MessageResponse {
  id: string;
  thread_id: string;
  author_type: 'reporter' | 'developer' | 'system';
  body: string;
  created_at: string;
  attachments?: string[];
}

export interface AddMessageRequest {
  author_type: 'reporter' | 'developer' | 'system';
  body: string;
}

// Status mapping for display
export const STATUS_LABELS: Record<string, string> = {
  received: '已收到',
  in_review: '处理中',
  waiting_for_user: '待补充信息',
  closed: '已关闭',
  deleted: '已删除',
};

// Category mapping for display
export const CATEGORY_LABELS: Record<string, string> = {
  '遇到问题': '遇到问题',
  '想提建议': '想提建议',
  '想问一下': '想问一下',
  '其他': '其他',
};

// ---------------------------------------------------------------------------
// Reporter Identity Adapter
// This layer abstracts reporter authentication.
// In production, this would integrate with your auth system.
// For dev, we use a placeholder that can be replaced later.
// ---------------------------------------------------------------------------

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

function buildReporterHeaders(): Record<string, string> {
  const identity = getReporterIdentity();
  return {
    'X-Reporter-Id': identity.id,
  };
}

// ---------------------------------------------------------------------------
// Developer API Key Authentication
// ---------------------------------------------------------------------------

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

function buildDevAuthHeaders(): Record<string, string> {
  const key = getDevApiKey();
  if (!key) return {};
  return { 'X-API-Key': key };
}

// Create a new feedback thread
export async function createThread(
  category: string,
  summary: string,
  reporterContact?: string,
  context?: Partial<ContextSnapshotInput>
): Promise<CreateThreadResponse> {
  const identity = getReporterIdentity();
  const response = await fetch(`${API_BASE}/feedback/threads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildReporterHeaders(),
    },
    body: JSON.stringify({
      reporter_id: identity.id,
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

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create feedback');
  }

  return response.json();
}

// Create a new feedback thread with initial message in a single transaction
export async function createThreadAtomic(
  category: string,
  summary: string,
  initialMessage: string,
  reporterContact?: string,
  context?: Partial<ContextSnapshotInput>,
  attachments?: string[],
  notificationEmail?: string
): Promise<CreateThreadAtomicResponse> {
  const identity = getReporterIdentity();

  const response = await fetch(`${API_BASE}/feedback/threads/atomic`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildReporterHeaders(),
    },
    body: JSON.stringify({
      reporter_id: identity.id,
      reporter_contact: reporterContact,
      category,
      summary,
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

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create feedback');
  }

  return response.json();
}

export interface PaginatedThreadsResponse {
  threads: ThreadResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ThreadFilterParams {
  app_key?: string;
  keyword?: string;
  status?: string;
  created_after?: string;
  created_before?: string;
  page?: number;
  page_size?: number;
}

// List user's feedback threads with optional filter/pagination
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
  const response = await fetch(url, {
    method: 'GET',
    headers: buildReporterHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch threads');
  }

  return response.json();
}

export interface AppResponse {
  id: string;
  name: string;
  app_key: string;
  description: string;
  created_at: string;
}

// List user's apps
export async function listApps(): Promise<AppResponse[]> {
  const response = await fetch(`${API_BASE}/feedback/apps`, {
    method: 'GET',
    headers: buildReporterHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch apps');
  }

  return response.json();
}

// Create a new app
export interface CreateAppRequest {
  name: string;
  description?: string;
}

export async function createApp(data: CreateAppRequest): Promise<AppResponse> {
  const response = await fetch(`${API_BASE}/feedback/apps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildReporterHeaders(),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create app');
  }

  return response.json();
}

// Get a single thread
export async function getThread(threadId: string): Promise<ThreadResponse> {
  const response = await fetch(`${API_BASE}/feedback/threads/${threadId}`, {
    method: 'GET',
    headers: buildReporterHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch thread');
  }

  return response.json();
}

// List messages in a thread
export async function listMessages(threadId: string): Promise<MessageResponse[]> {
  const response = await fetch(`${API_BASE}/feedback/threads/${threadId}/messages`, {
    method: 'GET',
    headers: buildReporterHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch messages');
  }

  return response.json();
}

// Delete a thread (soft delete — sets status to 'deleted')
export async function deleteThread(threadId: string): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/feedback/threads/${threadId}`, {
    method: 'DELETE',
    headers: buildReporterHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete feedback');
  }

  return response.json();
}

// Add a message to a thread
export async function addMessage(
  threadId: string,
  body: string,
  authorType: 'reporter' | 'developer' | 'system' = 'reporter'
): Promise<MessageResponse> {
  const response = await fetch(`${API_BASE}/feedback/threads/${threadId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildReporterHeaders(),
    },
    body: JSON.stringify({
      author_type: authorType,
      body,
    } as AddMessageRequest),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send message');
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Public API (no auth required)
// ---------------------------------------------------------------------------

export interface PublicStatusResponse {
  thread_id: string;
  status: string;
  category: string;
  latest_public_message_at: string;
}

export async function getPublicThreadStatus(threadId: string): Promise<PublicStatusResponse> {
  const response = await fetch(`${API_BASE}/public/threads/${threadId}/status`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch status');
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Developer API types
// ---------------------------------------------------------------------------

export interface DevThreadContext {
  app_version: string;
  build_number?: string;
  os_name: string;
  os_version: string;
  device_model: string;
  locale?: string;
  current_route: string;
  captured_at: string;
  reporter_account_id?: string;
}

export interface TagResponse {
  id: string;
  name: string;
  color: string;
  created_at: string;
}
export interface DeveloperThreadResponse {
  id: string;
  reporter_id: string;
  reporter_contact?: string;
  category: string;
  status: string;
  summary: string;
  latest_public_message_at: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  context: DevThreadContext;
  assignee_id?: string;
  is_spam: boolean;
  last_internal_note_at?: string;
  tags?: TagResponse[];
}

export interface DevMessageResponse {
  id: string;
  thread_id: string;
  author_type: 'reporter' | 'developer' | 'system';
  body: string;
  attachments?: string[];
  created_at: string;
  is_internal: boolean;
}

export interface DevPaginatedThreadsResponse {
  threads: DeveloperThreadResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DevThreadFilterParams {
  status?: string;
  category?: string;
  assignee_id?: string;
  limit?: number;
  offset?: number;
}

export interface UpdateStatusRequest {
  status: string;
}

export interface AddReplyRequest {
  body: string;
  attachments?: string[];
}

export interface AddInternalNoteRequest {
  body: string;
  attachments?: string[];
}

// ---------------------------------------------------------------------------
// Developer API helper — wraps fetch with X-API-Key auth header
// ---------------------------------------------------------------------------

export async function devApiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = {
    ...options.headers,
    ...buildDevAuthHeaders(),
  };
  return fetch(url, { ...options, headers });
}

const DEV_API_BASE = '/v1/dev';

// List developer inbox threads with optional filters
export async function devListThreads(
  filters?: DevThreadFilterParams
): Promise<DevPaginatedThreadsResponse> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.assignee_id) params.set('assignee_id', filters.assignee_id);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));

  const url = `${DEV_API_BASE}/feedback/threads${params.size > 0 ? `?${params.toString()}` : ''}`;
  const response = await devApiFetch(url, { method: 'GET' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch threads');
  }

  return response.json();
}

// Get a single developer thread
export async function devGetThread(threadId: string): Promise<DeveloperThreadResponse> {
  const response = await devApiFetch(`${DEV_API_BASE}/feedback/threads/${threadId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch thread');
  }

  return response.json();
}

// List messages in a developer thread (includes internal notes)
export async function devListMessages(threadId: string): Promise<DevMessageResponse[]> {
  const response = await devApiFetch(`${DEV_API_BASE}/feedback/threads/${threadId}/messages`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch messages');
  }

  return response.json();
}

// Add a developer reply to a thread
export async function devAddReply(
  threadId: string,
  body: string,
  attachments?: string[]
): Promise<DevMessageResponse> {
  const response = await devApiFetch(
    `${DEV_API_BASE}/feedback/threads/${threadId}/reply`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, attachments } as AddReplyRequest),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send reply');
  }

  return response.json();
}

// Update thread status
export async function devUpdateStatus(
  threadId: string,
  status: string
): Promise<DeveloperThreadResponse> {
  const response = await devApiFetch(
    `${DEV_API_BASE}/feedback/threads/${threadId}/status`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status } as UpdateStatusRequest),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update status');
  }

  return response.json();
}

// Add an internal note to a thread
export async function devAddInternalNote(
  threadId: string,
  body: string,
  attachments?: string[]
): Promise<DevMessageResponse> {
  const response = await devApiFetch(
    `${DEV_API_BASE}/feedback/threads/${threadId}/internal-note`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, attachments } as AddInternalNoteRequest),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add internal note');
  }

  return response.json();
}

// Bulk update status for multiple threads
export async function devBulkUpdateStatus(
  threadIds: string[],
  status: string
): Promise<{ updated: number; failed: string[] }> {
  const results = await Promise.allSettled(
    threadIds.map((id) => devUpdateStatus(id, status))
  );

  const failed = results
    .map((r, i) => (r.status === 'rejected' ? threadIds[i] : null))
    .filter((id): id is string => id !== null);

  return {
    updated: results.filter((r) => r.status === 'fulfilled').length,
    failed,
  };
}


// Assign a thread to a developer
export async function devAssign(
  threadId: string,
  assigneeId: string
): Promise<{ status: string }> {
  const response = await devApiFetch(
    `${DEV_API_BASE}/feedback/threads/${threadId}/assign`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignee_id: assigneeId }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to assign thread');
  }

  return response.json();
}

// Unassign a thread
export async function devUnassign(threadId: string): Promise<{ status: string }> {
  const response = await devApiFetch(
    `${DEV_API_BASE}/feedback/threads/${threadId}/assign`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to unassign thread');
  }

  return response.json();
}

// List all tags
export async function devListTags(): Promise<TagResponse[]> {
  const response = await devApiFetch(`${DEV_API_BASE}/tags`, { method: 'GET' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch tags');
  }

  return response.json();
}

// Create a tag
export interface CreateTagRequest {
  name: string;
  color: string;
}

export async function devCreateTag(data: CreateTagRequest): Promise<TagResponse> {
  const response = await devApiFetch(`${DEV_API_BASE}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create tag');
  }

  return response.json();
}

// Delete a tag
export async function devDeleteTag(tagId: string): Promise<{ message: string }> {
  const response = await devApiFetch(`${DEV_API_BASE}/tags/${tagId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete tag');
  }

  return response.json();
}

// List tags for a thread
export async function devListThreadTags(threadId: string): Promise<TagResponse[]> {
  const response = await devApiFetch(
    `${DEV_API_BASE}/feedback/threads/${threadId}/tags`,
    { method: 'GET' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch thread tags');
  }

  return response.json();
}

// Add a tag to a thread
export async function devAddTagToThread(
  threadId: string,
  tagId: string
): Promise<{ message: string }> {
  const response = await devApiFetch(
    `${DEV_API_BASE}/feedback/threads/${threadId}/tags`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: tagId }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add tag to thread');
  }

  return response.json();
}

// Remove a tag from a thread
export async function devRemoveTagFromThread(
  threadId: string,
  tagId: string
): Promise<{ message: string }> {
  const response = await devApiFetch(
    `${DEV_API_BASE}/feedback/threads/${threadId}/tags/${tagId}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove tag from thread');
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// API Key Management
// ---------------------------------------------------------------------------

export interface ApiKeyRow {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_used_at?: string;
  is_active: boolean;
}

// List all API keys for the authenticated developer
export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const response = await devApiFetch(`${DEV_API_BASE}/api-keys`, { method: 'GET' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch API keys');
  }

  return response.json();
}

// Revoke an API key
export async function revokeApiKey(keyId: string): Promise<{ message: string }> {
  const response = await devApiFetch(`${DEV_API_BASE}/api-keys/${keyId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to revoke API key');
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Response Templates
// ---------------------------------------------------------------------------

export interface ResponseTemplateRow {
  id: string;
  developer_email: string;
  title: string;
  body: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateRequest {
  title: string;
  body: string;
  category?: string;
}

export interface UpdateTemplateRequest {
  title?: string;
  body?: string;
  category?: string;
}

// List all response templates
export async function listResponseTemplates(): Promise<ResponseTemplateRow[]> {
  const response = await devApiFetch(`${DEV_API_BASE}/response-templates`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch templates');
  }

  return response.json();
}

// Create a response template
export async function createResponseTemplate(
  data: CreateTemplateRequest
): Promise<ResponseTemplateRow> {
  const response = await devApiFetch(`${DEV_API_BASE}/response-templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create template');
  }

  return response.json();
}

// Update a response template
export async function updateResponseTemplate(
  id: string,
  data: UpdateTemplateRequest
): Promise<ResponseTemplateRow> {
  const response = await devApiFetch(`${DEV_API_BASE}/response-templates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update template');
  }

  return response.json();
}

// Delete a response template
export async function deleteResponseTemplate(id: string): Promise<{ message: string }> {
  const response = await devApiFetch(`${DEV_API_BASE}/response-templates/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete template');
  }

  return response.json();
}
