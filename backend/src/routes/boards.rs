use axum::extract::{Path, State};
use axum::routing::{get, put};
use axum::{Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::AppError;
use crate::lib::AppState;
use crate::models::board::Board;
use crate::models::column::Column;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/projects/{project_id}/boards", get(list).post(create))
        .route("/boards/{id}", put(update).delete(remove))
        .route("/projects/{project_id}/boards/reorder", put(reorder))
}

#[derive(Deserialize)]
struct CreateBoard {
    name: String,
}

#[derive(Deserialize)]
struct UpdateBoard {
    name: Option<String>,
}

#[derive(Deserialize)]
struct ReorderRequest {
    ids: Vec<String>,
}

async fn list(
    State(state): State<AppState>,
    Path(project_id): Path<String>,
) -> Result<Json<Vec<serde_json::Value>>, AppError> {
    let boards = sqlx::query_as::<_, Board>(
        "SELECT * FROM boards WHERE project_id = ? ORDER BY position ASC",
    )
    .bind(&project_id)
    .fetch_all(&state.db)
    .await?;

    let mut result = Vec::new();
    for board in &boards {
        let columns = sqlx::query_as::<_, Column>(
            "SELECT * FROM columns WHERE board_id = ? ORDER BY position ASC",
        )
        .bind(&board.id)
        .fetch_all(&state.db)
        .await?;
        result.push(serde_json::json!({
            "id": board.id,
            "project_id": board.project_id,
            "name": board.name,
            "position": board.position,
            "created_at": board.created_at,
            "updated_at": board.updated_at,
            "columns": columns,
        }));
    }

    Ok(Json(result))
}

async fn create(
    State(state): State<AppState>,
    Path(project_id): Path<String>,
    Json(req): Json<CreateBoard>,
) -> Result<Json<Board>, AppError> {
    let id = Uuid::new_v4().to_string();
    let max_pos: Option<i64> =
        sqlx::query_scalar("SELECT MAX(position) FROM boards WHERE project_id = ?")
            .bind(&project_id)
            .fetch_one(&state.db)
            .await?;
    let position = max_pos.unwrap_or(-1) + 1;

    sqlx::query("INSERT INTO boards (id, project_id, name, position) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&project_id)
        .bind(&req.name)
        .bind(position)
        .execute(&state.db)
        .await?;

    // Create default columns
    let default_columns = [
        ("Todo", "#94a3b8", 0),
        ("In Progress", "#6366f1", 1),
        ("Done", "#22c55e", 2),
    ];
    for (name, color, pos) in default_columns {
        let col_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO columns (id, board_id, name, color, position) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&col_id)
        .bind(&id)
        .bind(name)
        .bind(color)
        .bind(pos)
        .execute(&state.db)
        .await?;
    }

    let board = sqlx::query_as::<_, Board>("SELECT * FROM boards WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(board))
}

async fn update(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<UpdateBoard>,
) -> Result<Json<Board>, AppError> {
    if let Some(name) = &req.name {
        sqlx::query("UPDATE boards SET name = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(name)
            .bind(&id)
            .execute(&state.db)
            .await?;
    }

    let board = sqlx::query_as::<_, Board>("SELECT * FROM boards WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(board))
}

async fn remove(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query("DELETE FROM boards WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn reorder(
    State(state): State<AppState>,
    Path(_project_id): Path<String>,
    Json(req): Json<ReorderRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    for (i, id) in req.ids.iter().enumerate() {
        sqlx::query("UPDATE boards SET position = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(i as i64)
            .bind(id)
            .execute(&state.db)
            .await?;
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}
