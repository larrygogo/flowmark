use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;

use crate::errors::AppError;
use crate::lib::AppState;
use crate::models::project::Project;
use crate::services::github_service;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/projects/{id}/github/issues", get(issues))
        .route("/projects/{id}/github/pulls", get(pulls))
        .route("/projects/{id}/github/sync", post(sync))
}

#[derive(sqlx::FromRow, serde::Serialize)]
struct CachedItem {
    id: String,
    project_id: String,
    item_type: String,
    github_id: i64,
    title: String,
    state: String,
    author: Option<String>,
    labels: String,
    github_created_at: Option<String>,
    github_updated_at: Option<String>,
    synced_at: String,
}

async fn ensure_synced(state: &AppState, project: &Project) -> Result<(), AppError> {
    let (owner, repo) = match (&project.github_owner, &project.github_repo) {
        (Some(o), Some(r)) => (o.as_str(), r.as_str()),
        _ => return Err(AppError::BadRequest("Project has no GitHub URL configured".to_string())),
    };

    github_service::sync_github(
        &state.db,
        &state.github_client,
        &project.id,
        owner,
        repo,
        state.config.github_token.as_deref(),
    )
    .await
    .map_err(|e| AppError::Internal(e))?;

    Ok(())
}

async fn issues(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Vec<CachedItem>>, AppError> {
    let project = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    ensure_synced(&state, &project).await.ok(); // Don't fail if sync fails, return cached

    let items = sqlx::query_as::<_, CachedItem>(
        "SELECT id, project_id, item_type, github_id, title, state, author, labels, github_created_at, github_updated_at, synced_at FROM github_cache WHERE project_id = ? AND item_type = 'issue' ORDER BY github_id DESC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(items))
}

async fn pulls(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Vec<CachedItem>>, AppError> {
    let project = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    ensure_synced(&state, &project).await.ok();

    let items = sqlx::query_as::<_, CachedItem>(
        "SELECT id, project_id, item_type, github_id, title, state, author, labels, github_created_at, github_updated_at, synced_at FROM github_cache WHERE project_id = ? AND item_type = 'pull_request' ORDER BY github_id DESC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(items))
}

async fn sync(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let project = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let (owner, repo) = match (&project.github_owner, &project.github_repo) {
        (Some(o), Some(r)) => (o.as_str(), r.as_str()),
        _ => return Err(AppError::BadRequest("No GitHub URL".to_string())),
    };

    // Force sync by clearing cache timestamps
    sqlx::query("UPDATE github_cache SET synced_at = '2000-01-01 00:00:00' WHERE project_id = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;

    let count = github_service::sync_github(
        &state.db,
        &state.github_client,
        &project.id,
        owner,
        repo,
        state.config.github_token.as_deref(),
    )
    .await
    .map_err(|e| AppError::Internal(e))?;

    Ok(Json(serde_json::json!({ "synced_count": count })))
}
