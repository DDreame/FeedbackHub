# Backend Testing Guide

## Prerequisites

- Rust 1.75+
- PostgreSQL 17+ (or Docker)
- `sqlx-cli` (for migration management)

## Running Tests

### Unit Tests (no database required)

```bash
cargo test
```

### Integration Tests (requires PostgreSQL)

#### Option 1: Using Docker Compose

```bash
# Start PostgreSQL
cd ..
docker-compose up -d postgres

# Wait for PostgreSQL to be ready, then run migrations
cd backend
DATABASE_URL=postgres://feedback:feedback_secret@localhost:5432/feedback_dev sqlx migrate run

# Run all tests including ignored integration tests
DATABASE_URL=postgres://feedback:feedback_secret@localhost:5432/feedback_dev cargo test -- --ignored
```

#### Option 2: Using existing PostgreSQL

Set the `DATABASE_URL` environment variable to point to your PostgreSQL instance:

```bash
export DATABASE_URL=postgres://feedback:feedback_secret@localhost:5432/feedback_dev
sqlx migrate run
cargo test -- --ignored
```

## Database Setup

### Run Migrations

```bash
sqlx migrate run
```

### Reset Database

```bash
# Drop and recreate database
docker exec feedback_postgres psql -U feedback -d postgres -c "DROP DATABASE IF EXISTS feedback_dev;"
docker exec feedback_postgres psql -U feedback -d postgres -c "CREATE DATABASE feedback_dev;"
sqlx migrate run
```

## Test Categories

### Unit Tests
- Model tests (`model::thread`, `model::feedback`)
- Route handler tests (in-memory, no DB)
- All pass without `DATABASE_URL`

### Integration Tests (ignored by default)
- `routes::threads::tests::*` - Thread API route tests
- `routes::feedback::tests::*` - Feedback API route tests
- `routes::project::tests::*` - Project API route tests
- `tests::threads_schema_test::*` - Database schema validation tests
- `tests::db_schema_test::*` - Feedback table schema validation tests

Run with: `cargo test -- --ignored`

### CI Pipeline

See `.github/workflows/backend-ci.yml` for the full CI pipeline which runs:
1. `cargo fmt -- --check`
2. `cargo clippy --all-targets --all-features -- -D warnings`
3. `cargo test`
4. Integration tests with PostgreSQL

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required for integration tests |

## Docker Services

The `docker-compose.yml` in the project root provides:
- `postgres:17-alpine` on port 5432
- `redis:7-alpine` on port 6379 (for future use)

```bash
docker-compose up -d
```
