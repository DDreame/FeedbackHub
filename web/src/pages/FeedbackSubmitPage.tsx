import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  createThreadAtomic,
  STATUS_LABELS,
} from '../services/api';
import { formatRefNumber } from '../utils/formatRefNumber';

const CATEGORIES = [
  { id: '遇到问题', label: '遇到问题', icon: '❌' },
  { id: '想提建议', label: '想提建议', icon: '💡' },
  { id: '想问一下', label: '想问一下', icon: '❓' },
  { id: '其他', label: '其他', icon: '📝' },
];

const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_CONTENT_LENGTH = 2000;

type Step = 'category' | 'form' | 'confirmation';

interface SubmitResult {
  threadId: string;
}

export function FeedbackSubmitPage() {
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        errors.push(`最多只能上传 ${MAX_ATTACHMENTS} 张图片`);
        break;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} 超过 5MB 限制`);
        continue;
      }
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name} 不是图片文件`);
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
    // Reset file input so same file can be selected again
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
      setError('请输入反馈内容');
      return;
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      setError(`反馈内容不能超过 ${MAX_CONTENT_LENGTH} 字`);
      return;
    }
    if (allowContact && contact.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact.trim())) {
        setContactError('请输入有效的邮箱地址');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Auto-generate summary: first line, capped at 120 chars
      const body = content.trim();
      const firstLine = body.split('\n')[0];
      const summary = firstLine.length > 120 ? firstLine.slice(0, 117) + '...' : firstLine;

      // Atomic: create thread + initial message in a single transaction
      const result = await createThreadAtomic(
        selectedCategory,
        summary,
        body,
        allowContact ? contact : undefined,
        { current_route: `/submit/${appKey}` },
        attachments.length > 0 ? attachments : undefined
      );

      setSubmitResult({ threadId: result.thread_id });
      setStep('confirmation');
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请重试');
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
        <span className="eyebrow">反馈提交</span>
        <h1>提交反馈</h1>

        {/* Breadcrumb */}
        <div className="step-indicator">
          <span className={step === 'category' ? 'active' : ''}>选择类型</span>
          <span className="arrow">›</span>
          <span className={step === 'form' ? 'active' : ''}>填写内容</span>
          <span className="arrow">›</span>
          <span className={step === 'confirmation' ? 'active' : ''}>完成</span>
        </div>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        {/* Step 1: Category Selection */}
        {step === 'category' && (
          <div className="category-grid">
            <p className="lead">请选择反馈类型：</p>
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
              <label className="form-label">反馈类型</label>
              <div className="selected-category">
                {CATEGORIES.find((c) => c.id === selectedCategory)?.icon}{' '}
                {CATEGORIES.find((c) => c.id === selectedCategory)?.label}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="content" className="form-label">
                反馈内容 <span className="required">*</span>
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
                placeholder="请详细描述您的问题或建议..."
                rows={6}
                required
              />
              <div className="form-textarea-footer">
                <span className="form-hint">请尽量详细描述，这样可以帮助我们更好地解决问题 · Ctrl+Enter 快捷提交</span>
                <span className={`char-count ${content.length > MAX_CONTENT_LENGTH ? 'char-count-over' : ''}`}>
                  {content.length}/{MAX_CONTENT_LENGTH}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">添加截图（可选，最多{MAX_ATTACHMENTS}张）</label>
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
                  <span>点击或拖拽添加截图</span>
                </label>
                {attachments.length > 0 && (
                  <div className="attachment-previews">
                    {attachments.map((dataUrl, index) => (
                      <div key={index} className="attachment-preview-item">
                        <img src={dataUrl} alt={`附件 ${index + 1}`} className="attachment-thumbnail" />
                        <button
                          type="button"
                          className="attachment-remove"
                          onClick={() => removeAttachment(index)}
                          aria-label="移除"
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
                <span>允许开发者联系我</span>
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
                    placeholder="请输入邮箱地址"
                  />
                  {contactError && (
                    <span className="contact-error">{contactError}</span>
                  )}
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={handleBack}>
                上一步
              </button>
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? '提交中...' : '提交反馈'}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirmation' && submitResult && (
          <div className="confirmation-page">
            <div className="confirmation-icon">✅</div>
            <h2>感谢您的反馈</h2>
            <p className="lead">我们已收到您的反馈，会尽快处理。</p>

            <div className="confirmation-details">
              <div className="detail-row">
                <span className="detail-label">反馈编号</span>
                <span className="detail-value" title={submitResult.threadId}>
                  {formatRefNumber(submitResult.threadId)}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">类型</span>
                <span className="detail-value">
                  {CATEGORIES.find((c) => c.id === selectedCategory)?.icon}{' '}
                  {CATEGORIES.find((c) => c.id === selectedCategory)?.label}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">状态</span>
                <span className="detail-value status-badge received">
                  {STATUS_LABELS['received']}
                </span>
              </div>
            </div>

            <p className="confirmation-hint">
              您可以在「我的反馈」页面查看处理进度。
            </p>

            <div className="form-actions">
              <Link to="/" className="btn-secondary">
                返回首页
              </Link>
              <Link to={`/feedback/${submitResult.threadId}`} className="btn-primary">
                查看详情
              </Link>
            </div>
          </div>
        )}

        <Link className="back-link" to="/">
          ← 返回首页
        </Link>
      </section>
    </main>
  );
}
