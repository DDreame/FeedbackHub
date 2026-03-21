use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/// Lifecycle status for a feedback item.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FeedbackStatus {
    New,
    InProgress,
    Resolved,
    Archived,
}

impl FeedbackStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            FeedbackStatus::New => "new",
            FeedbackStatus::InProgress => "in_progress",
            FeedbackStatus::Resolved => "resolved",
            FeedbackStatus::Archived => "archived",
        }
    }
}

/// Developer-assigned priority.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FeedbackPriority {
    Low,
    Medium,
    High,
    Critical,
}

impl FeedbackPriority {
    pub fn as_str(&self) -> &'static str {
        match self {
            FeedbackPriority::Low => "low",
            FeedbackPriority::Medium => "medium",
            FeedbackPriority::High => "high",
            FeedbackPriority::Critical => "critical",
        }
    }
}

// ---------------------------------------------------------------------------
// Domain model (database row)
// ---------------------------------------------------------------------------

/// Full feedback record as stored in the `feedbacks` table.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Feedback {
    pub id: Uuid,
    pub project_id: Uuid,
    pub end_user_id: Option<Uuid>,
    /// App name submitted with the feedback (e.g. "My App v2.1").
    pub app_context: String,
    /// Platform string such as "iOS 17", "Android 14", "Web Chrome".
    pub platform: String,
    /// Version string such as "2.1.0".
    pub version: String,
    /// Free-text feedback content.
    pub content: String,
    pub status: String,
    pub priority: String,
    /// Comma-separated tag list; empty string when no tags.
    pub tags: String,
    /// Developer notes — not visible to end users.
    pub notes: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/// Input for submitting a new feedback item (SDK → API).
#[derive(Debug, Deserialize)]
pub struct CreateFeedback {
    pub app_context: String,
    pub platform: String,
    pub version: String,
    pub content: String,
    pub end_user_id: Option<Uuid>,
}

