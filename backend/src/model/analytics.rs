use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Ingest models (client → server)
// ---------------------------------------------------------------------------

/// A single analytics event submitted by the client.
#[derive(Debug, Clone, Deserialize)]
pub struct AnalyticsEvent {
    pub session_id: Uuid,
    pub event_type: String,  // 'page_view' | 'feature_use' | 'flow' | 'drop_off' | 'technical'
    pub event_name: String,  // 'record_screen_opened' | 'entry_saved' ...
    #[serde(default)]
    pub properties: serde_json::Value,
    pub app_version: Option<String>,
    pub platform: Option<String>,
}

/// Batch of events sent by the client.
#[derive(Debug, Clone, Deserialize)]
pub struct IngestEventsRequest {
    pub events: Vec<AnalyticsEvent>,
}

// ---------------------------------------------------------------------------
// Response models (server → client)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct IngestEventsResponse {
    pub accepted: usize,
}

// ---------------------------------------------------------------------------
// Dashboard query models (for Phase 2)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct DashboardQuery {
    pub app_id: Option<String>,
    pub from: Option<String>, // ISO date
    pub to: Option<String>,   // ISO date
}

#[derive(Debug, Serialize)]
pub struct DashboardSummary {
    pub daily_active_sessions: i64,
    pub total_events_7d: i64,
    pub avg_events_per_session: f64,
}

#[derive(Debug, Serialize)]
pub struct FunnelStep {
    pub step_name: String,
    pub count: i64,
    pub conversion_rate: f64,
}

#[derive(Debug, Serialize)]
pub struct PopularFeature {
    pub event_name: String,
    pub count: i64,
}

// ---------------------------------------------------------------------------
// Event whitelist — all allowed event names
// Must match the set agreed by SSS + RC + A2 in #App_Backend:18fc7811
// ---------------------------------------------------------------------------

pub const ALLOWED_EVENTS: &[&str] = &[
    // Retention signals
    "app_opened",
    "app_foregrounded",
    // Page views
    "record_screen_opened",
    "history_screen_opened",
    "detail_screen_opened",
    "settings_opened",
    // Feature usage
    "photo_added",
    "recording_started",
    "entry_saved",
    "entry_deleted",
    "entry_viewed",
    "backup_triggered",
    "backup_completed",
    "backup_failed",
    "feedback_opened",
    "feedback_sent",
    // Drop-off signals
    "record_screen_dismissed_without_save",
    "detail_back_without_comment",
    "permission_denied",
    "onboarding_exited",
];

/// Returns true if the event_name is in the whitelist.
pub fn is_allowed_event(name: &str) -> bool {
    ALLOWED_EVENTS.contains(&name)
}
