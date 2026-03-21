use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;

pub async fn create_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await
}

#[cfg(test)]
pub use test_helpers::*;

/// Test helpers for database testing.
#[cfg(test)]
mod test_helpers {
    use sqlx::PgPool;
    use sqlx::postgres::PgPoolOptions;

    /// Creates a test pool pointing at a test database.
    /// The DATABASE_URL environment variable must be set.
    pub async fn test_pool() -> Result<PgPool, sqlx::Error> {
        let database_url =
            std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for tests");
        PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
    }
}
