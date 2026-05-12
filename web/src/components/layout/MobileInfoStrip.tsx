import { type FC } from 'react';

export interface MobileTicketMeta {
  status: string;
  statusLabel: string;
  statusColor: string;
  device: string;
  version: string;
  onStatusChange?: (newStatus: string) => void;
}

interface MobileInfoStripProps {
  ticket: MobileTicketMeta | null;
  statusOptions: Array<{ value: string; label: string }>;
}

export const MobileInfoStrip: FC<MobileInfoStripProps> = ({ ticket, statusOptions }) => {
  if (!ticket) return null;

  return (
    <div className="fh-mobile-info-strip">
      <select
        value={ticket.status}
        onChange={(e) => ticket.onStatusChange?.(e.target.value)}
      >
        {statusOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="fh-mi-item">📱 {ticket.device}</div>
      <div className="fh-mi-item">📦 v{ticket.version}</div>
    </div>
  );
};
