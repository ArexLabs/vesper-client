mod secure_storage;

use chrono::{Duration, Utc};
use directories::ProjectDirs;
use reqwest::{blocking::Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs, io,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
    time::Duration as StdDuration,
};
use tauri::{AppHandle, State};
use uuid::Uuid;

const MS_REFRESH_TOKEN_KEY: &str = "microsoft.minecraft.refresh_token";
const MS_DEVICE_CODE_URL: &str =
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const MS_TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const MS_SCOPE: &str = "XboxLive.signin offline_access";
const XBL_AUTH_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_LOGIN_URL: &str = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_ENTITLEMENTS_URL: &str = "https://api.minecraftservices.com/entitlements/mcstore";
const MC_PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";
const MODRINTH_SEARCH_URL: &str = "https://api.modrinth.com/v2/search";
const MODRINTH_PROJECT_VERSIONS_URL: &str = "https://api.modrinth.com/v2/project";
const CURSEFORGE_API_ROOT: &str = "https://api.curseforge.com/v1";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateInstanceInput {
    name: String,
    mc_version: String,
    loader: String,
    modpack_name: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LaunchPreview {
    status: String,
    instance_id: String,
    command_preview: Vec<String>,
    note: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiscoverSearchInput {
    query: String,
    loader: Option<String>,
    game_version: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiscoverDownloadInput {
    project_id: String,
    loader: Option<String>,
    game_version: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgeDownloadInput {
    mod_id: u64,
    loader: Option<String>,
    game_version: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiscoverDownloadResult {
    source: String,
    project_id: String,
    file_name: String,
    file_path: String,
    size_bytes: Option<u64>,
    url: String,
    message: String,
}

#[derive(Debug, Default)]
struct PendingMicrosoftFlows {
    sessions: Mutex<HashMap<String, PendingMicrosoftFlow>>,
}

#[derive(Debug, Clone)]
struct PendingMicrosoftFlow {
    device_code: String,
    interval_seconds: u64,
    expires_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthStatusResponse {
    profile: Option<Value>,
    login_available: bool,
    secure_storage_available: bool,
    microsoft_client_configured: bool,
    message: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MicrosoftDeviceLoginStart {
    session_id: String,
    user_code: String,
    verification_uri: String,
    verification_uri_complete: Option<String>,
    expires_in_seconds: u64,
    interval_seconds: u64,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MicrosoftDeviceLoginPoll {
    status: String,
    profile: Option<Value>,
    retry_after_seconds: Option<u64>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    #[serde(default)]
    verification_uri_complete: Option<String>,
    expires_in: u64,
    #[serde(default)]
    interval: Option<u64>,
    message: String,
}

#[derive(Debug, Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OAuthErrorResponse {
    error: String,
    #[serde(default)]
    error_description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct XboxAuthResponse {
    token: String,
    display_claims: XboxDisplayClaims,
}

#[derive(Debug, Deserialize)]
struct XboxDisplayClaims {
    xui: Vec<XboxUserClaim>,
}

#[derive(Debug, Deserialize)]
struct XboxUserClaim {
    uhs: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct XstsAuthResponse {
    token: String,
}

#[derive(Debug, Deserialize)]
struct MinecraftLoginResponse {
    access_token: String,
}

#[derive(Debug, Deserialize)]
struct MinecraftEntitlementsResponse {
    items: Vec<Value>,
}

#[derive(Debug, Deserialize)]
struct MinecraftProfileResponse {
    id: String,
    name: String,
}

fn state_file_path() -> Result<PathBuf, String> {
    let dirs = ProjectDirs::from("io", "Vesper", "VesperLauncher")
        .ok_or_else(|| "Unable to resolve app data directory".to_string())?;
    let dir = dirs.data_dir();
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    Ok(dir.join("app-state.json"))
}

fn write_state_value(value: &Value) -> Result<(), String> {
    let path = state_file_path()?;
    let raw = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

fn read_state_value() -> Result<Option<Value>, String> {
    let path = state_file_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let parsed = serde_json::from_str::<Value>(&raw).map_err(|e| e.to_string())?;
    Ok(Some(parsed))
}

fn default_launcher_config() -> Value {
    json!({
        "javaPath": "java",
        "memoryMbMin": 2048,
        "memoryMbMax": 4096,
        "jvmArgs": ["-XX:+UseG1GC"],
        "rendererFlags": [],
        "launchArgs": [],
        "window": {
            "width": 1280,
            "height": 800,
            "fullscreen": false
        },
        "globalVersionFilter": null
    })
}

fn minimal_state_object() -> Value {
    json!({
        "version": 1,
        "globalDefaults": default_launcher_config(),
        "presets": [],
        "instances": [],
        "profiles": [],
        "ui": { "language": "en" },
        "settingsSnapshots": []
    })
}

fn read_state_for_mutation() -> Result<Value, String> {
    let value = read_state_value()?.unwrap_or_else(minimal_state_object);
    if value.is_object() {
        Ok(value)
    } else {
        Ok(minimal_state_object())
    }
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .timeout(StdDuration::from_secs(20))
        .user_agent("VesperClient/0.1.0")
        .build()
        .map_err(|e| e.to_string())
}

fn app_data_dir() -> Result<PathBuf, String> {
    let dirs = ProjectDirs::from("io", "Vesper", "VesperLauncher")
        .ok_or_else(|| "Unable to resolve app data directory".to_string())?;
    let dir = dirs.data_dir();
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    Ok(dir.to_path_buf())
}

fn downloads_dir_for(source: &str) -> Result<PathBuf, String> {
    let dir = app_data_dir()?.join("downloads").join(source);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn sanitize_filename(name: &str) -> String {
    let trimmed = name.trim();
    let mut out = String::with_capacity(trimmed.len().max(16));
    for ch in trimmed.chars() {
        if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_') {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    if out.is_empty() {
        "download.bin".to_string()
    } else {
        out
    }
}

fn write_response_to_file(
    mut response: reqwest::blocking::Response,
    path: &Path,
) -> Result<u64, String> {
    let mut file = fs::File::create(path).map_err(|e| e.to_string())?;
    io::copy(&mut response, &mut file).map_err(|e| e.to_string())
}

fn download_file(url: &str, destination: &Path) -> Result<u64, String> {
    let client = http_client()?;
    let response = client
        .get(url)
        .send()
        .map_err(|e| format!("Download request failed: {e}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("Download failed ({status})"));
    }
    write_response_to_file(response, destination)
}

fn curseforge_api_key() -> Result<String, String> {
    std::env::var("VESPER_CURSEFORGE_API_KEY")
        .ok()
        .or_else(|| std::env::var("CURSEFORGE_API_KEY").ok())
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .ok_or_else(|| {
            "CurseForge API key missing. Set VESPER_CURSEFORGE_API_KEY or CURSEFORGE_API_KEY."
                .to_string()
        })
}

fn curseforge_loader_id(loader: &str) -> Option<u32> {
    match loader.trim().to_lowercase().as_str() {
        "forge" => Some(1),
        "fabric" => Some(4),
        "quilt" => Some(5),
        "neoforge" => Some(6),
        _ => None,
    }
}

fn microsoft_client_id() -> Result<String, String> {
    let from_runtime = std::env::var("VESPER_MS_CLIENT_ID")
        .ok()
        .or_else(|| std::env::var("MICROSOFT_CLIENT_ID").ok())
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());
    let from_compile = option_env!("VESPER_MS_CLIENT_ID")
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());

    from_runtime.or(from_compile).ok_or_else(|| {
        "Microsoft OAuth client ID is not configured. Set VESPER_MS_CLIENT_ID.".to_string()
    })
}

fn ensure_profiles_array(state: &mut Value) -> Result<&mut Vec<Value>, String> {
    if state.get("profiles").and_then(Value::as_array).is_none() {
        state["profiles"] = Value::Array(vec![]);
    }
    state
        .get_mut("profiles")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| "profiles is not an array".to_string())
}

fn build_microsoft_profile(display_name: &str, auth_state: &str) -> Value {
    json!({
        "id": "profile-microsoft-primary",
        "provider": "microsoft",
        "displayName": display_name,
        "offlineUsername": Value::Null,
        "authState": auth_state,
    })
}

fn upsert_microsoft_profile(display_name: &str, auth_state: &str) -> Result<Value, String> {
    let mut state = read_state_for_mutation()?;
    let profile = build_microsoft_profile(display_name, auth_state);
    let profiles = ensure_profiles_array(&mut state)?;
    if let Some(existing) = profiles
        .iter_mut()
        .find(|p| p.get("provider") == Some(&Value::String("microsoft".to_string())))
    {
        *existing = profile.clone();
    } else {
        profiles.insert(0, profile.clone());
    }
    write_state_value(&state)?;
    Ok(profile)
}

fn set_microsoft_profile_auth_state(auth_state: &str) -> Result<Option<Value>, String> {
    let mut state = read_state_for_mutation()?;
    let profiles = ensure_profiles_array(&mut state)?;
    let mut out = None;
    if let Some(existing) = profiles
        .iter_mut()
        .find(|p| p.get("provider") == Some(&Value::String("microsoft".to_string())))
    {
        if let Some(obj) = existing.as_object_mut() {
            obj.insert(
                "authState".to_string(),
                Value::String(auth_state.to_string()),
            );
        }
        out = Some(existing.clone());
        write_state_value(&state)?;
    }
    Ok(out)
}

fn read_microsoft_profile() -> Result<Option<Value>, String> {
    let state = read_state_value()?.unwrap_or_else(minimal_state_object);
    let profile = state
        .get("profiles")
        .and_then(Value::as_array)
        .and_then(|profiles| {
            profiles
                .iter()
                .find(|p| p.get("provider") == Some(&Value::String("microsoft".to_string())))
                .cloned()
        });
    Ok(profile)
}

fn oauth_device_code_start() -> Result<DeviceCodeResponse, String> {
    let client = http_client()?;
    let client_id = microsoft_client_id()?;
    let response = client
        .post(MS_DEVICE_CODE_URL)
        .form(&[("client_id", client_id.as_str()), ("scope", MS_SCOPE)])
        .send()
        .map_err(|e| format!("Microsoft device code request failed: {e}"))?;

    let status = response.status();
    let body = response
        .text()
        .map_err(|e| format!("Microsoft device code read failed: {e}"))?;
    if !status.is_success() {
        return Err(format!(
            "Microsoft device code request failed ({status}): {body}"
        ));
    }
    serde_json::from_str::<DeviceCodeResponse>(&body)
        .map_err(|e| format!("Microsoft device code parse failed: {e}"))
}

fn oauth_token_with_device_code(
    device_code: &str,
) -> Result<OAuthTokenResponse, OAuthErrorResponse> {
    let client = http_client().map_err(|e| OAuthErrorResponse {
        error: "client_error".to_string(),
        error_description: Some(e),
    })?;
    let client_id = microsoft_client_id().map_err(|e| OAuthErrorResponse {
        error: "configuration_error".to_string(),
        error_description: Some(e),
    })?;

    let response = client
        .post(MS_TOKEN_URL)
        .form(&[
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ("client_id", client_id.as_str()),
            ("device_code", device_code),
        ])
        .send()
        .map_err(|e| OAuthErrorResponse {
            error: "network_error".to_string(),
            error_description: Some(e.to_string()),
        })?;

    let status = response.status();
    let body = response.text().map_err(|e| OAuthErrorResponse {
        error: "read_error".to_string(),
        error_description: Some(e.to_string()),
    })?;

    if status.is_success() {
        serde_json::from_str::<OAuthTokenResponse>(&body).map_err(|e| OAuthErrorResponse {
            error: "parse_error".to_string(),
            error_description: Some(e.to_string()),
        })
    } else {
        let err = serde_json::from_str::<OAuthErrorResponse>(&body).unwrap_or(OAuthErrorResponse {
            error: "oauth_error".to_string(),
            error_description: Some(body),
        });
        Err(err)
    }
}

fn xbox_live_auth(ms_access_token: &str) -> Result<(String, String), String> {
    let client = http_client()?;
    let response = client
        .post(XBL_AUTH_URL)
        .header("x-xbl-contract-version", "1")
        .json(&json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": format!("d={ms_access_token}"),
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT",
        }))
        .send()
        .map_err(|e| format!("Xbox Live auth request failed: {e}"))?;

    let status = response.status();
    let body = response.text().map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("Xbox Live auth failed ({status}): {body}"));
    }
    let parsed: XboxAuthResponse = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    let uhs = parsed
        .display_claims
        .xui
        .first()
        .map(|x| x.uhs.clone())
        .ok_or_else(|| "Xbox Live response missing user hash".to_string())?;
    Ok((parsed.token, uhs))
}

fn xsts_auth(xbl_token: &str) -> Result<String, String> {
    let client = http_client()?;
    let response = client
        .post(XSTS_AUTH_URL)
        .header("x-xbl-contract-version", "1")
        .json(&json!({
            "Properties": {
                "SandboxId": "RETAIL",
                "UserTokens": [xbl_token],
            },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT",
        }))
        .send()
        .map_err(|e| format!("XSTS auth request failed: {e}"))?;

    let status = response.status();
    let body = response.text().map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("XSTS auth failed ({status}): {body}"));
    }
    let parsed: XstsAuthResponse = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    Ok(parsed.token)
}

fn minecraft_login_with_xbox(uhs: &str, xsts_token: &str) -> Result<String, String> {
    let client = http_client()?;
    let response = client
        .post(MC_LOGIN_URL)
        .json(&json!({
            "identityToken": format!("XBL3.0 x={uhs};{xsts_token}"),
        }))
        .send()
        .map_err(|e| format!("Minecraft auth request failed: {e}"))?;

    let status = response.status();
    let body = response.text().map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("Minecraft auth failed ({status}): {body}"));
    }
    let parsed: MinecraftLoginResponse = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    Ok(parsed.access_token)
}

fn ensure_minecraft_entitlement(mc_access_token: &str) -> Result<(), String> {
    let client = http_client()?;
    let response = client
        .get(MC_ENTITLEMENTS_URL)
        .bearer_auth(mc_access_token)
        .send()
        .map_err(|e| format!("Minecraft entitlements request failed: {e}"))?;

    let status = response.status();
    let body = response.text().map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("Minecraft entitlements failed ({status}): {body}"));
    }
    let parsed: MinecraftEntitlementsResponse =
        serde_json::from_str(&body).map_err(|e| e.to_string())?;
    if parsed.items.is_empty() {
        return Err(
            "Microsoft account is authenticated, but no Minecraft entitlement was found."
                .to_string(),
        );
    }
    Ok(())
}

