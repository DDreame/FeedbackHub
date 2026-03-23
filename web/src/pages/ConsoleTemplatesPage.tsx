import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  listResponseTemplates,
  createResponseTemplate,
  updateResponseTemplate,
  deleteResponseTemplate,
  type ResponseTemplateRow,
} from '../services/api';
import { getDevApiKey } from '../services/api';
import i18n from '../i18n';

const TEMPLATE_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'bug', label: 'Bug Reply' },
  { value: 'suggestion', label: 'Suggestion Reply' },
  { value: 'question', label: 'Question Reply' },
  { value: 'thanks', label: 'Thank You' },
  { value: 'closing', label: 'Closing' },
];

interface TemplateFormData {
  title: string;
  body: string;
  category: string;
}

export function ConsoleTemplatesPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<ResponseTemplateRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>({ title: '', body: '', category: 'general' });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const hasApiKey = !!getDevApiKey();

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listResponseTemplates();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('console.templates.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (hasApiKey) fetchTemplates();
  }, [hasApiKey, fetchTemplates]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const resetForm = () => {
    setFormData({ title: '', body: '', category: 'general' });
    setEditingId(null);
    setShowForm(false);
    setFormError(null);
  };

  const handleEdit = (template: ResponseTemplateRow) => {
    setFormData({ title: template.title, body: template.body, category: template.category });
    setEditingId(template.id);
    setShowForm(true);
    setFormError(null);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      setFormError(t('console.templates.titleRequired'));
      return;
    }
    if (!formData.body.trim()) {
      setFormError(t('console.templates.bodyRequired'));
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        const updated = await updateResponseTemplate(editingId, formData);
        setTemplates((prev) => prev.map((t) => (t.id === editingId ? updated : t)));
        setToast({ message: t('console.templates.updateSuccess'), type: 'success' });
      } else {
        const created = await createResponseTemplate(formData);
        setTemplates((prev) => [created, ...prev]);
        setToast({ message: t('console.templates.createSuccess'), type: 'success' });
      }
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('console.templates.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setConfirmDelete(null);
    try {
      await deleteResponseTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setToast({ message: t('console.templates.deleteSuccess'), type: 'success' });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : t('console.templates.deleteError'), type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getCategoryLabel = (cat: string) => {
    return TEMPLATE_CATEGORIES.find((c) => c.value === cat)?.label || cat;
  };

  if (!hasApiKey) {
    return (
      <main className="shell">
        <section className="detail-card">
          <span className="eyebrow">{t('console.eyebrow')}</span>
          <h1>{t('console.templates.title')}</h1>
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
        <h1>{t('console.templates.title')}</h1>

        {error && (
          <div className="error-message" role="alert">
            {error}
            <button onClick={fetchTemplates} className="retry-btn">
              {t('console.templates.retry')}
            </button>
          </div>
        )}

        {/* Create/Edit Form */}
        {showForm ? (
          <div className="template-form">
            <h3>{editingId ? t('console.templates.editTitle') : t('console.templates.createTitle')}</h3>
            <div className="form-group">
              <label className="form-label">{t('console.templates.formTitle')}</label>
              <input
                type="text"
                className="form-input"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                placeholder={t('console.templates.titlePlaceholder')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('console.templates.formCategory')}</label>
              <select
                className="form-select"
                value={formData.category}
                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
              >
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('console.templates.formBody')}</label>
              <textarea
                className="form-textarea"
                rows={6}
                value={formData.body}
                onChange={(e) => setFormData((p) => ({ ...p, body: e.target.value }))}
                placeholder={t('console.templates.bodyPlaceholder')}
              />
            </div>
            {formError && <span className="form-error">{formError}</span>}
            <div className="form-actions">
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? t('console.templates.saving') : t('console.templates.save')}
              </button>
              <button
                className="btn-secondary"
                onClick={resetForm}
                disabled={isSaving}
              >
                {t('console.templates.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="template-list-header">
            <p className="template-hint">{t('console.templates.hint')}</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              + {t('console.templates.create')}
            </button>
          </div>
        )}

        {/* Template List */}
        {isLoading ? (
          <div className="loading">{t('console.templates.loading')}</div>
        ) : templates.length === 0 && !showForm ? (
          <div className="empty-state">
            <p className="empty-state-title">{t('console.templates.noTemplates')}</p>
          </div>
        ) : (
          <div className="template-list">
            {templates.map((template) => (
              <div key={template.id} className="template-card">
                <div className="template-header">
                  <span className="template-category-badge">
                    {getCategoryLabel(template.category)}
                  </span>
                  <span className="template-date">{formatDate(template.updated_at)}</span>
                </div>
                <div className="template-title">{template.title}</div>
                <div className="template-body">{template.body}</div>
                <div className="template-actions">
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => handleEdit(template)}
                  >
                    {t('console.templates.edit')}
                  </button>
                  {confirmDelete === template.id ? (
                    <div className="template-delete-confirm">
                      <span>{t('console.templates.confirmDelete')}</span>
                      <button
                        className="btn-danger btn-sm"
                        onClick={() => handleDelete(template.id)}
                        disabled={deletingId === template.id}
                      >
                        {deletingId === template.id ? t('console.templates.deleting') : t('console.templates.confirm')}
                      </button>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => setConfirmDelete(null)}
                        disabled={!!deletingId}
                      >
                        {t('console.templates.cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => setConfirmDelete(template.id)}
                      disabled={!!deletingId}
                    >
                      {t('console.templates.delete')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Link className="back-link" to="/console">
          ← {t('console.thread.backToInbox')}
        </Link>
      </section>
    </main>
  );
}
