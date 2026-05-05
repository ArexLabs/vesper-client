use crate::error::AppError;
use crate::models::modrinth::{ModrinthFile, ModrinthVersion};
use reqwest::header;
use serde_json::json;

const SODIUM_VERSIONS_URL: &str = "https://api.modrinth.com/v2/project/sodium/version";

pub async fn resolve_sodium_version(
    game_version: &str,
    loader: &str,
) -> Result<ModrinthFile, AppError> {
    let client = reqwest::Client::new();
    let response = client
        .get(SODIUM_VERSIONS_URL)
        .header(header::USER_AGENT, "vesper-client/1.0")
        .query(&[
            ("game_versions", json!([game_version]).to_string()),
            ("loaders", json!([loader]).to_string()),
        ])
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let err_text = response.text().await.unwrap_or_default();
        return Err(AppError::ModrinthApi(reqwest::Error::new(
            reqwest::StatusCode::from_u16(status.as_u16()).unwrap(),
            err_text,
        )));
    }

    let versions: Vec<ModrinthVersion> = response.json().await?;

    let release_version = versions
        .iter()
        .find(|v| v.version_type == "release")
        .ok_or(AppError::NoSodiumVersion)?;

    let primary_file = release_version
        .files
        .iter()
        .find(|f| f.primary)
        .ok_or(AppError::NoSodiumVersion)?;

    Ok(primary_file.clone())
}
