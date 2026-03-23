use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
};
use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;
use uuid::Uuid;

use crate::email::{
    self, EmailPayload, SmtpConfig, template_close_notification, template_reply_notification,
    template_status_change_notification,
};
use crate::model::thread::{
    AddMessageRequest, DeveloperThreadResponse, FeedbackThread, InternalNoteRequest,
    MarkSpamRequest, MessageResponse, ThreadStatus, UpdateStatusRequest,
};

use super::feedback::{AppState, create_api_key};

// ---------------------------------------------------------------------------
// Query types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, Default)]
pub struct InboxQuery {
    pub status: Option<String>,
    pub category: Option<String>,
    pub assignee_id: Option<Uuid>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct PaginatedThreadsResponse {
    pub threads: Vec<DeveloperThreadResponse>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
    pub total_pages: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct ErrorResponse {
    error: String,
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
// Notification helpers
// ---------------------------------------------------------------------------

#[derive(Debug, sqlx::FromRow)]
struct NotificationPrefs {
    email: String,
    notify_on_reply: bool,
    notify_on_status_change: bool,
    notify_on_close: bool,
}

/// Look up notification preferences for a reporter and send email notification.
/// Runs asynchronously - failures are logged but do not affect the main request.
async fn maybe_send_notification(
    db: &sqlx::PgPool,
    reporter_id: Uuid,
    thread_summary: &str,
    notification_type: NotificationType,
) {
    // Load SMTP config
    let Some(smtp_config) = SmtpConfig::from_env() else {
        eprintln!("SMTP not configured, skipping notification");
        return;
    };

    if !smtp_config.is_configured() {
        eprintln!("SMTP not configured, skipping notification");
        return;
    }

    // Look up notification preferences
    let prefs: Option<NotificationPrefs> = sqlx::query_as(
        "SELECT email, notify_on_reply, notify_on_status_change, notify_on_close
         FROM notification_preferences WHERE reporter_id = $1",
    )
    .bind(reporter_id)
    .fetch_optional(db)
    .await
    .ok()
    .flatten();

    let Some(prefs) = prefs else {
        return; // No notification preferences set
    };

    // Build email based on notification type
    let should_notify = match notification_type {
        NotificationType::Reply => prefs.notify_on_reply,
        NotificationType::StatusChange { ref new_status } => {
            if *new_status == "closed" {
                prefs.notify_on_close
            } else {
                prefs.notify_on_status_change
            }
        }
    };

    if !should_notify {
        return;
    }

    let (subject, body) = match notification_type {
        NotificationType::Reply => {
            let template = template_reply_notification(
                "用户",
                "",
                thread_summary,
                "", // message content would need to be passed
                "https://feedback.example.com",
            );
            (template.subject, template.body_html)
        }
        NotificationType::StatusChange { new_status } => {
            let template = if new_status == "closed" {
                template_close_notification(
                    "用户",
                    "",
                    thread_summary,
                    "https://feedback.example.com",
                )
            } else {
                template_status_change_notification(
                    "用户",
                    "",
                    thread_summary,
                    "",
                    &new_status,
                    "https://feedback.example.com",
                )
            };
            (template.subject, template.body_html)
        }
    };

    let email = EmailPayload {
        to_email: prefs.email,
        to_name: "用户".to_string(),
        subject,
        body_html: body,
    };

    // Send email asynchronously
    if let Err(e) = email::send_email(&smtp_config, &email) {
        eprintln!("Failed to send notification email: {}", e);
    }
}

enum NotificationType {
    Reply,
    StatusChange { new_status: String },
}

// ---------------------------------------------------------------------------
// Developer thread routes
// ---------------------------------------------------------------------------

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
        if [
            "received",
            "in_review",
            "waiting_for_user",
            "closed",
            "deleted",
        ]
        .contains(&s.as_str())
        {
            Some(s.clone())
        } else {
            None
        }
    });

    // Use parameterized query - build dynamically with bound params
    let rows: Vec<FeedbackThread> = match (&status_value, &query.category, &query.assignee_id) {
        (None, None, None) => sqlx::query_as(
            r#"
                SELECT id, reporter_id, reporter_contact, category, status, summary,
                       latest_public_message_at, created_at, updated_at, closed_at,
                       context_app_version, context_build_number, context_os_name,
                       context_os_version, context_device_model, context_locale,
                       context_current_route, context_captured_at, context_reporter_account_id,
                       assignee_id, is_spam, last_internal_note_at
                FROM feedback_threads
                WHERE status != 'deleted'
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
        })?,
        _ => {
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
                  AND status != 'deleted'
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

    let total: i64 = match (&status_value, &query.category, &query.assignee_id) {
        (None, None, None) => {
            sqlx::query_scalar("SELECT COUNT(*) FROM feedback_threads WHERE status != 'deleted'")
                .fetch_one(&state.db)
                .await
                .unwrap_or(0)
        }
        _ => {
            let category_pattern = query.category.as_deref().map(|c| format!("%{}%", c));
            sqlx::query_scalar(
                r#"
                SELECT COUNT(*) FROM feedback_threads
                WHERE ($1::varchar IS NULL OR status = $1)
                  AND ($2::varchar IS NULL OR category LIKE $2)
                  AND ($3::uuid IS NULL OR assignee_id = $3)
                  AND status != 'deleted'
                "#,
            )
            .bind(&status_value)
            .bind(&category_pattern)
            .bind(query.assignee_id)
            .fetch_one(&state.db)
            .await
            .unwrap_or(0)
        }
    };

    let total_pages = (total as f64 / limit as f64).ceil() as i64;
    let page = (offset / limit) + 1;

    let response: Vec<DeveloperThreadResponse> = rows
        .into_iter()
        .map(DeveloperThreadResponse::from)
        .collect();
    Ok(Json(PaginatedThreadsResponse {
        threads: response,
        total,
        page,
        page_size: limit,
        total_pages,
    }))
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
               assignee_id, is_spam, last_internal_note_at, deleted_at
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
        r#"INSERT INTO feedback_messages (id, thread_id, author_type, body, attachments, created_at, is_internal) VALUES ($1, $2, 'developer', $3, $4, $5, FALSE)"#,
    )
    .bind(id)
    .bind(thread_id)
    .bind(&payload.body)
    .bind(payload.attachments.clone().unwrap_or_default())
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

