-- Add attachments column for screenshot upload
ALTER TABLE feedback_messages ADD COLUMN attachments text[] NOT NULL DEFAULT '{}';
