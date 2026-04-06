use axum::extract::{Path, Query, State};
use axum::routing::{get, put};
use axum::{Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::AppError;
use crate::lib::AppState;
use crate::models::task::Task;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/tasks", get(list).post(create))
        .route("/tasks/{id}", get(get_one).put(update).delete(remove))
        .route("/tasks/{id}/move", put(move_task))
        .route("/tasks/{id}/subtasks", get(subtasks))
        .route("/columns/{column_id}/tasks/reorder", put(reorder))
}

#[derive(Deserialize)]
struct ListQuery {
    column_id: Option<String>,
    board_id: Option<String>,
    project_id: Option<String>,
    priority: Option<String>,
    search: Option<String>,
}

#[derive(Deserialize)]
struct CreateTask {
    column_id: String,
    title: String,
    description: Option<String>,
    priority: Option<String>,
    labels: Option<Vec<String>>,
    due_date: Option<String>,
    parent_task_id: Option<String>,
}

#[derive(Deserialize)]
struct UpdateTask {
    title: Option<String>,
    description: Option<String>,
    priority: Option<String>,
    progress: Option<i64>,
    labels: Option<Vec<String>>,
    due_date: Option<Option<String>>,
    column_id: Option<String>,
}

#[derive(Deserialize)]
struct MoveTask {
    column_id: String,
    position: i64,
}

#[derive(Deserialize)]
struct ReorderRequest {
    ids: Vec<String>,
}

async fn list(
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Task>>, AppError> {
    let mut sql = String::from("SELECT tasks.* FROM tasks");
    let mut conditions = Vec::new();
    let mut binds: Vec<String> = Vec::new();

    if let Some(ref col_id) = q.column_id {
        conditions.push("tasks.column_id = ?".to_string());
        binds.push(col_id.clone());
    }

    if let Some(ref board_id) = q.board_id {
        sql.push_str(" JOIN columns ON tasks.column_id = columns.id");
        conditions.push("columns.board_id = ?".to_string());
        binds.push(board_id.clone());
    }

    if let Some(ref project_id) = q.project_id {
        if !sql.contains("JOIN columns") {
            sql.push_str(" JOIN columns ON tasks.column_id = columns.id");
        }
        sql.push_str(" JOIN boards ON columns.board_id = boards.id");
        conditions.push("boards.project_id = ?".to_string());
        binds.push(project_id.clone());
    }

    if let Some(ref priority) = q.priority {
        conditions.push("tasks.priority = ?".to_string());
        binds.push(priority.clone());
    }

    if let Some(ref search) = q.search {
        conditions.push("(tasks.title LIKE ? OR tasks.description LIKE ?)".to_string());
        let pattern = format!("%{search}%");
        binds.push(pattern.clone());
        binds.push(pattern);
    }

    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }

    sql.push_str(" ORDER BY tasks.position ASC, tasks.created_at ASC");

    let mut query = sqlx::query_as::<_, Task>(&sql);
    for bind in &binds {
        query = query.bind(bind);
    }

    let tasks = query.fetch_all(&state.db).await?;
    Ok(Json(tasks))
}

async fn create(
    State(state): State<AppState>,
    Json(req): Json<CreateTask>,
) -> Result<Json<Task>, AppError> {
    let id = Uuid::new_v4().to_string();
    let labels_json = serde_json::to_string(&req.labels.unwrap_or_default())
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let max_pos: Option<i64> =
        sqlx::query_scalar("SELECT MAX(position) FROM tasks WHERE column_id = ?")
            .bind(&req.column_id)
            .fetch_one(&state.db)
            .await?;
    let position = max_pos.unwrap_or(-1) + 1;

    sqlx::query(
        "INSERT INTO tasks (id, column_id, parent_task_id, title, description, priority, labels, due_date, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&req.column_id)
    .bind(&req.parent_task_id)
    .bind(&req.title)
    .bind(req.description.as_deref().unwrap_or(""))
    .bind(req.priority.as_deref().unwrap_or("medium"))
    .bind(&labels_json)
    .bind(&req.due_date)
    .bind(position)
    .execute(&state.db)
    .await?;

    let task = sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(task))
}

async fn get_one(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let task = sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let subtask_list = sqlx::query_as::<_, Task>(
        "SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY position ASC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "task": task,
        "subtasks": subtask_list,
    })))
}

async fn update(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<UpdateTask>,
) -> Result<Json<Task>, AppError> {
    let existing = sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let title = req.title.unwrap_or(existing.title);
    let description = req.description.unwrap_or(existing.description);
    let priority = req.priority.unwrap_or(existing.priority);
    let progress = req.progress.unwrap_or(existing.progress);
    let labels = match req.labels {
        Some(l) => serde_json::to_string(&l).map_err(|e| AppError::Internal(e.to_string()))?,
        None => existing.labels,
    };
    let due_date = match req.due_date {
        Some(d) => d,
        None => existing.due_date,
    };
    let column_id = req.column_id.unwrap_or(existing.column_id);

    sqlx::query(
        "UPDATE tasks SET title = ?, description = ?, priority = ?, progress = ?, labels = ?, due_date = ?, column_id = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(&title)
    .bind(&description)
    .bind(&priority)
    .bind(progress)
    .bind(&labels)
    .bind(&due_date)
    .bind(&column_id)
    .bind(&id)
    .execute(&state.db)
    .await?;

    let task = sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(task))
}

async fn remove(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query("DELETE FROM tasks WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn move_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<MoveTask>,
) -> Result<Json<Task>, AppError> {
    // Shift tasks at and after the target position
    sqlx::query(
        "UPDATE tasks SET position = position + 1 WHERE column_id = ? AND position >= ?",
    )
    .bind(&req.column_id)
    .bind(req.position)
    .execute(&state.db)
    .await?;

    // Move the task
    sqlx::query(
        "UPDATE tasks SET column_id = ?, position = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(&req.column_id)
    .bind(req.position)
    .bind(&id)
    .execute(&state.db)
    .await?;

    let task = sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(task))
}

async fn subtasks(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Vec<Task>>, AppError> {
    let tasks = sqlx::query_as::<_, Task>(
        "SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY position ASC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(tasks))
}

async fn reorder(
    State(state): State<AppState>,
    Path(_column_id): Path<String>,
    Json(req): Json<ReorderRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    for (i, id) in req.ids.iter().enumerate() {
        sqlx::query("UPDATE tasks SET position = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(i as i64)
            .bind(id)
            .execute(&state.db)
            .await?;
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}
