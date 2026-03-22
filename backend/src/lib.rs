pub mod db;
pub mod model;
pub mod routes;

use axum::{Json, Router, routing::get};
use routes::feedback::{AppState, feedback_routes};
use serde::Serialize;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

pub fn app() -> Router {
    app_with_state(AppState {
        db: create_pool_from_env(),
    })
}

pub fn app_with_state(state: AppState) -> Router {
    let health = Router::new().route("/api/health", get(health));
    health.merge(feedback_routes(state))
}

fn create_pool_from_env() -> sqlx::PgPool {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    sqlx::postgres::PgPoolOptions::new()
        .max_connections(10)
        .connect_lazy(&database_url)
        .expect("failed to create database pool")
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "feedback-system-backend",
    })
}

#[cfg(test)]
mod tests {
    use axum::{
        Router,
        body::Body,
        http::{Request, StatusCode},
        routing::get,
    };
    use http_body_util::BodyExt;
    use serde_json::Value;
    use tower::util::ServiceExt;

    use super::health;

    fn health_only_router() -> Router {
        Router::new().route("/api/health", get(health))
    }

    #[tokio::test]
    async fn health_endpoint_reports_backend_ready() {
        let response = health_only_router()
            .oneshot(
                Request::builder()
                    .uri("/api/health")
                    .body(Body::empty())
                    .expect("health request should build"),
            )
            .await
            .expect("router should answer");

        assert_eq!(response.status(), StatusCode::OK);

        let body = response
            .into_body()
            .collect()
            .await
            .expect("body should collect")
            .to_bytes();

        let payload: Value =
            serde_json::from_slice(&body).expect("health response should be valid json");

        assert_eq!(payload["status"], "ok");
        assert_eq!(payload["service"], "feedback-system-backend");
    }
}
