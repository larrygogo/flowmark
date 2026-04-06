use axum::extract::{Path, State};
use axum::routing::put;
use axum::{Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::AppError;
use crate::lib::AppState;
use crate::models::column::Column;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/boards/{board_id}/columns", axum::routing::post(create))
        .route("/columns/{id}", put(update).delete(remove))
        .route("/boards/{board_id}/columns/reorder", put(reorder))
}

#[derive(Deserialize)]
struct CreateColumn {
    name: String,
    color: Option<String>,
}

#[derive(Deserialize)]
struct UpdateColumn {
    name: Option<String>,
    color: Option<String>,
    wip_limit: Option<Option<i64>>,
}

#[derive(Deserialize)]
struct ReorderRequest {
    ids: Vec<String>,
}

async fn create(
    State(state): State<AppState>,
    Path(board_id): Path<String>,
    Json(req): Json<CreateColumn>,
) -> Result<Json<Column>, AppError> {
    let id = Uuid::new_v4().to_string();
    let max_pos: Option<i64> =
        sqlx::query_scalar("SELECT MAX(position) FROM columns WHERE board_id = ?")
            .bind(&board_id)
            .fetch_one(&state.db)
            .await?;
    let position = max_pos.unwrap_or(-1) + 1;

    sqlx::query(
        "INSERT INTO columns (id, board_id, name, color, position) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&board_id)
    .bind(&req.name)
    .bind(req.color.as_deref().unwrap_or("#e2e8f0"))
    .bind(position)
    .execute(&state.db)
    .await?;

    let column = sqlx::query_as::<_, Column>("SELECT * FROM columns WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(column))
}

async fn update(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<UpdateColumn>,
) -> Result<Json<Column>, AppError> {
    let existing = sqlx::query_as::<_, Column>("SELECT * FROM columns WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let name = req.name.unwrap_or(existing.name);
    let color = req.color.unwrap_or(existing.color);
    let wip_limit = match req.wip_limit {
        Some(v) => v,
        None => existing.wip_limit,
    };

    sqlx::query(
        "UPDATE columns SET name = ?, color = ?, wip_limit = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(&name)
    .bind(&color)
    .bind(wip_limit)
    .bind(&id)
    .execute(&state.db)
    .await?;

    let column = sqlx::query_as::<_, Column>("SELECT * FROM columns WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(column))
}

async fn remove(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query("DELETE FROM columns WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn reorder(
    State(state): State<AppState>,
    Path(_board_id): Path<String>,
    Json(req): Json<ReorderRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    for (i, id) in req.ids.iter().enumerate() {
        sqlx::query("UPDATE columns SET position = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(i as i64)
            .bind(id)
            .execute(&state.db)
            .await?;
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}
