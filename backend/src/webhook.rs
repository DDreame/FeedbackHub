//! Webhook delivery service (#t79)
//! Sends HTTP POST notifications to registered webhook URLs on events.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::time::Duration;
use uuid::Uuid;

/// Webhook event types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum WebhookEvent {
    FeedbackCreated,
    FeedbackStatusChanged,
    FeedbackReplied,
}

impl WebhookEvent {
    pub fn as_str(&self) -> &'static str {
        match self {
            WebhookEvent::FeedbackCreated => "feedback.created",
            WebhookEvent::FeedbackStatusChanged => "feedback.status_changed",
            WebhookEvent::FeedbackReplied => "feedback.replied",
        }
    }
}

/// Webhook payload sent to registered URLs
#[derive(Debug, Clone, Serialize)]
pub struct WebhookPayload {
    pub event: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub data: WebhookData,
}

#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
pub enum WebhookData {
    FeedbackCreated {
        thread_id: Uuid,
        app_id: Uuid,
        reporter_id: Uuid,
        category: String,
        summary: String,
        status: String,
    },
    FeedbackStatusChanged {
        thread_id: Uuid,
        app_id: Uuid,
        old_status: String,
        new_status: String,
    },
    FeedbackReplied {
        thread_id: Uuid,
        app_id: Uuid,
        message_id: Uuid,
        author_type: String,
    },
}

pub struct WebhookConfig {
    pub url: String,
    pub secret: Option<String>,
}

/// Fetch active webhooks for an app that subscribe to a given event
pub async fn get_active_webhooks(
    pool: &PgPool,
    app_id: Uuid,
    event: &WebhookEvent,
) -> Result<Vec<WebhookConfig>, sqlx::Error> {
    let rows: Vec<(String, Option<String>)> = sqlx::query_as(
        r#"
        SELECT url, secret FROM webhooks
        WHERE app_id = $1 AND is_active = TRUE AND $2 = ANY(events)
        "#,
    )
    .bind(app_id)
    .bind(event.as_str())
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(url, secret)| WebhookConfig { url, secret })
        .collect())
}

/// Send a webhook POST request (non-blocking via tokio::spawn)
pub fn deliver_webhook(url: String, payload: WebhookPayload, secret: Option<String>) {
    tokio::spawn(async move {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .ok();

        if let Some(client) = client {
            let mut request = client.post(&url).json(&payload);

            if let Some(secret) = &secret {
                // HMAC-SHA256 signature header
                let timestamp = payload.timestamp.to_rfc3339();
                let body = serde_json::to_string(&payload).unwrap_or_default();
                let signature_input = format!("{}.{}.{}", timestamp, body, secret);

                use sha2::{Digest, Sha256};
                let sig_hash = Sha256::digest(signature_input.as_bytes());
                let sig_hex: String = sig_hash
                    .iter()
                    .fold(String::new(), |mut acc, b| {
                        use std::fmt::Write;
                        write!(&mut acc, "{:02x}", b).unwrap();
                        acc
                    });

                request = request
                    .header("X-Webhook-Signature", sig_hex)
                    .header("X-Webhook-Timestamp", timestamp);
            }

            if let Err(e) = request.send().await {
                tracing::warn!(url = %url, error = %e, "webhook delivery failed");
            }
        }
    });
}

/// Trigger feedback.created webhook
pub async fn trigger_feedback_created(
    pool: &PgPool,
    thread_id: Uuid,
    app_id: Uuid,
    reporter_id: Uuid,
    category: String,
    summary: String,
) {
    let event = WebhookEvent::FeedbackCreated;
    if let Ok(webhooks) = get_active_webhooks(pool, app_id, &event).await {
        let payload = WebhookPayload {
            event: event.as_str().to_string(),
            timestamp: chrono::Utc::now(),
            data: WebhookData::FeedbackCreated {
                thread_id,
                app_id,
                reporter_id,
                category,
                summary,
                status: "received".to_string(),
            },
        };
        for webhook in webhooks {
            deliver_webhook(webhook.url, payload.clone(), webhook.secret);
        }
    }
}

/// Trigger feedback.status_changed webhook
pub async fn trigger_status_changed(
    pool: &PgPool,
    thread_id: Uuid,
    app_id: Uuid,
    old_status: String,
    new_status: String,
) {
    let event = WebhookEvent::FeedbackStatusChanged;
    if let Ok(webhooks) = get_active_webhooks(pool, app_id, &event).await {
        let payload = WebhookPayload {
            event: event.as_str().to_string(),
            timestamp: chrono::Utc::now(),
            data: WebhookData::FeedbackStatusChanged {
                thread_id,
                app_id,
                old_status,
                new_status,
            },
        };
        for webhook in webhooks {
            deliver_webhook(webhook.url, payload.clone(), webhook.secret);
        }
    }
}

/// Trigger feedback.replied webhook
pub async fn trigger_feedback_replied(
    pool: &PgPool,
    thread_id: Uuid,
    app_id: Uuid,
    message_id: Uuid,
    author_type: String,
) {
    let event = WebhookEvent::FeedbackReplied;
    if let Ok(webhooks) = get_active_webhooks(pool, app_id, &event).await {
        let payload = WebhookPayload {
            event: event.as_str().to_string(),
            timestamp: chrono::Utc::now(),
            data: WebhookData::FeedbackReplied {
                thread_id,
                app_id,
                message_id,
                author_type,
            },
        };
        for webhook in webhooks {
            deliver_webhook(webhook.url, payload.clone(), webhook.secret);
        }
    }
}