fn minecraft_profile(mc_access_token: &str) -> Result<MinecraftProfileResponse, String> {
    let client = http_client()?;
    let response = client
        .get(MC_PROFILE_URL)
        .bearer_auth(mc_access_token)
        .send()
        .map_err(|e| format!("Minecraft profile request failed: {e}"))?;

    let status = response.status();
    let body = response.text().map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("Minecraft profile failed ({status}): {body}"));
    }
    serde_json::from_str::<MinecraftProfileResponse>(&body).map_err(|e| e.to_string())
}

fn resolve_minecraft_profile_from_ms_access_token(
    ms_access_token: &str,
) -> Result<MinecraftProfileResponse, String> {
    let (xbl_token, uhs) = xbox_live_auth(ms_access_token)?;
    let xsts_token = xsts_auth(&xbl_token)?;
    let mc_access_token = minecraft_login_with_xbox(&uhs, &xsts_token)?;
    ensure_minecraft_entitlement(&mc_access_token)?;
    minecraft_profile(&mc_access_token)
}

fn open_system_minecraft_uri() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "start", "", "minecraft://"]);
        cmd
    };

    #[cfg(target_os = "linux")]
    let mut command = {
        let mut cmd = Command::new("xdg-open");
        cmd.arg("minecraft://");
        cmd
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut cmd = Command::new("open");
        cmd.arg("minecraft://");
        cmd
    };

    let status = command
        .status()
        .map_err(|e| format!("Failed to execute launcher command: {e}"))?;
    if !status.success() {
        return Err(format!(
            "Launcher command returned a non-success status: {status}"
        ));
    }
    Ok("System launcher URI dispatched.".to_string())
}

