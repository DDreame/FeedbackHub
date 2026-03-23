import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  createThreadAtomic,
  STATUS_LABELS,
} from '../services/api';
import { formatRefNumber } from '../utils/formatRefNumber';

const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_CONTENT_LENGTH = 2000;

type Step = 'category' | 'form' | 'confirmation';

interface SubmitResult {
  threadId: string;
}

interface Category {
  id: string;
  icon: string;
}

export function FeedbackSubmitPage() {
  const { t } = useTranslation();
  const { appKey } = useParams<{ appKey: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('category');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [allowContact, setAllowContact] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [attachmentErrors, setAttachmentErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [expandedAttachment, setExpandedAttachment] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const CATEGORIES: (Category & { label: string })[] = [
    { id: '遇到问题', icon: '❌', label: t('submit.encounteredProblem') },
    { id: '想提建议', icon: '💡', label: t('submit.haveSuggestion') },
    { id: '想问一下', icon: '❓', label: t('submit.haveQuestion') },
    { id: '其他', icon: '📝', label: t('submit.other') },
  ];

  // Unsaved changes guard
  const hasUnsavedContent = step === 'form' && (content.trim().length > 0 || attachments.length > 0);
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedContent) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedContent]);

  // Keyboard submit: Ctrl/Cmd + Enter
  const handleContentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      const form = e.currentTarget.closest('form');
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.click();
        }
      }
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setStep('form');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const errors: string[] = [];
    const newAttachments: string[] = [];

    for (const file of files) {
      if (attachments.length + newAttachments.length >= MAX_ATTACHMENTS) {
        errors.push(t('submit.maxAttachmentsError', { max: MAX_ATTACHMENTS }));
        break;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(t('submit.fileSizeError', { name: file.name }));
        continue;
      }
      if (!file.type.startsWith('image/')) {
        errors.push(t('submit.notImageError', { name: file.name }));
        continue;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setAttachments((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    }

    setAttachmentErrors(errors);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError(t('submit.contentRequired'));
      return;
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      setError(t('submit.contentTooLong', { max: MAX_CONTENT_LENGTH }));
      return;
    }
    if (allowContact && contact.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact.trim())) {
        setContactError(t('submit.invalidEmail'));
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const body = content.trim();
      const firstLine = body.split('\n')[0];
      const summary = firstLine.length > 120 ? firstLine.slice(0, 117) + '...' : firstLine;

      const result = await createThreadAtomic(
        selectedCategory,
        summary,
        body,
        allowContact ? contact : undefined,
        { current_route: `/submit/${appKey}` },
        attachments.length > 0 ? attachments : undefined,
        allowContact ? contact : undefined
      );

      setSubmitResult({ threadId: result.thread_id });
      setStep('confirmation');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('submit.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 'form') {
      setStep('category');
    } else if (step === 'confirmation') {
      navigate('/');
    }
  };

  return (
    <main className="shell">
      <section className="detail-card">
        <span className="eyebrow">{t('submit.eyebrow')}</span>
        <h1>{t('submit.title')}</h1>

        {/* Breadcrumb */}
        <div className="step-indicator">
          <span className={step === 'category' ? 'active' : ''}>{t('submit.stepCategory')}</span>
          <span className="arrow">›</span>
          <span className={step === 'form' ? 'active' : ''}>{t('submit.stepForm')}</span>
          <span className="arrow">›</span>
          <span className={step === 'confirmation' ? 'active' : ''}>{t('submit.stepConfirm')}</span>
        </div>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        {/* Step 1: Category Selection */}
        {step === 'category' && (
          <div className="category-grid">
            <p className="lead">{t('submit.selectCategory')}</p>
            <div className="category-options">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  className="category-card"
                  onClick={() => handleCategorySelect(cat.id)}
                  type="button"
                >
                  <span className="category-icon">{cat.icon}</span>
                  <span className="category-label">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Feedback Form */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="feedback-form">
            <div className="form-group">
              <label className="form-label">{t('submit.feedbackType')}</label>
              <div className="selected-category">
                {CATEGORIES.find((c) => c.id === selectedCategory)?.icon}{' '}
                {CATEGORIES.find((c) => c.id === selectedCategory)?.label}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="content" className="form-label">
                {t('submit.contentLabel')} <span className="required">*</span>
              </label>
              <textarea
                id="content"
                className="form-textarea"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setContactError(null);
                  setError(null);
                }}
                onKeyDown={handleContentKeyDown}
                placeholder={t('submit.feedbackPlaceholder')}
                rows={6}
                required
              />
              <div className="form-textarea-footer">
                <span className="form-hint">{t('submit.contentHint')}</span>
                <span className={`char-count ${content.length > MAX_CONTENT_LENGTH ? 'char-count-over' : ''}`}>
                  {content.length}/{MAX_CONTENT_LENGTH}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('submit.attachScreenshotLabel')}</label>
              <div className="attachment-upload-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="attachment-input"
                  id="attachment-input"
                />
                <label htmlFor="attachment-input" className="attachment-upload-label">
                  <span className="attachment-upload-icon">📷</span>
                  <span>{t('submit.attachScreenshot')}</span>
                </label>
                {attachments.length > 0 && (
                  <div className="attachment-previews">
                    {attachments.map((dataUrl, index) => (
                      <div key={index} className="attachment-preview-item">
                        <img
                          src={dataUrl}
                          alt={t('submit.attachmentAlt', { index: index + 1 })}
                          className="attachment-thumbnail"
                          onClick={() => setExpandedAttachment(index)}
                          style={{ cursor: 'pointer' }}
                        />
                        <button
                          type="button"
                          className="attachment-remove"
                          onClick={() => removeAttachment(index)}
                          aria-label={t('submit.remove')}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {attachmentErrors.length > 0 && (
                <div className="attachment-errors">
                  {attachmentErrors.map((err, i) => (
                    <span key={i} className="attachment-error">{err}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  checked={allowContact}
                  onChange={(e) => setAllowContact(e.target.checked)}
                />
                <span>{t('submit.allowContact')}</span>
              </label>
              {allowContact && (
                <div className="contact-input-group">
                  <input
                    type="text"
                    className={`form-input ${contactError ? 'form-input-error' : ''}`}
                    value={contact}
                    onChange={(e) => {
                      setContact(e.target.value);
                      setContactError(null);
                      setError(null);
                    }}
                    placeholder={t('submit.contactPlaceholder')}
                  />
                  {contactError && (
                    <span className="contact-error">{contactError}</span>
                  )}
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={handleBack}>
                {t('submit.back')}
              </button>
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? t('submit.submitting') : t('submit.submit')}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirmation' && submitResult && (
          <div className="confirmation-page">
            <div className="confirmation-icon">✅</div>
            <h2>{t('submit.confirmTitle')}</h2>
            <p className="lead">{t('submit.confirmDescription')}</p>

            <div className="confirmation-details">
              <div className="detail-row">
                <span className="detail-label">{t('submit.referenceNumber')}</span>
                <span className="detail-value" title={submitResult.threadId}>
                  {formatRefNumber(submitResult.threadId)}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{t('submit.type')}</span>
                <span className="detail-value">
                  {CATEGORIES.find((c) => c.id === selectedCategory)?.icon}{' '}
                  {CATEGORIES.find((c) => c.id === selectedCategory)?.label}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{t('submit.status')}</span>
                <span className="detail-value status-badge received">
                  {STATUS_LABELS['received']}
                </span>
              </div>
            </div>

            <p className="confirmation-hint">
              {t('submit.confirmHint')}
            </p>

            <div className="form-actions">
              <Link to="/" className="btn-secondary">
                {t('submit.backToHome')}
              </Link>
              <Link to={`/feedback/${submitResult.threadId}`} className="btn-primary">
                {t('submit.viewDetails')}
              </Link>
            </div>
          </div>
        )}

        <Link className="back-link" to="/">
          ← {t('submit.backToHome')}
        </Link>

        {/* Expanded image modal */}
        {expandedAttachment !== null && attachments[expandedAttachment] && (
          <div className="modal-overlay" onClick={() => setExpandedAttachment(null)}>
            <div className="image-preview-modal" onClick={(e) => e.stopPropagation()}>
              <img
                src={attachments[expandedAttachment]}
                alt={t('submit.attachmentAlt', { index: expandedAttachment + 1 })}
                className="image-preview-full"
              />
              <button
                className="image-preview-close"
                onClick={() => setExpandedAttachment(null)}
                aria-label={t('history.close')}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
