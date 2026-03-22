use axum::{
    Json, Router,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
};
use chrono::Utc;
use serde::Serialize;
use uuid::Uuid;

use crate::model::thread::{
    AddMessageRequest, ContextSnapshot, CreateThreadAtomicRequest, CreateThreadAtomicResponse,
    CreateThreadRequest, CreateThreadResponse, FeedbackMessage, FeedbackThread, MessageResponse,
    ThreadResponse, ThreadStatus, UpdateStatusRequest,
};

use super::feedback::AppState;

fn extract_reporter_id(headers: &HeaderMap) -> Option<Uuid> {
    headers
        .get("X-Reporter-Id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
}

#[derive(Debug, serde::Serialize)]
pub struct ErrorResponse {
    error: String,
}

impl IntoResponse for ErrorResponse {
    fn into_response(self) -> axum::response::Response {
        (StatusCode::BAD_REQUEST, Json(self)).into_response()
    }
}

impl From<&'static str> for ErrorResponse {
    fn from(s: &'static str) -> Self {
        ErrorResponse {
            error: s.to_string(),
        }
    }
}

impl From<String> for ErrorResponse {
    fn from(s: String) -> Self {
        ErrorResponse { error: s }
    }
}

// ---------------------------------------------------------------------------
// Reporter-side API
// ---------------------------------------------------------------------------

/// POST /v1/feedback/threads
async fn create_thread(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateThreadRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    // Auth: require X-Reporter-Id header and use it as authoritative reporter_id
    let reporter_id = extract_reporter_id(&headers).ok_or((
        StatusCode::UNAUTHORIZED,
        Json(ErrorResponse {
            error: "X-Reporter-Id header required".to_string(),
        }),
    ))?;

    let id = Uuid::now_v7();
    let now = Utc::now();
    let context = ContextSnapshot {
        app_version: payload.context.app_version,
        build_number: payload.context.build_number,
        os_name: payload.context.os_name,
        os_version: payload.context.os_version,
        device_model: payload.context.device_model,
        locale: payload.context.locale,
        current_route: payload.context.current_route,
        captured_at: now,
        reporter_account_id: payload.context.reporter_account_id,
    };

    sqlx::query(
        r#"
        INSERT INTO feedback_threads (
            id, reporter_id, reporter_contact, category, status, summary,
            latest_public_message_at, created_at, updated_at, closed_at,
            context_app_version, context_build_number, context_os_name,
            context_os_version, context_device_model, context_locale,
            context_current_route, context_captured_at, context_reporter_account_id
        ) VALUES ($1, $2, $3, $4, 'received', $5, $6, $6, $6, NULL, $7, $8, $9, $10, $11, $12, $13, $6, $14)
        "#,
    )
    .bind(id)
    .bind(reporter_id)
    .bind(&payload.reporter_contact)
    .bind(&payload.category)
    .bind(&payload.summary)
    .bind(now)
    .bind(&context.app_version)
    .bind(&context.build_number)
    .bind(&context.os_name)
    .bind(&context.os_version)
    .bind(&context.device_model)
    .bind(&context.locale)
    .bind(&context.current_route)
    .bind(&context.reporter_account_id)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e.to_string() })))?;

    Ok((StatusCode::CREATED, Json(CreateThreadResponse { id })))
}

