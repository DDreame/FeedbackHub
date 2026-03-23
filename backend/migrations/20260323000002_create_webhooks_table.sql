-- Webhooks table for app-level event notifications (#t79)
CREATE TABLE webhooks (
    id              UUID        NOT NULL PRIMARY KEY,
    app_id          UUID        NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    url             TEXT        NOT NULL,
    events          TEXT[]      NOT NULL DEFAULT '{}',
    -- events: 'feedback.created', 'feedback.status_changed', 'feedback.replied'
    secret          VARCHAR(255),
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_app_id ON webhooks(app_id);
CREATE INDEX idx_webhooks_is_active ON webhooks(is_active) WHERE is_active = TRUE;
