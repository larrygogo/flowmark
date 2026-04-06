use axum::extract::{Path, Query, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::AppError;
use crate::lib::AppState;
use crate::models::quick_note::QuickNote;
use crate::models::task::Task;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/notes", get(list).post(create))
        .route("/notes/{id}", axum::routing::put(update).delete(remove))
        .route("/notes/{id}/convert-to-task", axum::routing::post(convert_to_task))
}

#[derive(Deserialize)]
struct ListQuery {
    project_id: Option<String>,
    is_converted: Option<bool>,
}

#[derive(Deserialize)]
struct CreateNote {
    content: String,
    project_id: Option<String>,
}

#[derive(Deserialize)]
struct UpdateNote {
    content: Option<String>,
    project_id: Option<Option<String>>,
    pinned: Option<bool>,
}

#[derive(Deserialize)]
struct ConvertToTask {
    column_id: String,
    priority: Option<String>,
}

async fn list(
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<QuickNote>>, AppError> {
    let mut sql = String::from("SELECT * FROM quick_notes WHERE 1=1");
    let mut binds: Vec<String> = Vec::new();

    if let Some(ref pid) = q.project_id {
        sql.push_str(" AND project_id = ?");
        binds.push(pid.clone());
    }
    if let Some(converted) = q.is_converted {
        sql.push_str(" AND is_converted = ?");
        binds.push(if converted { "1".to_string() } else { "0".to_string() });
    }

    sql.push_str(" ORDER BY pinned DESC, created_at DESC");

    let mut query = sqlx::query_as::<_, QuickNote>(&sql);
    for bind in &binds {
        query = query.bind(bind);
    }

    let notes = query.fetch_all(&state.db).await?;
    Ok(Json(notes))
}

async fn create(
    State(state): State<AppState>,
    Json(req): Json<CreateNote>,
) -> Result<Json<QuickNote>, AppError> {
    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO quick_notes (id, content, project_id) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(&req.content)
        .bind(&req.project_id)
        .execute(&state.db)
        .await?;

    let note = sqlx::query_as::<_, QuickNote>("SELECT * FROM quick_notes WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(note))
}

async fn update(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<UpdateNote>,
) -> Result<Json<QuickNote>, AppError> {
    let existing = sqlx::query_as::<_, QuickNote>("SELECT * FROM quick_notes WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let content = req.content.unwrap_or(existing.content);
    let project_id = match req.project_id {
        Some(pid) => pid,
        None => existing.project_id,
    };
    let pinned = req.pinned.unwrap_or(existing.pinned);

    sqlx::query(
        "UPDATE quick_notes SET content = ?, project_id = ?, pinned = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(&content)
    .bind(&project_id)
    .bind(pinned)
    .bind(&id)
    .execute(&state.db)
    .await?;

    let note = sqlx::query_as::<_, QuickNote>("SELECT * FROM quick_notes WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(note))
}

async fn remove(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query("DELETE FROM quick_notes WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn convert_to_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<ConvertToTask>,
) -> Result<Json<Task>, AppError> {
    let note = sqlx::query_as::<_, QuickNote>("SELECT * FROM quick_notes WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let task_id = Uuid::new_v4().to_string();
    let max_pos: Option<i64> =
        sqlx::query_scalar("SELECT MAX(position) FROM tasks WHERE column_id = ?")
            .bind(&req.column_id)
            .fetch_one(&state.db)
            .await?;
    let position = max_pos.unwrap_or(-1) + 1;

    sqlx::query(
        "INSERT INTO tasks (id, column_id, title, priority, position) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&task_id)
    .bind(&req.column_id)
    .bind(&note.content)
    .bind(req.priority.as_deref().unwrap_or("medium"))
    .bind(position)
    .execute(&state.db)
    .await?;

    // Mark note as converted
    sqlx::query(
        "UPDATE quick_notes SET is_converted = 1, task_id = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(&task_id)
    .bind(&id)
    .execute(&state.db)
    .await?;

    let task = sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
        .bind(&task_id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(task))
}
