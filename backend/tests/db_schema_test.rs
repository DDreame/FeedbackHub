//! Integration test: verifies the feedbacks table schema is applied by sqlx migrations.
//!
//! Run with: DATABASE_URL=... cargo test --test db_schema_test
//!
//! This test is ignored by default (requires a live database). Run manually with:
//!   cargo test --test db_schema_test -- --ignored

use sqlx::postgres::PgPoolOptions;

fn env_or(name: &str, default: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| default.to_string())
}

#[tokio::test]
#[ignore = "requires live PostgreSQL instance"]
async fn feedbacks_table_has_expected_columns() {
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
        WHERE table_name = 'feedbacks'
        ORDER BY column_name
        "#,
    )
    .fetch_all(&pool)
    .await
    .expect("should query feedbacks columns");

    let col_map: std::collections::HashMap<_, _> = columns.into_iter().collect();

    assert!(col_map.contains_key("id"), "feedbacks.id missing");
    assert!(
        col_map.contains_key("project_id"),
        "feedbacks.project_id missing"
    );
    assert!(
        col_map.contains_key("end_user_id"),
        "feedbacks.end_user_id missing"
    );
    assert!(
        col_map.contains_key("app_context"),
        "feedbacks.app_context missing"
    );
    assert!(
        col_map.contains_key("platform"),
        "feedbacks.platform missing"
    );
    assert!(col_map.contains_key("version"), "feedbacks.version missing");
    assert!(col_map.contains_key("content"), "feedbacks.content missing");
    assert!(col_map.contains_key("status"), "feedbacks.status missing");
    assert!(
        col_map.contains_key("priority"),
        "feedbacks.priority missing"
    );
    assert!(col_map.contains_key("tags"), "feedbacks.tags missing");
    assert!(col_map.contains_key("notes"), "feedbacks.notes missing");
    assert!(
        col_map.contains_key("created_at"),
        "feedbacks.created_at missing"
    );
    assert!(
        col_map.contains_key("updated_at"),
        "feedbacks.updated_at missing"
    );

    assert_eq!(col_map["id"], "uuid");
    assert_eq!(col_map["project_id"], "uuid");
    assert_eq!(col_map["content"], "text");

    // Verify status CHECK constraint includes expected values.
    let checks: Vec<(String, String)> = sqlx::query_as(
        r#"
        SELECT constraint_name, check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE 'ck_feedbacks_%'
        "#,
    )
    .fetch_all(&pool)
    .await
    .expect("should query check constraints");

    assert!(
        checks.iter().any(|(_, c)| c.contains("'new'")),
        "status CHECK should include 'new'"
    );
    assert!(
        checks.iter().any(|(_, c)| c.contains("'in_progress'")),
        "status CHECK should include 'in_progress'"
    );
    assert!(
        checks.iter().any(|(_, c)| c.contains("'resolved'")),
        "status CHECK should include 'resolved'"
    );
    assert!(
        checks.iter().any(|(_, c)| c.contains("'archived'")),
        "status CHECK should include 'archived'"
    );
}
