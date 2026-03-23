#!/usr/bin/env bash
# dev.sh — One-command local preview for FeedBack-System
#
# Prerequisites:
#   - Docker with compose plugin (docker compose)
#   - Rust toolchain (cargo)
#   - Node.js + npm
#
# Usage:
#   ./dev.sh          # Start all services
#   ./dev.sh stop     # Stop background services (postgres)
#
# Access from Windows browser:
#   Web (user-facing):  http://localhost:3010
#   Backend API:        http://localhost:3000
#
# Test account:
#   Email:    test@dev.local
#   Password: testpass123

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

export DATABASE_URL="${DATABASE_URL:-postgres://feedback:feedback_secret@localhost:5432/feedback_dev}"

# --- Stop mode ---
if [[ "${1:-}" == "stop" ]]; then
  echo "Stopping docker compose services..."
  cd "$ROOT_DIR" && docker compose down
  echo "Done. Backend and web dev servers (if running in foreground) can be interrupted with Ctrl+C."
  exit 0
fi

echo "=== FeedBack-System Local Preview ==="
echo ""

BACKEND_PORT="${PORT:-3000}"
WEB_PORT=3010

# --- Pre-flight: check ports are free ---
check_port() {
  local port=$1 label=$2
  if ss -tlnp 2>/dev/null | grep -q ":${port} " || \
     lsof -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "ERROR: Port ${port} (${label}) is already in use."
    echo "  Stop the existing process first, or use './dev.sh stop' to clean up."
    exit 1
  fi
}
check_port "$BACKEND_PORT" "backend"
check_port "$WEB_PORT" "web"

# 1. Start PostgreSQL (+ Redis) via docker compose
echo "[1/4] Starting PostgreSQL and Redis..."
cd "$ROOT_DIR"
docker compose up -d postgres redis
echo "  Waiting for PostgreSQL to be ready..."
until docker compose exec -T postgres pg_isready -U feedback -d feedback_dev > /dev/null 2>&1; do
  sleep 1
done
echo "  PostgreSQL is ready."
echo ""

# 2. Run database migrations
echo "[2/4] Running database migrations..."
cd "$ROOT_DIR/backend"
if command -v sqlx > /dev/null 2>&1; then
  sqlx database create 2>/dev/null || true
  if ! sqlx migrate run 2>&1; then
    echo "  Migration failed (likely checksum mismatch). Resetting database..."
    docker exec feedback_postgres psql -U feedback -d postgres -c "DROP DATABASE IF EXISTS feedback_dev;" > /dev/null 2>&1
    docker exec feedback_postgres psql -U feedback -d postgres -c "CREATE DATABASE feedback_dev;" > /dev/null 2>&1
    sqlx migrate run
    echo "  Database reset and migrations re-applied."
  else
    echo "  Migrations applied."
  fi
else
  echo "  sqlx-cli not found; skipping auto-migration."
  echo "  Install with: cargo install sqlx-cli --no-default-features --features postgres"
  echo "  Then run: cd backend && sqlx migrate run"
fi
echo ""

# 3. Start backend in background
echo "[3/4] Starting backend (port 3000)..."
cd "$ROOT_DIR/backend"
cargo run &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"
echo ""

# 4. Start web dev server in foreground
echo "[4/4] Starting web dev server (port 3010)..."
echo ""
echo "========================================="
echo "  Web:     http://localhost:3010"
echo "  Backend: http://localhost:3000"
echo "========================================="
echo ""
cd "$ROOT_DIR/web"
npm install --silent 2>/dev/null || true
npm run dev -- --strictPort

# Cleanup: when web dev server is interrupted, also stop backend
kill $BACKEND_PID 2>/dev/null || true
echo "Backend stopped."
