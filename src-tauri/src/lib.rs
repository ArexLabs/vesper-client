#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod secure_storage;

use chrono::{Duration, Utc};
use directories::ProjectDirs;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    process::Command,
    time::Duration as StdDuration,
};
use tauri::Manager;
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppState {
    pub version: i32,
    pub global_defaults: Value,
    pub presets: Vec<Value>,
    pub instances: Vec<Value>,
    pub profiles: Vec<Value>,
    pub ui: Value,
    pub settings_snapshots: Vec<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthStatusResponse {
    pub profile: Option<Value>,
    pub login_available: bool,
    pub secure_storage_available: bool,
    pub microsoft_client_configured: bool,
    pub message: Option<String>,
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

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .timeout(StdDuration::from_secs(20))
        .user_agent("VesperClient/1.0.0")
        .build()
        .map_err(|e| e.to_string())
}

fn microsoft_client_id() -> Result<String, String> {
    std::env::var("VESPER_MS_CLIENT_ID")
        .ok()
        .or_else(|| std::env::var("MICROSOFT_CLIENT_ID").ok())
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .ok_or_else(|| "Microsoft OAuth client ID not configured".to_string())
}

#[derive(Debug, Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: Option<u64>,
    message: String,
}

#[derive(Debug, Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OAuthErrorResponse {
    error: String,
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

#[tauri::command]
fn load_app_state() -> Result<Value, String> {
    read_state_value()?.unwrap_or_else(minimal_state_object)
}

#[tauri::command]
fn save_app_state(state: Value) -> Result<(), String> {
    write_state_value(&state)
}

#[tauri::command]
fn get_auth_status() -> AuthStatusResponse {
    let secure_probe = secure_storage::read_secret(MS_REFRESH_TOKEN_KEY);
    let secure_storage_available = secure_probe.is_ok();
    let refresh_token_present = matches!(secure_probe, Ok(Some(_)));
    let microsoft_client_configured = microsoft_client_id().is_ok();

    let profile = read_state_value()
        .ok()
        .flatten()
        .and_then(|state| {
            state.get("profiles")?.as_array()?.iter().find(|p| {
                p.get("provider") == Some(&Value::String("microsoft".to_string()))
            }).cloned()
        });

    let message = if !microsoft_client_configured {
        Some("Set VESPER_MS_CLIENT_ID to enable Microsoft login".to_string())
    } else if !secure_storage_available {
        Some("OS secure storage unavailable".to_string())
    } else {
        None
    };

    AuthStatusResponse {
        profile,
        login_available: microsoft_client_configured && secure_storage_available,
        secure_storage_available,
        microsoft_client_configured,
        message,
    }
}

#[tauri::command]
fn begin_microsoft_device_login() -> Result<DeviceCodeResponse, String> {
    let client = http_client()?;
    let client_id = microsoft_client_id()?;
    let response = client
        .post(MS_DEVICE_CODE_URL)
        .form(&[("client_id", client_id.as_str()), ("scope", MS_SCOPE)])
        .send()
        .map_err(|e| format!("Device code request failed: {e}"))?;

    let status = response.status();
    let body = response.text().map_err(|e| format!("Read failed: {e}"))?;
    if !status.is_success() {
        return Err(format!("Request failed ({status}): {body}"));
    }
    serde_json::from_str(&body).map_err(|e| format!("Parse failed: {e}"))
}

