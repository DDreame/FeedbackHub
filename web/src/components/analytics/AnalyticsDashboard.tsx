import { type FC } from 'react';

type DateRange = '7d' | '30d' | '90d';

interface StatCard {
  label: string;
  value: string | number;
  change: string;
  changePositive: boolean;
  color: string;
}

interface FunnelStep {
  label: string;
  count: number;
  pct: number;
  color: string;
  warning?: boolean;
}

interface FeatureUsage {
  name: string;
  pct: number;
  color: string;
}

interface AnalyticsDashboardProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  statCards: StatCard[];
  funnel: FunnelStep[];
  featureUsage: FeatureUsage[];
}

const RANGE_LABELS: Record<DateRange, string> = {
  '7d': '最近 7 天',
  '30d': '最近 30 天',
  '90d': '最近 90 天',
};

export const AnalyticsDashboard: FC<AnalyticsDashboardProps> = ({
  dateRange,
  onDateRangeChange,
  statCards,
  funnel,
  featureUsage,
}) => {
  return (
    <div className="fh-analytics-panel">
      {/* Date Range Selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--fh-space-xl)' }}>
        <div style={{ display: 'flex', gap: 'var(--fh-space-sm)' }}>
          {(['7d', '30d', '90d'] as DateRange[]).map((range) => (
            <button
              key={range}
              className={`fh-btn${dateRange === range ? ' fh-btn-primary' : ''}`}
              onClick={() => onDateRangeChange(range)}
            >
              {RANGE_LABELS[range]}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="fh-card-grid">
        {statCards.map((card, i) => (
          <div key={i} className="fh-stat-card">
            <div className="fh-stat-label">{card.label}</div>
            <div className="fh-stat-value" style={{ color: card.color }}>
              {card.value}
            </div>
            <div
              className="fh-stat-change"
              style={{ color: card.changePositive ? 'var(--fh-status-resolved)' : 'var(--fh-accent-danger)' }}
            >
              {card.changePositive ? '↑' : '↓'} {card.change}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="fh-chart-grid">
        {/* Funnel */}
        <div className="fh-chart-card">
          <div className="fh-chart-title">转化漏斗</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fh-space-sm)' }}>
            {funnel.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--fh-space-md)' }}>
                <div style={{ width: 80, fontSize: 12, color: 'var(--fh-text-secondary)', textAlign: 'right' }}>
                  {step.label}
                </div>
                <div style={{ flex: 1, height: 24, background: 'var(--fh-bg-tertiary)', borderRadius: 'var(--fh-radius-sm)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.max(step.pct, 3)}%`,
                      height: '100%',
                      background: step.color,
                      borderRadius: 'var(--fh-radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 'var(--fh-space-sm)',
                      fontSize: 11,
                      color: '#fff',
                    }}
                  >
                    {step.count.toLocaleString()}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: step.warning ? 'var(--fh-accent-danger)' : 'var(--fh-text-tertiary)', width: 40, textAlign: 'right' }}>
                  {step.pct}%{step.warning ? ' ⚠' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Usage */}
        <div className="fh-chart-card">
          <div className="fh-chart-title">功能使用排行</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fh-space-sm)' }}>
            {featureUsage.map((feat, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--fh-space-md)' }}>
                <div style={{ fontFamily: 'var(--fh-font-mono)', fontSize: 11, color: 'var(--fh-text-tertiary)', width: 16 }}>
                  {i + 1}
                </div>
                <div style={{ width: 100, fontSize: 12, color: 'var(--fh-text-secondary)' }}>
                  {feat.name}
                </div>
                <div style={{ flex: 1, height: 20, background: 'var(--fh-bg-tertiary)', borderRadius: 'var(--fh-radius-sm)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${feat.pct}%`,
                      height: '100%',
                      background: feat.color,
                      borderRadius: 'var(--fh-radius-sm)',
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
                <div style={{ fontFamily: 'var(--fh-font-mono)', fontSize: 11, color: 'var(--fh-text-primary)', width: 40, textAlign: 'right' }}>
                  {feat.pct}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
