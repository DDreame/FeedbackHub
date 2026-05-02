# Stage 1: Build the Rust binary
FROM rust:1.85-slim-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
COPY src/ src/

# Build release binary
RUN cargo build --release --bin feedback-system-backend

# Stage 2: Minimal runtime
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/feedback-system-backend /usr/local/bin/feedback-system-backend

EXPOSE 3000

CMD ["feedback-system-backend"]
