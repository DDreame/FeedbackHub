-- Feedback items: structured submissions from end users with app context.
-- end_user_id is nullable — anonymous feedback is allowed (no FK, end_users is phase 2).
CREATE TABLE feedbacks (
    id           UUID         NOT NULL PRIMARY KEY,
    project_id   UUID         NOT NULL,
    end_user_id  UUID,
    app_context  VARCHAR(255) NOT NULL DEFAULT '',
    platform     VARCHAR(100) NOT NULL DEFAULT '',
    version      VARCHAR(50)  NOT NULL DEFAULT '',
    content      TEXT         NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'new',
    priority     VARCHAR(20)  NOT NULL DEFAULT 'medium',
    tags         VARCHAR(500) NOT NULL DEFAULT '',
    notes        TEXT         NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_feedbacks_status   CHECK (status   IN ('new', 'in_progress', 'resolved', 'archived')),
    CONSTRAINT ck_feedbacks_priority CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

-- Indexes for common query patterns: list by project, filter by status.
CREATE INDEX idx_feedbacks_project_id  ON feedbacks(project_id);
CREATE INDEX idx_feedbacks_status     ON feedbacks(status);
CREATE INDEX idx_feedbacks_end_user_id ON feedbacks(end_user_id);