fn value_to_u64(value: Option<&Value>) -> u64 {
    match value {
        Some(v) => v
            .as_u64()
            .or_else(|| v.as_i64().filter(|n| *n >= 0).map(|n| n as u64))
            .or_else(|| v.as_f64().filter(|n| *n >= 0.0).map(|n| n as u64))
            .unwrap_or(0),
        None => 0,
    }
}

fn map_modrinth_hit(hit: &Value) -> Value {
    let slug = hit.get("slug").and_then(Value::as_str).unwrap_or_default();
    let project_id = hit
        .get("project_id")
        .and_then(Value::as_str)
        .or_else(|| hit.get("id").and_then(Value::as_str))
        .unwrap_or_default();

    let loaders: Vec<String> = hit
        .get("categories")
        .and_then(Value::as_array)
        .map(|cats| {
            cats.iter()
                .filter_map(Value::as_str)
                .map(String::from)
                .collect()
        })
        .unwrap_or_default();

    let latest_version = hit
        .get("versions")
        .and_then(Value::as_array)
        .and_then(|v| v.last())
        .and_then(Value::as_str)
        .unwrap_or("Unknown");

    json!({
        "source": "modrinth",
        "projectId": project_id,
        "title": hit.get("title").and_then(Value::as_str).unwrap_or("Untitled"),
        "summary": hit.get("description").and_then(Value::as_str).unwrap_or(""),
        "downloads": value_to_u64(hit.get("downloads")),
        "iconUrl": hit.get("icon_url").and_then(Value::as_str),
        "url": if slug.is_empty() { Value::Null } else { Value::String(format!("https://modrinth.com/mod/{slug}")) },
        "author": hit.get("author").and_then(Value::as_str),
        "loaders": loaders,
        "latestVersion": latest_version,
    })
}