/// POST /v1/feedback/threads/atomic
/// Creates a thread and optionally an initial message in a single transaction.
async fn create_thread_atomic(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateThreadAtomicRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let reporter_id = extract_reporter_id(&headers).ok_or((
        StatusCode::UNAUTHORIZED,
        Json(ErrorResponse {
            error: "X-Reporter-Id header required".to_string(),
        }),
    ))?;

    let thread_id = Uuid::now_v7();
    let now = Utc::now();
    let context = ContextSnapshot {
        app_version: payload.thread.context.app_version.clone(),
        build_number: payload.thread.context.build_number.clone(),
        os_name: payload.thread.context.os_name.clone(),
        os_version: payload.thread.context.os_version.clone(),
        device_model: payload.thread.context.device_model.clone(),
        locale: payload.thread.context.locale.clone(),
        current_route: payload.thread.context.current_route.clone(),
        captured_at: now,
        reporter_account_id: payload.thread.context.reporter_account_id.clone(),
    };

    // Use a transaction for atomicity
    let mut tx = state.db.begin().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    sqlx::query(
        r#"
        INSERT INTO feedback_threads (
            id, reporter_id, reporter_contact, category, status, summary,
            latest_public_message_at, created_at, updated_at, closed_at,
            context_app_version, context_build_number, context_os_name,
            context_os_version, context_device_model, context_locale,
            context_current_route, context_captured_at, context_reporter_account_id
        ) VALUES ($1, $2, $3, $4, 'received', $5, $6, $6, $6, NULL, $7, $8, $9, $10, $11, $12, $13, $6, $14)
        "#,
    )
    .bind(thread_id)
    .bind(reporter_id)
    .bind(&payload.thread.reporter_contact)
    .bind(&payload.thread.category)
    .bind(&payload.thread.summary)
    .bind(now)
    .bind(&context.app_version)
    .bind(&context.build_number)
    .bind(&context.os_name)
    .bind(&context.os_version)
    .bind(&context.device_model)
    .bind(&context.locale)
    .bind(&context.current_route)
    .bind(&context.reporter_account_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse { error: e.to_string() }),
        )
    })?;

    let message_id = if let Some(body) = &payload.initial_message {
        let msg_id = Uuid::now_v7();
        sqlx::query(
            r#"INSERT INTO feedback_messages (id, thread_id, author_type, body, created_at) VALUES ($1, $2, 'reporter', $3, $4)"#,
        )
        .bind(msg_id)
        .bind(thread_id)
        .bind(body)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse { error: e.to_string() }),
            )
        })?;
        Some(msg_id)
    } else {
        None
    };

    tx.commit().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    Ok((
        StatusCode::CREATED,
        Json(CreateThreadAtomicResponse {
            thread_id,
            message_id,
        }),
    ))
}

/// GET /v1/feedback/threads
async fn list_my_threads(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let reporter_id = extract_reporter_id(&headers).ok_or((
        StatusCode::UNAUTHORIZED,
        Json(ErrorResponse {
            error: "X-Reporter-Id header required".to_string(),
        }),
    ))?;

    let rows: Vec<FeedbackThread> = sqlx::query_as(
        r#"
        SELECT id, reporter_id, reporter_contact, category, status, summary,
               latest_public_message_at, created_at, updated_at, closed_at,
               context_app_version, context_build_number, context_os_name,
               context_os_version, context_device_model, context_locale,
               context_current_route, context_captured_at, context_reporter_account_id
        FROM feedback_threads
        WHERE reporter_id = $1
        ORDER BY latest_public_message_at DESC
        "#,
    )
    .bind(reporter_id)
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

    let response: Vec<ThreadResponse> = rows.into_iter().map(ThreadResponse::from).collect();
    Ok(Json(response))
}

/// GET /v1/feedback/threads/:thread_id
async fn get_my_thread(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(thread_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let reporter_id = extract_reporter_id(&headers).ok_or((
        StatusCode::UNAUTHORIZED,
        Json(ErrorResponse {
            error: "X-Reporter-Id header required".to_string(),
        }),
    ))?;

    let row: Option<FeedbackThread> = sqlx::query_as(
        r#"
        SELECT id, reporter_id, reporter_contact, category, status, summary,
               latest_public_message_at, created_at, updated_at, closed_at,
               context_app_version, context_build_number, context_os_name,
               context_os_version, context_device_model, context_locale,
               context_current_route, context_captured_at, context_reporter_account_id
        FROM feedback_threads
        WHERE id = $1
        "#,
    )
    .bind(thread_id)
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
        Some(thread) => {
            if thread.reporter_id != reporter_id {
                Err((
                    StatusCode::FORBIDDEN,
                    Json(ErrorResponse {
                        error: "not your thread".to_string(),
                    }),
                ))
            } else {
                Ok(Json(ThreadResponse::from(thread)))
            }
        }
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "thread not found".to_string(),
            }),
        )),
    }
}

