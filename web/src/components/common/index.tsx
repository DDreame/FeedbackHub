import { type FC, type ReactNode, useEffect, useRef } from 'react';

/* ── StatusBadge ── */
const STATUS_COLORS: Record<string, string> = {
  received: 'var(--fh-status-unread)',
  in_review: 'var(--fh-status-in-progress)',
  waiting_for_user: 'var(--fh-status-waiting)',
  closed: 'var(--fh-status-closed)',
};

const STATUS_NAMES: Record<string, string> = {
  received: '未读',
  in_review: '处理中',
  waiting_for_user: '等待回复',
  closed: '已关闭',
};

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: FC<StatusBadgeProps> = ({ status }) => {
  const color = STATUS_COLORS[status] || 'var(--fh-text-tertiary)';
  const label = STATUS_NAMES[status] || status;
  return (
    <span
      className="fh-badge"
      style={{ background: color }}
    >
      {label}
    </span>
  );
};

/* ── EmptyState ── */
interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState: FC<EmptyStateProps> = ({
  icon = '📋',
  title,
  description,
  action,
}) => (
  <div className="fh-empty-state">
    <div className="fh-empty-icon">{icon}</div>
    <div className="fh-empty-title">{title}</div>
    {description && <div className="fh-empty-desc">{description}</div>}
    {action && <div style={{ marginTop: 'var(--fh-space-lg)' }}>{action}</div>}
  </div>
);

/* ── Toast ── */
interface ToastProps {
  message: string;
  onDone: () => void;
  duration?: number;
}

export const Toast: FC<ToastProps> = ({ message, onDone, duration = 2500 }) => {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(onDone, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDone, duration]);

  return <div className="fh-toast">{message}</div>;
};

/* ── Slide-in animation utility ── */
export const slideInKeyframes = {
  from: { opacity: 0, transform: 'translateY(8px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
};

export const slideInStyle: React.CSSProperties = {
  animation: 'fh-msg-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
};
