pub mod auth;
pub mod boards;
pub mod columns;
pub mod dashboard;
pub mod github;
pub mod projects;
pub mod quick_notes;
pub mod tasks;

use axum::Router;
use axum::middleware;

use crate::auth::auth_middleware;
use crate::lib::AppState;

pub fn api_routes(state: AppState) -> Router<AppState> {
    let public = Router::new().merge(auth::public_routes());

    let protected = Router::new()
        .merge(auth::protected_routes())
        .merge(projects::routes())
        .merge(boards::routes())
        .merge(columns::routes())
        .merge(tasks::routes())
        .merge(quick_notes::routes())
        .merge(dashboard::routes())
        .merge(github::routes())
        .layer(middleware::from_fn_with_state(state, auth_middleware));

    Router::new().merge(public).merge(protected)
}
