use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub github_url: Option<String>,
    pub github_owner: Option<String>,
    pub github_repo: Option<String>,
    pub color: String,
    pub archived: bool,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}
