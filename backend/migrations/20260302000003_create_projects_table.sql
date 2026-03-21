-- Projects: apps owned by a developer, used as the parent of feedback items.
CREATE TABLE projects (
    id          UUID         NOT NULL PRIMARY KEY,
    developer_id UUID         NOT NULL,
    name        VARCHAR(255) NOT NULL,
    api_key     VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_developer_id ON projects(developer_id);
CREATE UNIQUE INDEX idx_projects_api_key ON projects(api_key);
