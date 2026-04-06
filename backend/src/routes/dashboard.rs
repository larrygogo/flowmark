use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};

use crate::errors::AppError;
use crate::lib::AppState;

pub fn routes() -> Router<AppState> {
    Router::new().route("/dashboard", get(dashboard))
}

async fn dashboard(State(state): State<AppState>) -> Result<Json<serde_json::Value>, AppError> {
    // Total tasks
    let total_tasks: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM tasks WHERE parent_task_id IS NULL")
            .fetch_one(&state.db)
            .await?;

    // Tasks by status (based on column name convention)
    let in_progress: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks t JOIN columns c ON t.column_id = c.id WHERE t.parent_task_id IS NULL AND (LOWER(c.name) LIKE '%progress%' OR LOWER(c.name) LIKE '%doing%' OR LOWER(c.name) LIKE '%进行%')",
    )
    .fetch_one(&state.db)
    .await?;

    let done: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks t JOIN columns c ON t.column_id = c.id WHERE t.parent_task_id IS NULL AND (LOWER(c.name) LIKE '%done%' OR LOWER(c.name) LIKE '%完成%' OR LOWER(c.name) LIKE '%finish%')",
    )
    .fetch_one(&state.db)
    .await?;

    // Overdue tasks
    let overdue_tasks: Vec<serde_json::Value> = sqlx::query_as::<_, crate::models::task::Task>(
        "SELECT t.* FROM tasks t WHERE t.due_date IS NOT NULL AND t.due_date < date('now') AND t.parent_task_id IS NULL AND t.column_id NOT IN (SELECT id FROM columns WHERE LOWER(name) LIKE '%done%' OR LOWER(name) LIKE '%完成%') ORDER BY t.due_date ASC LIMIT 10",
    )
    .fetch_all(&state.db)
    .await?
    .into_iter()
    .map(|t| serde_json::json!(t))
    .collect();

    // Project summaries
    let projects = sqlx::query_as::<_, crate::models::project::Project>(
        "SELECT * FROM projects WHERE archived = 0 ORDER BY position ASC",
    )
    .fetch_all(&state.db)
    .await?;

    let mut project_summaries = Vec::new();
    for p in &projects {
        let task_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM tasks t JOIN columns c ON t.column_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.project_id = ? AND t.parent_task_id IS NULL",
        )
        .bind(&p.id)
        .fetch_one(&state.db)
        .await?;

        let done_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM tasks t JOIN columns c ON t.column_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.project_id = ? AND t.parent_task_id IS NULL AND (LOWER(c.name) LIKE '%done%' OR LOWER(c.name) LIKE '%完成%')",
        )
        .bind(&p.id)
        .fetch_one(&state.db)
        .await?;

        project_summaries.push(serde_json::json!({
            "id": p.id,
            "name": p.name,
            "color": p.color,
            "total_tasks": task_count,
            "done_tasks": done_count,
        }));
    }

    // Recent notes
    let recent_notes: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM quick_notes WHERE is_converted = 0")
            .fetch_one(&state.db)
            .await?;

    Ok(Json(serde_json::json!({
        "total_tasks": total_tasks,
        "in_progress": in_progress,
        "done": done,
        "todo": total_tasks - in_progress - done,
        "overdue_tasks": overdue_tasks,
        "project_summaries": project_summaries,
        "pending_notes": recent_notes,
    })))
}