fn map_curseforge_mod(raw: &Value) -> Value {
    let id = raw.get("id").and_then(Value::as_u64).unwrap_or(0);
    let icon = raw
        .get("logo")
        .and_then(Value::as_object)
        .and_then(|x| x.get("thumbnailUrl"))
        .and_then(Value::as_str);
    let website = raw
        .get("links")
        .and_then(Value::as_object)
        .and_then(|x| x.get("websiteUrl"))
        .and_then(Value::as_str);
    let author = raw
        .get("authors")
        .and_then(Value::as_array)
        .and_then(|authors| authors.first())
        .and_then(Value::as_object)
        .and_then(|a| a.get("name"))
        .and_then(Value::as_str);

    let mut loaders = Vec::new();
    let mut latest_version = "Unknown".to_string();

    if let Some(files) = raw.get("latestFilesIndexes").and_then(Value::as_array) {
        if let Some(first_file) = files.first() {
            if let Some(gv) = first_file.get("gameVersion").and_then(Value::as_str) {
                latest_version = gv.to_string();
            }
        }
        for file in files {
            if let Some(mod_loader) = file.get("modLoader").and_then(Value::as_u64) {
                let loader_str = match mod_loader {
                    1 => "forge",
                    4 => "fabric",
                    5 => "quilt",
                    6 => "neoforge",
                    _ => continue,
                };
                if !loaders.contains(&loader_str.to_string()) {
                    loaders.push(loader_str.to_string());
                }
            }
        }
    }

    // fallback extraction for loaders if index is missing it (sometimes happens on CF)
    if loaders.is_empty() {
        if let Some(categories) = raw.get("categories").and_then(Value::as_array) {
            for cat in categories {
                if let Some(name) = cat.get("name").and_then(Value::as_str) {
                    let s = name.to_lowercase();
                    if s.contains("fabric") && !loaders.contains(&"fabric".to_string()) {
                        loaders.push("fabric".to_string());
                    }
                    if s.contains("forge") && !loaders.contains(&"forge".to_string()) {
                        loaders.push("forge".to_string());
                    }
                    if s.contains("quilt") && !loaders.contains(&"quilt".to_string()) {
                        loaders.push("quilt".to_string());
                    }
                    if s.contains("neoforge") && !loaders.contains(&"neoforge".to_string()) {
                        loaders.push("neoforge".to_string());
                    }
                }
            }
        }
    }

    json!({
        "source": "curseforge",
        "projectId": id.to_string(),
        "title": raw.get("name").and_then(Value::as_str).unwrap_or("Untitled"),
        "summary": raw.get("summary").and_then(Value::as_str).unwrap_or(""),
        "downloads": value_to_u64(raw.get("downloadCount")),
        "iconUrl": icon,
        "url": website,
        "author": author,
        "loaders": loaders,
        "latestVersion": latest_version,
    })
}

