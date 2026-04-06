use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};

use crate::config::Config;

pub async fn init_pool(config: &Config) -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&config.database_url)
        .await
        .expect("Failed to connect to SQLite");

    // PRAGMA tuning for performance
    sqlx::query("PRAGMA journal_mode = WAL")
        .execute(&pool)
        .await
        .expect("Failed to set journal_mode");
    sqlx::query("PRAGMA busy_timeout = 5000")
        .execute(&pool)
        .await
        .expect("Failed to set busy_timeout");
    sqlx::query("PRAGMA synchronous = NORMAL")
        .execute(&pool)
        .await
        .expect("Failed to set synchronous");
    sqlx::query("PRAGMA cache_size = -20000")
        .execute(&pool)
        .await
        .expect("Failed to set cache_size");
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await
        .expect("Failed to enable foreign_keys");
    sqlx::query("PRAGMA temp_store = MEMORY")
        .execute(&pool)
        .await
        .expect("Failed to set temp_store");

    pool
}

pub async fn run_migrations(pool: &SqlitePool) {
    let migration_sql = include_str!("../migrations/20260406_000001_initial.sql");
    for statement in migration_sql.split(';') {
        let stmt = statement.trim();
        if stmt.is_empty() || stmt.starts_with("--") || stmt.starts_with("PRAGMA") {
            continue;
        }
        sqlx::query(stmt)
            .execute(pool)
            .await
            .unwrap_or_else(|e| panic!("Migration failed on: {stmt}\nError: {e}"));
    }
    tracing::info!("Database migrations completed");
}