    // Get reporter_id and summary for notification
    let thread_info: Option<(Uuid, String)> =
        sqlx::query_as("SELECT reporter_id, summary FROM feedback_threads WHERE id = $1")
            .bind(thread_id)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten();

    let message = crate::model::thread::FeedbackMessage {
        id,
        thread_id,
        author_type: "developer".to_string(),
        body: payload.body.clone(),
        attachments: payload.attachments.unwrap_or_default(),
        created_at: now,
        is_internal: false,
    };

    // Send email notification asynchronously (non-blocking)
    if let Some((reporter_id, summary)) = thread_info {
        let db = state.db.clone();
        tokio::spawn(async move {
            maybe_send_notification(&db, reporter_id, &summary, NotificationType::Reply).await;
        });
    }

    Ok((StatusCode::CREATED, Json(MessageResponse::from(message))))
}

/// POST /v1/dev/feedback/threads/:thread_id/status
async fn dev_update_status(
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
    Json(payload): Json<UpdateStatusRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
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
               assignee_id, is_spam, last_internal_note_at, deleted_at
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
        Some(thread) => {
            // Send email notification asynchronously (non-blocking)
            let db = state.db.clone();
            let new_status_str = payload.status.as_str().to_string();
            let reporter_id = thread.reporter_id;
            let summary = thread.summary.clone();
            tokio::spawn(async move {
                maybe_send_notification(
                    &db,
                    reporter_id,
                    &summary,
                    NotificationType::StatusChange {
                        new_status: new_status_str,
                    },
                )
                .await;
            });

            Ok(Json(DeveloperThreadResponse::from(thread)))
        }
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
async fn dev_unassign(
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
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
async fn dev_add_internal_note(
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
    Json(payload): Json<InternalNoteRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
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
        r#"INSERT INTO feedback_messages (id, thread_id, author_type, body, attachments, created_at, is_internal) VALUES ($1, $2, 'developer', $3, $4, $5, TRUE)"#,
    )
    .bind(id)
    .bind(thread_id)
    .bind(&payload.body)
    .bind(payload.attachments.clone().unwrap_or_default())
    .bind(now)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e.to_string() })))?;

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

    let message = crate::model::thread::FeedbackMessage {
        id,
        thread_id,
        author_type: "developer".to_string(),
        body: payload.body,
        attachments: payload.attachments.unwrap_or_default(),
        created_at: now,
        is_internal: true,
    };

    Ok((StatusCode::CREATED, Json(MessageResponse::from(message))))
}

/// GET /v1/dev/feedback/threads/:thread_id/messages
async fn dev_list_messages(
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let rows: Vec<crate::model::thread::FeedbackMessage> = sqlx::query_as(
        r#"SELECT id, thread_id, author_type, body, attachments, created_at, is_internal FROM feedback_messages WHERE thread_id = $1 ORDER BY created_at ASC"#,
    )
    .bind(thread_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e.to_string() })))?;

    let response: Vec<MessageResponse> = rows.into_iter().map(MessageResponse::from).collect();
    Ok(Json(response))
}

/// POST /v1/dev/feedback/threads/:thread_id/spam
async fn dev_mark_spam(
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
    Json(payload): Json<MarkSpamRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
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

/// GET /v1/dev/feedback/apps
async fn dev_list_apps(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    #[derive(Debug, serde::Serialize, sqlx::FromRow)]
    pub struct AppRow {
        pub id: Uuid,
        pub name: String,
        pub app_key: String,
        pub description: String,
        pub created_at: chrono::DateTime<chrono::Utc>,
    }

    let rows: Vec<AppRow> = sqlx::query_as(
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

// ---------------------------------------------------------------------------
// Router factory (auth middleware applied externally)
// ---------------------------------------------------------------------------

/// Creates dev API router (without auth — auth applied via layer in lib.rs)
pub fn dev_routes(state: AppState) -> Router {
    Router::new()
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
        .route("/v1/dev/feedback/apps", get(dev_list_apps))
        .route("/v1/dev/api-keys", post(create_api_key))
        .with_state(state)
}
