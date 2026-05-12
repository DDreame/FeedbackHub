import { type FC } from 'react';
import { type DeveloperThreadResponse } from '../../services/api';

/* Status dot colors — matches theme tokens */
const STATUS_COLORS: Record<string, string> = {
  received: 'var(--fh-status-unread)',
  in_review: 'var(--fh-status-in-progress)',
  waiting_for_user: 'var(--fh-status-waiting)',
  closed: 'var(--fh-status-closed)',
};

interface TicketListProps {
  tickets: DeveloperThreadResponse[];
  activeTicketId: string | null;
  onSelectTicket: (id: string) => void;
}

export const TicketList: FC<TicketListProps> = ({
  tickets,
  activeTicketId,
  onSelectTicket,
}) => {
  if (tickets.length === 0) {
    return (
      <div className="fh-empty-state">
        <div className="fh-empty-icon">📋</div>
        <div className="fh-empty-title">还没有反馈</div>
        <div className="fh-empty-desc">当用户提交反馈后，会在这里显示</div>
      </div>
    );
  }

  return (
    <>
      {tickets.map((ticket) => {
        const isActive = ticket.id === activeTicketId;
        return (
          <div
            key={ticket.id}
            className={`fh-ticket-item${isActive ? ' active' : ''}`}
            onClick={() => onSelectTicket(ticket.id)}
          >
            <div
              className="fh-status-dot"
              style={{ background: STATUS_COLORS[ticket.status] || 'var(--fh-text-tertiary)' }}
            />
            <div className="fh-ticket-content">
              <div className="fh-ticket-summary">{ticket.summary}</div>
              <div className="fh-ticket-meta">
                <span>{formatRelativeTime(ticket.created_at)}</span>
                <span>{ticket.context?.device_model || '—'}</span>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};

/* ── TicketListFilter ── */
interface TicketListFilterProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
}

export const TicketListFilter: FC<TicketListFilterProps> = ({
  searchValue,
  onSearchChange,
}) => {
  return (
    <div className="fh-ticket-list-search">
      <input
        type="text"
        placeholder="搜索反馈..."
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  );
};

/* ── Helpers ── */
function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHrs < 24) return `${diffHrs} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN');
}
