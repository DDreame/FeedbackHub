-- Audit log for tracking all actions (#t91)
CREATE TABLE audit_logs (
    id              UUID        NOT NULL PRIMARY KEY,
    thread_id       UUID        NOT NULL REFERENCES feedback_threads(id) ON DELETE SET NULL,
    actor_id        UUID,                       -- developer UUID who performed action
    actor_email     VARCHAR(255),
    action          VARCHAR(50) NOT NULL,      -- 'status_change', 'reply', 'assign', 'unassign', 'internal_note', 'spam', 'delete'
    old_value       TEXT,
    new_value       TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_thread_id ON audit_logs(thread_id);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);