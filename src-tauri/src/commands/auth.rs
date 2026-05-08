use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

const MS_CLIENT_ID: &str = "00000000402b5328";
const MS_DEVICE_CODE_URL: &str =
  "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const MS_TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";

pub struct AuthState {
  pub sessions: Mutex<HashMap<String, DeviceFlowSession>>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DeviceFlowSession {
  pub device_code: String,
  pub user_code: String,
  pub verification_uri: String,
  pub verification_uri_complete: Option<String>,
  pub expires_in_seconds: u64,
  pub interval_seconds: u64,
}

#[derive(Serialize)]
pub struct AuthStatus {
  pub profile: Option<Value>,
  pub login_available: bool,
  pub secure_storage_available: bool,
  pub microsoft_client_configured: bool,
  pub message: Option<String>,
}

#[derive(Serialize)]
pub struct DeviceLoginStart {
  pub session_id: String,
  pub user_code: String,
  pub verification_uri: String,
  pub verification_uri_complete: Option<String>,
  pub expires_in_seconds: u64,
  pub interval_seconds: u64,
  pub message: String,
}

#[derive(Serialize)]
pub struct DeviceLoginPoll {
  pub status: String,
  pub profile: Option<Value>,
  pub retry_after_seconds: Option<u64>,
  pub message: Option<String>,
}

#[derive(Deserialize)]
struct DeviceCodeResponse {
  device_code: String,
  user_code: String,
  verification_uri: String,
  #[serde(rename = "verification_uri_complete")]
  verification_uri_complete: Option<String>,
  expires_in: u64,
  interval: u64,
  message: String,
}

#[derive(Deserialize)]
struct TokenErrorResponse {
  error: String,
  error_description: Option<String>,
}

#[tauri::command]
pub async fn auth_get_status(
  state: State<'_, AuthState>,
) -> Result<AuthStatus, String> {
  let profile_json = serde_json::json!({
    "id": "microsoft-profile",
    "provider": "microsoft",
    "displayName": "Player",
    "offlineUsername": null,
    "authState": "signed_out"
  });

  Ok(AuthStatus {
    profile: Some(profile_json),
    login_available: true,
    secure_storage_available: true,
    microsoft_client_configured: true,
    message: None,
  })
}

#[tauri::command]
pub async fn auth_begin_microsoft_device_login(
  state: State<'_, AuthState>,
) -> Result<DeviceLoginStart, String> {
  let client = reqwest::Client::new();

  let params = [
    ("client_id", MS_CLIENT_ID),
    ("scope", "XboxLive.signin offline_access"),
  ];

  let response = client
    .post(MS_DEVICE_CODE_URL)
    .form(&params)
    .send()
    .await
    .map_err(|e| format!("Device code request failed: {}", e))?;

  if !response.status().is_success() {
    let text = response.text().await.unwrap_or_default();
    return Err(format!("Device code endpoint returned {}: {}", response.status(), text));
  }

  let device: DeviceCodeResponse = response
    .json()
    .await
    .map_err(|e| format!("Failed to parse device code response: {}", e))?;

  let session_id = uuid::Uuid::new_v4().to_string();
  let session = DeviceFlowSession {
    device_code: device.device_code,
    user_code: device.user_code.clone(),
    verification_uri: device.verification_uri.clone(),
    verification_uri_complete: device.verification_uri_complete.clone(),
    expires_in_seconds: device.expires_in,
    interval_seconds: device.interval,
  };

  let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
  sessions.insert(session_id.clone(), session);

  Ok(DeviceLoginStart {
    session_id,
    user_code: device.user_code,
    verification_uri: device.verification_uri,
    verification_uri_complete: device.verification_uri_complete,
    expires_in_seconds: device.expires_in,
    interval_seconds: device.interval,
    message: device.message,
  })
}

#[tauri::command]
pub async fn auth_poll_microsoft_device_login(
  session_id: String,
  state: State<'_, AuthState>,
) -> Result<DeviceLoginPoll, String> {
  let session = {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    sessions.get(&session_id).cloned()
  };

  let session = match session {
    Some(s) => s,
    None => {
      return Ok(DeviceLoginPoll {
        status: "error".to_string(),
        profile: None,
        retry_after_seconds: None,
        message: Some("Session not found or expired".to_string()),
      });
    }
  };

  let client = reqwest::Client::new();
  let params = [
    ("client_id", MS_CLIENT_ID),
    ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
    ("device_code", &session.device_code),
  ];

  let response = client
    .post(MS_TOKEN_URL)
    .form(&params)
    .send()
    .await
    .map_err(|e| format!("Token poll request failed: {}", e))?;

  if response.status().is_success() {
    let token_data: Value = response.json().await.map_err(|e| e.to_string())?;

    let access_token = token_data["access_token"]
      .as_str()
      .unwrap_or("")
      .to_string();

    let display_name = fetch_display_name(&client, &access_token).await;

    {
      let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
      sessions.remove(&session_id);
    }

    let profile = serde_json::json!({
      "id": "microsoft-profile",
      "provider": "microsoft",
      "displayName": display_name,
      "offlineUsername": null,
      "authState": "signed_in"
    });

    return Ok(DeviceLoginPoll {
      status: "complete".to_string(),
      profile: Some(profile),
      retry_after_seconds: None,
      message: Some("Login complete".to_string()),
    });
  }

  let status_code = response.status();
  let error_body: TokenErrorResponse = response.json().await.unwrap_or(TokenErrorResponse {
    error: "unknown".to_string(),
    error_description: None,
  });

  match error_body.error.as_str() {
    "authorization_pending" => Ok(DeviceLoginPoll {
      status: "pending".to_string(),
      profile: None,
      retry_after_seconds: session.interval_seconds.into(),
      message: None,
    }),
    "slow_down" => Ok(DeviceLoginPoll {
      status: "pending".to_string(),
      profile: None,
      retry_after_seconds: Some(session.interval_seconds.saturating_add(5)),
      message: Some("Polling too fast, slowing down".to_string()),
    }),
    "expired_token" => {
      let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
      sessions.remove(&session_id);

      Ok(DeviceLoginPoll {
        status: "error".to_string(),
        profile: None,
        retry_after_seconds: None,
        message: Some("Login timed out. Please try again.".to_string()),
      })
    }
    _ => Ok(DeviceLoginPoll {
      status: "error".to_string(),
      profile: None,
      retry_after_seconds: None,
      message: Some(error_body.error_description.unwrap_or_else(|| {
        format!("Authentication error: {}", error_body.error)
      })),
    }),
  }
}

async fn fetch_display_name(client: &reqwest::Client, access_token: &str) -> String {
  match client
    .get("https://graph.microsoft.com/v1.0/me")
    .bearer_auth(access_token)
    .send()
    .await
  {
    Ok(resp) if resp.status().is_success() => {
      match resp.json::<Value>().await {
        Ok(user_data) => user_data["displayName"]
          .as_str()
          .unwrap_or("Player")
          .to_string(),
        Err(_) => "Player".to_string(),
      }
    }
    _ => "Player".to_string(),
  }
}

#[tauri::command]
pub async fn auth_logout_microsoft(
  state: State<'_, AuthState>,
) -> Result<AuthStatus, String> {
  let profile_json = serde_json::json!({
    "id": "microsoft-profile",
    "provider": "microsoft",
    "displayName": "Player",
    "offlineUsername": null,
    "authState": "signed_out"
  });

  Ok(AuthStatus {
    profile: Some(profile_json),
    login_available: true,
    secure_storage_available: true,
    microsoft_client_configured: true,
    message: Some("Logged out".to_string()),
  })
}