#[tauri::command]
fn discover_search_modrinth(
    _app: AppHandle,
    input: DiscoverSearchInput,
) -> Result<Vec<Value>, String> {
    let query = input.query.trim();

    let limit = input.limit.unwrap_or(20).clamp(1, 60);
    let mut url = Url::parse(MODRINTH_SEARCH_URL).map_err(|e| e.to_string())?;
    let mut facets: Vec<Vec<String>> = vec![vec!["project_type:mod".to_string()]];

    if let Some(loader) = input
        .loader
        .as_ref()
        .map(|v| v.trim().to_lowercase())
        .filter(|v| !v.is_empty() && v != "all" && v != "vanilla")
    {
        facets.push(vec![format!("categories:{loader}")]);
    }

    if let Some(version) = input
        .game_version
        .as_ref()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty() && v != "all")
    {
        facets.push(vec![format!("versions:{version}")]);
    }

    let facets_json = serde_json::to_string(&facets).map_err(|e| e.to_string())?;
    {
        let mut qp = url.query_pairs_mut();
        qp.append_pair("query", query);
        qp.append_pair("limit", &limit.to_string());
        if let Some(offset) = input.offset {
            qp.append_pair("offset", &offset.to_string());
        }
        qp.append_pair("index", "relevance");
        qp.append_pair("facets", &facets_json);
    }

    let client = http_client()?;
    let response = client
        .get(url)
        .send()
        .map_err(|e| format!("Modrinth search failed: {e}"))?;
    let status = response.status();
    let body = response.text().map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("Modrinth search failed ({status}): {body}"));
    }

    let parsed = serde_json::from_str::<Value>(&body).map_err(|e| e.to_string())?;
    let out = parsed
        .get("hits")
        .and_then(Value::as_array)
        .map(|hits| hits.iter().map(map_modrinth_hit).collect())
        .unwrap_or_default();
    Ok(out)
}

#[tauri::command]
fn discover_search_curseforge(
    _app: AppHandle,
    input: DiscoverSearchInput,
) -> Result<Vec<Value>, String> {
    let query = input.query.trim();

    let api_key = curseforge_api_key()?;
    let limit = input.limit.unwrap_or(20).clamp(1, 50);
    let mut url =
        Url::parse(&format!("{CURSEFORGE_API_ROOT}/mods/search")).map_err(|e| e.to_string())?;

    {
        let mut qp = url.query_pairs_mut();
        qp.append_pair("gameId", "432");
        qp.append_pair("classId", "6");
        qp.append_pair("searchFilter", query);
        qp.append_pair("pageSize", &limit.to_string());
        if let Some(offset) = input.offset {
            qp.append_pair("index", &offset.to_string());
        }
        if let Some(version) = input
            .game_version
            .as_ref()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty() && v != "all")
        {
            qp.append_pair("gameVersion", &version);
        }
        if let Some(loader_id) = input.loader.as_deref().and_then(curseforge_loader_id) {
            qp.append_pair("modLoaderType", &loader_id.to_string());
        }
    }

    let client = http_client()?;
    let response = client
        .get(url)
        .header("x-api-key", api_key)
        .send()
        .map_err(|e| format!("CurseForge search failed: {e}"))?;
    let status = response.status();
    let body = response.text().map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("CurseForge search failed ({status}): {body}"));
    }

    let parsed = serde_json::from_str::<Value>(&body).map_err(|e| e.to_string())?;
    let out = parsed
        .get("data")
        .and_then(Value::as_array)
        .map(|items| items.iter().map(map_curseforge_mod).collect())
        .unwrap_or_default();
    Ok(out)
}

