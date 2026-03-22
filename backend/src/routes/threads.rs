use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{delete, get, post},
};
use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;
use uuid::Uuid;

use crate::model::thread::{
    AddMessageRequest, ContextSnapshot, CreateThreadAtomicRequest, CreateThreadAtomicResponse,
    CreateThreadRequest, CreateThreadResponse, DeveloperThreadResponse, FeedbackMessage,
    FeedbackThread, InternalNoteRequest, MarkSpamRequest, MessageResponse, ThreadResponse,
    ThreadStatus, UpdateStatusRequest,
};

#[allow(unused_imports)]
use super::feedback::{AppState, RateLimiter};

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

    // Rate limit check
    if !state.rate_limiter.is_allowed(reporter_id) {
        return Err((
            StatusCode::TOO_MANY_REQUESTS,
            Json(ErrorResponse {
                error: "rate limit exceeded, please try again later".to_string(),
            }),
        ));
    }

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

    // Rate limit check
    if !state.rate_limiter.is_allowed(reporter_id) {
        return Err((
            StatusCode::TOO_MANY_REQUESTS,
            Json(ErrorResponse {
                error: "rate limit exceeded, please try again later".to_string(),
            }),
        ));
    }

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
            r#"INSERT INTO feedback_messages (id, thread_id, author_type, body, created_at, is_internal) VALUES ($1, $2, 'reporter', $3, $4, FALSE)"#,
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
               context_current_route, context_captured_at, context_reporter_account_id,
               assignee_id, is_spam, last_internal_note_at
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
               context_current_route, context_captured_at, context_reporter_account_id,
               assignee_id, is_spam, last_internal_note_at
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

    // Rate limit check for message append
    if !state.rate_limiter.is_allowed(reporter_id) {
        return Err((
            StatusCode::TOO_MANY_REQUESTS,
            Json(ErrorResponse {
                error: "rate limit exceeded, please try again later".to_string(),
            }),
        ));
    }

    // Verify thread ownership
    let thread: Option<FeedbackThread> = sqlx::query_as(
        r#"
        SELECT id, reporter_id, reporter_contact, category, status, summary,
               latest_public_message_at, created_at, updated_at, closed_at,
               context_app_version, context_build_number, context_os_name,
               context_os_version, context_device_model, context_locale,
               context_current_route, context_captured_at, context_reporter_account_id,
               assignee_id, is_spam, last_internal_note_at
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
        r#"INSERT INTO feedback_messages (id, thread_id, author_type, body, created_at, is_internal) VALUES ($1, $2, $3, $4, $5, FALSE)"#,
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
        is_internal: false,
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
               context_current_route, context_captured_at, context_reporter_account_id,
               assignee_id, is_spam, last_internal_note_at
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
        r#"SELECT id, thread_id, author_type, body, created_at, is_internal FROM feedback_messages WHERE thread_id = $1 AND is_internal = FALSE ORDER BY created_at ASC"#,
    )
    .bind(thread_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e.to_string() })))?;

    // Mark messages as read by updating thread_views
    let now = Utc::now();
    sqlx::query(
        r#"INSERT INTO thread_views (thread_id, user_id, user_type, last_read_at)
           VALUES ($1, $2, 'reporter', $3)
           ON CONFLICT (thread_id, user_id, user_type)
           DO UPDATE SET last_read_at = $3"#,
    )
    .bind(thread_id)
    .bind(reporter_id)
    .bind(now)
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

    let response: Vec<MessageResponse> = rows.into_iter().map(MessageResponse::from).collect();
    Ok(Json(response))
}

// ---------------------------------------------------------------------------
// Developer-side API
// ---------------------------------------------------------------------------