/// POST /v1/feedback/threads/:thread_id/messages
async fn add_message(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(thread_id): Path<Uuid>,
    Json(payload): Json<AddMessageRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let reporter_id = extract_reporter_id(&headers).ok_or((
        StatusCode::UNAUTHORIZED,
        Json(ErrorResponse {
            error: "X-Reporter-Id header required".to_string(),
        }),
    ))?;

    // Verify thread ownership
    let thread: Option<FeedbackThread> = sqlx::query_as(
        r#"
        SELECT id, reporter_id, reporter_contact, category, status, summary,
               latest_public_message_at, created_at, updated_at, closed_at,
               context_app_version, context_build_number, context_os_name,
               context_os_version, context_device_model, context_locale,
               context_current_route, context_captured_at, context_reporter_account_id
        FROM feedback_threads WHERE id = $1
        "#,
    )
    .bind(thread_id)
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

    let thread = thread.ok_or((
        StatusCode::NOT_FOUND,
        Json(ErrorResponse {
            error: "thread not found".to_string(),
        }),
    ))?;

    if thread.reporter_id != reporter_id {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "not your thread".to_string(),
            }),
        ));
    }

    let id = Uuid::now_v7();
    let now = Utc::now();

    sqlx::query(
        r#"INSERT INTO feedback_messages (id, thread_id, author_type, body, created_at) VALUES ($1, $2, $3, $4, $5)"#,
    )
    .bind(id)
    .bind(thread_id)
    .bind("reporter") // Force author_type to reporter for reporter-side endpoint
    .bind(&payload.body)
    .bind(now)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e.to_string() })))?;

    sqlx::query(
        r#"UPDATE feedback_threads SET latest_public_message_at = $1, updated_at = $1 WHERE id = $2"#,
    )
    .bind(now)
    .bind(thread_id)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e.to_string() })))?;

    // Reopen thread if it was closed (reporter added new message)
    sqlx::query(
        r#"UPDATE feedback_threads SET status = 'in_review', closed_at = NULL WHERE id = $1 AND status = 'closed'"#,
    )
    .bind(thread_id)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e.to_string() })))?;

    let message = FeedbackMessage {
        id,
        thread_id,
        author_type: "reporter".to_string(),
        body: payload.body,
        created_at: now,
    };

    Ok((StatusCode::CREATED, Json(MessageResponse::from(message))))
}

/// GET /v1/feedback/threads/:thread_id/messages
async fn list_my_messages(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(thread_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let reporter_id = extract_reporter_id(&headers).ok_or((
        StatusCode::UNAUTHORIZED,
        Json(ErrorResponse {
            error: "X-Reporter-Id header required".to_string(),
        }),
    ))?;

    // Verify thread ownership
    let thread: Option<FeedbackThread> = sqlx::query_as(
        r#"SELECT id, reporter_id, reporter_contact, category, status, summary,
               latest_public_message_at, created_at, updated_at, closed_at,
               context_app_version, context_build_number, context_os_name,
               context_os_version, context_device_model, context_locale,
               context_current_route, context_captured_at, context_reporter_account_id
        FROM feedback_threads WHERE id = $1"#,
    )
    .bind(thread_id)
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

    let thread = thread.ok_or((
        StatusCode::NOT_FOUND,
        Json(ErrorResponse {
            error: "thread not found".to_string(),
        }),
    ))?;

    if thread.reporter_id != reporter_id {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "not your thread".to_string(),
            }),
        ));
    }

    let rows: Vec<FeedbackMessage> = sqlx::query_as(
        r#"SELECT id, thread_id, author_type, body, created_at FROM feedback_messages WHERE thread_id = $1 ORDER BY created_at ASC"#,
    )
    .bind(thread_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e.to_string() })))?;

    let response: Vec<MessageResponse> = rows.into_iter().map(MessageResponse::from).collect();
    Ok(Json(response))
}

// ---------------------------------------------------------------------------
// Developer-side API
// ---------------------------------------------------------------------------

