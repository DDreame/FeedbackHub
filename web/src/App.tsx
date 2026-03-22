import { Link, Route, Routes } from 'react-router-dom'
import { FeedbackSubmitPage } from './pages/FeedbackSubmitPage'
import { FeedbackHistoryPage } from './pages/FeedbackHistoryPage'
import { FeedbackThreadPage } from './pages/FeedbackThreadPage'

import './App.css'

function HomePage() {
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
  )
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
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/submit/:appKey" element={<FeedbackSubmitPage />} />
      <Route path="/history" element={<FeedbackHistoryPage />} />
      <Route path="/feedback/:threadId" element={<FeedbackThreadPage />} />
      <Route path="/console" element={<ConsolePlaceholderPage />} />
    </Routes>
  )
}

export default App