#[tauri::command]
fn poll_microsoft_device_login(device_code: String, expires_at: String) -> Result<Value, String> {
    let expires = chrono::DateTime::parse_from_rfc3339(&expires_at)
        .map_err(|e| e.to_string())?
        .with_timezone(&Utc);
    
    if Utc::now() > expires {
        return Err("Session expired".to_string());
    }

    let client = http_client().map_err(|e| e.to_string())?;
    let client_id = microsoft_client_id().map_err(|e| e.to_string())?;

    let response = client
        .post(MS_TOKEN_URL)
        .form(&[
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ("client_id", client_id.as_str()),
            ("device_code", &device_code),
        ])
        .send()
        .map_err(|e| e.to_string())?;

    let status = response.status();
    let body = response.text().map_err(|e| e.to_string())?;

    if status.is_success() {
        let tokens: OAuthTokenResponse = serde_json::from_str(&body).map_err(|e| e.to_string())?;
        let refresh_token = tokens.refresh_token.ok_or_else(|| "No refresh token".to_string())?;
        
        secure_storage::write_secret(MS_REFRESH_TOKEN_KEY, &refresh_token).map_err(|e| e.to_string())?;
        
        // Get Minecraft profile
        let mc_profile = resolve_minecraft_profile_from_ms_access_token(&tokens.access_token)?;
        
        let profile = json!({
            "id": "profile-microsoft-primary",
            "provider": "microsoft",
            "displayName": mc_profile.name,
            "minecraftUuid": mc_profile.id,
            "minecraftUsername": mc_profile.name,
            "authState": "signed_in",
        });
        
        // Update state
        let mut state = read_state_value()?.unwrap_or_else(minimal_state_object);
        if state.get("profiles").and_then(Value::as_array).is_none() {
            state["profiles"] = Value::Array(vec![]);
        }
        if let Some(profiles) = state.get_mut("profiles").and_then(Value::as_array_mut) {
            let existing = profiles.iter().position(|p| p.get("provider") == Some(&Value::String("microsoft".to_string())));
            if let Some(idx) = existing {
                profiles[idx] = profile.clone();
            } else {
                profiles.insert(0, profile.clone());
            }
        }
        write_state_value(&state)?;

        Ok(json!({
            "status": "complete",
            "profile": profile,
            "message": format!("Signed in as {}", mc_profile.name)
        }))
    } else {
        let err: OAuthErrorResponse = serde_json::from_str(&body).unwrap_or(OAuthErrorResponse {
            error: "oauth_error".to_string(),
            error_description: Some(body),
        });
        
        match err.error.as_str() {
            "authorization_pending" | "slow_down" => Ok(json!({
                "status": "pending"
            })),
            _ => Err(err.error_description.unwrap_or(err.error))
        }
    }
}

fn resolve_minecraft_profile_from_ms_access_token(ms_access_token: &str) -> Result<MinecraftProfileResponse, String> {
    // Xbox Live auth
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
        .map_err(|e| format!("Xbox auth failed: {e}"))?;

    let body = response.text().map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Xbox auth failed: {}", body));
    }
    
    let xbl: XboxAuthResponse = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    let uhs = xbl.display_claims.xui.first().ok_or("No user hash")?.uhs.clone();

    // XSTS
    let response = client
        .post(XSTS_AUTH_URL)
        .header("x-xbl-contract-version", "1")
        .json(&json!({
            "Properties": {
                "SandboxId": "RETAIL",
                "UserTokens": [xbl.token],
            },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT",
        }))
        .send()
        .map_err(|e| format!("XSTS failed: {e}"))?;

    let body = response.text().map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("XSTS failed: {}", body));
    }
    
    let xsts: XstsAuthResponse = serde_json::from_str(&body).map_err(|e| e.to_string())?;

    // Minecraft login
    let response = client
        .post(MC_LOGIN_URL)
        .json(&json!({
            "identityToken": format!("XBL3.0 x={};{}", uhs, xsts.token),
        }))
        .send()
        .map_err(|e| format!("MC login failed: {e}"))?;

    let body = response.text().map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("MC login failed: {}", body));
    }
    
    let mc_token: MinecraftLoginResponse = serde_json::from_str(&body).map_err(|e| e.to_string())?;

    // Entitlements
    let response = client
        .get(MC_ENTITLEMENTS_URL)
        .bearer_auth(&mc_token.access_token)
        .send()
        .map_err(|e| format!("Entitlements failed: {e}"))?;

    let body = response.text().map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Entitlements failed: {}", body));
    }
    
    let ents: MinecraftEntitlementsResponse = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    if ents.items.is_empty() {
        return Err("No Minecraft entitlement".to_string());
    }

    // Profile
    let response = client
        .get(MC_PROFILE_URL)
        .bearer_auth(&mc_token.access_token)
        .send()
        .map_err(|e| format!("Profile failed: {e}"))?;

    let body = response.text().map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Profile failed: {}", body));
    }
    
    serde_json::from_str(&body).map_err(|e| e.to_string())
}

