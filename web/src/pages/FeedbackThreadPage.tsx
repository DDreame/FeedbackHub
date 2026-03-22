import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getThread,
  listMessages,
  addMessage,
  STATUS_LABELS,
  type ThreadResponse,
  type MessageResponse,
} from '../services/api';

export function FeedbackThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const [thread, setThread] = useState<ThreadResponse | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      setError(err instanceof Error ? err.message : '加载失败');
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
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setIsSending(false);
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
      default:
        return '';
    }
  };

  return (
    <main className="shell">
      <section className="detail-card thread-detail">
        <span className="eyebrow">反馈详情</span>

        {error && (
          <div className="error-message" role="alert">
            {error}
            <button onClick={fetchData} className="retry-btn">
              重试
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="loading">加载中...</div>
        ) : thread ? (
          <>
            {/* Thread Header */}
            <div className="thread-header-info">
              <div className="thread-status-row">
                <span className={`status-badge ${getStatusClass(thread.status)}`}>
                  {STATUS_LABELS[thread.status] || thread.status}
                </span>
                <span className="thread-category">{thread.category}</span>
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

            {/* Messages */}
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="no-messages">暂无消息记录</div>
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
                        {msg.author_type === 'developer' ? '👨‍💻 开发者' : '👤 您'}
                      </span>
                      <span className="message-time">{formatDate(msg.created_at)}</span>
                    </div>
                    <div className="message-body">{msg.body}</div>
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
                placeholder="输入您的回复..."
                rows={3}
                disabled={isSending}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={!replyContent.trim() || isSending}
              >
                {isSending ? '发送中...' : '发送'}
              </button>
            </form>
          </>
        ) : (
          <div className="error-message">未找到反馈记录</div>
        )}

        <Link className="back-link" to="/history">
          ← 返回反馈列表
        </Link>
      </section>
    </main>
  );
}
