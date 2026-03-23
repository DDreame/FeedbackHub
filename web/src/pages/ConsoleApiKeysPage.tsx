import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  listApiKeys,
  revokeApiKey,
  type ApiKeyRow,
} from '../services/api';
import { getDevApiKey } from '../services/api';
import i18n from '../i18n';

export function ConsoleApiKeysPage() {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const hasApiKey = !!getDevApiKey();

  const fetchKeys = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listApiKeys();
      setKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('console.apiKeys.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (hasApiKey) fetchKeys();
  }, [hasApiKey, fetchKeys]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId);
    setConfirmRevoke(null);
    try {
      await revokeApiKey(keyId);
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
      setToast({ message: t('console.apiKeys.revokeSuccess'), type: 'success' });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : t('console.apiKeys.revokeError'), type: 'error' });
    } finally {
      setRevokingId(null);
    }
  };

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

  if (!hasApiKey) {
    return (
      <main className="shell">
        <section className="detail-card">
          <span className="eyebrow">{t('console.eyebrow')}</span>
          <h1>{t('console.apiKeys.title')}</h1>
          <div className="empty-state">
            <p className="empty-state-title">{t('console.thread.noApiKey')}</p>
            <Link to="/console" className="btn-primary">
              {t('console.thread.configureApiKey')}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      {toast && (
        <div className={`toast toast-${toast.type}`} role="alert">
          {toast.message}
        </div>
      )}

      <section className="detail-card">
        <span className="eyebrow">{t('console.eyebrow')}</span>
        <h1>{t('console.apiKeys.title')}</h1>

        {error && (
          <div className="error-message" role="alert">
            {error}
            <button onClick={fetchKeys} className="retry-btn">
              {t('console.apiKeys.retry')}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="loading">{t('console.apiKeys.loading')}</div>
        ) : keys.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">{t('console.apiKeys.noKeys')}</p>
          </div>
        ) : (
          <div className="api-key-list">
            {keys.map((key) => (
              <div key={key.id} className="api-key-card">
                <div className="api-key-info">
                  <div className="api-key-name">{key.name || t('console.apiKeys.unnamed')}</div>
                  <div className="api-key-meta">
                    <span className="api-key-email">{key.email}</span>
                    <span className="api-key-date">
                      {t('console.apiKeys.created')}: {formatDate(key.created_at)}
                    </span>
                    {key.last_used_at && (
                      <span className="api-key-date">
                        {t('console.apiKeys.lastUsed')}: {formatDate(key.last_used_at)}
                      </span>
                    )}
                  </div>
                  <div className="api-key-id">
                    <code>{key.id.slice(0, 8)}...</code>
                  </div>
                </div>
                <div className="api-key-actions">
                  {confirmRevoke === key.id ? (
                    <div className="api-key-confirm-revoke">
                      <span>{t('console.apiKeys.confirmRevoke')}</span>
                      <button
                        className="btn-danger btn-sm"
                        onClick={() => handleRevoke(key.id)}
                        disabled={revokingId === key.id}
                      >
                        {revokingId === key.id ? t('console.apiKeys.revoking') : t('console.apiKeys.confirm')}
                      </button>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => setConfirmRevoke(null)}
                        disabled={!!revokingId}
                      >
                        {t('console.apiKeys.cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => setConfirmRevoke(key.id)}
                      disabled={!!revokingId}
                    >
                      {t('console.apiKeys.revoke')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="api-key-info-banner">
          <p>{t('console.apiKeys.securityNote')}</p>
        </div>

        <Link className="back-link" to="/console">
          ← {t('console.thread.backToInbox')}
        </Link>
      </section>
    </main>
  );
}
