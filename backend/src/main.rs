use feedback_system_backend::app;
use tracing_subscriber::prelude::*;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Sentry error tracking
    let sentry_dsn = std::env::var("SENTRY_DSN").unwrap_or_default();
    let _sentry = sentry::init(sentry::ClientOptions {
        dsn: if sentry_dsn.is_empty() {
            None
        } else {
            Some(sentry_dsn.parse().expect("invalid SENTRY_DSN"))
        },
        release: sentry::release_name!(),
        traces_sample_rate: 0.1,
        ..Default::default()
    });

    // Structured JSON logging for production
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer().json())
        .with(sentry_tracing::layer())
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "info".into()))
        .init();

    // Run database migrations before starting
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(2)
        .connect(&database_url)
        .await
        .expect("failed to connect to database for migration");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("database migration failed");
    pool.close().await;
    tracing::info!("Database migrations complete");

    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("{host}:{port}");

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Backend listening on {addr}");

    axum::serve(listener, app()).await?;

    Ok(())
}
