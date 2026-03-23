-- Team members: links developers to apps with role-based permissions
CREATE TABLE team_members (
    id          UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id      UUID        NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    email       VARCHAR(255) NOT NULL,  -- developer's email address
    role        VARCHAR(50) NOT NULL DEFAULT 'developer',  -- 'owner', 'admin', 'developer', 'viewer'
    invited_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (app_id, email)
);

CREATE INDEX idx_team_members_app_id ON team_members(app_id);
CREATE INDEX idx_team_members_email ON team_members(email);