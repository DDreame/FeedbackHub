use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::model::feedback::{Feedback, UpdateFeedback};

/// Shared application state holding the database pool.
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
struct FeedbackResponse {
    id: Uuid,
    project_id: Uuid,
    end_user_id: Option<Uuid>,
    app_context: String,
    platform: String,
    version: String,
    content: String,
    status: String,
    priority: String,
    tags: Vec<String>,
    notes: String,
    created_at: chrono::DateTime<Utc>,
    updated_at: chrono::DateTime<Utc>,
}

impl From<Feedback> for FeedbackResponse {
    fn from(f: Feedback) -> Self {
        let tags: Vec<String> = if f.tags.is_empty() {
            Vec::new()
        } else {
            f.tags.split(',').map(|s| s.trim().to_string()).collect()
        };
        Self {
            id: f.id,
            project_id: f.project_id,
            end_user_id: f.end_user_id,
            app_context: f.app_context,
            platform: f.platform,
            version: f.version,
            content: f.content,
            status: f.status,
            priority: f.priority,
            tags,
            notes: f.notes,
            created_at: f.created_at,
            updated_at: f.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ListFeedbackQuery {
    pub project_id: Option<Uuid>,
    pub status: Option<String>,
    pub end_user_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CreateFeedbackResponse {
    id: Uuid,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

/// Request payload for creating a new feedback item (includes project_id).
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateFeedbackRequest {
    pub project_id: Uuid,
    pub app_context: String,
    pub platform: String,
    pub version: String,
    pub content: String,
    pub end_user_id: Option<Uuid>,
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

pub fn feedback_routes(state: AppState) -> Router {
    Router::new()
        .route("/api/feedback", axum::routing::post(create_feedback))
        .route("/api/feedback", axum::routing::get(list_feedback))
        .route("/api/feedback/{id}", axum::routing::get(get_feedback))
        .route("/api/feedback/{id}", axum::routing::patch(update_feedback))
        .with_state(state)
}

// POST /api/feedback
async fn create_feedback(
    State(state): State<AppState>,
    Json(payload): Json<CreateFeedbackRequest>,
) -> Result<(StatusCode, Json<CreateFeedbackResponse>), (StatusCode, Json<ErrorResponse>)> {
    // Verify project exists to prevent orphan feedback rows.
    let project_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1)",
    )
    .bind(payload.project_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e.to_string() })))?;

    if !project_exists {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: "project not found".into() }),
        ));
    }

    let id = Uuid::now_v7();
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO feedbacks (id, project_id, end_user_id, app_context, platform, version, content, status, priority, tags, notes, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', 'medium', '', '', $8, $8)
        "#,
    )
    .bind(id)
    .bind(payload.project_id)
    .bind(payload.end_user_id)
    .bind(&payload.app_context)
    .bind(&payload.platform)
    .bind(&payload.version)
    .bind(&payload.content)
    .bind(now)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e.to_string() })))?;

    Ok((StatusCode::CREATED, Json(CreateFeedbackResponse { id })))
}

// GET /api/feedback
async fn list_feedback(
    State(state): State<AppState>,
    Query(query): Query<ListFeedbackQuery>,
) -> Result<Json<Vec<FeedbackResponse>>, (StatusCode, Json<ErrorResponse>)> {
    let rows: Vec<Feedback> = sqlx::query_as(
        r#"
        SELECT id, project_id, end_user_id, app_context, platform, version,
               content, status, priority, tags, notes, created_at, updated_at
        FROM feedbacks
        WHERE ($1::uuid IS NULL OR project_id = $1)
          AND ($2::text IS NULL OR status = $2)
          AND ($3::uuid IS NULL OR end_user_id = $3)
        ORDER BY created_at DESC
        "#,
    )
    .bind(query.project_id)
    .bind(query.status)
    .bind(query.end_user_id)
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

    let response: Vec<FeedbackResponse> = rows.into_iter().map(FeedbackResponse::from).collect();
    Ok(Json(response))
}

