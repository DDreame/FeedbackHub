pub mod model;

use axum::{Json, Router, routing::get};
use serde::Serialize;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

pub fn app() -> Router {
    Router::new().route("/api/health", get(health))
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
        body::Body,
        http::{Request, StatusCode},
    };
    use http_body_util::BodyExt;
    use serde_json::Value;
    use tower::util::ServiceExt;

    use super::app;

    #[tokio::test]
    async fn health_endpoint_reports_backend_ready() {
        let response = app()
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