/// Query parameters for developer inbox listing
#[derive(Debug, Deserialize, Default)]
pub struct InboxQuery {
    pub status: Option<String>,
    pub category: Option<String>,
    pub assignee_id: Option<Uuid>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// GET /v1/dev/feedback/threads
/// Developer inbox with optional filtering by status, category, assignee
/// and pagination via limit/offset (default limit=20, offset=0)
async fn dev_list_threads(
    State(state): State<AppState>,
    Query(query): Query<InboxQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let limit = query.limit.unwrap_or(20).min(100);
    let offset = query.offset.unwrap_or(0);

    // Validate status value to prevent SQL injection
    let status_value = query.status.as_ref().and_then(|s| {
        if ["received", "in_review", "waiting_for_user", "closed"].contains(&s.as_str()) {
            Some(s.clone())
        } else {
            None
        }
    });

    // Use parameterized query - build dynamically with bound params
    let rows: Vec<FeedbackThread> = match (&status_value, &query.category, &query.assignee_id) {
        (None, None, None) => {
            // No filters - use simple query
            sqlx::query_as(
                r#"
                SELECT id, reporter_id, reporter_contact, category, status, summary,
                       latest_public_message_at, created_at, updated_at, closed_at,
                       context_app_version, context_build_number, context_os_name,
                       context_os_version, context_device_model, context_locale,
                       context_current_route, context_captured_at, context_reporter_account_id,
                       assignee_id, is_spam, last_internal_note_at
                FROM feedback_threads
                ORDER BY latest_public_message_at DESC
                LIMIT $1 OFFSET $2
                "#,
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: e.to_string(),
                    }),
                )
            })?
        }
        _ => {
            // Build query with filters - use COALESCE for optional params
            let category_pattern = query.category.as_deref().map(|c| format!("%{}%", c));
            sqlx::query_as(
                r#"
                SELECT id, reporter_id, reporter_contact, category, status, summary,
                       latest_public_message_at, created_at, updated_at, closed_at,
                       context_app_version, context_build_number, context_os_name,
                       context_os_version, context_device_model, context_locale,
                       context_current_route, context_captured_at, context_reporter_account_id,
                       assignee_id, is_spam, last_internal_note_at
                FROM feedback_threads
                WHERE ($1::varchar IS NULL OR status = $1)
                  AND ($2::varchar IS NULL OR category LIKE $2)
                  AND ($3::uuid IS NULL OR assignee_id = $3)
                ORDER BY latest_public_message_at DESC
                LIMIT $4 OFFSET $5
                "#,
            )
            .bind(&status_value)
            .bind(&category_pattern)
            .bind(query.assignee_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: e.to_string(),
                    }),
                )
            })?
        }
    };

    let response: Vec<DeveloperThreadResponse> = rows
        .into_iter()
        .map(DeveloperThreadResponse::from)
        .collect();
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
               context_current_route, context_captured_at, context_reporter_account_id,
               assignee_id, is_spam, last_internal_note_at
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
        Some(thread) => Ok(Json(DeveloperThreadResponse::from(thread))),
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
        r#"INSERT INTO feedback_messages (id, thread_id, author_type, body, created_at, is_internal) VALUES ($1, $2, 'developer', $3, $4, FALSE)"#,
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
        is_internal: false,
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
               context_current_route, context_captured_at, context_reporter_account_id,
               assignee_id, is_spam, last_internal_note_at
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
        Some(thread) => Ok(Json(DeveloperThreadResponse::from(thread))),
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
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
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

    let assignee_id = payload
        .get("assignee_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());

    let now = Utc::now();
    let result = sqlx::query(
        r#"UPDATE feedback_threads SET assignee_id = $1, updated_at = $2 WHERE id = $3"#,
    )
    .bind(assignee_id)
    .bind(now)
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

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "thread not found".to_string(),
            }),
        ));
    }

    Ok(Json(AssignOkResponse { status: "ok" }))
}

/// DELETE /v1/dev/feedback/threads/:thread_id/assign
/// Unassign: clears assignee_id to NULL
async fn dev_unassign(
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
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

    let now = Utc::now();
    let result = sqlx::query(
        r#"UPDATE feedback_threads SET assignee_id = NULL, updated_at = $1 WHERE id = $2"#,
    )
    .bind(now)
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

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "thread not found".to_string(),
            }),
        ));
    }

    Ok(Json(AssignOkResponse { status: "ok" }))
}

/// POST /v1/dev/feedback/threads/:thread_id/internal-note
/// Add an internal note (developer-only, not visible to reporter)
async fn dev_add_internal_note(
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
    Json(payload): Json<InternalNoteRequest>,
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
        r#"INSERT INTO feedback_messages (id, thread_id, author_type, body, created_at, is_internal) VALUES ($1, $2, 'developer', $3, $4, TRUE)"#,
    )
    .bind(id)
    .bind(thread_id)
    .bind(&payload.body)
    .bind(now)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e.to_string() })))?;

    // Update last_internal_note_at for unread tracking
    sqlx::query(
        r#"UPDATE feedback_threads SET last_internal_note_at = $1, updated_at = $1 WHERE id = $2"#,
    )
    .bind(now)
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

    let message = FeedbackMessage {
        id,
        thread_id,
        author_type: "developer".to_string(),
        body: payload.body,
        created_at: now,
        is_internal: true,
    };

    Ok((StatusCode::CREATED, Json(MessageResponse::from(message))))
}

