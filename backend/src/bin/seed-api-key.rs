use sha2::Digest;
use sqlx::postgres::PgPoolOptions;
use std::fmt::Write;

#[tokio::main]
async fn main() {
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await
        .expect("failed to connect to database");

    let raw_key = uuid::Uuid::now_v7().to_string() + &uuid::Uuid::now_v7().to_string()[..8];
    let key_hash = {
        let result = sha2::Sha256::digest(raw_key.as_bytes());
        let mut hex = String::with_capacity(64);
        for b in result {
            write!(&mut hex, "{:02x}", b).unwrap();
        }
        hex
    };

    let id = uuid::Uuid::now_v7();
    let now = chrono::Utc::now();

    sqlx::query(
        r#"INSERT INTO api_keys (id, key_hash, email, name, created_at, is_active)
           VALUES ($1, $2, 'admin@feedback.dev', 'Admin', $3, TRUE)"#,
    )
    .bind(id)
    .bind(&key_hash)
    .bind(now)
    .execute(&pool)
    .await
    .expect("failed to insert api_key");

    println!("Created API key: {}", raw_key);
    println!("Save this key - it won't be shown again!");
}