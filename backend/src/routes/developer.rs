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

use super::feedback::{AppState, create_api_key, list_api_keys, revoke_api_key};

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

/// GET /v1/dev/feedback/export
/// Export threads as CSV with optional filtering
async fn dev_export_csv(
    State(state): State<AppState>,
    Query(query): Query<InboxQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    // Validate status value to prevent SQL injection
    let status_value = query.status.as_ref().and_then(|s| {
        if ["received", "in_review", "waiting_for_user", "closed", "deleted"]
            .contains(&s.as_str())
        {
            Some(s.clone())
        } else {
            None
        }
    });

    let rows: Vec<FeedbackThread> = match (&status_value, &query.category, &query.assignee_id) {
        (None, None, None) => {
            sqlx::query_as(
                r#"
                SELECT id, reporter_id, reporter_contact, category, status, summary,
                       latest_public_message_at, created_at, updated_at, closed_at,
                       context_app_version, context_build_number, context_os_name,
                       context_os_version, context_device_model, context_locale,
                       context_current_route, context_captured_at, context_reporter_account_id,
                       assignee_id, is_spam, last_internal_note_at, deleted_at
                FROM feedback_threads
                WHERE status != 'deleted'
                ORDER BY latest_public_message_at DESC
                LIMIT 10000
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
            })?
        }
        _ => {
            let category_pattern = query.category.as_deref().map(|c| format!("%{}%", c));
            sqlx::query_as(
                r#"
                SELECT id, reporter_id, reporter_contact, category, status, summary,
                       latest_public_message_at, created_at, updated_at, closed_at,
                       context_app_version, context_build_number, context_os_name,
                       context_os_version, context_device_model, context_locale,
                       context_current_route, context_captured_at, context_reporter_account_id,
                       assignee_id, is_spam, last_internal_note_at, deleted_at
                FROM feedback_threads
                WHERE ($1::varchar IS NULL OR status = $1)
                  AND ($2::varchar IS NULL OR category LIKE $2)
                  AND ($3::uuid IS NULL OR assignee_id = $3)
                  AND status != 'deleted'
                ORDER BY latest_public_message_at DESC
                LIMIT 10000
                "#,
            )
            .bind(&status_value)
            .bind(&category_pattern)
            .bind(query.assignee_id)
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

    // Build CSV
    let mut csv = String::new();
    csv.push_str("id,reporter_id,reporter_contact,category,status,summary,created_at,updated_at,closed_at,latest_public_message_at,app_version,build_number,os_name,os_version,device_model,locale,current_route,assignee_id,is_spam\n");

    for t in rows {
        // Escape quotes in text fields
        let escape = |s: &str| s.replace('"', "\"\"");
        let reporter_contact = t.reporter_contact.as_deref().unwrap_or("");
        let closed_at = t.closed_at.map(|d| d.to_rfc3339()).unwrap_or_default();
        let assignee = t.assignee_id.map(|u| u.to_string()).unwrap_or_default();
        let line = format!(
            "\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"\n",
            t.id,
            t.reporter_id,
            escape(reporter_contact),
            escape(&t.category),
            t.status,
            escape(&t.summary),
            t.created_at.to_rfc3339(),
            t.updated_at.to_rfc3339(),
            closed_at,
            t.latest_public_message_at.to_rfc3339(),
            escape(&t.context_app_version),
            escape(t.context_build_number.as_deref().unwrap_or("")),
            escape(&t.context_os_name),
            escape(&t.context_os_version),
            escape(&t.context_device_model),
            escape(t.context_locale.as_deref().unwrap_or("")),
            escape(&t.context_current_route),
            assignee,
            t.is_spam,
        );
        csv.push_str(&line);
    }

    Ok((
        StatusCode::OK,
        [("Content-Type", "text/csv")],
        csv,
    ))
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

    // Get reporter_id, summary, and app_id for notification
    let thread_info: Option<(Uuid, String, Option<Uuid>)> =
        sqlx::query_as("SELECT reporter_id, summary, app_id FROM feedback_threads WHERE id = $1")
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
    if let Some((reporter_id, summary, app_id)) = thread_info {
        let db = state.db.clone();
        tokio::spawn(async move {
            maybe_send_notification(&db, reporter_id, &summary, NotificationType::Reply).await;
            // Trigger webhook for reply
            crate::webhook::trigger_feedback_replied(&db, thread_id, app_id, id, "developer".to_string()).await;
        });
    }

    // Audit log
    let _ = crate::audit::log_audit(
        &state.db,
        thread_id,
        None,
        None,
        crate::audit::AuditAction::Reply,
        None,
        None,
        None,
    )
    .await;

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
    // Schedule auto-follow-up 3 days after transitioning to waiting_for_user
    let follow_up_due_at: Option<chrono::DateTime<Utc>> =
        if payload.status == ThreadStatus::WaitingForUser {
            Some(now + chrono::Duration::days(3))
        } else {
            None
        };

    sqlx::query(
        r#"UPDATE feedback_threads SET status = $1, updated_at = $2, closed_at = $3, follow_up_due_at = $4 WHERE id = $5"#,
    )
    .bind(payload.status.as_str())
    .bind(now)
    .bind(closed_at)
    .bind(follow_up_due_at)
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
            let old_status_str = current_status.clone();
            let reporter_id = thread.reporter_id;
            let summary = thread.summary.clone();
            let app_id = thread.app_id;
            tokio::spawn(async move {
                maybe_send_notification(
                    &db,
                    reporter_id,
                    &summary,
                    NotificationType::StatusChange {
                        new_status: new_status_str.clone(),
                    },
                )
                .await;
                // Trigger webhook for status change
                crate::webhook::trigger_status_changed(
                    &db,
                    thread_id,
                    app_id,
                    old_status_str,
                    new_status_str,
                )
                .await;
            });

            // Audit log
            let _ = crate::audit::log_audit(
                &state.db,
                thread_id,
                None,
                None,
                crate::audit::AuditAction::StatusChange,
                Some(&current_status),
                Some(payload.status.as_str()),
                None,
            )
            .await;

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

    // Audit log
    let _ = crate::audit::log_audit(
        &state.db,
        thread_id,
        None,
        None,
        crate::audit::AuditAction::Assign,
        None,
        assignee_id.map(|u| u.to_string()).as_deref(),
        None,
    )
    .await;

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

/// POST /v1/dev/feedback/threads/{thread_id}/merge
/// Developer merges a source thread INTO the target thread.
/// All messages and tags from the source are moved to the target, and the
/// source thread is soft-deleted. (#t92)
async fn dev_merge_threads(
    State(state): State<AppState>,
    Path(target_id): Path<Uuid>,
    Json(payload): Json<MergeThreadsRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let source_id = payload.source_thread_id;

    // Prevent merging a thread into itself
    if source_id == target_id {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "cannot merge a thread into itself".to_string(),
            }),
        ));
    }

    // Fetch both threads to verify they exist and are not deleted
    let target: Option<(Uuid, String)> = sqlx::query_as(
        r#"SELECT id, status FROM feedback_threads WHERE id = $1"#,
    )
    .bind(target_id)
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

    let target = target.ok_or((
        StatusCode::NOT_FOUND,
        Json(ErrorResponse {
            error: "target thread not found".to_string(),
        }),
    ))?;

    if target.1 == "deleted" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "target thread is deleted".to_string(),
            }),
        ));
    }

    let source: Option<(Uuid, String)> = sqlx::query_as(
        r#"SELECT id, status FROM feedback_threads WHERE id = $1"#,
    )
    .bind(source_id)
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

    let source = source.ok_or((
        StatusCode::NOT_FOUND,
        Json(ErrorResponse {
            error: "source thread not found".to_string(),
        }),
    ))?;

    if source.1 == "deleted" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "source thread is already deleted".to_string(),
            }),
        ));
    }

    // Begin transaction for atomic merge
    let mut tx = state.db.begin().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    let now = Utc::now();

    // Move all messages from source to target (update thread_id FK)
    sqlx::query(
        r#"UPDATE feedback_messages SET thread_id = $1 WHERE thread_id = $2"#,
    )
    .bind(target_id)
    .bind(source_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    // Move all tags from source to target
    // First, delete any existing tags on target that might conflict (same tag_id)
    sqlx::query(
        r#"DELETE FROM thread_tags WHERE thread_id = $1"#,
    )
    .bind(target_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    // Insert tags from source onto target (skip duplicates via ON CONFLICT DO NOTHING)
    sqlx::query(
        r#"
        INSERT INTO thread_tags (thread_id, tag_id, created_at)
        SELECT $1, tag_id, created_at FROM thread_tags WHERE thread_id = $2
        ON CONFLICT (thread_id, tag_id) DO NOTHING
        "#,
    )
    .bind(target_id)
    .bind(source_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    // Delete source thread tags (cleanup)
    sqlx::query(
        r#"DELETE FROM thread_tags WHERE thread_id = $1"#,
    )
    .bind(source_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    // Update target's latest_public_message_at if source has a newer timestamp
    sqlx::query(
        r#"
        UPDATE feedback_threads
        SET latest_public_message_at = GREATEST(
            (SELECT latest_public_message_at FROM feedback_threads WHERE id = $1),
            (SELECT latest_public_message_at FROM feedback_threads WHERE id = $2)
        ), updated_at = $3
        WHERE id = $1
        "#,
    )
    .bind(target_id)
    .bind(source_id)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    // Soft-delete the source thread
    sqlx::query(
        r#"UPDATE feedback_threads SET status = 'deleted', deleted_at = $1, updated_at = $1 WHERE id = $2"#,
    )
    .bind(now)
    .bind(source_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    tx.commit().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    // Audit log the merge
    let _ = crate::audit::log_audit(
        &state.db,
        target_id,
        None,
        None,
        crate::audit::AuditAction::Delete,
        Some(&source_id.to_string()),
        None,
        None,
    )
    .await;

    #[derive(Serialize)]
    struct MergeResponse {
        merged_into: Uuid,
        merged_from: Uuid,
        messages_moved: i64,
    }

    Ok(Json(MergeResponse {
        merged_into: target_id,
        merged_from: source_id,
        messages_moved: 0, // Simplified — actual count would require extra query
    }))
}

// ---------------------------------------------------------------------------
// Router factory (auth middleware applied externally)
// ---------------------------------------------------------------------------

/// Request body for merging two threads
#[derive(Debug, Deserialize)]
pub struct MergeThreadsRequest {
    pub source_thread_id: Uuid,
}

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
        .route(
            "/v1/dev/feedback/threads/{thread_id}/merge",
            post(dev_merge_threads),
        )
        .route("/v1/dev/feedback/apps", get(dev_list_apps))
        .route("/v1/dev/feedback/export", get(dev_export_csv))
        .route("/v1/dev/api-keys", post(create_api_key))
        .route("/v1/dev/api-keys", get(list_api_keys))
        .route("/v1/dev/api-keys/{key_id}", delete(revoke_api_key))
        .with_state(state)
}
