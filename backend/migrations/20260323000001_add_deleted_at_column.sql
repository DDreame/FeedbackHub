-- Add deleted_at column for soft delete recovery tracking (#t75)
ALTER TABLE feedback_threads ADD COLUMN deleted_at TIMESTAMPTZ;

-- Index for efficient recovery queries
CREATE INDEX idx_threads_deleted_at ON feedback_threads(deleted_at) WHERE deleted_at IS NOT NULL;