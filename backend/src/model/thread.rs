use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/// Canonical status for a feedback thread per #t6 contract.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "VARCHAR", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ThreadStatus {
    Received,
    InReview,
    WaitingForUser,
    Closed,
    Deleted,
}

impl ThreadStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ThreadStatus::Received => "received",
            ThreadStatus::InReview => "in_review",
            ThreadStatus::WaitingForUser => "waiting_for_user",
            ThreadStatus::Closed => "closed",
            ThreadStatus::Deleted => "deleted",
        }
    }

    pub fn can_transition_to(&self, next: &ThreadStatus) -> bool {
        matches!(
            (self, next),
            (ThreadStatus::Received, ThreadStatus::InReview)
                | (ThreadStatus::InReview, ThreadStatus::WaitingForUser)
                | (ThreadStatus::InReview, ThreadStatus::Closed)
                | (ThreadStatus::WaitingForUser, ThreadStatus::InReview)
                | (ThreadStatus::WaitingForUser, ThreadStatus::Closed)
                | (ThreadStatus::Closed, ThreadStatus::InReview)
                // Reporter can delete from any non-closed state
                | (ThreadStatus::Received, ThreadStatus::Deleted)
                | (ThreadStatus::InReview, ThreadStatus::Deleted)
                | (ThreadStatus::WaitingForUser, ThreadStatus::Deleted)
        )
    }
}

impl std::fmt::Display for ThreadStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Who authored a message.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "VARCHAR", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AuthorType {
    Reporter,
    Developer,
    System,
}

impl AuthorType {
    pub fn as_str(&self) -> &'static str {
        match self {
            AuthorType::Reporter => "reporter",
            AuthorType::Developer => "developer",
            AuthorType::System => "system",
        }
    }
}

// ---------------------------------------------------------------------------
// Domain models (database rows)
// ---------------------------------------------------------------------------

/// Context snapshot captured at thread creation.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ContextSnapshot {
    pub app_version: String,
    pub build_number: Option<String>,
    pub os_name: String,
    pub os_version: String,
    pub device_model: String,
    pub locale: Option<String>,
    pub current_route: String,
    pub captured_at: DateTime<Utc>,
    #[sqlx(rename = "reporter_account_id")]
    pub reporter_account_id: Option<String>,
}

/// FeedbackThread as stored in the database.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct FeedbackThread {
    pub id: Uuid,
    pub reporter_id: Uuid,
    pub reporter_contact: Option<String>,
    pub category: String,
    pub status: String,
    pub summary: String,
    pub latest_public_message_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
    // Context fields flattened
    pub context_app_version: String,
    pub context_build_number: Option<String>,
    pub context_os_name: String,
    pub context_os_version: String,
    pub context_device_model: String,
    pub context_locale: Option<String>,
    pub context_current_route: String,
    pub context_captured_at: DateTime<Utc>,
    pub context_reporter_account_id: Option<String>,
    // Assignee tracking
    pub assignee_id: Option<Uuid>,
    // Spam flag
    pub is_spam: bool,
    // Unread tracking for internal notes
    pub last_internal_note_at: Option<DateTime<Utc>>,
}

impl FeedbackThread {
    pub fn context(&self) -> ContextSnapshot {
        ContextSnapshot {
            app_version: self.context_app_version.clone(),
            build_number: self.context_build_number.clone(),
            os_name: self.context_os_name.clone(),
            os_version: self.context_os_version.clone(),
            device_model: self.context_device_model.clone(),
            locale: self.context_locale.clone(),
            current_route: self.context_current_route.clone(),
            captured_at: self.context_captured_at,
            reporter_account_id: self.context_reporter_account_id.clone(),
        }
    }
}

/// FeedbackMessage as stored in the database.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct FeedbackMessage {
    pub id: Uuid,
    pub thread_id: Uuid,
    pub author_type: String,
    pub body: String,
    pub attachments: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub is_internal: bool,
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// Input for creating a new feedback thread (SDK → API).
#[derive(Debug, Deserialize)]
pub struct CreateThreadRequest {
    pub reporter_id: Uuid,
    pub reporter_contact: Option<String>,
    pub category: String,
    pub summary: String,
    pub context: ContextSnapshotInput,
}

/// Input for atomic create-thread-with-message operation.
#[derive(Debug, Deserialize)]
pub struct CreateThreadAtomicRequest {
    #[serde(flatten)]
    pub thread: CreateThreadRequest,
    /// Initial message body. If provided, creates thread AND first message in one transaction.
    pub initial_message: Option<String>,
    /// Base64 data URLs of attached images.
    pub attachments: Option<Vec<String>>,
    /// Notification preferences. If provided, creates notification_preferences record.
    pub notification_preferences: Option<NotificationPreferencesInput>,
}

/// Notification preferences input from frontend.
#[derive(Debug, Deserialize)]
pub struct NotificationPreferencesInput {
    pub email: String,
    pub notify_on_reply: bool,
    pub notify_on_status_change: bool,
    pub notify_on_close: bool,
}

