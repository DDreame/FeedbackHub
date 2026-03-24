//! Tag management routes for thread categorization (#t87)

use crate::routes::feedback::{AppState, ErrorResponse};
use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{delete, get, post},
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Tag as stored in the database.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Tag {
    pub id: Uuid,
    pub name: String,
    pub color: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

// ---------------------------------------------------------------------------
// Tag CRUD (dev-only)
// ---------------------------------------------------------------------------

/// POST /v1/dev/tags - Create a new tag
async fn dev_create_tag(
    State(state): State<AppState>,
    Json(payload): Json<CreateTagRequest>,
) -> Result<impl axum::response::IntoResponse, (axum::http::StatusCode, Json<ErrorResponse>)> {
    let id = Uuid::now_v7();
    let now = chrono::Utc::now();

    sqlx::query(r#"INSERT INTO tags (id, name, color, created_at) VALUES ($1, $2, $3, $4)"#)
        .bind(id)
        .bind(&payload.name)
        .bind(&payload.color)
        .bind(now)
        .execute(&state.db)
        .await
        .map_err(|e| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: e.to_string(),
                }),
            )
        })?;

    #[derive(Serialize)]
    struct TagResponse {
        id: Uuid,
        name: String,
        color: String,
    }

    Ok(Json(TagResponse {
        id,
        name: payload.name,
        color: payload.color,
    }))
}

/// GET /v1/dev/tags - List all tags
async fn dev_list_tags(
    State(state): State<AppState>,
) -> Result<impl axum::response::IntoResponse, (axum::http::StatusCode, Json<ErrorResponse>)> {
    let tags: Vec<Tag> =
        sqlx::query_as("SELECT id, name, color, created_at FROM tags ORDER BY name")
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

    Ok(Json(tags))
}

/// DELETE /v1/dev/tags/{tag_id} - Delete a tag
async fn dev_delete_tag(
    State(state): State<AppState>,
    Path(tag_id): Path<Uuid>,
) -> Result<impl axum::response::IntoResponse, (axum::http::StatusCode, Json<ErrorResponse>)> {
    let result = sqlx::query("DELETE FROM tags WHERE id = $1")
        .bind(tag_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: e.to_string(),
                }),
            )
        })?;

    if result.rows_affected() == 0 {
        return Err((
            axum::http::StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "tag not found".to_string(),
            }),
        ));
    }

    Ok(Json(serde_json::json!({ "message": "tag deleted" })))
}

// ---------------------------------------------------------------------------
// Thread-Tag association
// ---------------------------------------------------------------------------

/// POST /v1/dev/feedback/threads/{thread_id}/tags - Add tag to thread
async fn dev_add_tag_to_thread(
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
    Json(payload): Json<AddTagRequest>,
) -> Result<impl axum::response::IntoResponse, (axum::http::StatusCode, Json<ErrorResponse>)> {
    // Verify thread exists
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM feedback_threads WHERE id = $1)")
            .bind(thread_id)
            .fetch_one(&state.db)
            .await
            .map_err(|e| {
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: e.to_string(),
                    }),
                )
            })?;

    if !exists {
        return Err((
            axum::http::StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "thread not found".to_string(),
            }),
        ));
    }

    // Verify tag exists
    let tag_exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tags WHERE id = $1)")
        .bind(payload.tag_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: e.to_string(),
                }),
            )
        })?;

    if !tag_exists {
        return Err((
            axum::http::StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "tag not found".to_string(),
            }),
        ));
    }

    let now = chrono::Utc::now();
    sqlx::query(
        r#"INSERT INTO thread_tags (thread_id, tag_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING"#,
    )
    .bind(thread_id)
    .bind(payload.tag_id)
    .bind(now)
    .execute(&state.db)
    .await
    .map_err(|e| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    Ok(Json(
        serde_json::json!({ "message": "tag added to thread" }),
    ))
}

/// DELETE /v1/dev/feedback/threads/{thread_id}/tags/{tag_id} - Remove tag from thread
async fn dev_remove_tag_from_thread(
    State(state): State<AppState>,
    Path((thread_id, tag_id)): Path<(Uuid, Uuid)>,
) -> Result<impl axum::response::IntoResponse, (axum::http::StatusCode, Json<ErrorResponse>)> {
    sqlx::query("DELETE FROM thread_tags WHERE thread_id = $1 AND tag_id = $2")
        .bind(thread_id)
        .bind(tag_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: e.to_string(),
                }),
            )
        })?;

    Ok(Json(
        serde_json::json!({ "message": "tag removed from thread" }),
    ))
}

/// GET /v1/dev/feedback/threads/{thread_id}/tags - List tags on a thread
async fn dev_list_thread_tags(
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
) -> Result<impl axum::response::IntoResponse, (axum::http::StatusCode, Json<ErrorResponse>)> {
    let tags: Vec<Tag> = sqlx::query_as(
        r#"
        SELECT t.id, t.name, t.color, t.created_at
        FROM tags t
        INNER JOIN thread_tags tt ON tt.tag_id = t.id
        WHERE tt.thread_id = $1
        ORDER BY t.name
        "#,
    )
    .bind(thread_id)
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

    Ok(Json(tags))
}

// ---------------------------------------------------------------------------
// Routes registration
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct CreateTagRequest {
    pub name: String,
    pub color: String,
}

#[derive(Deserialize)]
pub struct AddTagRequest {
    pub tag_id: Uuid,
}

/// Tag management routes (all dev-protected)
pub fn tag_routes(state: crate::routes::feedback::AppState) -> Router {
    Router::new()
        .route("/v1/dev/tags", post(dev_create_tag))
        .route("/v1/dev/tags", get(dev_list_tags))
        .route("/v1/dev/tags/{tag_id}", delete(dev_delete_tag))
        .route(
            "/v1/dev/feedback/threads/{thread_id}/tags",
            post(dev_add_tag_to_thread),
        )
        .route(
            "/v1/dev/feedback/threads/{thread_id}/tags",
            get(dev_list_thread_tags),
        )
        .route(
            "/v1/dev/feedback/threads/{thread_id}/tags/{tag_id}",
            delete(dev_remove_tag_from_thread),
        )
        .with_state(state)
}
