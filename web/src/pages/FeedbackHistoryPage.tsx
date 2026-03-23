import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  listMyThreads,
  STATUS_LABELS,
  type ThreadResponse,
} from '../services/api';
import { formatRefNumber } from '../utils/formatRefNumber';

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'received', label: '已收到' },
  { value: 'in_review', label: '处理中' },
  { value: 'waiting_for_user', label: '待补充信息' },
  { value: 'closed', label: '已关闭' },
];


const STATUS_MSGS: Record<string, string> = {
  received: '✅ 感谢提交，您的反馈已收到',
  in_review: '👀 开发者已查看您的反馈',
  waiting_for_user: '💬 开发者已回复，等待您的操作',
  closed: '✅ 此反馈已关闭，如有需要可继续回复',
};

export function FeedbackHistoryPage() {
  const { appKey } = useParams<{ appKey?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [threads, setThreads] = useState<ThreadResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalNotification, setGlobalNotification] = useState<{ message: string; status: string } | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state from URL params
  const keyword = searchParams.get('keyword') || '';
  const status = searchParams.get('status') || '';
  const dateFrom = searchParams.get('created_after') || '';
  const dateTo = searchParams.get('created_before') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const fetchThreads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters = {
        ...(keyword && { keyword }),
        ...(status && { status }),
        ...(dateFrom && { created_after: dateFrom }),
        ...(dateTo && { created_before: dateTo }),
        page,
        per_page: 20,
      };
      const data = await listMyThreads(appKey, filters);

      // Check for status changes (show first changed thread's notification)
      for (const thread of data.items) {
        const key = `feedback_thread_status_${thread.id}`;
        const cached = localStorage.getItem(key);
        if (cached && cached !== thread.status) {
          setGlobalNotification({ message: STATUS_MSGS[thread.status] || '状态已更新', status: thread.status });
          break;
        }
      }
      // Update cache
      for (const thread of data.items) {
        localStorage.setItem(`feedback_thread_status_${thread.id}`, thread.status);
      }

      setThreads(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [appKey, keyword, status, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '1'); // reset to page 1 on filter change
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const goToPage = (p: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', String(p));
    setSearchParams(newParams);
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

  const hasActiveFilters = keyword || status || dateFrom || dateTo;

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

        {globalNotification && (
          <div className={`status-notification-banner banner-${globalNotification.status}`} role="alert">
            <span className="banner-message">{globalNotification.message}</span>
            <button className="banner-dismiss" onClick={() => setGlobalNotification(null)} aria-label="关闭">✕</button>
          </div>
        )}

        {/* Search/Filter Bar */}
        <div className="history-filter-bar">
          <div className="filter-bar-header">
            <input
              type="search"
              className="filter-keyword-input"
              placeholder="搜索反馈内容..."
              value={keyword}
              onChange={(e) => updateFilter('keyword', e.target.value)}
            />
            <button
              className={`filter-toggle-btn ${hasActiveFilters ? 'filter-active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
            >
              {hasActiveFilters ? '筛选 🔽' : '筛选'}
            </button>
          </div>

          {showFilters && (
            <div className="filter-bar-body">
              <div className="filter-row">
                <label className="filter-label">
                  状态
                  <select
                    className="filter-select"
                    value={status}
                    onChange={(e) => updateFilter('status', e.target.value)}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="filter-row">
                <label className="filter-label">
                  创建时间
                  <div className="filter-date-range">
                    <input
                      type="date"
                      className="filter-date-input"
                      value={dateFrom}
                      onChange={(e) => updateFilter('created_after', e.target.value)}
                      placeholder="开始日期"
                    />
                    <span className="filter-date-sep">至</span>
                    <input
                      type="date"
                      className="filter-date-input"
                      value={dateTo}
                      onChange={(e) => updateFilter('created_before', e.target.value)}
                      placeholder="结束日期"
                    />
                  </div>
                </label>
              </div>
              {hasActiveFilters && (
                <button className="filter-clear-btn" onClick={clearFilters}>
                  清除筛选
                </button>
              )}
            </div>
          )}
        </div>

        {/* Results count */}
        {!isLoading && !error && (
          <div className="history-results-info">
            {total > 0 ? (
              <span>共 {total} 条反馈</span>
            ) : (
              <span>无符合条件的结果</span>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="loading">加载中...</div>
        ) : threads.length === 0 && !hasActiveFilters ? (
          <div className="empty-state">
            <p>您还没有提交过反馈</p>
            <Link to={appKey ? `/submit/${appKey}` : '/submit/demo-app'} className="btn-primary">
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
                  <span className="thread-ref">{formatRefNumber(thread.id)}</span>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="pagination-btn"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              aria-label="上一页"
            >
              ‹ 上一页
            </button>
            <span className="pagination-info">
              第 {page} / {totalPages} 页
            </span>
            <button
              className="pagination-btn"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              aria-label="下一页"
            >
              下一页 ›
            </button>
          </div>
        )}

        <Link className="back-link" to="/">
          ← 返回首页
        </Link>
      </section>
    </main>
  );
}
