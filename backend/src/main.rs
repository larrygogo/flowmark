mod auth;
mod config;
mod db;
mod errors;
mod models;
mod routes;
mod services;

// Re-export for use across modules
pub mod lib {
    pub use crate::lib_impl::*;
}

mod lib_impl {
    use sqlx::SqlitePool;
    use crate::config::Config;

    #[derive(Clone)]
    pub struct AppState {
        pub db: SqlitePool,
        pub config: Config,
        pub github_client: reqwest::Client,
    }
}

use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| "flowmark=info".into()),
        )
        .init();

    let config = config::Config::from_env();
    let pool = db::init_pool(&config).await;
    db::run_migrations(&pool).await;

    let state = lib::AppState {
        db: pool,
        config: config.clone(),
        github_client: reqwest::Client::new(),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let api = axum::Router::new()
        .nest("/api/v1", routes::api_routes(state.clone()))
        .route("/health", axum::routing::get(health))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    // Serve SPA static files in production
    let app = if let Some(ref static_dir) = config.static_dir {
        api.fallback_service(
            tower_http::services::ServeDir::new(static_dir)
                .fallback(tower_http::services::ServeFile::new(
                    format!("{}/index.html", static_dir),
                )),
        )
    } else {
        api.fallback(|| async {
            axum::Json(serde_json::json!({ "message": "FlowMark API. Frontend not configured." }))
        })
    };

    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("FlowMark listening on {addr}");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}