/// GET /v1/dev/feedback/threads
async fn dev_list_threads(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let rows: Vec<FeedbackThread> = sqlx::query_as(
        r#"
        SELECT id, reporter_id, reporter_contact, category, status, summary,
               latest_public_message_at, created_at, updated_at, closed_at,
               context_app_version, context_build_number, context_os_name,
               context_os_version, context_device_model, context_locale,
               context_current_route, context_captured_at, context_reporter_account_id
        FROM feedback_threads
        ORDER BY latest_public_message_at DESC
        "#,
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

    let response: Vec<ThreadResponse> = rows.into_iter().map(ThreadResponse::from).collect();
    Ok(Json(response))
}

/// GET /v1/dev/feedback/threads/:thread_id
async fn dev_get_thread(
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let row: Option<FeedbackThread> = sqlx::query_as(
        r#"
        SELECT id, reporter_id, reporter_contact, category, status, summary,
               latest_public_message_at, created_at, updated_at, closed_at,
               context_app_version, context_build_number, context_os_name,
               context_os_version, context_device_model, context_locale,
               context_current_route, context_captured_at, context_reporter_account_id
        FROM feedback_threads WHERE id = $1
        "#,
    )
    .bind(thread_id)
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
        Some(thread) => Ok(Json(ThreadResponse::from(thread))),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "thread not found".to_string(),
            }),
        )),
    }
}

/// POST /v1/dev/feedback/threads/:thread_id/reply
async fn dev_reply(
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
    Json(payload): Json<AddMessageRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    // Verify thread exists
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM feedback_threads WHERE id = $1)")
            .bind(thread_id)
            .fetch_one(&state.db)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: e.to_string(),
                    }),
                )
            })?;

    if !exists {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "thread not found".to_string(),
            }),
        ));
    }

    let id = Uuid::now_v7();
    let now = Utc::now();

    sqlx::query(
        r#"INSERT INTO feedback_messages (id, thread_id, author_type, body, created_at) VALUES ($1, $2, 'developer', $3, $4)"#,
    )
    .bind(id)
    .bind(thread_id)
    .bind(&payload.body)
    .bind(now)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e.to_string() })))?;

    sqlx::query(
        r#"UPDATE feedback_threads SET latest_public_message_at = $1, updated_at = $1 WHERE id = $2"#,
    )
    .bind(now)
    .bind(thread_id)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e.to_string() })))?;

    let message = FeedbackMessage {
        id,
        thread_id,
        author_type: "developer".to_string(),
        body: payload.body,
        created_at: now,
    };

    Ok((StatusCode::CREATED, Json(MessageResponse::from(message))))
}

/// POST /v1/dev/feedback/threads/:thread_id/status
async fn dev_update_status(
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
    Json(payload): Json<UpdateStatusRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    // Get current status and verify transition is valid
    let current_status: Option<String> =
        sqlx::query_scalar("SELECT status FROM feedback_threads WHERE id = $1")
            .bind(thread_id)
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

    let current_status = current_status.ok_or((
        StatusCode::NOT_FOUND,
        Json(ErrorResponse {
            error: "thread not found".to_string(),
        }),
    ))?;

    let current: ThreadStatus =
        serde_json::from_str(&format!("\"{}\"", current_status)).map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "invalid current status".to_string(),
                }),
            )
        })?;

    if !current.can_transition_to(&payload.status) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("cannot transition from {} to {}", current, payload.status),
            }),
        ));
    }

    let now = Utc::now();
    let closed_at: Option<chrono::DateTime<Utc>> = if payload.status == ThreadStatus::Closed {
        Some(now)
    } else {
        None
    };

    sqlx::query(
        r#"UPDATE feedback_threads SET status = $1, updated_at = $2, closed_at = $3 WHERE id = $4"#,
    )
    .bind(payload.status.as_str())
    .bind(now)
    .bind(closed_at)
    .bind(thread_id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    let row: Option<FeedbackThread> = sqlx::query_as(
        r#"
        SELECT id, reporter_id, reporter_contact, category, status, summary,
               latest_public_message_at, created_at, updated_at, closed_at,
               context_app_version, context_build_number, context_os_name,
               context_os_version, context_device_model, context_locale,
               context_current_route, context_captured_at, context_reporter_account_id
        FROM feedback_threads WHERE id = $1
        "#,
    )
    .bind(thread_id)
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
        Some(thread) => Ok(Json(ThreadResponse::from(thread))),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "thread not found".to_string(),
            }),
        )),
    }
}

