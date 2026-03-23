-- Tags for thread categorization (#t87)
CREATE TABLE tags (
    id          UUID        NOT NULL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    color       VARCHAR(20) NOT NULL DEFAULT '#6366f1',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE thread_tags (
    thread_id   UUID        NOT NULL REFERENCES feedback_threads(id) ON DELETE CASCADE,
    tag_id      UUID        NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (thread_id, tag_id)
);

CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_thread_tags_tag_id ON thread_tags(tag_id);