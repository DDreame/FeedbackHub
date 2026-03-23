import { useEffect, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import { FeedbackSubmitPage } from './pages/FeedbackSubmitPage'
import { FeedbackHistoryPage } from './pages/FeedbackHistoryPage'
import { FeedbackThreadPage } from './pages/FeedbackThreadPage'
import { listApps, type AppResponse } from './services/api'

import './App.css'

const THEME_KEY = 'feedback_theme';

function ThemeToggle({ theme, onToggle }: { theme: string; onToggle: () => void }) {
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到暗色模式'}
      title={theme === 'dark' ? '浅色模式' : '暗色模式'}
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  );
}

function AppShell({ children, theme, onToggleTheme }: { children: React.ReactNode; theme: string; onToggleTheme: () => void }) {
  return (
    <>
      <div className="theme-toggle-wrapper">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      {children}
    </>
  );
}

function HomePage() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listApps()
      .then((appList) => {
        setApps(appList);
        setLoading(false);
        // If only one app, redirect directly to submit page
        if (appList.length === 1) {
          navigate(`/submit/${appList[0].app_key}`);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '加载失败');
        setLoading(false);
      });
  }, [navigate]);

  if (loading) {
    return (
      <main className="shell">
        <div className="loading">加载中...</div>
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

  // Multiple apps — show app selector
  if (apps.length > 1) {
    return (
      <main className="shell">
        <section className="hero">
          <h1>FeedBack System</h1>
          <p className="lead">请选择要提交反馈的应用</p>
        </section>
        <section className="surface-grid" aria-label="选择应用">
          {apps.map((app) => (
            <article key={app.id} className="surface-card">
              <h2>{app.name}</h2>
              {app.description && <p>{app.description}</p>}
              <Link className="route-link" to={`/submit/${app.app_key}`}>
                打开反馈入口
              </Link>
            </article>
          ))}
        </section>
        <section className="surface-grid" aria-label="功能入口">
          <article className="surface-card">
            <h2>我的反馈</h2>
            <p>查看我的反馈历史和处理进度。</p>
            <Link className="route-link" to="/history">
              查看历史
            </Link>
          </article>
        </section>
      </main>
    );
  }

  // Fallback: no apps or single app redirect handled above
  return (
    <main className="shell">
      <section className="hero">
        <h1>FeedBack System</h1>
        <p className="lead">
          快速提交反馈，追踪处理进度。
        </p>
      </section>

      <section className="surface-grid" aria-label="功能入口">
        <article className="surface-card">
          <h2>提交反馈</h2>
          <p>提交反馈，报告问题或建议。</p>
          <Link className="route-link" to="/submit/demo-app">
            打开反馈入口
          </Link>
        </article>

        <article className="surface-card">
          <h2>我的反馈</h2>
          <p>查看我的反馈历史和处理进度。</p>
          <Link className="route-link" to="/history">
            查看历史
          </Link>
        </article>
      </section>
    </main>
  );
}

function ConsolePlaceholderPage() {
  return (
    <main className="shell">
      <section className="detail-card">
        <h1>Developer Console</h1>
        <p className="lead">
          此功能正在开发中，敬请期待。
        </p>
        <Link className="route-link" to="/">
          返回首页
        </Link>
      </section>
    </main>
  )
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
        <Route path="/console" element={<ConsolePlaceholderPage />} />
      </Routes>
    </AppShell>
  );
}

export default App
