import { type FC, useState } from 'react';
import {
  type DeveloperThreadResponse,
  type DevMessageResponse,
  STATUS_LABELS,
} from '../../services/api';

interface TicketInfoProps {
  ticket: DeveloperThreadResponse;
  internalNotes: DevMessageResponse[];
  onStatusChange: (newStatus: string) => void;
  onAddNote: (body: string) => void;
  onDeleteNote: (index: number) => void;
  onCloseTicket: () => void;
}

export const TicketInfo: FC<TicketInfoProps> = ({
  ticket,
  internalNotes,
  onStatusChange,
  onAddNote,
  onDeleteNote,
  onCloseTicket,
}) => {
  const [noteValue, setNoteValue] = useState('');

  const handleAddNote = () => {
    const trimmed = noteValue.trim();
    if (!trimmed) return;
    onAddNote(trimmed);
    setNoteValue('');
  };

  const statusOptions = Object.entries(STATUS_LABELS);

  return (
    <>
      {/* Status */}
      <div className="fh-info-section">
        <div className="fh-info-section-title">状态</div>
        <select
          className="fh-status-select"
          value={ticket.status}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          {statusOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* User Info */}
      <div className="fh-info-section">
        <div className="fh-info-section-title">用户信息</div>
        <div className="fh-info-row">
          <span className="fh-label">设备</span>
          <span className="fh-value">
            {ticket.context?.device_model || '—'}
          </span>
        </div>
        <div className="fh-info-row">
          <span className="fh-label">平台</span>
          <span className="fh-value">
            {ticket.context?.os_name} {ticket.context?.os_version}
          </span>
        </div>
      </div>

      {/* App */}
      <div className="fh-info-section">
        <div className="fh-info-section-title">App</div>
        <div className="fh-info-row">
          <span className="fh-label">版本</span>
          <span className="fh-value">
            {ticket.context?.app_version || '—'}
            {ticket.context?.build_number
              ? ` (${ticket.context.build_number})`
              : ''}
          </span>
        </div>
      </div>

      {/* Time */}
      <div className="fh-info-section">
        <div className="fh-info-section-title">时间</div>
        <div className="fh-info-row">
          <span className="fh-label">创建</span>
          <span className="fh-value">
            {formatDate(ticket.created_at)}
          </span>
        </div>
        <div className="fh-info-row">
          <span className="fh-label">更新</span>
          <span className="fh-value">
            {formatDate(ticket.updated_at)}
          </span>
        </div>
      </div>

      <hr className="fh-info-divider" />

      {/* Quick Actions */}
      <div className="fh-info-section">
        <div className="fh-info-section-title">快捷操作</div>
        <button
          className="fh-btn fh-btn-danger"
          style={{ width: '100%', marginBottom: 'var(--fh-space-sm)' }}
          onClick={onCloseTicket}
        >
          关闭工单
        </button>
      </div>

      <hr className="fh-info-divider" />

      {/* Internal Notes */}
      <div className="fh-info-section">
        <div className="fh-info-section-title">内部备注</div>

        {internalNotes.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--fh-text-tertiary)', textAlign: 'center', padding: 'var(--fh-space-sm)' }}>
            暂无内部备注
          </div>
        ) : (
          internalNotes.map((note, i) => (
            <div key={note.id || i} className="fh-internal-note">
              <button
                className="fh-note-delete"
                onClick={() => onDeleteNote(i)}
                title="删除"
              >
                ×
              </button>
              {note.body}
              <div className="fh-note-time">{formatDate(note.created_at)}</div>
            </div>
          ))
        )}

        <div className="fh-note-composer">
          <input
            type="text"
            placeholder="添加备注..."
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddNote();
            }}
          />
          <button
            className="fh-btn"
            onClick={handleAddNote}
            style={{ fontSize: 11 }}
          >
            添加
          </button>
        </div>
      </div>
    </>
  );
};

function formatDate(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
