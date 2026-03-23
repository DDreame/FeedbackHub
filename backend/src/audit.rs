//! Audit logging service (#t91)
//! Records all developer actions to audit_logs table.

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

/// Audit log action types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditAction {
    StatusChange,
    Reply,
    InternalNote,
    Assign,
    Unassign,
    MarkSpam,
    UnmarkSpam,
    Delete,
}

impl AuditAction {
    pub fn as_str(&self) -> &'static str {
        match self {
            AuditAction::StatusChange => "status_change",
            AuditAction::Reply => "reply",
            AuditAction::InternalNote => "internal_note",
            AuditAction::Assign => "assign",
            AuditAction::Unassign => "unassign",
            AuditAction::MarkSpam => "mark_spam",
            AuditAction::UnmarkSpam => "unmark_spam",
            AuditAction::Delete => "delete",
        }
    }
}

/// Record an audit log entry
pub async fn log_audit(
    pool: &PgPool,
    thread_id: Uuid,
    actor_id: Option<Uuid>,
    actor_email: Option<&str>,
    action: AuditAction,
    old_value: Option<&str>,
    new_value: Option<&str>,
    metadata: Option<serde_json::Value>,
) -> Result<(), sqlx::Error> {
    let id = Uuid::now_v7();
    let now = chrono::Utc::now();

    sqlx::query(
        r#"
        INSERT INTO audit_logs (id, thread_id, actor_id, actor_email, action, old_value, new_value, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
    )
    .bind(id)
    .bind(thread_id)
    .bind(actor_id)
    .bind(actor_email)
    .bind(action.as_str())
    .bind(old_value)
    .bind(new_value)
    .bind(metadata)
    .bind(now)
    .execute(pool)
    .await?;

    Ok(())
}
