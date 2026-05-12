-- Add sort_order to response_templates for ordering quick-reply templates in the UI
ALTER TABLE response_templates ADD COLUMN sort_order INT NOT NULL DEFAULT 0;

CREATE INDEX idx_response_templates_sort ON response_templates (developer_email, sort_order);
