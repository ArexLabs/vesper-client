#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod secure_storage;

use chrono::{Duration, Utc};
use directories::ProjectDirs;
use eframe::egui;
use reqwest::blocking::Client;
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs, io,
    path::{Path, PathBuf},
    process::Command,
    time::Duration as StdDuration,
};
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

#[derive(Debug, Clone)]
enum AppPage {
    Home,
    Instances,
    InstanceDetails(String),
    Discover,
    Skins,
    ConfigStudio,
    Diagnostics,
    Settings,
}

struct VesperApp {
    current_page: AppPage,
    instances: Vec<Value>,
    profiles: Vec<Value>,
    search_query: String,
    search_results: Vec<Value>,
    is_searching: bool,
    pending_ms_flows: HashMap<String, PendingMicrosoftFlow>,
    auth_status: AuthStatusResponse,
    settings: Value,
    console_output: Vec<String>,
}

impl Default for VesperApp {
    fn default() -> Self {
        Self {
            current_page: AppPage::Home,
            instances: Vec::new(),
            profiles: Vec::new(),
            search_query: String::new(),
            search_results: Vec::new(),
            is_searching: false,
            pending_ms_flows: HashMap::new(),
            auth_status: AuthStatusResponse {
                profile: None,
                login_available: false,
                secure_storage_available: true,
                microsoft_client_configured: false,
                message: None,
            },
            settings: default_launcher_config(),
            console_output: vec!["Vesper Client started".to_string()],
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AuthStatusResponse {
    profile: Option<Value>,
    login_available: bool,
    secure_storage_available: bool,
    microsoft_client_configured: bool,
    message: Option<String>,
}

#[derive(Debug, Clone)]
struct PendingMicrosoftFlow {
    device_code: String,
    interval_seconds: u64,
    expires_at: chrono::DateTime<Utc>,
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
    let mut file = fs::File::create(destination).map_err(|e| e.to_string())?;
    let mut response = response;
    io::copy(&mut response, &mut file).map_err(|e| e.to_string())
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
        error_description: Some(e),
    })?;

    if status.is_success() {
        serde_json::from_str::<OAuthTokenResponse>(&body).map_err(|e| OAuthErrorResponse {
            error: "parse_error".to_string(),
            error_description: Some(e),
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

impl VesperApp {
    fn load_state(&mut self) {
        if let Ok(Some(state)) = read_state_value() {
            self.instances = state
                .get("instances")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            self.profiles = state
                .get("profiles")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            self.settings = state
                .get("globalDefaults")
                .cloned()
                .unwrap_or_else(default_launcher_config);
        }

        let secure_probe = secure_storage::read_secret(MS_REFRESH_TOKEN_KEY);
        let secure_storage_available = secure_probe.is_ok();
        let refresh_token_present = matches!(secure_probe, Ok(Some(_)));
        let microsoft_client_configured = microsoft_client_id().is_ok();

        let mut profile = read_microsoft_profile().ok().flatten();
        if let Some(p) = &profile {
            let auth_state = p
                .get("authState")
                .and_then(Value::as_str)
                .unwrap_or("signed_out");
            if auth_state == "signed_in" && !refresh_token_present {
                profile = set_microsoft_profile_auth_state("expired").ok().flatten();
            }
        }

        let message = if !microsoft_client_configured {
            Some("Set VESPER_MS_CLIENT_ID to enable Microsoft login.".to_string())
        } else if !secure_storage_available {
            Some("OS secure storage is unavailable; Microsoft login is disabled.".to_string())
        } else {
            None
        };

        self.auth_status = AuthStatusResponse {
            profile,
            login_available: microsoft_client_configured && secure_storage_available,
            secure_storage_available,
            microsoft_client_configured,
            message,
        };
    }

    fn log(&mut self, message: String) {
        self.console_output.push(message);
        if self.console_output.len() > 1000 {
            self.console_output.remove(0);
        }
    }

    fn search_modrinth(&mut self) {
        let query = self.search_query.trim();
        if query.is_empty() {
            return;
        }

        self.is_searching = true;
        self.log(format!("Searching Modrinth for: {}", query));

        let result: Result<Vec<Value>, String> = (|| {
            let limit = 20u32.clamp(1, 60);
            let mut url = Url::parse(MODRINTH_SEARCH_URL).map_err(|e| e.to_string())?;
            let facets: Vec<Vec<String>> = vec![vec!["project_type:mod".to_string()]];
            let facets_json = serde_json::to_string(&facets).map_err(|e| e.to_string())?;

            {
                let mut qp = url.query_pairs_mut();
                qp.append_pair("query", query);
                qp.append_pair("limit", &limit.to_string());
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
        })();

        match result {
            Ok(results) => {
                self.search_results = results;
                self.log(format!("Found {} results", self.search_results.len()));
            }
            Err(e) => {
                self.log(format!("Search error: {}", e));
            }
        }
        self.is_searching = false;
    }

    fn search_curseforge(&mut self) {
        let query = self.search_query.trim();
        if query.is_empty() {
            return;
        }

        self.is_searching = true;
        self.log(format!("Searching CurseForge for: {}", query));

        let result: Result<Vec<Value>, String> = (|| {
            let api_key = curseforge_api_key()?;
            let limit = 20u32.clamp(1, 50);
            let mut url = Url::parse(&format!("{CURSEFORGE_API_ROOT}/mods/search"))
                .map_err(|e| e.to_string())?;

            {
                let mut qp = url.query_pairs_mut();
                qp.append_pair("gameId", "432");
                qp.append_pair("classId", "6");
                qp.append_pair("searchFilter", query);
                qp.append_pair("pageSize", &limit.to_string());
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
        })();

        match result {
            Ok(results) => {
                self.search_results = results;
                self.log(format!("Found {} results", self.search_results.len()));
            }
            Err(e) => {
                self.log(format!("Search error: {}", e));
            }
        }
        self.is_searching = false;
    }

    fn create_instance(&mut self, name: String, mc_version: String, loader: String) {
        let now = now_iso();
        let instance = json!({
            "id": format!("inst-{}", Uuid::new_v4()),
            "name": name.trim(),
            "mcVersion": mc_version.trim(),
            "loader": loader.trim(),
            "modpackName": Value::Null,
            "tags": [loader.trim()],
            "notes": "",
            "presetId": Value::Null,
            "overrides": {},
            "snapshots": [],
            "createdAt": now,
            "updatedAt": now,
            "lastPlayedAt": Value::Null
        });

        let mut state = read_state_for_mutation().unwrap_or_else(minimal_state_object);
        if state.get("instances").and_then(Value::as_array).is_none() {
            state["instances"] = Value::Array(vec![]);
        }
        if let Some(instances) = state.get_mut("instances").and_then(Value::as_array_mut) {
            instances.insert(0, instance.clone());
        }

        if write_state_value(&state).is_ok() {
            self.instances.insert(0, instance);
            self.log("Instance created successfully".to_string());
        }
    }

    fn delete_instance(&mut self, instance_id: &str) {
        let mut state = read_state_for_mutation().unwrap_or_else(minimal_state_object);
        if let Some(instances) = state.get_mut("instances").and_then(Value::as_array_mut) {
            instances.retain(|i| i.get("id").and_then(Value::as_str) != Some(instance_id));
        }

        if write_state_value(&state).is_ok() {
            self.instances
                .retain(|i| i.get("id").and_then(Value::as_str) != Some(instance_id));
            self.log(format!("Deleted instance: {}", instance_id));
        }
    }

    fn start_ms_device_login(&mut self) -> Result<DeviceCodeResponse, String> {
        let device = oauth_device_code_start()?;
        let interval = device.interval.unwrap_or(5).max(1);
        let session_id = format!("msflow-{}", Uuid::new_v4());

        let pending = PendingMicrosoftFlow {
            device_code: device.device_code.clone(),
            interval_seconds: interval,
            expires_at: Utc::now() + Duration::seconds(device.expires_in as i64),
        };

        self.pending_ms_flows.insert(session_id, pending);
        Ok(device)
    }

    fn poll_ms_device_login(&mut self, session_id: &str) -> Result<Value, String> {
        let pending = self
            .pending_ms_flows
            .get(session_id)
            .ok_or_else(|| "Login session not found or expired.".to_string())?
            .clone();

        if Utc::now() > pending.expires_at {
            self.pending_ms_flows.remove(session_id);
            return Err("Microsoft device login session expired.".to_string());
        }

        match oauth_token_with_device_code(&pending.device_code) {
            Ok(tokens) => {
                let refresh_token = tokens.refresh_token.ok_or_else(|| {
                    "Microsoft token response did not include a refresh token.".to_string()
                })?;
                let mc_profile =
                    resolve_minecraft_profile_from_ms_access_token(&tokens.access_token)?;
                secure_storage::write_secret(MS_REFRESH_TOKEN_KEY, &refresh_token)?;
                let profile = upsert_microsoft_profile(&mc_profile.name, "signed_in")?;

                let mut profile_obj = profile.as_object().cloned().unwrap_or_default();
                profile_obj.insert("minecraftUuid".to_string(), json!(mc_profile.id));
                profile_obj.insert("minecraftUsername".to_string(), json!(mc_profile.name));
                let final_profile = Value::Object(profile_obj);

                self.pending_ms_flows.remove(session_id);
                self.load_state();

                Ok(json!({
                    "status": "complete",
                    "profile": final_profile,
                    "message": format!("Signed in as {} ({})", mc_profile.name, mc_profile.id)
                }))
            }
            Err(err) => {
                let error_code = err.error.as_str();
                match error_code {
                    "authorization_pending" | "slow_down" => Ok(json!({
                        "status": "pending",
                        "retryAfterSeconds": pending.interval_seconds
                    })),
                    _ => {
                        self.pending_ms_flows.remove(session_id);
                        Err(err.error_description.unwrap_or(err.error))
                    }
                }
            }
        }
    }

    fn logout_microsoft(&mut self) {
        let _ = secure_storage::delete_secret(MS_REFRESH_TOKEN_KEY);
        let _ = set_microsoft_profile_auth_state("signed_out");
        self.load_state();
        self.log("Signed out".to_string());
    }

    fn launch_instance(&mut self, instance_id: &str) {
        #[cfg(target_os = "windows")]
        let status = Command::new("cmd")
            .args(["/C", "start", "", "minecraft://"])
            .status();

        #[cfg(target_os = "linux")]
        let status = Command::new("xdg-open").arg("minecraft://").status();

        #[cfg(target_os = "macos")]
        let status = Command::new("open").arg("minecraft://").status();

        match status {
            Ok(s) if s.success() => {
                self.log("Opened system launcher".to_string());
            }
            Ok(s) => {
                self.log(format!("Launcher returned: {}", s));
            }
            Err(e) => {
                self.log(format!("Failed to open launcher: {}", e));
            }
        }
    }
}

impl eframe::App for VesperApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::TopBottomPanel::top("top_bar").show(ctx, |ui| {
            ui.horizontal(|ui| {
                ui.heading("Vesper Client");
                ui.separator();
                if ui
                    .selectable_label(matches!(self.current_page, AppPage::Home), "Home")
                    .clicked()
                {
                    self.current_page = AppPage::Home;
                }
                if ui
                    .selectable_label(matches!(self.current_page, AppPage::Instances), "Instances")
                    .clicked()
                {
                    self.current_page = AppPage::Instances;
                }
                if ui
                    .selectable_label(matches!(self.current_page, AppPage::Discover), "Discover")
                    .clicked()
                {
                    self.current_page = AppPage::Discover;
                }
                if ui
                    .selectable_label(matches!(self.current_page, AppPage::Settings), "Settings")
                    .clicked()
                {
                    self.current_page = AppPage::Settings;
                }
                ui.separator();
                if ui
                    .selectable_label(
                        matches!(self.current_page, AppPage::Diagnostics),
                        "Diagnostics",
                    )
                    .clicked()
                {
                    self.current_page = AppPage::Diagnostics;
                }
            });
        });

        egui::SidePanel::left("sidebar")
            .default_width(200.0)
            .show(ctx, |ui| {
                ui.heading("Account");
                if let Some(profile) = &self.auth_status.profile {
                    let username = profile
                        .get("minecraftUsername")
                        .and_then(Value::as_str)
                        .or_else(|| profile.get("displayName").and_then(Value::as_str))
                        .unwrap_or("Unknown");
                    let auth_state = profile
                        .get("authState")
                        .and_then(Value::as_str)
                        .unwrap_or("signed_out");

                    ui.label(format!("Signed in as {}", username));
                    ui.label(format!("Status: {}", auth_state));
                    if ui.button("Sign Out").clicked() {
                        self.logout_microsoft();
                    }
                } else {
                    ui.label("Not signed in");
                    if self.auth_status.login_available {
                        if ui.button("Sign in with Microsoft").clicked() {
                            if let Ok(device) = self.start_ms_device_login() {
                                self.log(format!("Device code: {}", device.user_code));
                                let _ = open::that(&device.verification_uri);
                            }
                        }
                    } else if let Some(msg) = &self.auth_status.message {
                        ui.label(msg);
                    }
                }

                ui.separator();
                ui.heading("Instances");
                ui.label(format!("{} instances", self.instances.len()));
            });

        egui::CentralPanel::default().show(ctx, |ui| match &self.current_page {
            AppPage::Home => self.show_home_page(ui),
            AppPage::Instances => self.show_instances_page(ui),
            AppPage::InstanceDetails(id) => self.show_instance_details_page(ui, id),
            AppPage::Discover => self.show_discover_page(ui),
            AppPage::Skins => self.show_skins_page(ui),
            AppPage::ConfigStudio => self.show_config_studio_page(ui),
            AppPage::Diagnostics => self.show_diagnostics_page(ui),
            AppPage::Settings => self.show_settings_page(ui),
        });
    }
}

impl VesperApp {
    fn show_home_page(&mut self, ui: &mut egui::Ui) {
        ui.heading("Welcome to Vesper Client");
        ui.label("A Minecraft launcher built with Rust and egui");

        ui.separator();
        ui.heading("Quick Actions");

        ui.horizontal(|ui| {
            if ui.button("New Instance").clicked() {
                self.current_page = AppPage::Instances;
            }
            if ui.button("Browse Mods").clicked() {
                self.current_page = AppPage::Discover;
            }
            if ui.button("Settings").clicked() {
                self.current_page = AppPage::Settings;
            }
        });

        ui.separator();
        ui.heading("Recent Instances");
        egui::ScrollArea::vertical().show(ui, |ui| {
            for instance in self.instances.iter().take(5) {
                let name = instance
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("Unnamed");
                let mc_version = instance
                    .get("mcVersion")
                    .and_then(Value::as_str)
                    .unwrap_or("Unknown");
                let loader = instance
                    .get("loader")
                    .and_then(Value::as_str)
                    .unwrap_or("vanilla");

                ui.horizontal(|ui| {
                    ui.label(format!("{} ({}-{})", name, mc_version, loader));
                    if ui.button("Launch").clicked() {
                        if let Some(id) = instance.get("id").and_then(Value::as_str) {
                            self.launch_instance(id);
                        }
                    }
                });
            }
        });
    }

    fn show_instances_page(&mut self, ui: &mut egui::Ui) {
        ui.heading("Instances");

        ui.horizontal(|ui| {
            let mut new_name = String::new();
            let mut new_version = String::from("1.20.4");
            let mut new_loader = String::from("fabric");

            ui.label("Name:");
            ui.text_edit_singleline(&mut new_name);
            ui.label("Version:");
            ui.text_edit_singleline(&mut new_version);
            ui.label("Loader:");
            ui.text_edit_singleline(&mut new_loader);

            if ui.button("Create").clicked() && !new_name.is_empty() {
                self.create_instance(new_name, new_version, new_loader);
            }
        });

        ui.separator();

        egui::ScrollArea::vertical().show(ui, |ui| {
            for instance in &self.instances {
                let name = instance
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("Unnamed");
                let mc_version = instance
                    .get("mcVersion")
                    .and_then(Value::as_str)
                    .unwrap_or("Unknown");
                let loader = instance
                    .get("loader")
                    .and_then(Value::as_str)
                    .unwrap_or("vanilla");
                let id = instance.get("id").and_then(Value::as_str).unwrap_or("");

                egui::Frame::group(ui).show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.vertical(|ui| {
                            ui.label(egui::RichText::new(name).heading());
                            ui.label(format!("{} - {}", mc_version, loader));
                        });
                        ui.separator();
                        if ui.button("Launch").clicked() {
                            self.launch_instance(id);
                        }
                        if ui.button("Delete").clicked() {
                            self.delete_instance(id);
                        }
                    });
                });
            }
        });
    }

    fn show_instance_details_page(&mut self, ui: &mut egui::Ui, _id: &str) {
        ui.heading("Instance Details");
        ui.label("This page shows detailed instance information.");
    }

    fn show_discover_page(&mut self, ui: &mut egui::Ui) {
        ui.heading("Discover Mods");

        ui.horizontal(|ui| {
            ui.label("Search:");
            ui.text_edit_singleline(&mut self.search_query);
            if ui.button("Search Modrinth").clicked() {
                self.search_modrinth();
            }
            if ui.button("Search CurseForge").clicked() {
                self.search_curseforge();
            }
        });

        ui.separator();

        if self.is_searching {
            ui.spinner();
            ui.label("Searching...");
        } else {
            egui::ScrollArea::vertical().show(ui, |ui| {
                for result in &self.search_results {
                    let title = result
                        .get("title")
                        .and_then(Value::as_str)
                        .unwrap_or("Untitled");
                    let summary = result.get("summary").and_then(Value::as_str).unwrap_or("");
                    let source = result
                        .get("source")
                        .and_then(Value::as_str)
                        .unwrap_or("unknown");
                    let downloads = result.get("downloads").and_then(Value::as_u64).unwrap_or(0);
                    let loaders: Vec<String> = result
                        .get("loaders")
                        .and_then(Value::as_array)
                        .map(|arr| {
                            arr.iter()
                                .filter_map(Value::as_str)
                                .map(String::from)
                                .collect()
                        })
                        .unwrap_or_default();

                    egui::Frame::group(ui).show(ui, |ui| {
                        ui.horizontal(|ui| {
                            ui.vertical(|ui| {
                                ui.label(egui::RichText::new(title).heading());
                                ui.label(egui::RichText::new(summary).small());
                                ui.label(format!(
                                    "{} • {} • {}",
                                    source,
                                    format!("{:?}", loaders),
                                    format_number(downloads)
                                ));
                            });
                        });
                    });
                }
            });
        }
    }

    fn show_skins_page(&mut self, ui: &mut egui::Ui) {
        ui.heading("Skins");
        ui.label("Skin management coming soon.");
    }

    fn show_config_studio_page(&mut self, ui: &mut egui::Ui) {
        ui.heading("Config Studio");
        ui.label("Instance configuration editor coming soon.");
    }

    fn show_diagnostics_page(&mut self, ui: &mut egui::Ui) {
        ui.heading("Diagnostics");
        ui.label("Console Output:");

        egui::ScrollArea::vertical()
            .stick_to_bottom(true)
            .show(ui, |ui| {
                for line in &self.console_output {
                    ui.label(egui::RichText::new(line).monospace());
                }
            });

        if ui.button("Clear").clicked() {
            self.console_output.clear();
        }
    }

    fn show_settings_page(&mut self, ui: &mut egui::Ui) {
        ui.heading("Settings");

        let java_path = self
            .settings
            .get("javaPath")
            .and_then(Value::as_str)
            .unwrap_or("java");
        let mem_min = self
            .settings
            .get("memoryMbMin")
            .and_then(Value::as_u64)
            .unwrap_or(2048);
        let mem_max = self
            .settings
            .get("memoryMbMax")
            .and_then(Value::as_u64)
            .unwrap_or(4096);

        ui.label(format!("Java Path: {}", java_path));
        ui.label(format!("Memory: {} - {} MB", mem_min, mem_max));

        ui.separator();
        ui.heading("About");
        ui.label("Vesper Client v1.0.0");
        ui.label("Built with Rust and egui");
    }
}

fn format_number(n: u64) -> String {
    if n >= 1_000_000 {
        format!("{:.1}M", n as f64 / 1_000_000.0)
    } else if n >= 1_000 {
        format!("{:.1}K", n as f64 / 1_000.0)
    } else {
        n.to_string()
    }
}

fn main() {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1280.0, 800.0])
            .with_min_inner_size([800.0, 600.0]),
        ..Default::default()
    };

    let mut app = VesperApp::default();
    app.load_state();

    eframe::run_native("Vesper Client", options, Box::new(|_cc| Ok(Box::new(app))))
        .expect("Failed to run Vesper Client");
}
