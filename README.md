# FeedBack System

Canonical repo for the current FeedBack System MVP.

## Stack

- `backend/`: Rust + Axum API
- `web/`: React + Vite web surface for hosted feedback intake and the developer console

## Current Task Mapping

- `#t3`: create the canonical repo/workspace and base scaffold
- `#t4`: define the feedback domain model and database schema
- `#t5`: wire the Rust backend API into persistence

## Local Commands

```bash
cd backend && cargo test
cd web && npm test
cd web && npm run build
```

## Local Preview

For a local end-to-end preview of the current MVP, use the repo-side wiring in
`docs/local-preview.md`.
