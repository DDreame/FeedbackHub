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
  attachments?: string[]
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
