use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct QuickNote {
    pub id: String,
    pub project_id: Option<String>,
    pub content: String,
    pub is_converted: bool,
    pub task_id: Option<String>,
    pub pinned: bool,
    pub created_at: String,
    pub updated_at: String,
}
