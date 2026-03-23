import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listApps, createApp, type AppResponse } from '../services/api';

export function AppsPage() {
  const { t } = useTranslation();
  const [apps, setApps] = useState<AppResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [appName, setAppName] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    listApps()
      .then(setApps)
      .catch(() => setError(t('app.loadError')))
      .finally(() => setIsLoading(false));
  }, [t]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const newApp = await createApp({ name: appName.trim(), description: appDescription.trim() });
      setApps((prev) => [newApp, ...prev]);
      setAppName('');
      setAppDescription('');
      setShowForm(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('app.loadError'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="shell">
      <section className="detail-card">
        <span className="eyebrow">{t('apps.eyebrow')}</span>
        <h1>{t('apps.title')}</h1>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="loading">{t('app.loading')}</div>
        ) : (
          <>
            {/* App List */}
            {apps.length > 0 ? (
              <div className="apps-list">
                {apps.map((app) => (
                  <div key={app.id} className="app-card">
                    <div className="app-info">
                      <h3>{app.name}</h3>
                      {app.description && <p className="app-description">{app.description}</p>}
                      <span className="app-key">{app.app_key}</span>
                    </div>
                    <div className="app-actions">
                      <Link to={`/submit/${app.app_key}`} className="btn-primary">
                        {t('apps.submitFeedback')}
                      </Link>
                      <Link to={`/history/${app.app_key}`} className="btn-secondary">
                        {t('apps.viewHistory')}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>{t('apps.noApps')}</p>
              </div>
            )}

            {/* Create App */}
            {showForm ? (
              <form onSubmit={handleCreate} className="create-app-form">
                <h3>{t('apps.createTitle')}</h3>
                <div className="form-group">
                  <label className="form-label" htmlFor="app-name">
                    {t('apps.nameLabel')}
                  </label>
                  <input
                    id="app-name"
                    type="text"
                    className="form-input"
                    placeholder={t('apps.namePlaceholder')}
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="app-desc">
                    {t('apps.descLabel')}
                  </label>
                  <input
                    id="app-desc"
                    type="text"
                    className="form-input"
                    placeholder={t('apps.descPlaceholder')}
                    value={appDescription}
                    onChange={(e) => setAppDescription(e.target.value)}
                  />
                </div>
                {createError && <div className="error-message">{createError}</div>}
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShowForm(false);
                      setCreateError(null);
                    }}
                    disabled={isCreating}
                  >
                    {t('apps.cancel')}
                  </button>
                  <button type="submit" className="btn-primary" disabled={isCreating || !appName.trim()}>
                    {isCreating ? t('app.loading') : t('apps.create')}
                  </button>
                </div>
              </form>
            ) : (
              <button className="btn-primary" onClick={() => setShowForm(true)}>
                + {t('apps.createApp')}
              </button>
            )}
          </>
        )}

        <Link className="back-link" to="/">
          ← {t('apps.backToHome')}
        </Link>
      </section>
    </main>
  );
}
