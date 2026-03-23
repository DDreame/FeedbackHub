-- Backfill existing reporter_ids from feedback_threads into reporters
INSERT INTO reporters (id, created_at)
SELECT DISTINCT reporter_id, NOW()
FROM feedback_threads fht
WHERE NOT EXISTS (
    SELECT 1 FROM reporters r WHERE r.id = fht.reporter_id
);

-- Add FK constraint from feedback_threads.reporter_id to reporters
ALTER TABLE feedback_threads
    ADD CONSTRAINT fk_feedback_threads_reporter
    FOREIGN KEY (reporter_id) REFERENCES reporters(id)
    ON DELETE CASCADE;