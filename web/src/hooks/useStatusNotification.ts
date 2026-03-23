import { useState, useEffect, useCallback } from 'react';

export type StatusKey = 'received' | 'in_review' | 'waiting_for_user' | 'closed';

export interface StatusNotification {
  message: string;
  status: StatusKey;
}

const STATUS_NOTIFICATION_MESSAGES: Record<StatusKey, string> = {
  received: '✅ 感谢提交，您的反馈已收到',
  in_review: '👀 开发者已查看您的反馈',
  waiting_for_user: '💬 开发者已回复，等待您的操作',
  closed: '✅ 此反馈已关闭，如有需要可继续回复',
};

function getStatusKey(status: string): StatusKey | null {
  const map: Record<string, StatusKey> = {
    received: 'received',
    in_review: 'in_review',
    waiting_for_user: 'waiting_for_user',
    closed: 'closed',
  };
  return map[status] ?? null;
}

function getStorageKey(threadId: string): string {
  return `feedback_thread_status_${threadId}`;
}

export function useStatusNotification(threadId: string, currentStatus: string) {
  const [notification, setNotification] = useState<StatusNotification | null>(null);

  const dismiss = useCallback(() => {
    setNotification(null);
  }, []);

  useEffect(() => {
    if (!threadId || !currentStatus) return;

    const statusKey = getStatusKey(currentStatus);
    if (!statusKey) return;

    const storageKey = getStorageKey(threadId);
    const cached = localStorage.getItem(storageKey);

    if (cached) {
      const previousStatus = getStatusKey(cached);
      if (previousStatus && previousStatus !== statusKey) {
        // Status changed - show notification for the NEW status
        const message = STATUS_NOTIFICATION_MESSAGES[statusKey];
        setTimeout(() => setNotification({ message, status: statusKey }), 0);
      }
    }

    // Always update cached status
    localStorage.setItem(storageKey, currentStatus);
  }, [threadId, currentStatus]);

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(dismiss, 10000);
    return () => clearTimeout(timer);
  }, [notification, dismiss]);

  return { notification, dismiss };
}
