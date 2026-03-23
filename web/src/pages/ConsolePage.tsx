import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getDevApiKey, setDevApiKey, clearDevApiKey } from '../services/api';

export function ConsolePage() {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(!!getDevApiKey());

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

  const handleRevoke = () => {
    clearDevApiKey();
    setApiKey('');
    setSaved(false);
  };

  return (
    <main className="shell">
      <section className="detail-card">
        <span className="eyebrow">{t('console.eyebrow')}</span>
        <h1>{t('console.title')}</h1>

        {saved ? (
          <div className="console-key-status">
            <div className="key-saved-badge">
              <span className="key-status-icon">🔑</span>
              <span>{t('console.apiKeySaved')}</span>
            </div>
            <p className="key-hint">{t('console.apiKeyHint')}</p>
            <button className="btn-danger" onClick={handleRevoke}>
              {t('console.apiKeyRevoke')}
            </button>
          </div>
        ) : (
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
        )}

        <Link className="back-link" to="/">
          ← {t('console.backToHome')}
        </Link>
      </section>
    </main>
  );
}
