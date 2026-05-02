import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  devListThreads,
  devBulkUpdateStatus,
  type DeveloperThreadResponse,
} from '../services/api';
import { getDevApiKey } from '../services/api';
import i18n from '../i18n';

export function ConsoleInboxPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [threads, setThreads] = useState<DeveloperThreadResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [bulkStatusTarget, setBulkStatusTarget] = useState<string | null>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const hasApiKey = !!getDevApiKey();

  const STATUS_OPTIONS = [
    { value: '', label: t('console.inbox.allStatuses') },
    { value: 'received', label: t('console.inbox.statusReceived') },
    { value: 'in_review', label: t('console.inbox.statusInReview') },
    { value: 'waiting_for_user', label: t('console.inbox.statusWaitingForUser') },
    { value: 'closed', label: t('console.inbox.statusClosed') },
  ];

  const BULK_STATUS_OPTIONS = [
    { value: 'in_review', label: t('console.inbox.statusInReview') },
    { value: 'waiting_for_user', label: t('console.inbox.statusWaitingForUser') },
    { value: 'closed', label: t('console.inbox.statusClosed') },
  ];

  const CATEGORY_OPTIONS = useMemo(() => {
    const cats = [
      { value: '', label: t('console.inbox.allCategories') },
      { value: '遇到问题', label: t('console.inbox.catBug') },
      { value: '想提建议', label: t('console.inbox.catSuggestion') },
      { value: '想问一下', label: t('console.inbox.catQuestion') },
      { value: '其他', label: t('console.inbox.catOther') },
    ];
    return cats;
  }, [t]);

  const fetchThreads = useCallback(async () => {
    if (!hasApiKey) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await devListThreads({
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        keyword: keyword || undefined,
        limit: 20,
        offset: (page - 1) * 20,
      });
      setThreads(data.threads);
      setTotal(data.total);
      setTotalPages(data.total_pages);
      // Clear selections when page changes
      setSelectedIds(new Set());
      setShowBulkMenu(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('console.inbox.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, categoryFilter, keyword, hasApiKey, t]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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
      case 'received': return t('console.inbox.statusReceived');
      case 'in_review': return t('console.inbox.statusInReview');
      case 'waiting_for_user': return t('console.inbox.statusWaitingForUser');
      case 'closed': return t('console.inbox.statusClosed');
      default: return status;
    }
  };

  const highlightedSummary = (summary: string, kw: string) => {
    if (!kw) return summary;
    const idx = summary.toLowerCase().indexOf(kw.toLowerCase());
    if (idx === -1) return summary;
    return (
      <>
        {summary.slice(0, idx)}
        <mark className="highlight">{summary.slice(idx, idx + kw.length)}</mark>
        {summary.slice(idx + kw.length)}
      </>
    );
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === threads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(threads.map((t) => t.id)));
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatusTarget || selectedIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      const result = await devBulkUpdateStatus(Array.from(selectedIds), bulkStatusTarget);
      if (result.failed.length === 0) {
        setToast({ message: t('console.inbox.bulkUpdated', { count: result.updated }), type: 'success' });
      } else {
        setToast({ message: t('console.inbox.bulkPartial', { updated: result.updated, failed: result.failed.length }), type: 'error' });
      }
      setSelectedIds(new Set());
      setShowBulkMenu(false);
      setBulkStatusTarget(null);
      // Refresh the list
      await fetchThreads();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : t('console.inbox.bulkError'), type: 'error' });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  if (!hasApiKey) {
    return (
      <main className="shell">
        <section className="detail-card">
          <span className="eyebrow">{t('console.eyebrow')}</span>
          <h1>{t('console.inbox.title')}</h1>
          <div className="empty-state">
            <p className="empty-state-title">{t('console.inbox.noApiKey')}</p>
            <Link to="/console" className="btn-primary">
              {t('console.inbox.configureApiKey')}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`} role="alert">
          {toast.message}
        </div>
      )}

      <section className="detail-card">
        <span className="eyebrow">{t('console.eyebrow')}</span>
        <h1>{t('console.inbox.title')}</h1>

        {error && (
          <div className="error-message" role="alert">
            {error}
            <button onClick={fetchThreads} className="retry-btn">
              {t('console.inbox.retry')}
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <div className="history-filter-bar">
          <div className="filter-bar-header">
            <input
              type="search"
              className="filter-keyword-input"
              placeholder={t('console.inbox.searchPlaceholder')}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <button
              className={`filter-toggle-btn ${showFilters ? 'filter-active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              {t('console.inbox.filter')}
            </button>
          </div>

          {showFilters && (
            <div className="filter-bar-body">
              <div className="filter-row">
                <label className="filter-label">
                  {t('console.inbox.filterStatus')}
                  <select
                    className="filter-select"
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="filter-row">
                <label className="filter-label">
                  {t('console.inbox.filterCategory')}
                  <select
                    className="filter-select"
                    value={categoryFilter}
                    onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              {(statusFilter || categoryFilter) && (
                <button
                  className="filter-clear-btn"
                  onClick={() => { setStatusFilter(''); setCategoryFilter(''); setPage(1); }}
                >
                  {t('console.inbox.clearFilters')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="bulk-action-bar">
            <div className="bulk-info">
              <input
                type="checkbox"
                className="bulk-checkbox"
                checked={selectedIds.size === threads.length && threads.length > 0}
                ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < threads.length; }}
                onChange={toggleSelectAll}
                aria-label={t('console.inbox.selectAll')}
              />
              <span>{t('console.inbox.selectedCount', { count: selectedIds.size })}</span>
              <button
                className="btn-secondary btn-sm"
                onClick={() => setSelectedIds(new Set())}
              >
                {t('console.inbox.clearSelection')}
              </button>
            </div>
            <div className="bulk-actions">
              <div className="bulk-status-dropdown">
                <button
                  className="btn-primary btn-sm"
                  onClick={() => setShowBulkMenu(!showBulkMenu)}
                  disabled={showBulkMenu}
                >
                  {t('console.inbox.bulkUpdateStatus')}
                </button>
                {showBulkMenu && (
                  <div className="dropdown-menu bulk-dropdown-menu">
                    <div className="dropdown-menu-header">{t('console.inbox.selectNewStatus')}</div>
                    {BULK_STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        className="dropdown-item"
                        onClick={() => {
                          setBulkStatusTarget(opt.value);
                          setShowBulkMenu(false);
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <button
                      className="dropdown-item dropdown-item-cancel"
                      onClick={() => { setShowBulkMenu(false); setBulkStatusTarget(null); }}
                    >
                      {t('console.inbox.cancel')}
                    </button>
                  </div>
                )}
              </div>
              {bulkStatusTarget && (
                <div className="bulk-confirm">
                  <span className="bulk-confirm-text">
                    {t('console.inbox.confirmBulk', {
                      count: selectedIds.size,
                      status: getStatusLabel(bulkStatusTarget),
                    })}
                  </span>
                  <button
                    className="btn-primary btn-sm"
                    onClick={handleBulkStatusUpdate}
                    disabled={isBulkUpdating}
                  >
                    {isBulkUpdating ? t('console.inbox.updating') : t('console.inbox.confirm')}
                  </button>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => { setBulkStatusTarget(null); }}
                  >
                    {t('console.inbox.cancel')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results count */}
        {!isLoading && !error && (
          <div className="history-results-info">
            {total > 0 ? (
              <span>{t('console.inbox.resultCount', { count: total })}</span>
            ) : (
              <span>{t('console.inbox.noResults')}</span>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="loading">{t('console.inbox.loading')}</div>
        ) : threads.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">{t('console.inbox.emptyInbox')}</p>
          </div>
        ) : (
          <div className="thread-list">
            {threads.map((thread) => {
              const isSelected = selectedIds.has(thread.id);
              return (
                <div
                  key={thread.id}
                  className={`dev-thread-card-wrapper ${isSelected ? 'thread-selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="thread-row-checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(thread.id)}
                    aria-label={t('console.inbox.selectThread')}
                  />
                  <button
                    className="thread-card dev-thread-card"
                    onClick={() => navigate(`/console/thread/${thread.id}`)}
                    style={{ flex: 1 }}
                  >
                    <div className="thread-header">
                      <span className={`status-badge ${getStatusClass(thread.status)}`}>
                        {getStatusLabel(thread.status)}
                      </span>
                      <span className="thread-category">{thread.category}</span>
                      {thread.is_spam && <span className="thread-spam-badge">SPAM</span>}
                      <span className="thread-ref">#{thread.id.slice(0, 8)}</span>
                    </div>
                    <p className="thread-summary">
                      {highlightedSummary(thread.summary, keyword)}
                    </p>
                    <div className="thread-meta">
                      <span className="thread-date">{formatDate(thread.created_at)}</span>
                      <span className="thread-context">
                        {thread.context.app_version} · {thread.context.os_name}
                      </span>
                      {thread.reporter_contact && (
                        <span className="thread-contact">{thread.reporter_contact}</span>
                      )}
                      {thread.assignee_id && (
                        <span className="thread-assignee">👤 {thread.assignee_id.slice(0, 8)}</span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="pagination-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              ‹ {t('console.inbox.previous')}
            </button>
            <span className="pagination-info">
              {t('console.inbox.pageInfo', { current: page, total: totalPages })}
            </span>
            <button
              className="pagination-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              {t('console.inbox.next')} ›
            </button>
          </div>
        )}

        <Link className="back-link" to="/">
          ← {t('console.inbox.backToHome')}
        </Link>
      </section>
    </main>
  );
}
