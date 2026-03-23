# Local Preview

This repo supports a local preview path for the current MVP on one machine,
including Windows browsers talking to services running inside WSL.

## Stack

- `backend/`: Rust + Axum API on `0.0.0.0:3000` (configurable via `HOST`/`PORT` env vars)
- `web/`: React + Vite dev server on `0.0.0.0:3010`
- PostgreSQL: project-root `docker-compose.yml` on `localhost:5432`

## Why This Works

The web app calls relative `/v1/...` APIs. Vite now proxies both `/v1` and
`/api` to the backend on `http://127.0.0.1:3000`, so the browser only needs the
frontend URL.

## Prerequisites

- Docker or a local PostgreSQL instance
- Rust toolchain
- Node.js with npm
- `sqlx-cli` for migrations

## Start The Preview

### Quick Start (recommended)

From the project root:

```bash
./dev.sh
```

This starts PostgreSQL, runs migrations, launches the backend, and starts the
web dev server in one command.

### Manual Start

From the project root:

```bash
docker compose up -d postgres
```

In `backend/`:

```bash
export DATABASE_URL=postgres://feedback:feedback_secret@localhost:5432/feedback_dev
sqlx migrate run
cargo run
```

If `sqlx migrate run` reports an existing migration checksum mismatch on an old
local database, reset `feedback_dev` and rerun migrations:

```bash
docker exec feedback_postgres psql -U feedback -d postgres -c "DROP DATABASE IF EXISTS feedback_dev;"
docker exec feedback_postgres psql -U feedback -d postgres -c "CREATE DATABASE feedback_dev;"
sqlx migrate run
```

In `web/`:

```bash
npm install
npm run dev
```

## Access

Open the web app at:

- `http://localhost:3010`

The backend health endpoint is available at:

- `http://localhost:3000/api/health`

## Verification

Optional quick checks:

```bash
cd backend && cargo test
cd web && npm test
cd web && npm run build
```