#[derive(Serialize)]
struct AssignOkResponse {
    status: &'static str,
}

/// POST /v1/dev/feedback/threads/:thread_id/assign
async fn dev_assign(
    State(_state): State<AppState>,
    Path(_thread_id): Path<Uuid>,
    Json(_payload): Json<serde_json::Value>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    // Assign implementation - for now just return success
    // TODO: integrate with actual auth/developer identity
    Ok(Json(AssignOkResponse { status: "ok" }))
}

// ---------------------------------------------------------------------------
// Routes registration
// ---------------------------------------------------------------------------

pub fn thread_routes(state: AppState) -> Router {
    Router::new()
        // Reporter-side (auth via X-Reporter-Id header)
        .route("/v1/feedback/threads", post(create_thread))
        .route("/v1/feedback/threads/atomic", post(create_thread_atomic))
        .route("/v1/feedback/threads", get(list_my_threads))
        .route("/v1/feedback/threads/{thread_id}", get(get_my_thread))
        .route(
            "/v1/feedback/threads/{thread_id}/messages",
            post(add_message),
        )
        .route(
            "/v1/feedback/threads/{thread_id}/messages",
            get(list_my_messages),
        )
        // Developer-side
        .route("/v1/dev/feedback/threads", get(dev_list_threads))
        .route("/v1/dev/feedback/threads/{thread_id}", get(dev_get_thread))
        .route(
            "/v1/dev/feedback/threads/{thread_id}/reply",
            post(dev_reply),
        )
        .route(
            "/v1/dev/feedback/threads/{thread_id}/status",
            post(dev_update_status),
        )
        .route(
            "/v1/dev/feedback/threads/{thread_id}/assign",
            post(dev_assign),
        )
        .with_state(state)
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

    fn app_with_pool(pool: sqlx::PgPool) -> Router {
        thread_routes(AppState { db: pool })
    }

    fn is_database_available() -> bool {
        std::env::var("DATABASE_URL").is_ok()
    }

    /// Seeds a minimal thread row for message/status tests.
    async fn seed_thread(
        pool: &sqlx::PgPool,
        thread_id: Uuid,
        reporter_id: Uuid,
        status: &str,
    ) -> Result<(), sqlx::Error> {
        let now = chrono::Utc::now();
        sqlx::query(
            r#"
            INSERT INTO feedback_threads (
                id, reporter_id, reporter_contact, category, status, summary,
                latest_public_message_at, created_at, updated_at, closed_at,
                context_app_version, context_build_number, context_os_name,
                context_os_version, context_device_model, context_locale,
                context_current_route, context_captured_at, context_reporter_account_id
            ) VALUES ($1, $2, NULL, 'bug', $3, 'test summary', $4, $4, $4, NULL, '1.0.0', NULL, 'iOS', '17.0', 'iPhone 15', NULL, '/home', $4, NULL)
            "#,
        )
        .bind(thread_id)
        .bind(reporter_id)
        .bind(status)
        .bind(now)
        .execute(pool)
        .await?;
        Ok(())
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL to be set"]
    async fn create_thread_requires_x_reporter_id_header() {
        if !is_database_available() {
            return;
        }
        let pool = test_pool().await.expect("test pool");
        let app = app_with_pool(pool);

        // Payload constructed manually to avoid Serialize requirement on CreateThreadRequest
        let body = serde_json::json!({
            "reporter_id": Uuid::now_v7().to_string(),
            "reporter_contact": null,
            "category": "bug",
            "summary": "Test",
            "context": {
                "app_version": "1.0.0",
                "build_number": null,
                "os_name": "iOS",
                "os_version": "17.0",
                "device_model": "iPhone",
                "locale": null,
                "current_route": "/home",
                "reporter_account_id": null
            }
        });

        // Missing X-Reporter-Id header → 401
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/feedback/threads")
                    .header("Content-Type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL to be set"]
    async fn create_thread_with_valid_header_succeeds() {
        if !is_database_available() {
            return;
        }
        let pool = test_pool().await.expect("test pool");
        let app = app_with_pool(pool.clone());

        let reporter_id = Uuid::now_v7();
        let body = serde_json::json!({
            "reporter_id": reporter_id.to_string(),
            "reporter_contact": "test@example.com",
            "category": "bug",
            "summary": "Test bug",
            "context": {
                "app_version": "1.0.0",
                "build_number": "1",
                "os_name": "iOS",
                "os_version": "17.0",
                "device_model": "iPhone 15",
                "locale": "en-US",
                "current_route": "/feedback",
                "reporter_account_id": null
            }
        });

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/feedback/threads")
                    .header("Content-Type", "application/json")
                    .header("X-Reporter-Id", reporter_id.to_string())
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);
        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        let created_id = json
            .get("id")
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok());

        assert!(
            created_id.is_some(),
            "response should contain valid UUID id"
        );

        // Clean up
        if let Some(id) = created_id {
            let _ = sqlx::query("DELETE FROM feedback_threads WHERE id = $1")
                .bind(id)
                .execute(&pool)
                .await;
        }
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL to be set"]
    async fn create_thread_atomic_with_initial_message() {
        if !is_database_available() {
            return;
        }
        let pool = test_pool().await.expect("test pool");
        let app = app_with_pool(pool.clone());

        let reporter_id = Uuid::now_v7();
        let body = serde_json::json!({
            "reporter_id": reporter_id.to_string(),
            "reporter_contact": "test@example.com",
            "category": "bug",
            "summary": "Test atomic bug",
            "context": {
                "app_version": "1.0.0",
                "build_number": "1",
                "os_name": "iOS",
                "os_version": "17.0",
                "device_model": "iPhone 15",
                "locale": "en-US",
                "current_route": "/feedback",
                "reporter_account_id": null
            },
            "initial_message": "This is the initial bug report message"
        });

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/feedback/threads/atomic")
                    .header("Content-Type", "application/json")
                    .header("X-Reporter-Id", reporter_id.to_string())
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);
        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        let thread_id = json
            .get("thread_id")
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok());
        let message_id = json
            .get("message_id")
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok());

        assert!(thread_id.is_some(), "response should contain thread_id");
        assert!(
            message_id.is_some(),
            "response should contain message_id when initial_message provided"
        );

        // Verify message exists in DB
        if let (Some(tid), Some(mid)) = (thread_id, message_id) {
            let count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM feedback_messages WHERE id = $1 AND thread_id = $2",
            )
            .bind(mid)
            .bind(tid)
            .fetch_one(&pool)
            .await
            .expect("count message");
            assert_eq!(count, 1, "message should exist in DB");

            // Clean up
            let _ = sqlx::query("DELETE FROM feedback_messages WHERE thread_id = $1")
                .bind(tid)
                .execute(&pool)
                .await;
            let _ = sqlx::query("DELETE FROM feedback_threads WHERE id = $1")
                .bind(tid)
                .execute(&pool)
                .await;
        }
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL to be set"]
    async fn add_message_forces_author_type_to_reporter() {
        if !is_database_available() {
            return;
        }
        let pool = test_pool().await.expect("test pool");
        let app = app_with_pool(pool.clone());

        let thread_id = Uuid::now_v7();
        let reporter_id = Uuid::now_v7();
        seed_thread(&pool, thread_id, reporter_id, "in_review")
            .await
            .expect("seed thread");

        // Client claims author_type=developer, but server should force to reporter
        let body = serde_json::json!({
            "author_type": "developer",
            "body": "This should be forced to reporter"
        });

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/feedback/threads/{}/messages", thread_id))
                    .header("Content-Type", "application/json")
                    .header("X-Reporter-Id", reporter_id.to_string())
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);
        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        let author_type = json.get("author_type").and_then(|v| v.as_str());
        assert_eq!(
            author_type,
            Some("reporter"),
            "server must force author_type to reporter"
        );

        // Clean up
        let _ = sqlx::query("DELETE FROM feedback_messages WHERE thread_id = $1")
            .bind(thread_id)
            .execute(&pool)
            .await;
        let _ = sqlx::query("DELETE FROM feedback_threads WHERE id = $1")
            .bind(thread_id)
            .execute(&pool)
            .await;
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL to be set"]
    async fn closed_thread_reopens_when_reporter_adds_message() {
        if !is_database_available() {
            return;
        }
        let pool = test_pool().await.expect("test pool");
        let app = app_with_pool(pool.clone());

        let thread_id = Uuid::now_v7();
        let reporter_id = Uuid::now_v7();
        let now = chrono::Utc::now();

        // Seed a CLOSED thread
        sqlx::query(
            r#"
            INSERT INTO feedback_threads (
                id, reporter_id, reporter_contact, category, status, summary,
                latest_public_message_at, created_at, updated_at, closed_at,
                context_app_version, context_build_number, context_os_name,
                context_os_version, context_device_model, context_locale,
                context_current_route, context_captured_at, context_reporter_account_id
            ) VALUES ($1, $2, NULL, 'bug', 'closed', 'test', $3, $3, $3, $3, '1.0', NULL, 'iOS', '17', 'iPhone', NULL, '/home', $3, NULL)
            "#,
        )
        .bind(thread_id)
        .bind(reporter_id)
        .bind(now)
        .execute(&pool)
        .await
        .expect("seed closed thread");

        let body = serde_json::json!({
            "author_type": "reporter",
            "body": "Reopening message"
        });

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/feedback/threads/{}/messages", thread_id))
                    .header("Content-Type", "application/json")
                    .header("X-Reporter-Id", reporter_id.to_string())
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);

        // Verify thread is now in_review with no closed_at
        let row: (String, Option<chrono::DateTime<chrono::Utc>>) =
            sqlx::query_as("SELECT status, closed_at FROM feedback_threads WHERE id = $1")
                .bind(thread_id)
                .fetch_one(&pool)
                .await
                .expect("fetch thread status");

        assert_eq!(row.0, "in_review");
        assert!(row.1.is_none(), "closed_at should be cleared after reopen");

        // Clean up
        let _ = sqlx::query("DELETE FROM feedback_messages WHERE thread_id = $1")
            .bind(thread_id)
            .execute(&pool)
            .await;
        let _ = sqlx::query("DELETE FROM feedback_threads WHERE id = $1")
            .bind(thread_id)
            .execute(&pool)
            .await;
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL to be set"]
    async fn dev_list_threads_returns_all_threads() {
        if !is_database_available() {
            return;
        }
        let pool = test_pool().await.expect("test pool");
        let app = app_with_pool(pool.clone());

        let thread_id = Uuid::now_v7();
        let reporter_id = Uuid::now_v7();
        seed_thread(&pool, thread_id, reporter_id, "received")
            .await
            .expect("seed thread");

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/dev/feedback/threads")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        let threads = json.as_array().expect("response should be array");
        assert!(
            threads.iter().any(|t| t
                .get("id")
                .and_then(|v| v.as_str())
                .and_then(|s| Uuid::parse_str(s).ok())
                == Some(thread_id)),
            "should contain seeded thread"
        );

        // Clean up
        let _ = sqlx::query("DELETE FROM feedback_threads WHERE id = $1")
            .bind(thread_id)
            .execute(&pool)
            .await;
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL to be set"]
    async fn dev_update_status_transitions_are_validated() {
        if !is_database_available() {
            return;
        }
        let pool = test_pool().await.expect("test pool");
        let app = app_with_pool(pool.clone());

        let thread_id = Uuid::now_v7();
        let reporter_id = Uuid::now_v7();
        seed_thread(&pool, thread_id, reporter_id, "received")
            .await
            .expect("seed thread");

        // Invalid: received → closed (must go through in_review first)
        let body = serde_json::json!({ "status": "closed" });

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/dev/feedback/threads/{}/status", thread_id))
                    .header("Content-Type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        // Valid: received → in_review
        let body = serde_json::json!({ "status": "in_review" });

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/dev/feedback/threads/{}/status", thread_id))
                    .header("Content-Type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(
            json.get("status").and_then(|v| v.as_str()),
            Some("in_review")
        );

        // Clean up
        let _ = sqlx::query("DELETE FROM feedback_threads WHERE id = $1")
            .bind(thread_id)
            .execute(&pool)
            .await;
    }

    #[test]
    fn error_response_serializes() {
        let err = ErrorResponse {
            error: "test error".to_string(),
        };
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["error"], "test error");
    }
}
