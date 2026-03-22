-- Add internal notes support, assignee tracking, and spam flagging
-- For #t10 (inbox) and #t11 (abuse guardrails)

-- Add is_internal column to feedback_messages
-- Internal notes are only visible to developers, not reporters
ALTER TABLE feedback_messages
    ADD COLUMN is_internal BOOLEAN NOT NULL DEFAULT FALSE;

-- Add assignee_id column to feedback_threads
-- Null means unassigned
ALTER TABLE feedback_threads
    ADD COLUMN assignee_id UUID;

-- Add is_spam column to feedback_threads
-- Allows marking threads as spam/abuse
ALTER TABLE feedback_threads
    ADD COLUMN is_spam BOOLEAN NOT NULL DEFAULT FALSE;

-- Add last_internal_note_at for unread tracking
ALTER TABLE feedback_threads
    ADD COLUMN last_internal_note_at TIMESTAMPTZ;

-- Index for assignee filtering
CREATE INDEX idx_threads_assignee_id ON feedback_threads(assignee_id);

-- Index for spam filtering
CREATE INDEX idx_threads_is_spam ON feedback_threads(is_spam) WHERE is_spam = TRUE;

-- Index for internal messages
CREATE INDEX idx_messages_is_internal ON feedback_messages(is_internal) WHERE is_internal = TRUE;