/// Response for atomic create-thread-with-message operation.
#[derive(Debug, Serialize)]
pub struct CreateThreadAtomicResponse {
    pub thread_id: Uuid,
    pub message_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct ContextSnapshotInput {
    pub app_version: String,
    pub build_number: Option<String>,
    pub os_name: String,
    pub os_version: String,
    pub device_model: String,
    pub locale: Option<String>,
    pub current_route: String,
    pub reporter_account_id: Option<String>,
}

/// Input for adding a message to a thread.
#[derive(Debug, Deserialize)]
pub struct AddMessageRequest {
    pub author_type: AuthorType,
    pub body: String,
    /// Base64 data URLs of attached images.
    pub attachments: Option<Vec<String>>,
}

/// Input for updating thread status (developer-side).
#[derive(Debug, Deserialize)]
pub struct UpdateStatusRequest {
    pub status: ThreadStatus,
}

/// Input for adding an internal note (developer-only).
#[derive(Debug, Deserialize)]
pub struct InternalNoteRequest {
    pub body: String,
    /// Base64 data URLs of attached images.
    pub attachments: Option<Vec<String>>,
}

/// Input for unassigning a thread (clears assignee_id).
#[derive(Debug, Deserialize)]
pub struct UnassignRequest {}

/// Input for marking a thread as spam.
#[derive(Debug, Deserialize)]
pub struct MarkSpamRequest {
    pub is_spam: bool,
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct ThreadResponse {
    pub id: Uuid,
    pub reporter_id: Uuid,
    pub reporter_contact: Option<String>,
    pub category: String,
    pub status: String,
    pub summary: String,
    pub latest_public_message_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
    pub context: ContextSnapshot,
}

impl From<FeedbackThread> for ThreadResponse {
    fn from(t: FeedbackThread) -> Self {
        let context = t.context();
        ThreadResponse {
            id: t.id,
            reporter_id: t.reporter_id,
            reporter_contact: t.reporter_contact,
            category: t.category,
            status: t.status,
            summary: t.summary,
            latest_public_message_at: t.latest_public_message_at,
            created_at: t.created_at,
            updated_at: t.updated_at,
            closed_at: t.closed_at,
            context,
        }
    }
}

/// DeveloperThreadResponse includes developer-only fields: assignee_id, is_spam, last_internal_note_at
#[derive(Debug, Serialize)]
pub struct DeveloperThreadResponse {
    pub id: Uuid,
    pub reporter_id: Uuid,
    pub reporter_contact: Option<String>,
    pub category: String,
    pub status: String,
    pub summary: String,
    pub latest_public_message_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
    pub context: ContextSnapshot,
    pub assignee_id: Option<Uuid>,
    pub is_spam: bool,
    pub last_internal_note_at: Option<DateTime<Utc>>,
}

impl From<FeedbackThread> for DeveloperThreadResponse {
    fn from(t: FeedbackThread) -> Self {
        let context = t.context();
        DeveloperThreadResponse {
            id: t.id,
            reporter_id: t.reporter_id,
            reporter_contact: t.reporter_contact,
            category: t.category,
            status: t.status,
            summary: t.summary,
            latest_public_message_at: t.latest_public_message_at,
            created_at: t.created_at,
            updated_at: t.updated_at,
            closed_at: t.closed_at,
            context,
            assignee_id: t.assignee_id,
            is_spam: t.is_spam,
            last_internal_note_at: t.last_internal_note_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub id: Uuid,
    pub thread_id: Uuid,
    pub author_type: String,
    pub body: String,
    pub attachments: Vec<String>,
    pub created_at: DateTime<Utc>,
}

impl From<FeedbackMessage> for MessageResponse {
    fn from(m: FeedbackMessage) -> Self {
        MessageResponse {
            id: m.id,
            thread_id: m.thread_id,
            author_type: m.author_type,
            body: m.body,
            attachments: m.attachments,
            created_at: m.created_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct CreateThreadResponse {
    pub id: Uuid,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn thread_status_as_str() {
        assert_eq!(ThreadStatus::Received.as_str(), "received");
        assert_eq!(ThreadStatus::InReview.as_str(), "in_review");
        assert_eq!(ThreadStatus::WaitingForUser.as_str(), "waiting_for_user");
        assert_eq!(ThreadStatus::Closed.as_str(), "closed");
        assert_eq!(ThreadStatus::Deleted.as_str(), "deleted");
    }

    #[test]
    fn thread_status_valid_transitions() {
        assert!(ThreadStatus::Received.can_transition_to(&ThreadStatus::InReview));
        assert!(ThreadStatus::InReview.can_transition_to(&ThreadStatus::WaitingForUser));
        assert!(ThreadStatus::InReview.can_transition_to(&ThreadStatus::Closed));
        assert!(ThreadStatus::WaitingForUser.can_transition_to(&ThreadStatus::InReview));
        assert!(ThreadStatus::WaitingForUser.can_transition_to(&ThreadStatus::Closed));
        assert!(ThreadStatus::Closed.can_transition_to(&ThreadStatus::InReview));
        // Soft delete transitions
        assert!(ThreadStatus::Received.can_transition_to(&ThreadStatus::Deleted));
        assert!(ThreadStatus::InReview.can_transition_to(&ThreadStatus::Deleted));
        assert!(ThreadStatus::WaitingForUser.can_transition_to(&ThreadStatus::Deleted));
    }

    #[test]
    fn thread_status_invalid_transitions() {
        assert!(!ThreadStatus::Received.can_transition_to(&ThreadStatus::Closed));
        assert!(!ThreadStatus::Received.can_transition_to(&ThreadStatus::WaitingForUser));
        assert!(!ThreadStatus::InReview.can_transition_to(&ThreadStatus::Received));
        assert!(!ThreadStatus::WaitingForUser.can_transition_to(&ThreadStatus::Received));
        assert!(!ThreadStatus::Closed.can_transition_to(&ThreadStatus::Received));
        assert!(!ThreadStatus::Closed.can_transition_to(&ThreadStatus::WaitingForUser));
        // Cannot transition FROM Deleted to any other status
        assert!(!ThreadStatus::Deleted.can_transition_to(&ThreadStatus::Received));
        assert!(!ThreadStatus::Deleted.can_transition_to(&ThreadStatus::InReview));
        assert!(!ThreadStatus::Deleted.can_transition_to(&ThreadStatus::WaitingForUser));
        assert!(!ThreadStatus::Deleted.can_transition_to(&ThreadStatus::Closed));
        // Cannot delete a closed thread
        assert!(!ThreadStatus::Closed.can_transition_to(&ThreadStatus::Deleted));
    }

    #[test]
    fn thread_status_serialize_to_snake_case() {
        let json = serde_json::to_value(ThreadStatus::InReview).unwrap();
        assert_eq!(json, "in_review");
        let json_del = serde_json::to_value(ThreadStatus::Deleted).unwrap();
        assert_eq!(json_del, "deleted");
    }

    #[test]
    fn thread_status_deserialize_from_snake_case() {
        let json = serde_json::json!("waiting_for_user");
        let s: ThreadStatus = serde_json::from_value(json).unwrap();
        assert_eq!(s, ThreadStatus::WaitingForUser);
        let json_del = serde_json::json!("deleted");
        let s_del: ThreadStatus = serde_json::from_value(json_del).unwrap();
        assert_eq!(s_del, ThreadStatus::Deleted);
    }

    #[test]
    fn author_type_as_str() {
        assert_eq!(AuthorType::Reporter.as_str(), "reporter");
        assert_eq!(AuthorType::Developer.as_str(), "developer");
        assert_eq!(AuthorType::System.as_str(), "system");
    }

    #[test]
    fn context_snapshot_from_thread() {
        let thread = FeedbackThread {
            id: Uuid::new_v4(),
            reporter_id: Uuid::new_v4(),
            reporter_contact: None,
            category: "bug".to_string(),
            status: "received".to_string(),
            summary: "Test".to_string(),
            latest_public_message_at: Utc::now(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            closed_at: None,
            context_app_version: "1.0.0".to_string(),
            context_build_number: Some("1".to_string()),
            context_os_name: "iOS".to_string(),
            context_os_version: "17.0".to_string(),
            context_device_model: "iPhone 15".to_string(),
            context_locale: Some("en-US".to_string()),
            context_current_route: "/home".to_string(),
            context_captured_at: Utc::now(),
            context_reporter_account_id: Some("user123".to_string()),
            assignee_id: None,
            is_spam: false,
            last_internal_note_at: None,
        };
        let ctx = thread.context();
        assert_eq!(ctx.app_version, "1.0.0");
        assert_eq!(ctx.os_name, "iOS");
    }

    #[test]
    fn thread_response_from_feedback_thread() {
        let thread = FeedbackThread {
            id: Uuid::new_v4(),
            reporter_id: Uuid::new_v4(),
            reporter_contact: Some("test@example.com".to_string()),
            category: "bug".to_string(),
            status: "received".to_string(),
            summary: "Test summary".to_string(),
            latest_public_message_at: Utc::now(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            closed_at: None,
            context_app_version: "1.0.0".to_string(),
            context_build_number: None,
            context_os_name: "iOS".to_string(),
            context_os_version: "17.0".to_string(),
            context_device_model: "iPhone 15".to_string(),
            context_locale: None,
            context_current_route: "/home".to_string(),
            context_captured_at: Utc::now(),
            context_reporter_account_id: None,
            assignee_id: None,
            is_spam: false,
            last_internal_note_at: None,
        };
        let response: ThreadResponse = thread.into();
        assert_eq!(response.category, "bug");
        assert_eq!(response.status, "received");
    }
}
