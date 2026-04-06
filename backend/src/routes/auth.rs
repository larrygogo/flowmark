use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use crate::auth::{create_token, hash_password, verify_password};
use crate::errors::AppError;
use crate::lib::AppState;

#[derive(Deserialize)]
pub struct LoginRequest {
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
}

#[derive(Deserialize)]
pub struct SetupRequest {
    pub password: String,
}

#[derive(Deserialize)]
pub struct ChangePasswordRequest {
    pub old_password: String,
    pub new_password: String,
}

#[derive(Serialize)]
pub struct MeResponse {
    pub authenticated: bool,
}

pub fn public_routes() -> Router<AppState> {
    Router::new()
        .route("/auth/login", post(login))
        .route("/auth/setup", post(setup))
}

pub fn protected_routes() -> Router<AppState> {
    Router::new()
        .route("/auth/me", get(me))
        .route("/auth/change-password", post(change_password))
}

async fn setup(
    State(state): State<AppState>,
    Json(req): Json<SetupRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    // Check if already set up
    let existing = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM auth")
        .fetch_one(&state.db)
        .await?;

    if existing > 0 {
        return Err(AppError::BadRequest("Already set up".to_string()));
    }

    let password_hash = hash_password(&req.password)?;
    sqlx::query("INSERT INTO auth (id, password_hash) VALUES (1, ?)")
        .bind(&password_hash)
        .execute(&state.db)
        .await?;

    let token = create_token(&state.config.jwt_secret, state.config.jwt_expiration_hours)?;
    Ok(Json(LoginResponse { token }))
}

async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    let hash: Option<String> =
        sqlx::query_scalar("SELECT password_hash FROM auth WHERE id = 1")
            .fetch_optional(&state.db)
            .await?;

    let hash = hash.ok_or(AppError::BadRequest("Not set up yet. POST /api/v1/auth/setup first".to_string()))?;

    if !verify_password(&req.password, &hash)? {
        return Err(AppError::Unauthorized);
    }

    let token = create_token(&state.config.jwt_secret, state.config.jwt_expiration_hours)?;
    Ok(Json(LoginResponse { token }))
}

async fn me() -> Json<MeResponse> {
    Json(MeResponse { authenticated: true })
}

async fn change_password(
    State(state): State<AppState>,
    Json(req): Json<ChangePasswordRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let hash: String = sqlx::query_scalar("SELECT password_hash FROM auth WHERE id = 1")
        .fetch_one(&state.db)
        .await?;

    if !verify_password(&req.old_password, &hash)? {
        return Err(AppError::BadRequest("Old password is incorrect".to_string()));
    }

    let new_hash = hash_password(&req.new_password)?;
    sqlx::query("UPDATE auth SET password_hash = ?, updated_at = datetime('now') WHERE id = 1")
        .bind(&new_hash)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}
