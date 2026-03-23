-- Add app_id to feedback_threads for webhook routing (#t79)
ALTER TABLE feedback_threads ADD COLUMN app_id UUID REFERENCES apps(id) ON DELETE SET NULL;
CREATE INDEX idx_threads_app_id ON feedback_threads(app_id);