#[tauri::command]
fn discover_download_modrinth(
    _app: AppHandle,
    input: DiscoverDownloadInput,
) -> Result<DiscoverDownloadResult, String> {
    let project_id = input.project_id.trim();
    if project_id.is_empty() {
        return Err("Project ID is required.".to_string());
    }

    let url = format!("{MODRINTH_PROJECT_VERSIONS_URL}/{project_id}/version");
    let client = http_client()?;
    let response = client
        .get(url)
        .send()
        .map_err(|e| format!("Modrinth versions request failed: {e}"))?;
    let status = response.status();
    let body = response.text().map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!(
            "Modrinth versions request failed ({status}): {body}"
        ));
    }

    let versions = serde_json::from_str::<Value>(&body)
        .map_err(|e| e.to_string())?
        .as_array()
        .cloned()
        .unwrap_or_default();
    if versions.is_empty() {
        return Err("No downloadable versions found for this Modrinth project.".to_string());
    }

    let wanted_loader = input
        .loader
        .as_ref()
        .map(|x| x.trim().to_lowercase())
        .filter(|x| !x.is_empty() && x != "all" && x != "vanilla");
    let wanted_version = input
        .game_version
        .as_ref()
        .map(|x| x.trim().to_string())
        .filter(|x| !x.is_empty() && x != "all");

    let selected = versions
        .iter()
        .find(|version| {
            let game_versions = version
                .get("game_versions")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let loaders = version
                .get("loaders")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let version_ok = wanted_version.as_ref().map_or(true, |wanted| {
                game_versions
                    .iter()
                    .any(|entry| entry.as_str().map_or(false, |v| v == wanted))
            });
            let loader_ok = wanted_loader.as_ref().map_or(true, |wanted| {
                loaders
                    .iter()
                    .any(|entry| entry.as_str().map_or(false, |v| v == wanted))
            });
            version_ok && loader_ok
        })
        .or_else(|| versions.first())
        .ok_or_else(|| "No compatible Modrinth version found.".to_string())?;

    let files = selected
        .get("files")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let file = files
        .iter()
        .find(|entry| {
            entry
                .get("primary")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        })
        .or_else(|| files.first())
        .ok_or_else(|| "No downloadable file found for selected Modrinth version.".to_string())?;

    let file_url = file
        .get("url")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing Modrinth file URL.".to_string())?;
    let file_name = sanitize_filename(
        file.get("filename")
            .and_then(Value::as_str)
            .unwrap_or("modrinth-download.mrpack"),
    );
    let target_dir = downloads_dir_for("modrinth")?.join(project_id);
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    let destination = target_dir.join(&file_name);
    let bytes = download_file(file_url, &destination)?;
    let version_name = selected
        .get("version_number")
        .and_then(Value::as_str)
        .unwrap_or("latest");

    Ok(DiscoverDownloadResult {
        source: "modrinth".to_string(),
        project_id: project_id.to_string(),
        file_name,
        file_path: destination.to_string_lossy().to_string(),
        size_bytes: Some(bytes),
        url: file_url.to_string(),
        message: format!("Downloaded Modrinth version {version_name}."),
    })
}

#[tauri::command]
fn discover_download_curseforge(
    _app: AppHandle,
    input: CurseForgeDownloadInput,
) -> Result<DiscoverDownloadResult, String> {
    let api_key = curseforge_api_key()?;
    let mut url = Url::parse(&format!(
        "{CURSEFORGE_API_ROOT}/mods/{}/files",
        input.mod_id
    ))
    .map_err(|e| e.to_string())?;

    {
        let mut qp = url.query_pairs_mut();
        qp.append_pair("pageSize", "80");
        if let Some(version) = input
            .game_version
            .as_ref()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty() && v != "all")
        {
            qp.append_pair("gameVersion", &version);
        }
        if let Some(loader_id) = input.loader.as_deref().and_then(curseforge_loader_id) {
            qp.append_pair("modLoaderType", &loader_id.to_string());
        }
    }

    let client = http_client()?;
    let response = client
        .get(url)
        .header("x-api-key", api_key)
        .send()
        .map_err(|e| format!("CurseForge files request failed: {e}"))?;
    let status = response.status();
    let body = response.text().map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!(
            "CurseForge files request failed ({status}): {body}"
        ));
    }
    let parsed = serde_json::from_str::<Value>(&body).map_err(|e| e.to_string())?;
    let files = parsed
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let file = files
        .iter()
        .find(|f| f.get("downloadUrl").and_then(Value::as_str).is_some())
        .ok_or_else(|| {
            "No downloadable CurseForge file found for this mod/filters. Some files are distribution restricted."
                .to_string()
        })?;

    let file_url = file
        .get("downloadUrl")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing CurseForge download URL.".to_string())?;
    let file_name = sanitize_filename(
        file.get("fileName")
            .and_then(Value::as_str)
            .or_else(|| file.get("displayName").and_then(Value::as_str))
            .unwrap_or("curseforge-download.jar"),
    );
    let target_dir = downloads_dir_for("curseforge")?.join(input.mod_id.to_string());
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    let destination = target_dir.join(&file_name);
    let bytes = download_file(file_url, &destination)?;

    Ok(DiscoverDownloadResult {
        source: "curseforge".to_string(),
        project_id: input.mod_id.to_string(),
        file_name,
        file_path: destination.to_string_lossy().to_string(),
        size_bytes: Some(bytes),
        url: file_url.to_string(),
        message: "Downloaded latest CurseForge file.".to_string(),
    })
}

