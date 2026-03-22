use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
};
use serde::Serialize;
use uuid::Uuid;

use super::feedback::AppState;

#[derive(Debug, Serialize, serde::Deserialize)]
pub struct ProjectResponse {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

async fn get_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ProjectResponse>, (StatusCode, Json<super::feedback::ErrorResponse>)> {
    let row: Option<(Uuid, String, String, chrono::DateTime<chrono::Utc>)> = sqlx::query_as(
        r#"
        SELECT id, name, description, created_at
        FROM projects
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(super::feedback::ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    match row {
        Some((id, name, description, created_at)) => Ok(Json(ProjectResponse {
            id,
            name,
            description,
            created_at,
        })),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(super::feedback::ErrorResponse {
                error: "project not found".into(),
            }),
        )),
    }
}

pub fn project_routes(state: AppState) -> Router {
    Router::new()
        .route("/api/projects/{id}", axum::routing::get(get_project))
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_pool;
    use crate::routes::feedback::RateLimiter;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use sqlx::PgPool;
    use tower::util::ServiceExt;

    fn app_with_pool(pool: PgPool) -> Router {
        project_routes(AppState {
            db: pool,
            rate_limiter: RateLimiter::new(1000, 60),
        })
    }

    fn is_database_available() -> bool {
        std::env::var("DATABASE_URL").is_ok()
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL to be set"]
    async fn get_project_returns_project() {
        if !is_database_available() {
            return;
        }
        let pool = test_pool().await.expect("test pool");
        let app = app_with_pool(pool.clone());

        // Seed a project
        let id = Uuid::now_v7();
        sqlx::query(
            "INSERT INTO projects (id, developer_id, name, api_key, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())",
        )
        .bind(id)
        .bind(Uuid::now_v7())
        .bind("My App")
        .bind(format!("proj_testkey_{}", Uuid::now_v7()))
        .execute(&pool)
        .await
        .expect("project seed");

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/projects/{id}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let proj: ProjectResponse = serde_json::from_slice(&body).unwrap();
        assert_eq!(proj.id, id);
        assert_eq!(proj.name, "My App");
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL to be set"]
    async fn get_project_returns_404_for_unknown_id() {
        if !is_database_available() {
            return;
        }
        let pool = test_pool().await.expect("test pool");
        let app = app_with_pool(pool);

        let fake_id = Uuid::now_v7();
        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/projects/{fake_id}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}