// GET /api/feedback/:id
async fn get_feedback(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<FeedbackResponse>, (StatusCode, Json<ErrorResponse>)> {
    let row: Option<Feedback> = sqlx::query_as(
        r#"
        SELECT id, project_id, end_user_id, app_context, platform, version,
               content, status, priority, tags, notes, created_at, updated_at
        FROM feedbacks
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    match row {
        Some(f) => Ok(Json(FeedbackResponse::from(f))),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "not found".into(),
            }),
        )),
    }
}

// PATCH /api/feedback/:id
async fn update_feedback(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateFeedback>,
) -> Result<Json<FeedbackResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Build dynamic update query based on provided fields.
    let status = payload.status.map(|s| s.as_str().to_string());
    let priority = payload.priority.map(|p| p.as_str().to_string());

    let row: Option<Feedback> = sqlx::query_as(
        r#"
        UPDATE feedbacks
        SET status = COALESCE($1, status),
            priority = COALESCE($2, priority),
            tags = COALESCE($3, tags),
            notes = COALESCE($4, notes),
            updated_at = NOW()
        WHERE id = $5
        RETURNING id, project_id, end_user_id, app_context, platform, version,
                  content, status, priority, tags, notes, created_at, updated_at
        "#,
    )
    .bind(&status)
    .bind(&priority)
    .bind(&payload.tags)
    .bind(&payload.notes)
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    match row {
        Some(f) => Ok(Json(FeedbackResponse::from(f))),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "not found".into(),
            }),
        )),
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_pool;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use tower::util::ServiceExt;

    fn app_with_pool(pool: PgPool) -> Router {
        feedback_routes(AppState { db: pool })
    }

    fn json_body<T: Serialize>(value: &T) -> String {
        serde_json::to_string(value).unwrap()
    }

    fn is_database_available() -> bool {
        std::env::var("DATABASE_URL").is_ok()
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL to be set"]
    async fn create_and_fetch_feedback() {
        if !is_database_available() {
            return;
        }
        let pool = test_pool().await.expect("test pool");
        let app = app_with_pool(pool.clone());

        let project_id = Uuid::now_v7();
        let payload = CreateFeedbackRequest {
            project_id,
            app_context: "TestApp v1.0".into(),
            platform: "iOS 17".into(),
            version: "1.0.0".into(),
            content: "Great app!".into(),
            end_user_id: None,
        };

        // Create
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/feedback")
                    .header("Content-Type", "application/json")
                    .body(Body::from(json_body(&payload)))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let created: CreateFeedbackResponse = serde_json::from_slice(&body).unwrap();

        // Fetch
        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/feedback/{}", created.id))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let fetched: FeedbackResponse = serde_json::from_slice(&body).unwrap();
        assert_eq!(fetched.content, "Great app!");
        assert_eq!(fetched.status, "new");
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL to be set"]
    async fn list_feedback_filters_by_project() {
        if !is_database_available() {
            return;
        }
        let pool = test_pool().await.expect("test pool");
        let app = app_with_pool(pool.clone());

        let project_id = Uuid::now_v7();

        // Create two feedback items for different projects
        for i in 0..2 {
            let payload = CreateFeedbackRequest {
                project_id,
                app_context: format!("App{}", i),
                platform: "Android".into(),
                version: "1.0".into(),
                content: format!("Feedback {}", i),
                end_user_id: None,
            };
            let _ = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/feedback")
                        .header("Content-Type", "application/json")
                        .body(Body::from(json_body(&payload)))
                        .unwrap(),
                )
                .await
                .unwrap();
        }

        // List all (no filter)
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/feedback")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // List filtered by project_id
        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/feedback?project_id={}", project_id))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let list: Vec<FeedbackResponse> = serde_json::from_slice(&body).unwrap();
        assert!(list.iter().all(|f| f.project_id == project_id));
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL to be set"]
    async fn get_nonexistent_feedback_returns_404() {
        if !is_database_available() {
            return;
        }
        let pool = test_pool().await.expect("test pool");
        let app = app_with_pool(pool);

        let fake_id = Uuid::now_v7();
        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/feedback/{}", fake_id))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}
