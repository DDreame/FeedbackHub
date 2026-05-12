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
// Event type whitelist — validates event_type (category), not event_name.
//
// The SDK already enforces typed API (9 methods, no free-form strings) as the
// first line of defence. We validate event_type (always one of 9 categories)
// as the second line. event_name is kept as a flexible identifier for
// dashboard grouping and is not used as a security gate.
//
// This eliminates the future-proof problem: new screens, features, or flows
// require only a host-app parameter change, not a backend whitelist update.
// ---------------------------------------------------------------------------

pub const ALLOWED_EVENT_TYPES: &[&str] = &[
    "page_view",
    "feature_use",
    "flow_step",
    "flow_complete",
    "flow_drop",
    "app_open",
    "app_close",
    "cold_start",
    "crash",
];

/// Returns true if the event_type is in the whitelist.
pub fn is_allowed_event_type(event_type: &str) -> bool {
    ALLOWED_EVENT_TYPES.contains(&event_type)
}
