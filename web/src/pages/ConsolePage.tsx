import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getDevApiKey, setDevApiKey, clearDevApiKey } from '../services/api';

export function ConsolePage() {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(!!getDevApiKey());

  // If already configured, show a link to the inbox
  if (saved) {
    return (
      <main className="shell">
        <section className="detail-card">
          <span className="eyebrow">{t('console.eyebrow')}</span>
          <h1>{t('console.title')}</h1>

          <div className="console-key-status">
            <div className="key-saved-badge">
              <span className="key-status-icon">🔑</span>
              <span>{t('console.apiKeySaved')}</span>
            </div>
            <p className="key-hint">{t('console.apiKeyHint')}</p>
            <div className="console-nav-links">
              <Link to="/console/inbox" className="btn-primary">
                {t('console.goToInbox')}
              </Link>
              <Link to="/console/analytics" className="btn-secondary">
                {t('console.goToAnalytics')}
              </Link>
              <Link to="/console/templates" className="btn-secondary">
                {t('console.goToTemplates')}
              </Link>
              <Link to="/console/api-keys" className="btn-secondary">
                {t('console.goToApiKeys')}
              </Link>
              <button className="btn-danger" onClick={() => { clearDevApiKey(); setSaved(false); }}>
                {t('console.apiKeyRevoke')}
              </button>
            </div>
          </div>

          <Link className="back-link" to="/">
            ← {t('console.backToHome')}
          </Link>
        </section>
      </main>
    );
  }

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError(t('console.apiKeyError'));
      return;
    }
    setDevApiKey(trimmed);
    setSaved(true);
    setError('');
  };

  return (
    <main className="shell">
      <section className="detail-card">
        <span className="eyebrow">{t('console.eyebrow')}</span>
        <h1>{t('console.title')}</h1>

        <div className="console-key-form">
          <p className="console-description">
            {t('console.apiKeyHint')}
          </p>
          <div className="form-group">
            <label className="form-label" htmlFor="api-key-input">
              {t('console.apiKeyLabel')}
            </label>
            <input
              id="api-key-input"
              type="text"
              className="form-input"
              placeholder={t('console.apiKeyPlaceholder')}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              autoComplete="off"
              spellCheck={false}
            />
            {error && <span className="form-error">{error}</span>}
          </div>
          <button className="btn-primary" onClick={handleSave}>
            {t('console.apiKeySave')}
          </button>
        </div>

        <Link className="back-link" to="/">
          ← {t('console.backToHome')}
        </Link>
      </section>
    </main>
  );
}
