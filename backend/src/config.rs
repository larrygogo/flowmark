use std::env;

#[derive(Clone)]
pub struct Config {
    pub port: u16,
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expiration_hours: u64,
    pub github_token: Option<String>,
    pub static_dir: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            port: env::var("PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(3200),
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite:data/flowmark.db?mode=rwc".to_string()),
            jwt_secret: env::var("JWT_SECRET").expect("JWT_SECRET must be set"),
            jwt_expiration_hours: env::var("JWT_EXPIRATION_HOURS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(720), // 30 days
            github_token: env::var("GITHUB_TOKEN").ok(),
            static_dir: env::var("STATIC_DIR").ok(),
        }
    }
}
