/* ═══════════════════════════════════════════
   FeedbackHub API — Barrel Export
   Backward-compatible: all existing imports from
   '../services/api' continue to work unchanged.
   =========================================== */

// Types
export type {
  ContextSnapshotInput,
  CreateThreadRequest, CreateThreadResponse,
  CreateThreadAtomicRequest, CreateThreadAtomicResponse,
  ThreadResponse, MessageResponse, AddMessageRequest,
  PaginatedThreadsResponse, ThreadFilterParams,
  AppResponse, CreateAppRequest,
  NotificationPrefs, UpdateNotificationPrefsRequest,
  PublicStatusResponse,
  DevThreadContext, TagResponse,
  DeveloperThreadResponse, DevMessageResponse,
  DevPaginatedThreadsResponse, DevThreadFilterParams,
  UpdateStatusRequest, AddReplyRequest, AddInternalNoteRequest,
  ApiKeyRow,
  ResponseTemplateRow, CreateTemplateRequest, UpdateTemplateRequest,
  CreateTagRequest,
} from './types';

export { STATUS_LABELS, CATEGORY_LABELS } from './types';

// Client helpers
export {
  API_BASE, DEV_API_BASE,
  extractErrorMessage,
  buildReporterHeaders,
  getDevApiKey, setDevApiKey, clearDevApiKey,
  buildDevAuthHeaders, devApiFetch,
} from './client';

// Threads
export {
  createThread, createThreadAtomic,
  listMyThreads, getThread, deleteThread,
  devListThreads, devGetThread,
  devUpdateStatus, devBulkUpdateStatus,
  devAssign, devUnassign,
} from './threads';

// Messages
export {
  listMessages, addMessage,
  devListMessages, devAddReply, devAddInternalNote,
} from './messages';

// Templates
export {
  listResponseTemplates, createResponseTemplate,
  updateResponseTemplate, deleteResponseTemplate,
} from './templates';

// Tags
export {
  devListTags, devCreateTag, devDeleteTag,
  devListThreadTags, devAddTagToThread, devRemoveTagFromThread,
} from './tags';

// API Keys
export { listApiKeys, revokeApiKey } from './apikeys';

// Apps
export { listApps, createApp } from './apps';

// Notifications
export { getNotificationPrefs, updateNotificationPrefs } from './notifications';

// Public
export { getPublicThreadStatus } from './public';
