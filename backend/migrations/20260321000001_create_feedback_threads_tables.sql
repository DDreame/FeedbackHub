-- Feedback threads and messages schema per #t6 contract
-- FeedbackThread: top-level feedback item submitted by a reporter
CREATE TABLE feedback_threads (
    id                          UUID         NOT NULL PRIMARY KEY,
    reporter_id                 UUID         NOT NULL,
    reporter_contact            VARCHAR(255),
    category                    VARCHAR(100) NOT NULL DEFAULT '',
    status                      VARCHAR(30)  NOT NULL DEFAULT 'received',
    summary                     TEXT         NOT NULL,
    latest_public_message_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    closed_at                  TIMESTAMPTZ,
    context_app_version         VARCHAR(50)  NOT NULL DEFAULT '',
    context_build_number        VARCHAR(50),
    context_os_name             VARCHAR(100) NOT NULL DEFAULT '',
    context_os_version          VARCHAR(50)  NOT NULL DEFAULT '',
    context_device_model        VARCHAR(100) NOT NULL DEFAULT '',
    context_locale              VARCHAR(20),
    context_current_route       TEXT         NOT NULL DEFAULT '',
    context_captured_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    context_reporter_account_id VARCHAR(255),
    CONSTRAINT ck_threads_status CHECK (status IN ('received', 'in_review', 'waiting_for_user', 'closed', 'deleted'))
);

-- FeedbackMessage: individual messages within a thread
CREATE TABLE feedback_messages (
    id          UUID         NOT NULL PRIMARY KEY,
    thread_id   UUID         NOT NULL REFERENCES feedback_threads(id) ON DELETE CASCADE,
    author_type VARCHAR(20)  NOT NULL DEFAULT 'reporter',
    body        TEXT         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_messages_author_type CHECK (author_type IN ('reporter', 'developer', 'system'))
);

-- Indexes
CREATE INDEX idx_threads_reporter_id     ON feedback_threads(reporter_id);
CREATE INDEX idx_threads_status          ON feedback_threads(status);
CREATE INDEX idx_threads_latest_message  ON feedback_threads(latest_public_message_at DESC);
CREATE INDEX idx_messages_thread_id       ON feedback_messages(thread_id);
CREATE INDEX idx_messages_created_at     ON feedback_messages(created_at ASC);