/// Input for a developer to update feedback fields.
#[derive(Debug, Deserialize)]
pub struct UpdateFeedback {
    pub status: Option<FeedbackStatus>,
    pub priority: Option<FeedbackPriority>,
    pub tags: Option<String>,
    pub notes: Option<String>,
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/// Feedback data returned to API consumers (developers).
#[derive(Debug, Clone, Serialize)]
pub struct FeedbackResponse {
    pub id: Uuid,
    pub project_id: Uuid,
    pub end_user_id: Option<Uuid>,
    pub app_context: String,
    pub platform: String,
    pub version: String,
    pub content: String,
    pub status: String,
    pub priority: String,
    pub tags: Vec<String>,
    pub notes: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Feedback> for FeedbackResponse {
    fn from(f: Feedback) -> Self {
        let tags = if f.tags.is_empty() {
            Vec::new()
        } else {
            f.tags.split(',').map(|s| s.trim().to_string()).collect()
        };
        FeedbackResponse {
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_feedback() -> Feedback {
        Feedback {
            id: Uuid::now_v7(),
            project_id: Uuid::now_v7(),
            end_user_id: Some(Uuid::now_v7()),
            app_context: "MyApp v1.0.0".to_string(),
            platform: "iOS 17".to_string(),
            version: "1.0.0".to_string(),
            content: "Love this app!".to_string(),
            status: "new".to_string(),
            priority: "medium".to_string(),
            tags: "ui,feedback".to_string(),
            notes: String::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    // --- Enum as_str ---

    #[test]
    fn feedback_status_as_str() {
        assert_eq!(FeedbackStatus::New.as_str(), "new");
        assert_eq!(FeedbackStatus::InProgress.as_str(), "in_progress");
        assert_eq!(FeedbackStatus::Resolved.as_str(), "resolved");
        assert_eq!(FeedbackStatus::Archived.as_str(), "archived");
    }

    #[test]
    fn feedback_priority_as_str() {
        assert_eq!(FeedbackPriority::Low.as_str(), "low");
        assert_eq!(FeedbackPriority::Medium.as_str(), "medium");
        assert_eq!(FeedbackPriority::High.as_str(), "high");
        assert_eq!(FeedbackPriority::Critical.as_str(), "critical");
    }

    // --- Enum JSON serialization ---

    #[test]
    fn feedback_status_serializes_to_snake_case() {
        let json = serde_json::to_value(FeedbackStatus::InProgress).unwrap();
        assert_eq!(json, "in_progress");
    }

    #[test]
    fn feedback_status_deserializes_from_snake_case() {
        let json = serde_json::json!("resolved");
        let s: FeedbackStatus = serde_json::from_value(json).unwrap();
        assert_eq!(s, FeedbackStatus::Resolved);
    }

    #[test]
    fn feedback_priority_serializes_to_snake_case() {
        let json = serde_json::to_value(FeedbackPriority::Critical).unwrap();
        assert_eq!(json, "critical");
    }

    #[test]
    fn feedback_priority_deserializes_from_snake_case() {
        let json = serde_json::json!("high");
        let p: FeedbackPriority = serde_json::from_value(json).unwrap();
        assert_eq!(p, FeedbackPriority::High);
    }

    // --- FeedbackResponse conversion ---

    #[test]
    fn feedback_response_from_feedback_copies_all_fields() {
        let f = make_feedback();
        let r = FeedbackResponse::from(f.clone());
        assert_eq!(r.id, f.id);
        assert_eq!(r.project_id, f.project_id);
        assert_eq!(r.end_user_id, f.end_user_id);
        assert_eq!(r.app_context, f.app_context);
        assert_eq!(r.platform, f.platform);
        assert_eq!(r.version, f.version);
        assert_eq!(r.content, f.content);
        assert_eq!(r.status, f.status);
        assert_eq!(r.priority, f.priority);
        assert_eq!(r.notes, f.notes);
        assert_eq!(r.created_at, f.created_at);
    }

    #[test]
    fn feedback_response_parses_tags_into_vec() {
        let f = make_feedback();
        let r = FeedbackResponse::from(f);
        assert_eq!(r.tags, vec!["ui", "feedback"]);
    }

    #[test]
    fn feedback_response_with_empty_tags_gives_empty_vec() {
        let mut f = make_feedback();
        f.tags = String::new();
        let r = FeedbackResponse::from(f);
        assert!(r.tags.is_empty());
    }

    #[test]
    fn feedback_response_with_sparse_tags_trims_whitespace() {
        let mut f = make_feedback();
        f.tags = "ui, feedback , feature".to_string();
        let r = FeedbackResponse::from(f);
        assert_eq!(r.tags, vec!["ui", "feedback", "feature"]);
    }

    #[test]
    fn feedback_response_serializes_to_json() {
        let f = make_feedback();
        let r = FeedbackResponse::from(f);
        let json = serde_json::to_value(&r).unwrap();
        assert_eq!(json["app_context"], "MyApp v1.0.0");
        assert_eq!(json["platform"], "iOS 17");
        assert_eq!(json["status"], "new");
        assert!(json["tags"].is_array());
    }

    // --- CreateFeedback DTO ---

    #[test]
    fn create_feedback_deserializes_all_fields() {
        let json = serde_json::json!({
            "app_context": "TestApp v2",
            "platform": "Android 14",
            "version": "2.0.0",
            "content": "Something is broken",
            "end_user_id": null
        });
        let dto: CreateFeedback = serde_json::from_value(json).unwrap();
        assert_eq!(dto.app_context, "TestApp v2");
        assert_eq!(dto.platform, "Android 14");
        assert_eq!(dto.version, "2.0.0");
        assert_eq!(dto.content, "Something is broken");
        assert!(dto.end_user_id.is_none());
    }

    #[test]
    fn create_feedback_deserializes_with_end_user_id() {
        let uid = Uuid::now_v7();
        let json = serde_json::json!({
            "app_context": "TestApp v1",
            "platform": "Web Chrome",
            "version": "1.0.0",
            "content": "Great product",
            "end_user_id": uid.to_string()
        });
        let dto: CreateFeedback = serde_json::from_value(json).unwrap();
        assert_eq!(dto.end_user_id, Some(uid));
    }

    // --- UpdateFeedback DTO ---

    #[test]
    fn update_feedback_deserializes_status() {
        let json = serde_json::json!({ "status": "in_progress" });
        let dto: UpdateFeedback = serde_json::from_value(json).unwrap();
        assert_eq!(dto.status, Some(FeedbackStatus::InProgress));
    }

    #[test]
    fn update_feedback_deserializes_priority() {
        let json = serde_json::json!({ "priority": "high" });
        let dto: UpdateFeedback = serde_json::from_value(json).unwrap();
        assert_eq!(dto.priority, Some(FeedbackPriority::High));
    }

    #[test]
    fn update_feedback_deserializes_tags_and_notes() {
        let json = serde_json::json!({
            "tags": "bug,crash",
            "notes": "Reproduced on device X"
        });
        let dto: UpdateFeedback = serde_json::from_value(json).unwrap();
        assert_eq!(dto.tags.as_deref(), Some("bug,crash"));
        assert_eq!(dto.notes.as_deref(), Some("Reproduced on device X"));
    }

    #[test]
    fn update_feedback_all_fields_optional() {
        let json = serde_json::json!({});
        let dto: UpdateFeedback = serde_json::from_value(json).unwrap();
        assert!(dto.status.is_none());
        assert!(dto.priority.is_none());
        assert!(dto.tags.is_none());
        assert!(dto.notes.is_none());
    }
}
