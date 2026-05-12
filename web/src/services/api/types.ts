/* ═══════════════════════════════════════════
   FeedbackHub API — Shared Types
   =========================================== */

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

export interface AppResponse {
  id: string;
  name: string;
  app_key: string;
  description: string;
  created_at: string;
}

export interface NotificationPrefs {
  email: string;
  notify_on_reply: boolean;
  notify_on_status_change: boolean;
  notify_on_close: boolean;
}

export interface UpdateNotificationPrefsRequest {
  notify_on_reply?: boolean;
  notify_on_status_change?: boolean;
  notify_on_close?: boolean;
}

export interface CreateAppRequest {
  name: string;
  description?: string;
}

export interface PublicStatusResponse {
  thread_id: string;
  status: string;
  category: string;
  latest_public_message_at: string;
}

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
  keyword?: string;
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

export interface ApiKeyRow {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_used_at?: string;
  is_active: boolean;
}

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

export interface CreateTagRequest {
  name: string;
  color: string;
}

/* Display labels */
export const STATUS_LABELS: Record<string, string> = {
  received: '已收到',
  in_review: '处理中',
  waiting_for_user: '待补充信息',
  closed: '已关闭',
  deleted: '已删除',
};

export const CATEGORY_LABELS: Record<string, string> = {
  '遇到问题': '遇到问题',
  '想提建议': '想提建议',
  '想问一下': '想问一下',
  '其他': '其他',
};
