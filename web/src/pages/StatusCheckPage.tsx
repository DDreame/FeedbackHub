import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPublicThreadStatus, type PublicStatusResponse } from '../services/api';
import { formatRefNumber } from '../utils/formatRefNumber';

const CATEGORY_KEYS: Record<string, string> = {
  '遇到问题': 'submit.encounteredProblem',
  '想提建议': 'submit.haveSuggestion',
  '想问一下': 'submit.haveQuestion',
  '其他': 'submit.other',
};

const STATUS_KEYS: Record<string, string> = {
  received: 'history.received',
  in_review: 'history.inReview',
  waiting_for_user: 'history.waitingForUser',
  closed: 'history.closed',
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const statusKey = STATUS_KEYS[status] || status;
  const label = t(statusKey);

  const cssClass: Record<string, string> = {
    received: 'status-received',
    in_review: 'status-in_review',
    waiting_for_user: 'status-waiting_for_user',
    closed: 'status-closed',
  };

  return (
    <span className={`status-badge ${cssClass[status] || ''}`}>
      {label}
    </span>
  );
}

export function StatusCheckPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [inputValue, setInputValue] = useState(searchParams.get('ref') || '');
  const [result, setResult] = useState<PublicStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-fetch if ref param is provided in URL
  useEffect(() => {
    const refParam = searchParams.get('ref');
    if (refParam) {
      setInputValue(refParam);
      handleCheck(refParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheck = async (ref?: string) => {
    const value = ref || inputValue.trim();
    if (!value) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await getPublicThreadStatus(value);
      setResult(data);
      // Update URL with ref param for shareable links
      setSearchParams({ ref: value });
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        setError(t('statusCheck.notFound'));
      } else {
        setError(t('statusCheck.fetchError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCheck();
  };

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  const getCategoryLabel = (category: string) => {
    const key = CATEGORY_KEYS[category];
    return key ? t(key) : category;
  };

  return (
    <main className="shell">
      <section className="detail-card">
        <span className="eyebrow">{t('statusCheck.eyebrow')}</span>
        <h1>{t('statusCheck.title')}</h1>
        <p className="lead">{t('statusCheck.description')}</p>

        <form className="status-check-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="ref-input">
              {t('statusCheck.referenceLabel')}
            </label>
            <input
              id="ref-input"
              type="text"
              className="form-input"
              placeholder={t('statusCheck.referencePlaceholder')}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading || !inputValue.trim()}
          >
            {isLoading ? t('statusCheck.checking') : t('statusCheck.checkButton')}
          </button>
        </form>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        {result && (
          <div className="status-check-result">
            <div className="status-check-header">
              <span className="status-check-ref">
                {t('statusCheck.referenceNumber')}: <strong>{result.reference_number || formatRefNumber(result.thread_id)}</strong>
              </span>
              <StatusBadge status={result.status} />
            </div>

            <dl className="status-check-details">
              <div className="status-check-row">
                <dt>{t('statusCheck.category')}</dt>
                <dd>{getCategoryLabel(result.category)}</dd>
              </div>
              <div className="status-check-row">
                <dt>{t('statusCheck.lastUpdate')}</dt>
                <dd>{formatDate(result.latest_public_message_at)}</dd>
              </div>
            </dl>

            <p className="status-check-hint">
              {t('statusCheck.resultHint')}
            </p>

            <Link className="route-link" to="/">
              {t('statusCheck.backToHome')}
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