#[tauri::command]
fn load_app_state(_app: AppHandle) -> Result<Value, String> {
    Ok(read_state_value()?.unwrap_or(Value::Null))
}

#[tauri::command]
fn save_app_state(_app: AppHandle, state: Value) -> Result<bool, String> {
    write_state_value(&state)?;
    Ok(true)
}

#[tauri::command]
fn list_instances(_app: AppHandle) -> Result<Vec<Value>, String> {
    let state = read_state_value()?.unwrap_or_else(minimal_state_object);
    let instances = state
        .get("instances")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    Ok(instances)
}

#[tauri::command]
fn create_instance(_app: AppHandle, input: CreateInstanceInput) -> Result<Value, String> {
    let mut state = read_state_for_mutation()?;
    if state.get("instances").and_then(Value::as_array).is_none() {
        state["instances"] = Value::Array(vec![]);
    }

    let now = now_iso();
    let modpack_name = input
        .modpack_name
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let instance = json!({
        "id": format!("inst-{}", Uuid::new_v4()),
        "name": input.name.trim(),
        "mcVersion": input.mc_version.trim(),
        "loader": input.loader.trim(),
        "modpackName": modpack_name,
        "tags": [input.loader.trim()],
        "notes": "",
        "presetId": Value::Null,
        "overrides": {},
        "snapshots": [],
        "createdAt": now,
        "updatedAt": now,
        "lastPlayedAt": Value::Null
    });

    if let Some(instances) = state.get_mut("instances").and_then(Value::as_array_mut) {
        instances.insert(0, instance.clone());
    }

    write_state_value(&state)?;
    Ok(instance)
}

#[tauri::command]
fn launch_instance(_app: AppHandle, instance_id: String) -> Result<LaunchPreview, String> {
    let (status, note) = match open_system_minecraft_uri() {
        Ok(message) => ("launcher-opened".to_string(), message),
        Err(error) => (
            "placeholder".to_string(),
            format!("Failed to open system launcher URI: {error}"),
        ),
    };

    Ok(LaunchPreview {
        status,
        instance_id,
        command_preview: vec!["minecraft://".to_string()],
        note,
    })
}

#[tauri::command]
fn auth_get_status(_app: AppHandle) -> Result<AuthStatusResponse, String> {
    let secure_probe = secure_storage::read_secret(MS_REFRESH_TOKEN_KEY);
    let secure_storage_available = secure_probe.is_ok();
    let refresh_token_present = matches!(secure_probe, Ok(Some(_)));
    let microsoft_client_configured = microsoft_client_id().is_ok();

    let mut profile = read_microsoft_profile()?;
    if let Some(p) = &profile {
        let auth_state = p
            .get("authState")
            .and_then(Value::as_str)
            .unwrap_or("signed_out");
        if auth_state == "signed_in" && !refresh_token_present {
            profile = set_microsoft_profile_auth_state("expired")?;
        }
    }

    let message = if !microsoft_client_configured {
        Some("Set VESPER_MS_CLIENT_ID to enable Microsoft login.".to_string())
    } else if !secure_storage_available {
        Some("OS secure storage is unavailable; Microsoft login is disabled.".to_string())
    } else {
        None
    };

    Ok(AuthStatusResponse {
        profile,
        login_available: microsoft_client_configured && secure_storage_available,
        secure_storage_available,
        microsoft_client_configured,
        message,
    })
}

#[tauri::command]
fn auth_begin_microsoft_device_login(
    _app: AppHandle,
    flows: State<'_, PendingMicrosoftFlows>,
) -> Result<MicrosoftDeviceLoginStart, String> {
    let device = oauth_device_code_start()?;
    let interval = device.interval.unwrap_or(5).max(1);
    let session_id = format!("msflow-{}", Uuid::new_v4());

    let pending = PendingMicrosoftFlow {
        device_code: device.device_code.clone(),
        interval_seconds: interval,
        expires_at: Utc::now() + Duration::seconds(device.expires_in as i64),
    };

    let mut sessions = flows
        .sessions
        .lock()
        .map_err(|_| "Auth flow lock poisoned".to_string())?;
    sessions.insert(session_id.clone(), pending);

    Ok(MicrosoftDeviceLoginStart {
        session_id,
        user_code: device.user_code,
        verification_uri: device.verification_uri,
        verification_uri_complete: device.verification_uri_complete,
        expires_in_seconds: device.expires_in,
        interval_seconds: interval,
        message: device.message,
    })
}

