-- Add reference_number for anonymous feedback tracking (#t84)
ALTER TABLE feedback_threads ADD COLUMN reference_number VARCHAR(20) UNIQUE;
CREATE INDEX idx_threads_reference_number ON feedback_threads(reference_number);