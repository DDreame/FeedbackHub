-- Analytics events table for user behavior tracking
-- Uses BIGSERIAL for fast append-only inserts, JSONB for flexible properties,
-- BRIN index for time-range scans (100x smaller than B-tree for append-only data).
--
-- No foreign key to any user table — session_id is anonymous, not linked to reporter_id.
-- Events are fire-and-forget: no updates, no deletes (append-only).
CREATE TABLE analytics_events (
    id           BIGSERIAL    PRIMARY KEY,
    session_id   UUID         NOT NULL,
    event_type   VARCHAR(64)  NOT NULL,     -- 'page_view' | 'feature_use' | 'flow' | 'drop_off' | 'technical'
    event_name   VARCHAR(128) NOT NULL,     -- 'record_screen_opened' | 'entry_saved' | 'photo_added' ...
    properties   JSONB        NOT NULL DEFAULT '{}',
    app_version  VARCHAR(50),
    platform     VARCHAR(50),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- BRIN index: minimal size, ideal for append-only time-series data
-- Covers range scans like WHERE created_at > NOW() - INTERVAL '7 days'
CREATE INDEX idx_ae_created_at ON analytics_events USING BRIN (created_at);

-- Composite B-tree for filtering by type + name (dashboard queries)
CREATE INDEX idx_ae_type_name ON analytics_events (event_type, event_name);

-- For session-level queries (DAU, session counts)
CREATE INDEX idx_ae_session ON analytics_events (session_id);

-- For app_version filtering (feature adoption per version)
CREATE INDEX idx_ae_app_version ON analytics_events (app_version);
