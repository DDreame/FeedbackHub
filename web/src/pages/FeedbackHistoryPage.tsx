import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listMyThreads,
  STATUS_LABELS,
  type ThreadResponse,
} from '../services/api';

export function FeedbackHistoryPage() {
  const [threads, setThreads] = useState<ThreadResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchThreads();
  }, []);

  const fetchThreads = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listMyThreads();
      setThreads(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
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
      <section className="detail-card">
        <span className="eyebrow">反馈历史</span>
        <h1>我的反馈</h1>

        {error && (
          <div className="error-message" role="alert">
            {error}
            <button onClick={fetchThreads} className="retry-btn">
              重试
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="loading">加载中...</div>
        ) : threads.length === 0 ? (
          <div className="empty-state">
            <p>您还没有提交过反馈</p>
            <Link to="/submit/demo-app" className="btn-primary">
              提交反馈
            </Link>
          </div>
        ) : (
          <div className="thread-list">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                to={`/feedback/${thread.id}`}
                className="thread-card"
              >
                <div className="thread-header">
                  <span className={`status-badge ${getStatusClass(thread.status)}`}>
                    {STATUS_LABELS[thread.status] || thread.status}
                  </span>
                  <span className="thread-category">{thread.category}</span>
                </div>
                <p className="thread-summary">{thread.summary}</p>
                <div className="thread-meta">
                  <span className="thread-date">{formatDate(thread.created_at)}</span>
                  <span className="thread-context">
                    {thread.context.app_version} · {thread.context.os_name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <Link className="back-link" to="/">
          ← 返回首页
        </Link>
      </section>
    </main>
  );
}
