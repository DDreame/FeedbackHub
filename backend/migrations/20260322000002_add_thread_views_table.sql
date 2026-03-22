-- Add thread_views table for per-user read state tracking
-- For proper unread notification support

CREATE TABLE thread_views (
    thread_id UUID NOT NULL REFERENCES feedback_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_type VARCHAR(20) NOT NULL, -- 'reporter' or 'developer'
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (thread_id, user_id, user_type)
);

-- Index for efficient unread queries
CREATE INDEX idx_thread_views_user ON thread_views(user_id, user_type);
CREATE INDEX idx_thread_views_last_read ON thread_views(last_read_at);
