use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Task {
    pub id: String,
    pub column_id: String,
    pub parent_task_id: Option<String>,
    pub title: String,
    pub description: String,
    pub priority: String,
    pub progress: i64,
    pub labels: String, // JSON array
    pub due_date: Option<String>,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}
