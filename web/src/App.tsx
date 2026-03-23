import { useEffect, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FeedbackSubmitPage } from './pages/FeedbackSubmitPage'
import { FeedbackHistoryPage } from './pages/FeedbackHistoryPage'
import { FeedbackThreadPage } from './pages/FeedbackThreadPage'
import { ConsolePage } from './pages/ConsolePage'
import { ConsoleInboxPage } from './pages/ConsoleInboxPage'
import { ConsoleThreadPage } from './pages/ConsoleThreadPage'
import { ConsoleAnalyticsPage } from './pages/ConsoleAnalyticsPage'
import { ConsoleApiKeysPage } from './pages/ConsoleApiKeysPage'
import { ConsoleTemplatesPage } from './pages/ConsoleTemplatesPage'
import { AppsPage } from './pages/AppsPage'
import { listApps, type AppResponse } from './services/api'
import { toggleLanguage, getCurrentLanguage } from './i18n'

import './App.css'

const THEME_KEY = 'feedback_theme';

function ThemeToggle({ theme, onToggle }: { theme: string; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      aria-label={theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
      title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  );
}

function LanguageToggle() {
  const [lang, setLang] = useState(getCurrentLanguage);
  return (
    <button
      className="language-toggle"
      onClick={() => { toggleLanguage(); setLang(getCurrentLanguage()); }}
      title={lang === 'zh-CN' ? 'English' : '中文'}
    >
      {lang === 'zh-CN' ? 'EN' : '中'}
    </button>
  );
}

function AppShell({ children, theme, onToggleTheme }: { children: React.ReactNode; theme: string; onToggleTheme: () => void }) {
  return (
    <>
      <div className="theme-toggle-wrapper">
        <LanguageToggle />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      {children}
    </>
  );
}

function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listApps()
      .then((appList) => {
        setApps(appList);
        setLoading(false);
        if (appList.length === 1) {
          navigate(`/submit/${appList[0].app_key}`);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('app.loadError'));
        setLoading(false);
      });
  }, [navigate, t]);

  if (loading) {
    return (
      <main className="shell">
        <div className="loading">{t('app.loading')}</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="shell">
        <div className="error-message">{error}</div>
      </main>
    );
  }

  if (apps.length > 1) {
    return (
      <main className="shell">
        <section className="hero">
          <h1>{t('home.title')}</h1>
          <p className="lead">{t('home.selectApp')}</p>
        </section>
        <section className="surface-grid" aria-label="select-app">
          {apps.map((app) => (
            <article key={app.id} className="surface-card">
              <h2>{app.name}</h2>
              {app.description && <p>{app.description}</p>}
              <Link className="route-link" to={`/submit/${app.app_key}`}>
                {t('home.submitFeedback')}
              </Link>
            </article>
          ))}
          <article className="surface-card">
            <h2>{t('home.manageApps')}</h2>
            <p>{t('home.manageAppsDescription')}</p>
            <Link className="route-link" to="/apps">
              {t('home.manageAppsLink')}
            </Link>
          </article>
        </section>
        <section className="surface-grid" aria-label="features">
          <article className="surface-card">
            <h2>{t('home.myFeedback')}</h2>
            <p>{t('home.historyDescription')}</p>
            <Link className="route-link" to="/history">
              {t('home.viewHistory')}
            </Link>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <h1>{t('home.title')}</h1>
        <p className="lead">{t('home.historyDescription')}</p>
      </section>

      <section className="surface-grid" aria-label="features">
        <article className="surface-card">
          <h2>{t('home.submitFeedback')}</h2>
          <p>{t('home.submitDescription')}</p>
          <Link className="route-link" to="/submit/demo-app">
            {t('home.submitFeedback')}
          </Link>
        </article>

        <article className="surface-card">
          <h2>{t('home.myFeedback')}</h2>
          <p>{t('home.historyDescription')}</p>
          <Link className="route-link" to="/history">
            {t('home.viewHistory')}
          </Link>
        </article>
      </section>
    </main>
  );
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <AppShell theme={theme} onToggleTheme={toggleTheme}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/submit/:appKey" element={<FeedbackSubmitPage />} />
        <Route path="/history" element={<FeedbackHistoryPage />} />
        <Route path="/history/:appKey" element={<FeedbackHistoryPage />} />
        <Route path="/feedback/:threadId" element={<FeedbackThreadPage />} />
        <Route path="/console" element={<ConsolePage />} />
        <Route path="/console/inbox" element={<ConsoleInboxPage />} />
        <Route path="/console/thread/:threadId" element={<ConsoleThreadPage />} />
        <Route path="/console/analytics" element={<ConsoleAnalyticsPage />} />
        <Route path="/console/api-keys" element={<ConsoleApiKeysPage />} />
        <Route path="/console/templates" element={<ConsoleTemplatesPage />} />
        <Route path="/apps" element={<AppsPage />} />
      </Routes>
    </AppShell>
  );
}

export default App