/// GET /v1/dev/feedback/threads/:thread_id/messages
/// Developer message list - includes internal notes
async fn dev_list_messages(
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let rows: Vec<FeedbackMessage> = sqlx::query_as(
        r#"SELECT id, thread_id, author_type, body, created_at, is_internal FROM feedback_messages WHERE thread_id = $1 ORDER BY created_at ASC"#,
    )
    .bind(thread_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e.to_string() })))?;

    let response: Vec<MessageResponse> = rows.into_iter().map(MessageResponse::from).collect();
    Ok(Json(response))
}

/// POST /v1/dev/feedback/threads/:thread_id/spam
/// Mark or unmark a thread as spam
async fn dev_mark_spam(
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
    Json(payload): Json<MarkSpamRequest>,
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

    let now = Utc::now();
    let result =
        sqlx::query(r#"UPDATE feedback_threads SET is_spam = $1, updated_at = $2 WHERE id = $3"#)
            .bind(payload.is_spam)
            .bind(now)
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

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "thread not found".to_string(),
            }),
        ));
    }

    Ok(Json(AssignOkResponse { status: "ok" }))
}

/// GET /v1/feedback/threads/:thread_id/unread
/// Check if reporter has unread internal notes (developer added notes since last visit)
async fn check_reporter_unread(
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
               context_current_route, context_captured_at, context_reporter_account_id,
               assignee_id, is_spam, last_internal_note_at
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

    // Reporter unread is based on DEVELOPER PUBLIC REPLIES, not internal notes.
    // Internal notes are developer-only and must NOT be exposed to reporters.
    // Uses thread_views table to track per-user last read timestamps.

    // Get or initialize the reporter's last read timestamp
    let last_read_at: chrono::DateTime<Utc> = sqlx::query_scalar(
        "SELECT last_read_at FROM thread_views WHERE thread_id = $1 AND user_id = $2 AND user_type = 'reporter'"
    )
    .bind(thread_id)
    .bind(reporter_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e.to_string() })))?
    .unwrap_or(thread.created_at); // If never read, use thread creation time

    // Check if there's a developer public message after the last read timestamp
    let has_unread: bool = sqlx::query_scalar(
        r#"SELECT EXISTS(
            SELECT 1 FROM feedback_messages
            WHERE thread_id = $1
              AND author_type = 'developer'
              AND is_internal = FALSE
              AND created_at > $2
        )"#,
    )
    .bind(thread_id)
    .bind(last_read_at)
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

    #[derive(Serialize)]
    struct UnreadResponse {
        has_unread: bool,
        last_read_at: chrono::DateTime<Utc>,
    }

    Ok(Json(UnreadResponse {
        has_unread,
        last_read_at,
    }))
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
        .route(
            "/v1/feedback/threads/{thread_id}/unread",
            get(check_reporter_unread),
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
        .route(
            "/v1/dev/feedback/threads/{thread_id}/assign",
            delete(dev_unassign),
        )
        .route(
            "/v1/dev/feedback/threads/{thread_id}/internal-note",
            post(dev_add_internal_note),
        )
        .route(
            "/v1/dev/feedback/threads/{thread_id}/messages",
            get(dev_list_messages),
        )
        .route(
            "/v1/dev/feedback/threads/{thread_id}/spam",
            post(dev_mark_spam),
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
        thread_routes(AppState {
            db: pool,
            rate_limiter: RateLimiter::new(1000, 60),
        })
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

    #[test]
    fn rate_limiter_blocks_after_threshold() {
        use crate::routes::feedback::RateLimiter;
        let limiter = RateLimiter::new(3, 60); // 3 requests per 60 seconds
        let reporter_id = Uuid::new_v4();

        // First 3 requests should be allowed
        assert!(limiter.is_allowed(reporter_id));
        assert!(limiter.is_allowed(reporter_id));
        assert!(limiter.is_allowed(reporter_id));

        // 4th request should be blocked
        assert!(!limiter.is_allowed(reporter_id));
    }

    #[test]
    fn rate_limiter_clone_shares_state() {
        use crate::routes::feedback::RateLimiter;
        let limiter = RateLimiter::new(2, 60);
        let reporter_id = Uuid::new_v4();

        // Use original
        assert!(limiter.is_allowed(reporter_id));
        assert!(limiter.is_allowed(reporter_id));

        // Clone should share state - 3rd request blocked
        let limiter2 = limiter.clone();
        assert!(!limiter2.is_allowed(reporter_id));
    }

    #[test]
    fn inbox_query_default_values() {
        let query: InboxQuery = InboxQuery::default();
        assert!(query.status.is_none());
        assert!(query.category.is_none());
        assert!(query.assignee_id.is_none());
        assert!(query.limit.is_none());
        assert!(query.offset.is_none());
    }

    // ---------------------------------------------------------------------------
    // DB-backed integration tests (require DATABASE_URL)
    // ---------------------------------------------------------------------------

    #[tokio::test]
    #[ignore = "requires DATABASE_URL to be set"]
    async fn dev_assign_returns_404_for_missing_thread() {
        if !is_database_available() {
            return;
        }
        let pool = test_pool().await.expect("test pool");
        let app = app_with_pool(pool);

        let fake_thread_id = Uuid::now_v7();
        let body = serde_json::json!({ "assignee_id": Uuid::now_v7().to_string() });

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!(
                        "/v1/dev/feedback/threads/{}/assign",
                        fake_thread_id
                    ))
                    .header("Content-Type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL to be set"]
    async fn dev_unassign_returns_404_for_missing_thread() {
        if !is_database_available() {
            return;
        }
        let pool = test_pool().await.expect("test pool");
        let app = app_with_pool(pool);

        let fake_thread_id = Uuid::now_v7();

        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!(
                        "/v1/dev/feedback/threads/{}/assign",
                        fake_thread_id
                    ))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL to be set"]
    async fn dev_mark_spam_returns_404_for_missing_thread() {
        if !is_database_available() {
            return;
        }
        let pool = test_pool().await.expect("test pool");
        let app = app_with_pool(pool);

        let fake_thread_id = Uuid::now_v7();
        let body = serde_json::json!({ "is_spam": true });

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/dev/feedback/threads/{}/spam", fake_thread_id))
                    .header("Content-Type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL to be set"]
    async fn dev_list_threads_with_status_filter() {
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

        // Filter by status=in_review should return the thread
        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/dev/feedback/threads?status=in_review")
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
            threads
                .iter()
                .any(|t| t.get("id").and_then(|v| v.as_str())
                    == Some(thread_id.to_string().as_str())),
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
    async fn dev_list_threads_with_invalid_status_filter() {
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

        // Invalid status should be ignored (returns all threads, not filtered)
        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/dev/feedback/threads?status=invalid_status")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        let threads = json.as_array().expect("response should be array");
        // Invalid status should be ignored - thread should still appear
        assert!(
            threads
                .iter()
                .any(|t| t.get("id").and_then(|v| v.as_str())
                    == Some(thread_id.to_string().as_str())),
            "invalid status should be ignored and thread should still appear"
        );

        // Clean up
        let _ = sqlx::query("DELETE FROM feedback_threads WHERE id = $1")
            .bind(thread_id)
            .execute(&pool)
            .await;
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL to be set"]
    async fn unread_clears_after_reporter_reads_messages() {
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

        // Initially no unread (no dev messages)
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/v1/feedback/threads/{}/unread", thread_id))
                    .header("X-Reporter-Id", reporter_id.to_string())
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(
            json.get("has_unread").and_then(|v| v.as_bool()),
            Some(false)
        );

        // Developer adds a reply
        let reply_body =
            serde_json::json!({ "author_type": "developer", "body": "Developer reply" });
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/dev/feedback/threads/{}/reply", thread_id))
                    .header("Content-Type", "application/json")
                    .body(Body::from(reply_body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::CREATED);

        // Now unread should be true
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/v1/feedback/threads/{}/unread", thread_id))
                    .header("X-Reporter-Id", reporter_id.to_string())
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(json.get("has_unread").and_then(|v| v.as_bool()), Some(true));

        // Reporter reads messages
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/v1/feedback/threads/{}/messages", thread_id))
                    .header("X-Reporter-Id", reporter_id.to_string())
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // Now unread should be false
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/v1/feedback/threads/{}/unread", thread_id))
                    .header("X-Reporter-Id", reporter_id.to_string())
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(
            json.get("has_unread").and_then(|v| v.as_bool()),
            Some(false)
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
    async fn rate_limit_blocks_after_threshold() {
        if !is_database_available() {
            return;
        }
        let pool = test_pool().await.expect("test pool");
        // Use a limiter with low threshold for testing
        let app = thread_routes(AppState {
            db: pool,
            rate_limiter: RateLimiter::new(3, 60), // 3 requests per minute
        });

        let reporter_id = Uuid::now_v7();
        let body = serde_json::json!({
            "reporter_id": reporter_id.to_string(),
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

        // First 3 requests should succeed
        for i in 0..3 {
            let app = app.clone();
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
            assert_eq!(
                response.status(),
                StatusCode::CREATED,
                "request {} should succeed",
                i + 1
            );
        }

        // 4th request should be rate limited
        let response = app
            .clone()
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
        assert_eq!(
            response.status(),
            StatusCode::TOO_MANY_REQUESTS,
            "4th request should be rate limited"
        );
    }
}
