import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  listMyThreads,
  STATUS_LABELS,
  type ThreadResponse,
} from '../services/api';
import { formatRefNumber } from '../utils/formatRefNumber';
import { highlightKeyword } from '../utils/highlightKeyword';
import { CloseIcon, ChevronDownIcon } from '../components/icons';
import i18n from '../i18n';

export function FeedbackHistoryPage() {
  const { t } = useTranslation();
  const { appKey } = useParams<{ appKey?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [threads, setThreads] = useState<ThreadResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalNotification, setGlobalNotification] = useState<{ message: string; status: string } | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const STATUS_OPTIONS = [
    { value: '', label: t('history.allStatuses') },
    { value: 'received', label: t('history.received') },
    { value: 'in_review', label: t('history.inReview') },
    { value: 'waiting_for_user', label: t('history.waitingForUser') },
    { value: 'closed', label: t('history.closed') },
  ];

  const STATUS_MSGS: Record<string, string> = useMemo(() => ({
    received: t('notification.receivedSubmitted'),
    in_review: t('notification.reviewStarted'),
    waiting_for_user: t('notification.waitingResponse'),
    closed: t('notification.closed'),
  }), [t]);

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
        page_size: 20,
      };
      const data = await listMyThreads(appKey, filters);

      // Check for status changes (show first changed thread's notification)
      for (const thread of data.threads) {
        const key = `feedback_thread_status_${thread.id}`;
        const cached = localStorage.getItem(key);
        if (cached && cached !== thread.status) {
          setGlobalNotification({ message: STATUS_MSGS[thread.status] || t('notification.statusChanged', { status: thread.status }), status: thread.status });
          break;
        }
      }
      // Update cache
      for (const thread of data.threads) {
        localStorage.setItem(`feedback_thread_status_${thread.id}`, thread.status);
      }

      setThreads(data.threads);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [appKey, keyword, status, dateFrom, dateTo, page, t, STATUS_MSGS]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '1');
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
        <span className="eyebrow">{t('history.eyebrow')}</span>
        <h1>{t('history.title')}</h1>
        <Link to="/notifications" className="notif-prefs-link">
          {t('history.notificationSettings')}
        </Link>

        {error && (
          <div className="error-message" role="alert">
            {error}
            <button onClick={fetchThreads} className="retry-btn">
              {t('history.retry')}
            </button>
          </div>
        )}

        {globalNotification && (
          <div className={`status-notification-banner banner-${globalNotification.status}`} role="alert">
            <span className="banner-message">{globalNotification.message}</span>
            <button className="banner-dismiss" onClick={() => setGlobalNotification(null)} aria-label={t('history.close')}><CloseIcon /></button>
          </div>
        )}

        {/* Search/Filter Bar */}
        <div className="history-filter-bar">
          <div className="filter-bar-header">
            <input
              type="search"
              className="filter-keyword-input"
              placeholder={t('history.searchPlaceholder')}
              value={keyword}
              onChange={(e) => updateFilter('keyword', e.target.value)}
            />
            <button
              className={`filter-toggle-btn ${hasActiveFilters ? 'filter-active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
            >
              {hasActiveFilters ? <>{t('history.filter')} <ChevronDownIcon /></> : t('history.filter')}
            </button>
          </div>

          {showFilters && (
            <div className="filter-bar-body">
              <div className="filter-row">
                <label className="filter-label">
                  {t('history.filterStatus')}
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
                  {t('history.createdAt')}
                  <div className="filter-date-range">
                    <input
                      type="date"
                      className="filter-date-input"
                      value={dateFrom}
                      onChange={(e) => updateFilter('created_after', e.target.value)}
                      placeholder={t('history.dateFrom')}
                    />
                    <span className="filter-date-sep">{t('history.dateTo')}</span>
                    <input
                      type="date"
                      className="filter-date-input"
                      value={dateTo}
                      onChange={(e) => updateFilter('created_before', e.target.value)}
                      placeholder={t('history.dateEnd')}
                    />
                  </div>
                </label>
              </div>
              {hasActiveFilters && (
                <button className="filter-clear-btn" onClick={clearFilters}>
                  {t('history.clearFilter')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Results count */}
        {!isLoading && !error && (
          <div className="history-results-info">
            {total > 0 ? (
              <span>{t('history.resultCount', { count: total })}</span>
            ) : (
              <span>{t('history.noResults')}</span>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="loading">{t('app.loading')}</div>
        ) : threads.length === 0 && !hasActiveFilters ? (
          <div className="empty-state">
            <div className="empty-state-illustration" aria-hidden="true">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="40" cy="40" r="36" fill="rgba(64,51,41,0.06)" stroke="rgba(64,51,41,0.12)" strokeWidth="2"/>
                <path d="M28 32C28 30.34 29.34 29 31 29H49C50.66 29 52 30.34 52 32V44C52 45.66 50.66 47 49 47H31C29.34 47 28 45.66 28 44V32Z" fill="rgba(203,91,47,0.15)" stroke="rgba(203,91,47,0.4)" strokeWidth="1.5"/>
                <path d="M34 37H46M34 41H42" stroke="rgba(203,91,47,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="40" cy="56" r="2" fill="rgba(64,51,41,0.2)"/>
                <path d="M36 29V27C36 25.34 37.34 24 39 24H41C42.66 24 44 25.34 44 27V29" stroke="rgba(203,91,47,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="empty-state-title">{t('history.noFeedback')}</p>
            <p className="empty-state-hint">{t('history.noFeedbackHint')}</p>
            <Link to={appKey ? `/submit/${appKey}` : '/submit/demo-app'} className="btn-primary">
              {t('history.submitFeedback')}
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
                <p className="thread-summary">
                  {highlightKeyword(thread.summary, keyword)}
                </p>
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
              aria-label={t('history.previous')}
            >
              ‹ {t('history.previous')}
            </button>
            <span className="pagination-info">
              {t('history.pageInfo', { current: page, total: totalPages })}
            </span>
            <button
              className="pagination-btn"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              aria-label={t('history.next')}
            >
              {t('history.next')} ›
            </button>
          </div>
        )}

        <Link className="back-link" to="/">
          ← {t('history.backToHome')}
        </Link>
      </section>
    </main>
  );
}
