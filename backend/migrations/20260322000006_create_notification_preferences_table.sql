-- Reporters: canonical reporter identity, referenced by feedback_threads and notification_preferences
CREATE TABLE reporters (
    id          UUID        NOT NULL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification preferences: per-reporter email notification settings
CREATE TABLE notification_preferences (
    id                      UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id             UUID        NOT NULL,
    email                   VARCHAR(255) NOT NULL,
    notify_on_reply         BOOLEAN     NOT NULL DEFAULT TRUE,
    notify_on_status_change BOOLEAN     NOT NULL DEFAULT TRUE,
    notify_on_close         BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_notification_preferences_reporter
        FOREIGN KEY (reporter_id) REFERENCES reporters(id)
        ON DELETE CASCADE
);
CREATE INDEX idx_notification_preferences_reporter ON notification_preferences(reporter_id);
CREATE UNIQUE INDEX idx_notification_preferences_reporter_unique ON notification_preferences(reporter_id);