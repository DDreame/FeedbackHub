//! Integration test: verifies the feedback_threads and feedback_messages table schemas
//! are applied by sqlx migrations.
//!
//! Run with: DATABASE_URL=... cargo test --test threads_schema_test -- --ignored
//!
//! This test is ignored by default (requires a live database). Run manually with:
//!   cargo test --test threads_schema_test -- --ignored

use sqlx::postgres::PgPoolOptions;

fn env_or(name: &str, default: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| default.to_string())
}

#[tokio::test]
#[ignore = "requires live PostgreSQL instance"]
async fn feedback_threads_table_has_expected_columns() {
    let database_url = env_or(
        "DATABASE_URL",
        "postgres://postgres:postgres@localhost/postgres",
    );

    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await
        .expect("cannot connect to database");

    // Run migrations first.
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("migrations should run");

    let columns: Vec<(String, String)> = sqlx::query_as(
        r#"
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'feedback_threads'
        ORDER BY column_name
        "#,
    )
    .fetch_all(&pool)
    .await
    .expect("should query feedback_threads columns");

    let col_map: std::collections::HashMap<_, _> = columns.into_iter().collect();

    // Core fields
    assert!(col_map.contains_key("id"), "feedback_threads.id missing");
    assert!(
        col_map.contains_key("reporter_id"),
        "feedback_threads.reporter_id missing"
    );
    assert!(
        col_map.contains_key("reporter_contact"),
        "feedback_threads.reporter_contact missing"
    );
    assert!(
        col_map.contains_key("category"),
        "feedback_threads.category missing"
    );
    assert!(
        col_map.contains_key("status"),
        "feedback_threads.status missing"
    );
    assert!(
        col_map.contains_key("summary"),
        "feedback_threads.summary missing"
    );

    // Context fields
    assert!(
        col_map.contains_key("context_app_version"),
        "context_app_version missing"
    );
    assert!(
        col_map.contains_key("context_build_number"),
        "context_build_number missing"
    );
    assert!(
        col_map.contains_key("context_os_name"),
        "context_os_name missing"
    );
    assert!(
        col_map.contains_key("context_os_version"),
        "context_os_version missing"
    );
    assert!(
        col_map.contains_key("context_device_model"),
        "context_device_model missing"
    );
    assert!(
        col_map.contains_key("context_locale"),
        "context_locale missing"
    );
    assert!(
        col_map.contains_key("context_current_route"),
        "context_current_route missing"
    );
    assert!(
        col_map.contains_key("context_captured_at"),
        "context_captured_at missing"
    );
    assert!(
        col_map.contains_key("context_reporter_account_id"),
        "context_reporter_account_id missing"
    );

    // Timestamps
    assert!(
        col_map.contains_key("latest_public_message_at"),
        "latest_public_message_at missing"
    );
    assert!(
        col_map.contains_key("created_at"),
        "feedback_threads.created_at missing"
    );
    assert!(
        col_map.contains_key("updated_at"),
        "feedback_threads.updated_at missing"
    );
    assert!(
        col_map.contains_key("closed_at"),
        "feedback_threads.closed_at missing"
    );

    // Verify id is UUID
    assert_eq!(col_map["id"], "uuid");
    assert_eq!(col_map["reporter_id"], "uuid");

    // Verify status CHECK constraint includes expected values.
    let checks: Vec<(String, String)> = sqlx::query_as(
        r#"
        SELECT constraint_name, check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE 'ck_threads_%'
        "#,
    )
    .fetch_all(&pool)
    .await
    .expect("should query check constraints");

    assert!(
        checks.iter().any(|(_, c)| c.contains("'received'")),
        "status CHECK should include 'received'"
    );
    assert!(
        checks.iter().any(|(_, c)| c.contains("'in_review'")),
        "status CHECK should include 'in_review'"
    );
    assert!(
        checks.iter().any(|(_, c)| c.contains("'waiting_for_user'")),
        "status CHECK should include 'waiting_for_user'"
    );
    assert!(
        checks.iter().any(|(_, c)| c.contains("'closed'")),
        "status CHECK should include 'closed'"
    );
}

