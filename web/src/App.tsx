import { Link, Route, Routes, useParams } from 'react-router-dom'

import './App.css'

const surfaces = [
  {
    title: 'Hosted Feedback Intake',
    route: '/submit/demo-app',
    summary:
      'Public entry point for users to send feedback with app, platform, and version context.',
    action: 'Open intake scaffold',
  },
  {
    title: 'Developer Console',
    route: '/console',
    summary:
      'Private owner-facing inbox for reviewing, triaging, and updating feedback status.',
    action: 'Open console scaffold',
  },
]

const backendNotes = [
  'Axum service scaffolded with a live `/api/health` smoke route.',
  'Single repo keeps the public submission flow and developer console moving against one Rust backend.',
  'Legacy `/home/ddreame/code1/feedback-system` repo stays untouched so MVP work remains clean.',
]

const nextSteps = [
  'Finish the MVP feedback domain model and DB schema in `#t4`.',
  'Wire Rust persistence and inbox ingest paths in `#t5`.',
  'Keep the product surface to submission flow, inbox, and detail view only.',
]

function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">Task #t3 base scaffold</span>
        <h1>FeedBack System</h1>
        <p className="lead">
          One feedback operating surface for a single developer running multiple
          apps without turning the product into a helpdesk.
        </p>
        <div className="hero-meta">
          <span>
            <strong>Canonical repo:</strong> /home/ddreame/code1/FeedBack-System
          </span>
          <span>
            <strong>Backend:</strong> Rust + Axum
          </span>
          <span>
            <strong>Web surface:</strong> React + Vite + React Router
          </span>
        </div>
      </section>

      <section className="surface-grid" aria-label="MVP surfaces">
        {surfaces.map((surface) => (
          <article className="surface-card" key={surface.title}>
            <span className="route-label">MVP surface</span>
            <h2>{surface.title}</h2>
            <p>{surface.summary}</p>
            <span className="path-label">Scaffold route</span>
            <code className="route-value">{surface.route}</code>
            <Link className="route-link" to={surface.route}>
              {surface.action}
            </Link>
          </article>
        ))}
      </section>

      <section className="stack-grid" aria-label="Scaffold status">
        <article className="stack-card">
          <span className="path-label">Foundation</span>
          <h2>Rust backend foundation</h2>
          <ul>
            {backendNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </article>

        <article className="stack-card">
          <span className="path-label">Critical path</span>
          <h2>Next steps after scaffold</h2>
          <ol>
            {nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>
      </section>
    </main>
  )
}

function SubmitScaffoldPage() {
  const { appKey } = useParams()

  return (
    <main className="shell">
      <section className="detail-card">
        <span className="eyebrow">Hosted route scaffold</span>
        <h1>Hosted Feedback Intake</h1>
        <p className="lead">
          Public capture flow placeholder for the final feedback submission UI.
        </p>
        <p className="detail-copy">App key in route: {appKey}</p>
        <div className="detail-grid">
          <article className="stack-card">
            <span className="path-label">Intake contract</span>
            <h2>Submission context</h2>
            <ul>
              <li>App identifier comes from the public route.</li>
              <li>Payload will include platform and app version in `#t6`.</li>
              <li>Backend ingest wiring lands in Rust under `#t5` and `#t7`.</li>
            </ul>
          </article>
        </div>
        <Link className="route-link" to="/">
          Back to scaffold home
        </Link>
      </section>
    </main>
  )
}

function ConsoleScaffoldPage() {
  return (
    <main className="shell">
      <section className="detail-card">
        <span className="eyebrow">Owner route scaffold</span>
        <h1>Developer Console</h1>
        <p className="lead">
          Single-owner review surface for the inbox, detail view, and status
          workflow.
        </p>
        <div className="detail-grid">
          <article className="stack-card">
            <span className="path-label">Console lanes</span>
            <h2>Planned build path</h2>
            <ol>
              <li>`#t8` inbox list with app and status filters.</li>
              <li>`#t9` feedback detail with tags, notes, and updates.</li>
              <li>`#t10` access gate for the single owner model.</li>
            </ol>
          </article>
        </div>
        <Link className="route-link" to="/">
          Back to scaffold home
        </Link>
      </section>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/submit/:appKey" element={<SubmitScaffoldPage />} />
      <Route path="/console" element={<ConsoleScaffoldPage />} />
    </Routes>
  )
}

export default App
