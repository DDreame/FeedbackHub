use axum::{Json, Router, extract::State};
use serde::Serialize;
use sqlx::FromRow;

use super::feedback::AppState;

#[derive(Debug, Serialize, FromRow)]
pub struct App {
    pub id: uuid::Uuid,
    pub name: String,
    pub app_key: String,
    pub description: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

pub fn app_routes(state: AppState) -> Router {
    Router::new()
        .route("/v1/feedback/apps", axum::routing::get(list_apps))
        .with_state(state)
}

async fn list_apps(
    State(state): State<AppState>,
) -> Result<Json<Vec<App>>, (axum::http::StatusCode, Json<ErrorResponse>)> {
    let rows: Vec<App> = sqlx::query_as(
        "SELECT id, name, app_key, description, created_at FROM apps ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;
    Ok(Json(rows))
}
