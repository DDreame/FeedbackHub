pub mod audit;
pub mod db;
pub mod email;
pub mod model;
pub mod routes;
pub mod webhook;

use axum::{Json, Router, middleware, routing::get};
use axum::extract::{FromRequest, rejection::JsonRejection};
use axum::http::StatusCode;
use axum::http::Request;
use routes::apps::app_routes;
use routes::developer::dev_routes;
use routes::feedback::{AppState, RateLimiter, api_key_auth, feedback_routes};
use routes::project::project_routes;
use routes::tags::tag_routes;
use serde::{de::DeserializeOwned, Serialize};

/// A JSON extractor that returns sanitised error messages instead of
/// exposing internal field names on deserialisation failures.
pub struct SafeJson<T>(pub T);

impl<T, S> FromRequest<S> for SafeJson<T>
where
    T: DeserializeOwned,
    S: Send + Sync,
{
    type Rejection = (StatusCode, Json<serde_json::Value>);

    async fn from_request(req: Request<axum::body::Body>, state: &S) -> Result<Self, Self::Rejection> {
        match Json::<T>::from_request(req, state).await {
            Ok(Json(value)) => Ok(SafeJson(value)),
            Err(rejection) => {
                let status = rejection.status();
                let message = match &rejection {
                    JsonRejection::JsonDataError(_) => "invalid request body — check required fields",
                    JsonRejection::JsonSyntaxError(_) => "invalid JSON syntax in request body",
                    JsonRejection::MissingJsonContentType(_) => "missing Content-Type: application/json header",
                    JsonRejection::BytesRejection(_) => "failed to read request body",
                    _ => "invalid request body",
                };
                Err((
                    status,
                    Json(serde_json::json!({ "error": message })),
                ))
            }
        }
    }
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

pub fn app() -> Router {
    let rate_limit: usize = std::env::var("RATE_LIMIT_PER_MINUTE")
        .unwrap_or_else(|_| "100".to_string())
        .parse()
        .unwrap_or(100);
    app_with_state(AppState {
        db: create_pool_from_env(),
        rate_limiter: RateLimiter::new(rate_limit, 60),
    })
}

pub fn app_with_state(state: AppState) -> Router {
    let state2 = state.clone();
    let state3 = state.clone();
    let state4 = state.clone();
    let state5 = state.clone();
    let health = Router::new().route("/api/health", get(health));
    // Dev routes protected by API key auth middleware
    let dev_api = dev_routes(state.clone())
        .merge(tag_routes(state5))
        .layer(middleware::from_fn_with_state(state.clone(), api_key_auth));
    health
        .merge(app_routes(state))
        .merge(feedback_routes(state2))
        .merge(project_routes(state3))
        .merge(routes::threads::thread_routes(state4))
        .merge(dev_api)
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
