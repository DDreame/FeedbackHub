-- End users: individuals who submit feedback via the SDK.
CREATE TABLE end_users (
    id          UUID         NOT NULL PRIMARY KEY,
    project_id  UUID         NOT NULL,
    device_id   VARCHAR(255) NOT NULL,
    name        VARCHAR(255),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_end_users_project_id ON end_users(project_id);
