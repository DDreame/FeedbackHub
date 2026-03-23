-- Response templates for developer canned responses
CREATE TABLE response_templates (
    id          UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_email VARCHAR(255) NOT NULL,  -- owner of this template
    title       VARCHAR(255) NOT NULL,
    body        TEXT        NOT NULL,
    category    VARCHAR(100) NOT NULL DEFAULT 'general',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_response_templates_developer_email ON response_templates(developer_email);