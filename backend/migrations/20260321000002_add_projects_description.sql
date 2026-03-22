-- Add description column to projects table to match API contract
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description VARCHAR(500) NOT NULL DEFAULT '';
