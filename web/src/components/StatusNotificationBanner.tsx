import type { StatusKey } from '../hooks/useStatusNotification';
import { CloseIcon } from './icons';

interface Props {
  message: string;
  status: StatusKey;
  onDismiss: () => void;
}

const STATUS_CLASSES: Record<StatusKey, string> = {
  received: 'banner-received',
  in_review: 'banner-in-review',
  waiting_for_user: 'banner-waiting',
  closed: 'banner-closed',
};

export function StatusNotificationBanner({ message, status, onDismiss }: Props) {
  return (
    <div className={`status-notification-banner ${STATUS_CLASSES[status]}`} role="alert">
      <span className="banner-message">{message}</span>
      <button className="banner-dismiss" onClick={onDismiss} aria-label="关闭">
        <CloseIcon />
      </button>
    </div>
  );
}