#[tauri::command]
fn auth_poll_microsoft_device_login(
    _app: AppHandle,
    session_id: String,
    flows: State<'_, PendingMicrosoftFlows>,
) -> Result<MicrosoftDeviceLoginPoll, String> {
    let pending = {
        let sessions = flows
            .sessions
            .lock()
            .map_err(|_| "Auth flow lock poisoned".to_string())?;
        sessions.get(&session_id).cloned()
    }
    .ok_or_else(|| "Login session not found or expired.".to_string())?;

    if Utc::now() > pending.expires_at {
        let mut sessions = flows
            .sessions
            .lock()
            .map_err(|_| "Auth flow lock poisoned".to_string())?;
        sessions.remove(&session_id);
        return Ok(MicrosoftDeviceLoginPoll {
            status: "error".to_string(),
            profile: None,
            retry_after_seconds: None,
            message: Some("Microsoft device login session expired. Start login again.".to_string()),
        });
    }

    match oauth_token_with_device_code(&pending.device_code) {
        Ok(tokens) => {
            let refresh_token = tokens.refresh_token.ok_or_else(|| {
                "Microsoft token response did not include a refresh token.".to_string()
            })?;
            let mc_profile = resolve_minecraft_profile_from_ms_access_token(&tokens.access_token)?;
            secure_storage::write_secret(MS_REFRESH_TOKEN_KEY, &refresh_token)?;
            let profile = upsert_microsoft_profile(&mc_profile.name, "signed_in")?;

            let mut sessions = flows
                .sessions
                .lock()
                .map_err(|_| "Auth flow lock poisoned".to_string())?;
            sessions.remove(&session_id);

            Ok(MicrosoftDeviceLoginPoll {
                status: "complete".to_string(),
                profile: Some(profile),
                retry_after_seconds: None,
                message: Some(format!(
                    "Signed in as {} ({})",
                    mc_profile.name, mc_profile.id
                )),
            })
        }
        Err(err) => {
            let error_code = err.error.as_str();
            let message = err.error_description.unwrap_or(err.error.clone());
            match error_code {
                "authorization_pending" => Ok(MicrosoftDeviceLoginPoll {
                    status: "pending".to_string(),
                    profile: None,
                    retry_after_seconds: Some(pending.interval_seconds),
                    message: None,
                }),
                "slow_down" => {
                    let next_interval = pending.interval_seconds.saturating_add(5);
                    let mut sessions = flows
                        .sessions
                        .lock()
                        .map_err(|_| "Auth flow lock poisoned".to_string())?;
                    if let Some(existing) = sessions.get_mut(&session_id) {
                        existing.interval_seconds = next_interval;
                    }
                    Ok(MicrosoftDeviceLoginPoll {
                        status: "pending".to_string(),
                        profile: None,
                        retry_after_seconds: Some(next_interval),
                        message: None,
                    })
                }
                "authorization_declined" | "expired_token" | "bad_verification_code" => {
                    let mut sessions = flows
                        .sessions
                        .lock()
                        .map_err(|_| "Auth flow lock poisoned".to_string())?;
                    sessions.remove(&session_id);
                    Ok(MicrosoftDeviceLoginPoll {
                        status: "error".to_string(),
                        profile: None,
                        retry_after_seconds: None,
                        message: Some(message),
                    })
                }
                _ => Ok(MicrosoftDeviceLoginPoll {
                    status: "error".to_string(),
                    profile: None,
                    retry_after_seconds: None,
                    message: Some(message),
                }),
            }
        }
    }
}

#[tauri::command]
fn auth_logout_microsoft(_app: AppHandle) -> Result<AuthStatusResponse, String> {
    let _ = secure_storage::delete_secret(MS_REFRESH_TOKEN_KEY);
    let profile = set_microsoft_profile_auth_state("signed_out")?;
    let secure_storage_available = secure_storage::read_secret(MS_REFRESH_TOKEN_KEY).is_ok();
    let microsoft_client_configured = microsoft_client_id().is_ok();

    Ok(AuthStatusResponse {
        profile,
        login_available: microsoft_client_configured && secure_storage_available,
        secure_storage_available,
        microsoft_client_configured,
        message: None,
    })
}

#[tauri::command]
fn secure_store_write_placeholder(
    key: String,
    value: String,
) -> Result<secure_storage::SecureStorageStatus, String> {
    Ok(secure_storage::write_placeholder(key, value))
}

#[tauri::command]
fn secure_store_read_placeholder(
    key: String,
) -> Result<secure_storage::SecureStorageStatus, String> {
    Ok(secure_storage::read_placeholder(key))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PendingMicrosoftFlows::default())
        .invoke_handler(tauri::generate_handler![
            load_app_state,
            save_app_state,
            list_instances,
            create_instance,
            launch_instance,
            auth_get_status,
            auth_begin_microsoft_device_login,
            auth_poll_microsoft_device_login,
            auth_logout_microsoft,
            secure_store_write_placeholder,
            secure_store_read_placeholder,
            discover_search_modrinth,
            discover_download_modrinth,
            discover_search_curseforge,
            discover_download_curseforge
        ])
        .run(tauri::generate_context!())
        .expect("error while running Vesper Launcher");
}
