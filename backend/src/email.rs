//! Email notification service using SMTP via lettre.

use lettre::Transport;
use lettre::message::{Mailbox, MessageBuilder, header::ContentType};
use lettre::transport::smtp::SmtpTransport;
use lettre::transport::smtp::authentication::Credentials;
use serde::Deserialize;
use std::time::Duration;

/// SMTP configuration from environment variables.
#[derive(Debug, Clone, Deserialize)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub from_email: String,
    pub from_name: String,
}

impl SmtpConfig {
    pub fn from_env() -> Option<Self> {
        Some(Self {
            host: std::env::var("SMTP_HOST").ok()?,
            port: std::env::var("SMTP_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(587),
            username: std::env::var("SMTP_USERNAME").ok()?,
            password: std::env::var("SMTP_PASSWORD").ok()?,
            from_email: std::env::var("SMTP_FROM_EMAIL")
                .ok()
                .unwrap_or_else(|| "noreply@feedback-system.local".to_string()),
            from_name: std::env::var("SMTP_FROM_NAME")
                .ok()
                .unwrap_or_else(|| "FeedBack System".to_string()),
        })
    }

    pub fn is_configured(&self) -> bool {
        !self.host.is_empty() && !self.username.is_empty()
    }
}

/// Email message to send.
#[derive(Debug, Clone)]
pub struct EmailPayload {
    pub to_email: String,
    pub to_name: String,
    pub subject: String,
    pub body_html: String,
}

/// Send an email via SMTP.
/// Returns Ok(()) on success, Err(message) on failure.
pub fn send_email(config: &SmtpConfig, email: &EmailPayload) -> Result<(), String> {
    if !config.is_configured() {
        eprintln!("SMTP not configured, skipping email to {}", email.to_email);
        return Ok(());
    }

    // Build the SMTP transport
    let mailer = SmtpTransport::starttls_relay(&config.host)
        .map_err(|e| format!("Failed to create SMTP relay: {}", e))?
        .port(config.port)
        .credentials(Credentials::new(
            config.username.clone(),
            config.password.clone(),
        ))
        .timeout(Some(Duration::from_secs(30)))
        .build();

    // Parse sender and recipient
    let from: Mailbox = format!("{} <{}>", config.from_name, config.from_email)
        .parse()
        .map_err(|e| format!("Invalid from address: {}", e))?;

    let to: Mailbox = format!("{} <{}>", email.to_name, email.to_email)
        .parse()
        .map_err(|e| format!("Invalid to address: {}", e))?;

    // Build the email message
    let message = MessageBuilder::new()
        .from(from)
        .to(to)
        .subject(&email.subject)
        .header(ContentType::TEXT_HTML)
        .body(email.body_html.clone())
        .map_err(|e| format!("Failed to build email: {}", e))?;

    // Send the email
    mailer
        .send(&message)
        .map_err(|e| format!("SMTP send failed: {}", e))?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Notification templates
// ---------------------------------------------------------------------------

/// Build email for when a developer replies to a feedback thread.
pub fn template_reply_notification(
    reporter_name: &str,
    _app_name: &str,
    thread_summary: &str,
    message_content: &str,
    thread_url: &str,
) -> EmailPayload {
    let body = format!(
        r#"<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>您好，{}</h2>
  <p>开发者在您的反馈上回复了：</p>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
    <p style="margin: 0 0 10px 0;"><strong>反馈摘要：</strong> {}</p>
    <p style="margin: 0;"><strong>回复内容：</strong></p>
    <blockquote style="margin: 5px 0; padding-left: 15px; border-left: 3px solid #ccc;">
      {}
    </blockquote>
  </div>
  <a href="{}" style="display: inline-block; background: #007bff; color: white; padding: 10px 20px;
     text-decoration: none; border-radius: 5px; margin-top: 10px;">查看详情</a>
</body>
</html>"#,
        reporter_name, thread_summary, message_content, thread_url
    );

    EmailPayload {
        to_email: String::new(), // Will be filled by caller
        to_name: reporter_name.to_string(),
        subject: format!("[FeedBack] 开发者回复：{}", thread_summary),
        body_html: body,
    }
}

/// Build email for when a thread status changes.
pub fn template_status_change_notification(
    reporter_name: &str,
    _app_name: &str,
    thread_summary: &str,
    old_status: &str,
    new_status: &str,
    thread_url: &str,
) -> EmailPayload {
    let status_display = match new_status {
        "in_review" => "正在审查",
        "waiting_for_user" => "等待您的回复",
        "closed" => "已关闭",
        "deleted" => "已删除",
        _ => new_status,
    };

    let body = format!(
        r#"<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>您好，{}</h2>
  <p>您的反馈状态已更新：</p>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
    <p style="margin: 0 0 10px 0;"><strong>反馈摘要：</strong> {}</p>
    <p style="margin: 0;"><strong>状态变更：</strong> {} → <strong>{}</strong></p>
  </div>
  <a href="{}" style="display: inline-block; background: #007bff; color: white; padding: 10px 20px;
     text-decoration: none; border-radius: 5px; margin-top: 10px;">查看详情</a>
</body>
</html>"#,
        reporter_name, thread_summary, old_status, status_display, thread_url
    );

    EmailPayload {
        to_email: String::new(),
        to_name: reporter_name.to_string(),
        subject: format!("[FeedBack] 反馈状态更新：{}", thread_summary),
        body_html: body,
    }
}

/// Build email for when a thread is closed.
pub fn template_close_notification(
    reporter_name: &str,
    _app_name: &str,
    thread_summary: &str,
    thread_url: &str,
) -> EmailPayload {
    let body = format!(
        r#"<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>您好，{}</h2>
  <p>您的反馈已关闭：</p>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
    <p style="margin: 0 0 10px 0;"><strong>反馈摘要：</strong> {}</p>
  </div>
  <p style="color: #666; margin-top: 20px;">如果问题仍未解决，您可以随时重新提交新的反馈。</p>
  <a href="{}" style="display: inline-block; background: #007bff; color: white; padding: 10px 20px;
     text-decoration: none; border-radius: 5px; margin-top: 10px;">查看详情</a>
</body>
</html>"#,
        reporter_name, thread_summary, thread_url
    );

    EmailPayload {
        to_email: String::new(),
        to_name: reporter_name.to_string(),
        subject: format!("[FeedBack] 反馈已关闭：{}", thread_summary),
        body_html: body,
    }
}

/// Build email for scheduled auto-follow-up when a thread is waiting for reporter response.
pub fn template_follow_up_notification(
    reporter_name: &str,
    _app_name: &str,
    thread_summary: &str,
    thread_url: &str,
) -> EmailPayload {
    let body = format!(
        r#"<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>您好，{}</h2>
  <p>我们注意到您之前提交了一条反馈，目前仍在等待您的回复：</p>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
    <p style="margin: 0;"><strong>反馈摘要：</strong> {}</p>
  </div>
  <p style="color: #666;">请查看开发者的回复并尽快提供所需信息，以便我们更好地帮助您解决问题。</p>
  <a href="{}" style="display: inline-block; background: #007bff; color: white; padding: 10px 20px;
     text-decoration: none; border-radius: 5px; margin-top: 10px;">查看并回复</a>
</body>
</html>"#,
        reporter_name, thread_summary, thread_url
    );

    EmailPayload {
        to_email: String::new(),
        to_name: reporter_name.to_string(),
        subject: format!("[FeedBack] 温馨提示：请回复您的反馈——{}", thread_summary),
        body_html: body,
    }
}
