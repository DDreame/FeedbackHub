import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { devListThreads, type DeveloperThreadResponse } from '../services/api';
import { getDevApiKey } from '../services/api';

interface Stats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  recentTrend: { date: string; count: number }[];
}

export function ConsoleAnalyticsPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  const hasApiKey = !!getDevApiKey();

  const fetchStats = useCallback(async () => {
    if (!hasApiKey) return;
    setIsLoading(true);
    setError(null);
    try {
      // Fetch all threads (up to 500 for analytics)
      const allThreads: DeveloperThreadResponse[] = [];
      let page = 1;
      const limit = 100;

      while (true) {
        const data = await devListThreads({ limit, offset: (page - 1) * limit });
        allThreads.push(...data.threads);
        if (data.threads.length < limit || allThreads.length >= 500) break;
        page++;
      }

      const now = new Date();
      const cutoff = new Date();
      if (dateRange === '7d') cutoff.setDate(now.getDate() - 7);
      else if (dateRange === '30d') cutoff.setDate(now.getDate() - 30);
      else cutoff.setDate(now.getDate() - 90);

      // Filter by date
      const recentThreads = allThreads.filter(
        (t) => new Date(t.created_at) >= cutoff
      );

      // Compute by-status
      const byStatus: Record<string, number> = {};
      for (const thread of recentThreads) {
        byStatus[thread.status] = (byStatus[thread.status] || 0) + 1;
      }

      // Compute by-category
      const byCategory: Record<string, number> = {};
      for (const thread of recentThreads) {
        byCategory[thread.category] = (byCategory[thread.category] || 0) + 1;
      }

      // Compute trend (daily counts)
      const trendMap: Record<string, number> = {};
      for (const thread of recentThreads) {
        const date = new Date(thread.created_at).toISOString().slice(0, 10);
        trendMap[date] = (trendMap[date] || 0) + 1;
      }
      const recentTrend = Object.entries(trendMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));

      setStats({
        total: recentThreads.length,
        byStatus,
        byCategory,
        recentTrend,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('console.analytics.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [hasApiKey, dateRange, t]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const maxCategoryCount = stats ? Math.max(...Object.values(stats.byCategory), 1) : 1;
  const maxTrendCount = stats ? Math.max(...stats.recentTrend.map((d) => d.count), 1) : 1;

  const statusColors: Record<string, string> = {
    received: 'rgba(37, 99, 235, 0.7)',
    in_review: 'rgba(203, 91, 47, 0.7)',
    waiting_for_user: 'rgba(234, 179, 8, 0.7)',
    closed: 'rgba(107, 114, 128, 0.7)',
  };

  if (!hasApiKey) {
    return (
      <main className="shell">
        <section className="detail-card">
          <span className="eyebrow">{t('console.eyebrow')}</span>
          <h1>{t('console.analytics.title')}</h1>
          <div className="empty-state">
            <p className="empty-state-title">{t('console.analytics.noApiKey')}</p>
            <Link to="/console" className="btn-primary">
              {t('console.analytics.configureApiKey')}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="detail-card">
        <span className="eyebrow">{t('console.eyebrow')}</span>
        <h1>{t('console.analytics.title')}</h1>

        {error && (
          <div className="error-message" role="alert">
            {error}
            <button onClick={fetchStats} className="retry-btn">
              {t('console.analytics.retry')}
            </button>
          </div>
        )}

        {/* Date Range Selector */}
        <div className="analytics-range-bar">
          <span className="analytics-range-label">{t('console.analytics.dateRange')}</span>
          <div className="analytics-range-buttons">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                className={`analytics-range-btn ${dateRange === range ? 'active' : ''}`}
                onClick={() => setDateRange(range)}
              >
                {range === '7d' ? t('console.analytics.7d')
                  : range === '30d' ? t('console.analytics.30d')
                  : t('console.analytics.90d')}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="loading">{t('console.analytics.loading')}</div>
        ) : stats ? (
          <div className="analytics-grid">
            {/* Total */}
            <div className="analytics-card analytics-card-wide">
              <div className="analytics-card-label">{t('console.analytics.totalFeedback')}</div>
              <div className="analytics-card-value">{stats.total}</div>
            </div>

            {/* Status Distribution */}
            <div className="analytics-card">
              <div className="analytics-card-label">{t('console.analytics.statusDistribution')}</div>
              <div className="analytics-status-bars">
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <div key={status} className="analytics-status-row">
                    <span className="analytics-status-label">
                      {status === 'received' ? t('console.analytics.statusReceived')
                        : status === 'in_review' ? t('console.analytics.statusInReview')
                        : status === 'waiting_for_user' ? t('console.analytics.statusWaitingForUser')
                        : status === 'closed' ? t('console.analytics.statusClosed')
                        : status}
                    </span>
                    <div className="analytics-bar-track">
                      <div
                        className="analytics-bar-fill"
                        style={{
                          width: `${(count / Math.max(stats.total, 1)) * 100}%`,
                          background: statusColors[status] || 'rgba(64, 51, 41, 0.5)',
                        }}
                      />
                    </div>
                    <span className="analytics-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Distribution */}
            <div className="analytics-card">
              <div className="analytics-card-label">{t('console.analytics.categoryDistribution')}</div>
              <div className="analytics-category-bars">
                {Object.entries(stats.byCategory).map(([cat, count]) => (
                  <div key={cat} className="analytics-category-row">
                    <span className="analytics-category-label">{cat}</span>
                    <div className="analytics-bar-track">
                      <div
                        className="analytics-bar-fill"
                        style={{
                          width: `${(count / maxCategoryCount) * 100}%`,
                          background: 'rgba(203, 91, 47, 0.6)',
                        }}
                      />
                    </div>
                    <span className="analytics-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trend Chart */}
            <div className="analytics-card analytics-card-wide">
              <div className="analytics-card-label">{t('console.analytics.feedbackTrend')}</div>
              <div className="analytics-trend-chart">
                {stats.recentTrend.length === 0 ? (
                  <div className="analytics-empty">{t('console.analytics.noData')}</div>
                ) : (
                  <div className="analytics-trend-bars">
                    {stats.recentTrend.map(({ date, count }) => (
                      <div key={date} className="analytics-trend-bar-wrapper" title={`${date}: ${count}`}>
                        <div
                          className="analytics-trend-bar"
                          style={{ height: `${(count / maxTrendCount) * 100}%` }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {stats.recentTrend.length > 0 && (
                <div className="analytics-trend-labels">
                  <span>{stats.recentTrend[0]?.date}</span>
                  <span>{stats.recentTrend[stats.recentTrend.length - 1]?.date}</span>
                </div>
              )}
            </div>
          </div>
        ) : null}

        <Link className="back-link" to="/console/inbox">
          ← {t('console.analytics.backToInbox')}
        </Link>
      </section>
    </main>
  );
}
