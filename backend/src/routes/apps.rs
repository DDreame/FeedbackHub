use axum::{Json, Router, extract::State, http::StatusCode};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::feedback::AppState;

#[derive(Debug, Serialize, FromRow)]
pub struct App {
    pub id: Uuid,
    pub name: String,
    pub app_key: String,
    pub description: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateAppRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
struct CreateAppResponse {
    id: Uuid,
    app_key: String,
    name: String,
    description: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

impl From<App> for CreateAppResponse {
    fn from(app: App) -> Self {
        Self {
            id: app.id,
            app_key: app.app_key,
            name: app.name,
            description: app.description,
            created_at: app.created_at,
        }
    }
}

pub fn app_routes(state: AppState) -> Router {
    Router::new()
        .route("/v1/feedback/apps", axum::routing::post(create_app))
        .route("/v1/feedback/apps", axum::routing::get(list_apps))
        .with_state(state)
}

// POST /v1/feedback/apps
async fn create_app(
    State(state): State<AppState>,
    Json(payload): Json<CreateAppRequest>,
) -> Result<(StatusCode, Json<CreateAppResponse>), (StatusCode, Json<ErrorResponse>)> {
    let id = Uuid::now_v7();
    let app_key = format!(
        "app_{}",
        &Uuid::now_v7().to_string().replace("-", "")[..8]
    );
    let now = chrono::Utc::now();
    let description = payload.description.unwrap_or_default();

    sqlx::query(
        r#"INSERT INTO apps (id, name, app_key, description, created_at)
           VALUES ($1, $2, $3, $4, $5)"#,
    )
    .bind(id)
    .bind(&payload.name)
    .bind(&app_key)
    .bind(&description)
    .bind(now)
    .execute(&state.db)
    .await
    .map_err(|e| {
        eprintln!("create_app error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    let app = App {
        id,
        name: payload.name,
        app_key,
        description,
        created_at: now,
    };

    Ok((StatusCode::CREATED, Json(CreateAppResponse::from(app))))
}

async fn list_apps(
    State(state): State<AppState>,
) -> Result<Json<Vec<App>>, (StatusCode, Json<ErrorResponse>)> {
    let rows: Vec<App> = sqlx::query_as(
        "SELECT id, name, app_key, description, created_at FROM apps ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;
    Ok(Json(rows))
}
