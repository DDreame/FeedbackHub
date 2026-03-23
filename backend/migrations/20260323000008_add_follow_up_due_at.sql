-- Auto-follow-up scheduling (#t94)
-- When a thread transitions to waiting_for_user, a follow-up is scheduled
-- 3 days later to remind the reporter to respond.
ALTER TABLE feedback_threads
ADD COLUMN follow_up_due_at TIMESTAMPTZ;

CREATE INDEX idx_feedback_threads_follow_up_due_at
ON feedback_threads(follow_up_due_at)
WHERE follow_up_due_at IS NOT NULL;
