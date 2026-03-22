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
  // TODO: Replace with actual auth integration when available
  // For now, use a dev placeholder that can be overridden
  return {
    id: '00000000-0000-0000-0000-000000000001',
  };
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
  context?: Partial<ContextSnapshotInput>
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

// List user's feedback threads
export async function listMyThreads(): Promise<ThreadResponse[]> {
  const response = await fetch(`${API_BASE}/feedback/threads`, {
    method: 'GET',
    headers: buildReporterHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch threads');
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
