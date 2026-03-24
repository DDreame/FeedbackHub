import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getNotificationPrefs, updateNotificationPrefs, type NotificationPrefs } from '../services/api';

export function NotificationPrefsPage() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchPrefs = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getNotificationPrefs();
      setPrefs(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('notifPrefs.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const handleToggle = async (field: keyof Pick<NotificationPrefs, 'notify_on_reply' | 'notify_on_status_change' | 'notify_on_close'>) => {
    if (!prefs || isSaving) return;
    const newValue = !prefs[field];
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await updateNotificationPrefs({ [field]: newValue });
      setPrefs(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('notifPrefs.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="shell">
      <section className="detail-card">
        <span className="eyebrow">{t('notifPrefs.eyebrow')}</span>
        <h1>{t('notifPrefs.title')}</h1>
        <p className="notif-prefs-desc">{t('notifPrefs.description')}</p>

        {loadError && (
          <div className="error-message" role="alert">
            {loadError}
            <button onClick={fetchPrefs} className="retry-btn">
              {t('history.retry')}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="loading">{t('app.loading')}</div>
        ) : prefs ? (
          <div className="notif-prefs-list">
            <div className="notif-prefs-item">
              <div className="notif-prefs-info">
                <span className="notif-prefs-label">{t('notifPrefs.notifyOnReply')}</span>
                <span className="notif-prefs-hint">{t('notifPrefs.notifyOnReplyHint')}</span>
              </div>
              <button
                className={`toggle-switch ${prefs.notify_on_reply ? 'toggle-on' : 'toggle-off'}`}
                onClick={() => handleToggle('notify_on_reply')}
                disabled={isSaving}
                aria-label={t('notifPrefs.notifyOnReply')}
                aria-checked={prefs.notify_on_reply}
                role="switch"
              >
                <span className="toggle-knob" />
              </button>
            </div>

            <div className="notif-prefs-item">
              <div className="notif-prefs-info">
                <span className="notif-prefs-label">{t('notifPrefs.notifyOnStatusChange')}</span>
                <span className="notif-prefs-hint">{t('notifPrefs.notifyOnStatusChangeHint')}</span>
              </div>
              <button
                className={`toggle-switch ${prefs.notify_on_status_change ? 'toggle-on' : 'toggle-off'}`}
                onClick={() => handleToggle('notify_on_status_change')}
                disabled={isSaving}
                aria-label={t('notifPrefs.notifyOnStatusChange')}
                aria-checked={prefs.notify_on_status_change}
                role="switch"
              >
                <span className="toggle-knob" />
              </button>
            </div>

            <div className="notif-prefs-item">
              <div className="notif-prefs-info">
                <span className="notif-prefs-label">{t('notifPrefs.notifyOnClose')}</span>
                <span className="notif-prefs-hint">{t('notifPrefs.notifyOnCloseHint')}</span>
              </div>
              <button
                className={`toggle-switch ${prefs.notify_on_close ? 'toggle-on' : 'toggle-off'}`}
                onClick={() => handleToggle('notify_on_close')}
                disabled={isSaving}
                aria-label={t('notifPrefs.notifyOnClose')}
                aria-checked={prefs.notify_on_close}
                role="switch"
              >
                <span className="toggle-knob" />
              </button>
            </div>
          </div>
        ) : null}

        {saveError && (
          <div className="error-message" role="alert">
            {saveError}
          </div>
        )}

        {saveSuccess && (
          <div className="success-message" role="alert">
            {t('notifPrefs.saveSuccess')}
          </div>
        )}

        <Link className="back-link" to="/history">
          ← {t('notifPrefs.backToHistory')}
        </Link>
      </section>
    </main>
  );
}
