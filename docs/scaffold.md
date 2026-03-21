# #t3 Scaffold Notes

## Canonical Repo

- Path: `/home/ddreame/code1/FeedBack-System`
- Reason: this keeps the accepted MVP isolated from the older `/home/ddreame/code1/feedback-system` repo, which is both broader in scope and currently dirty.

## Base Structure

- `backend/`: Rust + Axum backend shell
- `web/`: single React web app for the hosted submission flow and developer console

## Immediate Follow-On Tasks

- `#t4`: define the feedback domain model and database schema against this repo
- `#t5`: wire the Rust API shell into persistence
