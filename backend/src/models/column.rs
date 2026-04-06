use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Column {
    pub id: String,
    pub board_id: String,
    pub name: String,
    pub color: String,
    pub position: i64,
    pub wip_limit: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}
