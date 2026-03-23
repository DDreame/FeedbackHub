-- API keys for developer authentication to /v1/dev/* endpoints
CREATE TABLE api_keys (
    id          UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash    VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hash of the API key
    email       VARCHAR(255) NOT NULL,
    name        VARCHAR(255) NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE
);

-- Index for fast key lookup during auth
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
