use axum::{Json, Router, extract::State, http::StatusCode, routing::post};
use serde::Serialize;

use crate::model::analytics::{self, IngestEventsRequest, IngestEventsResponse};
use crate::routes::feedback::AppState;

/// Shared error response shape — matches the existing pattern in feedback.rs.
#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

/// POST /api/v1/analytics/events
///
/// Accepts a batch of analytics events, validates each against the whitelist,
/// and bulk-inserts valid events into `analytics_events`.
///
/// Invalid events (unknown event_type) are silently skipped — the client SDK
/// already enforces typed API; server-side validation is a second line of
/// defence, not a client-facing error.
async fn ingest_events(
    State(state): State<AppState>,
    Json(payload): Json<IngestEventsRequest>,
) -> Result<Json<IngestEventsResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Filter to whitelisted event types only (event_name is dynamic/freeform)
    let valid: Vec<_> = payload
        .events
        .into_iter()
        .filter(|e| analytics::is_allowed_event_type(&e.event_type))
        .collect();

    if valid.is_empty() {
        return Ok(Json(IngestEventsResponse { accepted: 0 }));
    }

    // Build bulk INSERT with UNNEST for efficient batch insertion
    // We build the SQL once with the right number of rows
    let accepted = valid.len();
    let mut query_builder = sqlx::QueryBuilder::new(
        "INSERT INTO analytics_events (session_id, event_type, event_name, properties, app_version, platform)",
    );
    query_builder.push_values(valid.iter(), |mut b, event| {
        b.push_bind(event.session_id)
            .push_bind(&event.event_type)
            .push_bind(&event.event_name)
            .push_bind(&event.properties)
            .push_bind(&event.app_version)
            .push_bind(&event.platform);
    });

    query_builder
        .build()
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "failed to insert analytics events");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "failed to store events".into(),
                }),
            )
        })?;

    Ok(Json(IngestEventsResponse { accepted }))
}

pub fn analytics_routes(state: AppState) -> Router {
    Router::new()
        .route("/api/v1/analytics/events", post(ingest_events))
        .with_state(state)
}