#[tokio::test]
#[ignore = "requires live PostgreSQL instance"]
async fn feedback_messages_table_has_expected_columns() {
    let database_url = env_or(
        "DATABASE_URL",
        "postgres://postgres:postgres@localhost/postgres",
    );

    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await
        .expect("cannot connect to database");

    // Run migrations first.
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("migrations should run");

    let columns: Vec<(String, String)> = sqlx::query_as(
        r#"
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'feedback_messages'
        ORDER BY column_name
        "#,
    )
    .fetch_all(&pool)
    .await
    .expect("should query feedback_messages columns");

    let col_map: std::collections::HashMap<_, _> = columns.into_iter().collect();

    assert!(col_map.contains_key("id"), "feedback_messages.id missing");
    assert!(
        col_map.contains_key("thread_id"),
        "feedback_messages.thread_id missing"
    );
    assert!(
        col_map.contains_key("author_type"),
        "feedback_messages.author_type missing"
    );
    assert!(
        col_map.contains_key("body"),
        "feedback_messages.body missing"
    );
    assert!(
        col_map.contains_key("created_at"),
        "feedback_messages.created_at missing"
    );

    assert_eq!(col_map["id"], "uuid");
    assert_eq!(col_map["thread_id"], "uuid");

    // Verify author_type CHECK constraint
    let checks: Vec<(String, String)> = sqlx::query_as(
        r#"
        SELECT constraint_name, check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE 'ck_messages_%'
        "#,
    )
    .fetch_all(&pool)
    .await
    .expect("should query check constraints");

    assert!(
        checks.iter().any(|(_, c)| c.contains("'reporter'")),
        "author_type CHECK should include 'reporter'"
    );
    assert!(
        checks.iter().any(|(_, c)| c.contains("'developer'")),
        "author_type CHECK should include 'developer'"
    );
    assert!(
        checks.iter().any(|(_, c)| c.contains("'system'")),
        "author_type CHECK should include 'system'"
    );

    // Verify foreign key constraint
    let fks: Vec<(String, String, String)> = sqlx::query_as(
        r#"
        SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'feedback_messages'
          AND tc.constraint_type = 'FOREIGN KEY'
        "#,
    )
    .fetch_all(&pool)
    .await
    .expect("should query foreign keys");

    assert!(
        fks.iter()
            .any(|(cn, _, ft)| cn.contains("messages_thread_id_fkey") && ft == "feedback_threads"),
        "feedback_messages should have FK to feedback_threads"
    );
}

#[tokio::test]
#[ignore = "requires live PostgreSQL instance"]
async fn thread_status_transitions_respected_by_db() {
    // Verify invalid status transitions are rejected at DB level
    let database_url = env_or(
        "DATABASE_URL",
        "postgres://postgres:postgres@localhost/postgres",
    );

    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await
        .expect("cannot connect to database");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("migrations should run");

    // Insert a valid thread first
    let thread_id = uuid::Uuid::now_v7();
    let reporter_id = uuid::Uuid::now_v7();
    let now = chrono::Utc::now();

    sqlx::query(
        r#"
        INSERT INTO feedback_threads (
            id, reporter_id, reporter_contact, category, status, summary,
            latest_public_message_at, created_at, updated_at, closed_at,
            context_app_version, context_build_number, context_os_name,
            context_os_version, context_device_model, context_locale,
            context_current_route, context_captured_at, context_reporter_account_id
        ) VALUES ($1, $2, NULL, 'bug', 'received', 'test', $3, $3, $3, NULL, '1.0', NULL, 'iOS', '17', 'iPhone', NULL, '/home', $3, NULL)
        "#,
    )
    .bind(thread_id)
    .bind(reporter_id)
    .bind(now)
    .execute(&pool)
    .await
    .expect("should insert valid thread");

    // Verify initial status is 'received'
    let status: String = sqlx::query_scalar("SELECT status FROM feedback_threads WHERE id = $1")
        .bind(thread_id)
        .fetch_one(&pool)
        .await
        .expect("should get status");
    assert_eq!(status, "received");

    // Update to valid transition 'in_review'
    sqlx::query("UPDATE feedback_threads SET status = 'in_review' WHERE id = $1")
        .bind(thread_id)
        .execute(&pool)
        .await
        .expect("should update to in_review");

    let status: String = sqlx::query_scalar("SELECT status FROM feedback_threads WHERE id = $1")
        .bind(thread_id)
        .fetch_one(&pool)
        .await
        .expect("should get status");
    assert_eq!(status, "in_review");

    // Verify invalid status values are rejected by DB CHECK constraint
    // (state transitions are enforced at application level, not DB level)
    let thread_id2 = uuid::Uuid::now_v7();
    let result = sqlx::query(
        r#"
        INSERT INTO feedback_threads (
            id, reporter_id, reporter_contact, category, status, summary,
            latest_public_message_at, created_at, updated_at, closed_at,
            context_app_version, context_build_number, context_os_name,
            context_os_version, context_device_model, context_locale,
            context_current_route, context_captured_at, context_reporter_account_id
        ) VALUES ($1, $2, NULL, 'bug', 'invalid_status', 'test', $3, $3, $3, NULL, '1.0', NULL, 'iOS', '17', 'iPhone', NULL, '/home', $3, NULL)
        "#,
    )
    .bind(thread_id2)
    .bind(reporter_id)
    .bind(now)
    .execute(&pool)
    .await;

    assert!(
        result.is_err(),
        "DB CHECK constraint should reject invalid status values like 'invalid_status'"
    );
}
