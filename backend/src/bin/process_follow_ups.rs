//! Process scheduled auto-follow-ups (#t94)
//!
//! Queries for threads where `follow_up_due_at <= NOW()` and status is
//! `waiting_for_user`, sends a follow-up email to each reporter, then
//! clears the `follow_up_due_at` field.
//!
//! Usage: cargo run --bin process_follow_ups
//!
//! This binary is designed to be run periodically via cron or a scheduler
//! (e.g., every hour).

use feedback_system_backend::email::{
    self, SmtpConfig, template_follow_up_notification,
};
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("failed to connect to database");

    let smtp_config = SmtpConfig::from_env();

    // Find all threads due for follow-up
    #[derive(Debug, sqlx::FromRow)]
    struct DueThread {
        thread_id: Uuid,
        reporter_id: Uuid,
        summary: String,
        reporter_email: Option<String>,
    }

    let due_threads: Vec<DueThread> = sqlx::query_as(
        r#"
        SELECT
            ft.id AS thread_id,
            ft.reporter_id,
            ft.summary,
            np.email AS reporter_email
        FROM feedback_threads ft
        LEFT JOIN notification_preferences np ON np.reporter_id = ft.reporter_id
        WHERE ft.follow_up_due_at IS NOT NULL
          AND ft.follow_up_due_at <= NOW()
          AND ft.status = 'waiting_for_user'
        "#,
    )
    .fetch_all(&pool)
    .await
    .expect("failed to query due threads");

    if due_threads.is_empty() {
        println!("No follow-ups due.");
        return;
    }

    println!("Processing {} due follow-up(s)...", due_threads.len());

    let mut success_count = 0;
    let mut skipped_count = 0;

    for thread in due_threads {
        // Skip if no email on file
        let Some(email) = thread.reporter_email else {
            tracing::warn!(
                thread_id = %thread.thread_id,
                "No notification email for reporter, skipping follow-up"
            );
            skipped_count += 1;
            continue;
        };

        // Build follow-up email
        let thread_url = format!(
            "https://feedback.example.com/threads/{}",
            thread.thread_id
        );

        let mut email_payload = template_follow_up_notification(
            &thread.reporter_id.to_string()[..8], // Use truncated ID as name
            "FeedBack System",
            &thread.summary,
            &thread_url,
        );
        email_payload.to_email = email.clone();

        // Send email
        if let Some(ref config) = smtp_config {
            match email::send_email(config, &email_payload) {
                Ok(()) => {
                    tracing::info!(
                        thread_id = %thread.thread_id,
                        to = %email,
                        "Follow-up email sent"
                    );
                }
                Err(e) => {
                    tracing::error!(
                        thread_id = %thread.thread_id,
                        error = %e,
                        "Failed to send follow-up email"
                    );
                    // Still clear the follow-up so we don't keep retrying
                }
            }
        } else {
            tracing::warn!("SMTP not configured, skipping email send");
        }

        // Clear follow_up_due_at to prevent re-sending
        sqlx::query(
            r#"UPDATE feedback_threads SET follow_up_due_at = NULL WHERE id = $1"#,
        )
        .bind(thread.thread_id)
        .execute(&pool)
        .await
        .expect("failed to clear follow_up_due_at");

        success_count += 1;
    }

    println!(
        "Follow-up processing complete: {} sent, {} skipped.",
        success_count, skipped_count
    );
}
