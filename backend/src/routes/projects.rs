use axum::extract::{Path, State};
use axum::routing::{get, put};
use axum::{Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::AppError;
use crate::lib::AppState;
use crate::models::board::Board;
use crate::models::column::Column;
use crate::models::project::Project;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/projects", get(list).post(create))
        .route("/projects/{id}", get(get_one).put(update).delete(remove))
        .route("/projects/reorder", put(reorder))
}

#[derive(Deserialize)]
struct CreateProject {
    name: String,
    description: Option<String>,
    github_url: Option<String>,
    color: Option<String>,
}

#[derive(Deserialize)]
struct UpdateProject {
    name: Option<String>,
    description: Option<String>,
    github_url: Option<String>,
    color: Option<String>,
    archived: Option<bool>,
}

#[derive(Deserialize)]
struct ReorderRequest {
    ids: Vec<String>,
}

async fn list(State(state): State<AppState>) -> Result<Json<Vec<Project>>, AppError> {
    let projects = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects ORDER BY position ASC, created_at DESC",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(projects))
}

async fn create(
    State(state): State<AppState>,
    Json(req): Json<CreateProject>,
) -> Result<Json<Project>, AppError> {
    let id = Uuid::new_v4().to_string();

    // Parse github owner/repo from URL
    let (github_owner, github_repo) = req
        .github_url
        .as_ref()
        .and_then(|url| parse_github_url(url))
        .unzip();

    let max_pos: Option<i64> =
        sqlx::query_scalar("SELECT MAX(position) FROM projects")
            .fetch_one(&state.db)
            .await?;
    let position = max_pos.unwrap_or(-1) + 1;

    sqlx::query(
        "INSERT INTO projects (id, name, description, github_url, github_owner, github_repo, color, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&req.name)
    .bind(req.description.as_deref().unwrap_or(""))
    .bind(&req.github_url)
    .bind(&github_owner)
    .bind(&github_repo)
    .bind(req.color.as_deref().unwrap_or("#6366f1"))
    .bind(position)
    .execute(&state.db)
    .await?;

    // Create default board with 3 columns
    let board_id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO boards (id, project_id, name, position) VALUES (?, ?, ?, 0)")
        .bind(&board_id)
        .bind(&id)
        .bind("Default")
        .execute(&state.db)
        .await?;

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
        .bind(&board_id)
        .bind(name)
        .bind(color)
        .bind(pos)
        .execute(&state.db)
        .await?;
    }

    let project = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(project))
}

async fn get_one(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let project = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let boards = sqlx::query_as::<_, Board>(
        "SELECT * FROM boards WHERE project_id = ? ORDER BY position ASC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;

    // For each board, fetch columns
    let mut boards_with_columns = Vec::new();
    for board in &boards {
        let columns = sqlx::query_as::<_, Column>(
            "SELECT * FROM columns WHERE board_id = ? ORDER BY position ASC",
        )
        .bind(&board.id)
        .fetch_all(&state.db)
        .await?;
        boards_with_columns.push(serde_json::json!({
            "id": board.id,
            "project_id": board.project_id,
            "name": board.name,
            "position": board.position,
            "created_at": board.created_at,
            "updated_at": board.updated_at,
            "columns": columns,
        }));
    }

    Ok(Json(serde_json::json!({
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "github_url": project.github_url,
        "github_owner": project.github_owner,
        "github_repo": project.github_repo,
        "color": project.color,
        "archived": project.archived,
        "position": project.position,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "boards": boards_with_columns,
    })))
}

async fn update(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<UpdateProject>,
) -> Result<Json<Project>, AppError> {
    // Verify exists
    let existing = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let name = req.name.unwrap_or(existing.name);
    let description = req.description.unwrap_or(existing.description);
    let github_url = req.github_url.or(existing.github_url);
    let (github_owner, github_repo) = github_url
        .as_ref()
        .and_then(|url| parse_github_url(url))
        .unzip();
    let color = req.color.unwrap_or(existing.color);
    let archived = req.archived.unwrap_or(existing.archived);

    sqlx::query(
        "UPDATE projects SET name = ?, description = ?, github_url = ?, github_owner = ?, github_repo = ?, color = ?, archived = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(&name)
    .bind(&description)
    .bind(&github_url)
    .bind(&github_owner)
    .bind(&github_repo)
    .bind(&color)
    .bind(archived)
    .bind(&id)
    .execute(&state.db)
    .await?;

    let project = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(project))
}

async fn remove(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn reorder(
    State(state): State<AppState>,
    Json(req): Json<ReorderRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    for (i, id) in req.ids.iter().enumerate() {
        sqlx::query("UPDATE projects SET position = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(i as i64)
            .bind(id)
            .execute(&state.db)
            .await?;
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}

fn parse_github_url(url: &str) -> Option<(String, String)> {
    // Parse https://github.com/owner/repo or github.com/owner/repo
    let path = url
        .strip_prefix("https://github.com/")
        .or_else(|| url.strip_prefix("http://github.com/"))
        .or_else(|| url.strip_prefix("github.com/"))?;
    let parts: Vec<&str> = path.trim_end_matches('/').splitn(3, '/').collect();
    if parts.len() >= 2 {
        Some((parts[0].to_string(), parts[1].to_string()))
    } else {
        None
    }
}
