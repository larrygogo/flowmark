use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Debug, Deserialize, Serialize)]
pub struct GitHubItem {
    pub number: i64,
    pub title: String,
    pub state: String,
    pub user: Option<GitHubUser>,
    pub labels: Vec<GitHubLabel>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub pull_request: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GitHubUser {
    pub login: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GitHubLabel {
    pub name: String,
}

pub async fn sync_github(
    db: &SqlitePool,
    client: &Client,
    project_id: &str,
    owner: &str,
    repo: &str,
    token: Option<&str>,
) -> Result<i64, String> {
    // Check cache freshness (5 minutes)
    let last_sync: Option<String> = sqlx::query_scalar(
        "SELECT MAX(synced_at) FROM github_cache WHERE project_id = ?",
    )
    .bind(project_id)
    .fetch_one(db)
    .await
    .map_err(|e| e.to_string())?;

    if let Some(ref synced) = last_sync {
        if let Ok(ts) = chrono::NaiveDateTime::parse_from_str(synced, "%Y-%m-%d %H:%M:%S") {
            let age = chrono::Utc::now().naive_utc() - ts;
            if age.num_seconds() < 300 {
                // Cache is fresh, skip sync
                return Ok(0);
            }
        }
    }

    // Fetch issues (includes PRs on GitHub API)
    let url = format!("https://api.github.com/repos/{owner}/{repo}/issues?state=all&per_page=100&sort=updated");
    let mut request = client
        .get(&url)
        .header("User-Agent", "FlowMark/0.1")
        .header("Accept", "application/vnd.github.v3+json");

    if let Some(t) = token {
        request = request.header("Authorization", format!("Bearer {t}"));
    }

    let response = request.send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("GitHub API returned {}", response.status()));
    }

    let items: Vec<GitHubItem> = response.json().await.map_err(|e| e.to_string())?;
    let mut count: i64 = 0;

    for item in &items {
        let item_type = if item.pull_request.is_some() {
            "pull_request"
        } else {
            "issue"
        };
        let author = item.user.as_ref().map(|u| u.login.as_str());
        let labels: Vec<String> = item.labels.iter().map(|l| l.name.clone()).collect();
        let labels_json = serde_json::to_string(&labels).unwrap_or_else(|_| "[]".to_string());
        let data_json =
            serde_json::to_string(&item).unwrap_or_else(|_| "{}".to_string());
        let id = Uuid::new_v4().to_string();

        // Upsert
        sqlx::query(
            "INSERT INTO github_cache (id, project_id, item_type, github_id, title, state, author, labels, data, github_created_at, github_updated_at, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
             ON CONFLICT(project_id, item_type, github_id) DO UPDATE SET
               title = excluded.title,
               state = excluded.state,
               author = excluded.author,
               labels = excluded.labels,
               data = excluded.data,
               github_updated_at = excluded.github_updated_at,
               synced_at = datetime('now')",
        )
        .bind(&id)
        .bind(project_id)
        .bind(item_type)
        .bind(item.number)
        .bind(&item.title)
        .bind(&item.state)
        .bind(author)
        .bind(&labels_json)
        .bind(&data_json)
        .bind(&item.created_at)
        .bind(&item.updated_at)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;

        count += 1;
    }

    Ok(count)
}