#[tauri::command]
fn logout_microsoft() -> Result<AuthStatusResponse, String> {
    let _ = secure_storage::delete_secret(MS_REFRESH_TOKEN_KEY);
    
    let mut state = read_state_value()?.unwrap_or_else(minimal_state_object);
    if let Some(profiles) = state.get_mut("profiles").and_then(Value::as_array_mut) {
        for profile in profiles.iter_mut() {
            if profile.get("provider") == Some(&Value::String("microsoft".to_string())) {
                profile["authState"] = Value::String("signed_out".to_string());
            }
        }
    }
    write_state_value(&state)?;
    
    get_auth_status()
}

#[tauri::command]
fn create_instance(name: String, mc_version: String, loader: String) -> Result<Value, String> {
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

    let mut state = read_state_value()?.unwrap_or_else(minimal_state_object);
    if state.get("instances").and_then(Value::as_array).is_none() {
        state["instances"] = Value::Array(vec![]);
    }
    if let Some(instances) = state.get_mut("instances").and_then(Value::as_array_mut) {
        instances.insert(0, instance.clone());
    }

    write_state_value(&state)?;
    Ok(instance)
}

#[tauri::command]
fn launch_instance(instance_id: String) -> Result<Value, String> {
    let state = read_state_value()?.unwrap_or_else(minimal_state_object);
    let instance = state.get("instances")
        .and_then(Value::as_array)
        .and_then(|arr| arr.iter().find(|i| i.get("id") == Some(&Value::String(instance_id.clone()))))
        .cloned()
        .ok_or("Instance not found")?;

    let global_defaults = state.get("globalDefaults").cloned().unwrap_or_else(default_launcher_config);
    
    let java_path = instance.get("javaPath")
        .or_else(|| global_defaults.get("javaPath"))
        .and_then(Value::as_str)
        .unwrap_or("java");
    
    let memory_mb_min = instance.get("memoryMbMin")
        .or_else(|| global_defaults.get("memoryMbMin"))
        .and_then(Value::as_u64)
        .unwrap_or(2048) as u32;
    
    let memory_mb_max = instance.get("memoryMbMax")
        .or_else(|| global_defaults.get("memoryMbMax"))
        .and_then(Value::as_u64)
        .unwrap_or(4096) as u32;

    let window = instance.get("window")
        .or_else(|| global_defaults.get("window"))
        .cloned()
        .unwrap_or(json!({"width": 1280, "height": 800, "fullscreen": false}));

    // Note: Actual game launch would require proper Minecraft installation handling
    // This opens the system default launcher for demonstration
    
    #[cfg(target_os = "windows")]
    let _ = Command::new("cmd").args(["/C", "start", "", "minecraft://"]).status();
    #[cfg(target_os = "linux")]
    let _ = Command::new("xdg-open").arg("minecraft://").status();
    #[cfg(target_os = "macos")]
    let _ = Command::new("open").arg("minecraft://").status();

    Ok(json!({
        "instanceId": instance_id,
        "javaPath": java_path,
        "memoryMbMin": memory_mb_min,
        "memoryMbMax": memory_mb_max,
        "window": window,
        "launched": true
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            load_app_state,
            save_app_state,
            get_auth_status,
            begin_microsoft_device_login,
            poll_microsoft_device_login,
            logout_microsoft,
            create_instance,
            launch_instance,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}