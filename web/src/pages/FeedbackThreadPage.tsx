import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getThread,
  listMessages,
  addMessage,
  deleteThread,
  type ThreadResponse,
  type MessageResponse,
} from '../services/api';
import { useStatusNotification } from '../hooks/useStatusNotification';
import { StatusNotificationBanner } from '../components/StatusNotificationBanner';

export function FeedbackThreadPage() {
  const { t } = useTranslation();
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const [thread, setThread] = useState<ThreadResponse | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [expandedAttachment, setExpandedAttachment] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { notification, dismiss } = useStatusNotification(threadId || '', thread?.status || '');

  const fetchData = async () => {
    if (!threadId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [threadData, messagesData] = await Promise.all([
        getThread(threadId),
        listMessages(threadId),
      ]);
      setThread(threadData);
      setMessages(messagesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('thread.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !threadId) return;

    setIsSending(true);
    try {
      const newMessage = await addMessage(threadId, replyContent.trim(), 'reporter');
      setMessages((prev) => [...prev, newMessage]);
      setReplyContent('');
      // Refresh thread to get updated status (e.g., closed -> in_review after reply)
      const updatedThread = await getThread(threadId);
      setThread(updatedThread);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('thread.sendError'));
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async () => {
    if (!threadId) return;
    setIsDeleting(true);
    try {
      await deleteThread(threadId);
      setToast({ message: t('thread.deleteSuccess'), type: 'success' });
      setShowDeleteConfirm(false);
      setTimeout(() => navigate('/history'), 1500);
    } catch {
      setToast({ message: t('thread.deleteError'), type: 'error' });
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'received':
        return 'status-received';
      case 'in_review':
        return 'status-in-review';
      case 'waiting_for_user':
        return 'status-waiting';
      case 'closed':
        return 'status-closed';
      case 'deleted':
        return 'status-closed';
      default:
        return '';
    }
  };

  return (
    <main className="shell">
      <section className="detail-card thread-detail">
        <span className="eyebrow">{t('thread.eyebrow')}</span>

        {error && (
          <div className="error-message" role="alert">
            {error}
            <button onClick={fetchData} className="retry-btn">
              {t('thread.retry')}
            </button>
          </div>
        )}

        {notification && (
          <StatusNotificationBanner message={notification.message} status={notification.status} onDismiss={dismiss} />
        )}

        {toast && (
          <div className={`toast toast-${toast.type}`} role="alert">
            {toast.message}
          </div>
        )}

        {isLoading ? (
          <div className="loading">{t('thread.loading')}</div>
        ) : thread ? (
          <>
            {/* Thread Header */}
            <div className="thread-header-info">
              <div className="thread-status-row">
                <span className={`status-badge ${getStatusClass(thread.status)}`}>
                  {t({
                    received: 'thread.statusReceived',
                    in_review: 'thread.statusInReview',
                    waiting_for_user: 'thread.statusWaitingForUser',
                    closed: 'thread.statusClosed',
                    deleted: 'thread.statusDeleted',
                  }[thread.status] ?? 'thread.statusReceived')}
                </span>
                <span className="thread-category">{thread.category}</span>
                {thread.status !== 'deleted' && (
                  <button
                    className="btn-delete"
                    onClick={() => setShowDeleteConfirm(true)}
                    aria-label={t('thread.delete')}
                  >
                    {t('thread.delete')}
                  </button>
                )}
              </div>
              <p className="thread-summary">{thread.summary}</p>
              <div className="thread-context-info">
                <span>{thread.context.app_version}</span>
                <span>·</span>
                <span>{thread.context.os_name} {thread.context.os_version}</span>
                <span>·</span>
                <span>{formatDate(thread.created_at)}</span>
              </div>
            </div>

            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && (
              <div className="modal-overlay" role="dialog" aria-modal="true">
                <div className="modal-content">
                  <h3>{t('thread.deleteConfirmTitle')}</h3>
                  <p>{t('thread.deleteConfirmMessage')}</p>
                  <div className="modal-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                    >
                      {t('thread.cancel')}
                    </button>
                    <button
                      className="btn-danger"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      {isDeleting ? t('app.loading') : t('thread.delete')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="no-messages">{t('thread.noMessages')}</div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message ${
                      msg.author_type === 'developer'
                        ? 'message-developer'
                        : 'message-reporter'
                    }`}
                  >
                    <div className="message-header">
                      <span className="message-author">
                        {msg.author_type === 'developer' ? t('thread.developer') : t('thread.you')}
                      </span>
                      <span className="message-time">{formatDate(msg.created_at)}</span>
                    </div>
                    <div className="message-body">{msg.body}</div>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="message-attachments">
                        {msg.attachments.map((dataUrl, i) => {
                          const isImage = dataUrl.startsWith('data:image/');
                          if (isImage) {
                            return (
                              <button
                                type="button"
                                key={i}
                                className="message-attachment-thumb"
                                onClick={() => setExpandedAttachment(dataUrl)}
                              >
                                <img src={dataUrl} alt={t('thread.attachmentAlt', { index: i + 1 })} />
                              </button>
                            );
                          } else {
                            return (
                              <button
                                type="button"
                                key={i}
                                className="message-attachment-thumb message-attachment-file"
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = dataUrl;
                                  link.download = `${t('thread.attachmentAlt', { index: i + 1 })}`;
                                  link.click();
                                }}
                                title={dataUrl.startsWith('data:application/pdf') ? 'PDF' : dataUrl.includes('zip') ? 'ZIP' : 'DOCX'}
                              >
                                <span className="file-icon-emoji">
                                  {dataUrl.startsWith('data:application/pdf') ? '📄' : dataUrl.includes('zip') ? '📦' : '📝'}
                                </span>
                              </button>
                            );
                          }
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Form */}
            <form onSubmit={handleSendReply} className="reply-form">
              <textarea
                className="reply-textarea"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={t('thread.replyPlaceholder')}
                rows={3}
                disabled={isSending}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={!replyContent.trim() || isSending}
              >
                {isSending ? t('thread.sending') : t('thread.send')}
              </button>
            </form>
          </>
        ) : (
          <div className="error-message">{t('thread.noFeedback')}</div>
        )}

        <Link className="back-link" to="/history">
          {t('thread.backToHistory')}
        </Link>

        {/* Expanded image modal */}
        {expandedAttachment && expandedAttachment.startsWith('data:image/') && (
          <div className="modal-overlay" onClick={() => setExpandedAttachment(null)}>
            <div className="image-preview-modal" onClick={(e) => e.stopPropagation()}>
              <img
                src={expandedAttachment}
                alt={t('thread.attachmentAlt', { index: 1 })}
                className="image-preview-full"
              />
              <button
                className="image-preview-close"
                onClick={() => setExpandedAttachment(null)}
                aria-label={t('history.close')}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
