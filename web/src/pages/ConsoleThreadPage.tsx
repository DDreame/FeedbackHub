import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  devGetThread,
  devListMessages,
  devAddReply,
  devUpdateStatus,
  devAddInternalNote,
  devUnassign,
  devListTags,
  devListThreadTags,
  devAddTagToThread,
  devRemoveTagFromThread,
  type DeveloperThreadResponse,
  type DevMessageResponse,
  type TagResponse,
} from '../services/api';
import { getDevApiKey } from '../services/api';
import { UserIcon, MemoIcon, SendIcon } from '../components/icons';
import i18n from '../i18n';

const VALID_TRANSITIONS: Record<string, string[]> = {
  received: ['in_review'],
  in_review: ['waiting_for_user', 'closed'],
  waiting_for_user: ['in_review', 'closed'],
  closed: ['in_review'],
};

export function ConsoleThreadPage() {
  const { t } = useTranslation();
  const { threadId } = useParams<{ threadId: string }>();

  const [thread, setThread] = useState<DeveloperThreadResponse | null>(null);
  const [messages, setMessages] = useState<DevMessageResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const [noteText, setNoteText] = useState('');
  const [isSendingNote, setIsSendingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);

  // Assignee state
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Tag state
  const [threadTags, setThreadTags] = useState<TagResponse[]>([]);
  const [allTags, setAllTags] = useState<TagResponse[]>([]);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [isManagingTags, setIsManagingTags] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const hasApiKey = !!getDevApiKey();

  const fetchThreadAndMessages = useCallback(async () => {
    if (!threadId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [threadData, messagesData, tagsData, allTagsData] = await Promise.all([
        devGetThread(threadId),
        devListMessages(threadId),
        devListThreadTags(threadId),
        devListTags(),
      ]);
      setThread(threadData);
      setMessages(messagesData);
      setThreadTags(tagsData);
      setAllTags(allTagsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('console.thread.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [threadId, t]);

  useEffect(() => {
    fetchThreadAndMessages();
  }, [fetchThreadAndMessages]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !threadId) return;
    setIsSendingReply(true);
    setReplyError(null);
    try {
      const msg = await devAddReply(threadId, replyText.trim());
      setMessages((prev) => [...prev, msg]);
      setReplyText('');
      // Refresh thread to update latest_public_message_at
      const updated = await devGetThread(threadId);
      setThread(updated);
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : t('console.thread.sendError'));
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !threadId) return;
    setIsSendingNote(true);
    setNoteError(null);
    try {
      const note = await devAddInternalNote(threadId, noteText.trim());
      setMessages((prev) => [...prev, note]);
      setNoteText('');
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : t('console.thread.noteError'));
    } finally {
      setIsSendingNote(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!threadId) return;
    setShowStatusMenu(false);
    setIsUpdatingStatus(true);
    setStatusUpdateError(null);
    try {
      const updated = await devUpdateStatus(threadId, newStatus);
      setThread(updated);
    } catch (err) {
      setStatusUpdateError(err instanceof Error ? err.message : t('console.thread.statusError'));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleUnassign = async () => {
    if (!threadId) return;
    setShowAssignMenu(false);
    setIsAssigning(true);
    setAssignError(null);
    try {
      await devUnassign(threadId);
      const updated = await devGetThread(threadId);
      setThread(updated);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to unassign');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAddTag = async (tagId: string) => {
    if (!threadId) return;
    setShowTagMenu(false);
    setIsManagingTags(true);
    setTagError(null);
    try {
      await devAddTagToThread(threadId, tagId);
      const tags = await devListThreadTags(threadId);
      setThreadTags(tags);
    } catch (err) {
      setTagError(err instanceof Error ? err.message : 'Failed to add tag');
    } finally {
      setIsManagingTags(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!threadId) return;
    setIsManagingTags(true);
    setTagError(null);
    try {
      await devRemoveTagFromThread(threadId, tagId);
      const tags = await devListThreadTags(threadId);
      setThreadTags(tags);
    } catch (err) {
      setTagError(err instanceof Error ? err.message : 'Failed to remove tag');
    } finally {
      setIsManagingTags(false);
    }
  };
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'received': return 'status-received';
      case 'in_review': return 'status-in-review';
      case 'waiting_for_user': return 'status-waiting';
      case 'closed': return 'status-closed';
      default: return '';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'received': return t('console.thread.statusReceived');
      case 'in_review': return t('console.thread.statusInReview');
      case 'waiting_for_user': return t('console.thread.statusWaitingForUser');
      case 'closed': return t('console.thread.statusClosed');
      default: return status;
    }
  };

  const getAuthorLabel = (authorType: string, isInternal: boolean) => {
    if (isInternal) return t('console.thread.internalNote');
    if (authorType === 'developer') return t('console.thread.developer');
    if (authorType === 'system') return t('console.thread.system');
    return t('console.thread.reporter');
  };

  if (!hasApiKey) {
    return (
      <main className="shell">
        <section className="detail-card">
          <span className="eyebrow">{t('console.eyebrow')}</span>
          <h1>{t('console.thread.title')}</h1>
          <div className="empty-state">
            <p className="empty-state-title">{t('console.thread.noApiKey')}</p>
            <Link to="/console" className="btn-primary">
              {t('console.thread.configureApiKey')}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="shell">
        <section className="detail-card">
          <span className="eyebrow">{t('console.eyebrow')}</span>
          <div className="loading">{t('console.thread.loading')}</div>
        </section>
      </main>
    );
  }

  if (error || !thread) {
    return (
      <main className="shell">
        <section className="detail-card">
          <span className="eyebrow">{t('console.eyebrow')}</span>
          <h1>{t('console.thread.title')}</h1>
          <div className="error-message" role="alert">
            {error || t('console.thread.loadError')}
            <button onClick={fetchThreadAndMessages} className="retry-btn">
              {t('console.thread.retry')}
            </button>
          </div>
          <Link className="back-link" to="/console/inbox">
            ← {t('console.thread.backToInbox')}
          </Link>
        </section>
      </main>
    );
  }

  const validNextStatuses = VALID_TRANSITIONS[thread.status] || [];

  return (
    <main className="shell">
      <section className="detail-card">
        <span className="eyebrow">{t('console.eyebrow')}</span>
        <h1>{t('console.thread.title')}</h1>

        {/* Thread Header Info */}
        <div className="dev-thread-header">
          <div className="dev-thread-meta">
            <span className={`status-badge ${getStatusClass(thread.status)}`}>
              {getStatusLabel(thread.status)}
            </span>
            <span className="thread-category">{thread.category}</span>
            {thread.is_spam && <span className="thread-spam-badge">SPAM</span>}
            <span className="thread-ref">#{thread.id.slice(0, 8)}</span>
          </div>

          {/* Status Update */}
          <div className="dev-status-control">
            {isUpdatingStatus && (
              <span className="loading" style={{ fontSize: '0.875rem' }}>
                {t('console.thread.updating')}
              </span>
            )}
            {statusUpdateError && (
              <span className="form-error" style={{ fontSize: '0.875rem' }}>
                {statusUpdateError}
              </span>
            )}
            {validNextStatuses.length > 0 && !isUpdatingStatus && (
              <div className="status-update-dropdown">
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  disabled={showStatusMenu}
                >
                  {t('console.thread.updateStatus')}
                </button>
                {showStatusMenu && (
                  <div className="dropdown-menu">
                    {validNextStatuses.map((s) => (
                      <button
                        key={s}
                        className="dropdown-item"
                        onClick={() => handleStatusChange(s)}
                      >
                        {getStatusLabel(s)}
                      </button>
                    ))}
                    <button
                      className="dropdown-item dropdown-item-cancel"
                      onClick={() => setShowStatusMenu(false)}
                    >
                      {t('console.thread.cancel')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Assignee & Tags Row */}
        <div className="dev-thread-tags-row">
          {/* Assignee */}
          <div className="dev-assignee-control">
            {isAssigning && (
              <span className="loading" style={{ fontSize: '0.875rem' }}>...</span>
            )}
            {assignError && (
              <span className="form-error" style={{ fontSize: '0.875rem' }}>{assignError}</span>
            )}
            {!isAssigning && (
              <div className="assignee-dropdown">
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => setShowAssignMenu(!showAssignMenu)}
                  disabled={showAssignMenu}
                >
                  {thread.assignee_id
                    ? <><UserIcon /> {t('console.thread.assignee')}: {thread.assignee_id.slice(0, 8)}</>
                    : t('console.thread.assign')}
                </button>
                {showAssignMenu && (
                  <div className="dropdown-menu">
                    {thread.assignee_id && (
                      <button
                        className="dropdown-item"
                        onClick={handleUnassign}
                      >
                        {t('console.thread.unassign')}
                      </button>
                    )}
                    <button
                      className="dropdown-item dropdown-item-cancel"
                      onClick={() => setShowAssignMenu(false)}
                    >
                      {t('console.thread.cancel')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="dev-tags-control">
            {tagError && (
              <span className="form-error" style={{ fontSize: '0.875rem' }}>{tagError}</span>
            )}
            {threadTags.length > 0 && (
              <div className="thread-tags-display">
                {threadTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="thread-tag-badge"
                    style={{ backgroundColor: tag.color + '33', borderColor: tag.color }}
                  >
                    {tag.name}
                    <button
                      className="thread-tag-remove"
                      onClick={() => handleRemoveTag(tag.id)}
                      disabled={isManagingTags}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="tag-add-dropdown">
              <button
                className="btn-secondary btn-sm"
                onClick={() => setShowTagMenu(!showTagMenu)}
                disabled={showTagMenu || isManagingTags}
              >
                + {t('console.thread.addTag')}
              </button>
              {showTagMenu && (
                <div className="dropdown-menu">
                  {allTags
                    .filter((tag) => !threadTags.some((t) => t.id === tag.id))
                    .map((tag) => (
                      <button
                        key={tag.id}
                        className="dropdown-item"
                        onClick={() => handleAddTag(tag.id)}
                      >
                        <span
                          className="tag-dot"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </button>
                    ))}
                  {allTags.filter((tag) => !threadTags.some((t) => t.id === tag.id)).length === 0 && (
                    <div className="dropdown-item" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
                      {t('console.thread.noTagsAvailable')}
                    </div>
                  )}
                  <button
                    className="dropdown-item dropdown-item-cancel"
                    onClick={() => setShowTagMenu(false)}
                  >
                    {t('console.thread.cancel')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Thread Context */}
        <div className="dev-thread-context">
          <h3>{thread.summary}</h3>
          <div className="context-grid">
            <div className="context-item">
              <span className="context-label">{t('console.thread.reporterContact')}</span>
              <span className="context-value">
                {thread.reporter_contact || t('console.thread.anonymous')}
              </span>
            </div>
            <div className="context-item">
              <span className="context-label">{t('console.thread.appVersion')}</span>
              <span className="context-value">{thread.context.app_version}</span>
            </div>
            <div className="context-item">
              <span className="context-label">{t('console.thread.device')}</span>
              <span className="context-value">
                {thread.context.os_name} {thread.context.os_version} · {thread.context.device_model}
              </span>
            </div>
            <div className="context-item">
              <span className="context-label">{t('console.thread.route')}</span>
              <span className="context-value">{thread.context.current_route}</span>
            </div>
            <div className="context-item">
              <span className="context-label">{t('console.thread.createdAt')}</span>
              <span className="context-value">{formatDate(thread.created_at)}</span>
            </div>
            <div className="context-item">
              <span className="context-label">{t('console.thread.lastUpdate')}</span>
              <span className="context-value">{formatDate(thread.latest_public_message_at)}</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="dev-messages">
          <h2 className="messages-title">{t('console.thread.messages')}</h2>

          {messages.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 0' }}>
              <p className="empty-state-title">{t('console.thread.noMessages')}</p>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`message-item ${msg.is_internal ? 'message-internal' : ''}`}
                >
                  <div className="message-header">
                    <span className="message-author">
                      {msg.is_internal ? <><MemoIcon /> </> : ''}{getAuthorLabel(msg.author_type, msg.is_internal)}
                    </span>
                    <span className="message-date">{formatDate(msg.created_at)}</span>
                  </div>
                  <div className="message-body">{msg.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reply Form */}
        <div className="dev-reply-form">
          <h3>{t('console.thread.reply')}</h3>
          <textarea
            className="form-textarea"
            rows={4}
            placeholder={t('console.thread.replyPlaceholder')}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handleSendReply();
              }
            }}
          />
          {replyError && <span className="form-error">{replyError}</span>}
          <div className="form-actions">
            <button
              className="btn-primary"
              onClick={handleSendReply}
              disabled={!replyText.trim() || isSendingReply}
            >
              {isSendingReply ? t('console.thread.sending') : <><SendIcon /> {t('console.thread.send')}</>}
            </button>
          </div>
        </div>

        {/* Internal Note Form */}
        <div className="dev-note-form">
          <h3>{t('console.thread.internalNote')}</h3>
          <p className="note-hint">{t('console.thread.noteHint')}</p>
          <textarea
            className="form-textarea note-textarea"
            rows={3}
            placeholder={t('console.thread.notePlaceholder')}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          {noteError && <span className="form-error">{noteError}</span>}
          <div className="form-actions">
            <button
              className="btn-secondary"
              onClick={handleAddNote}
              disabled={!noteText.trim() || isSendingNote}
            >
              {isSendingNote ? t('console.thread.adding') : t('console.thread.addNote')}
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <Link className="back-link" to="/console/inbox">
          ← {t('console.thread.backToInbox')}
        </Link>
      </section>
    </main>
  );
}
