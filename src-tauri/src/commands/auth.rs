use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::entra_config::EntraConfig;
use crate::secure_storage;

const KEYRING_KEY_ACCESS_TOKEN: &str = "ms-access-token";
const KEYRING_KEY_REFRESH_TOKEN: &str = "ms-refresh-token";
const KEYRING_KEY_TOKEN_EXPIRY: &str = "ms-token-expiry";
const KEYRING_KEY_USER_PROFILE: &str = "ms-user-profile";

const GRAPH_ME_URL: &str = "https://graph.microsoft.com/v1.0/me";

/// Stores active device code flow sessions in memory.
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicrosoftProfile {
  pub id: String,
  #[serde(rename = "displayName")]
  pub display_name: String,
  pub email: Option<String>,
  #[serde(rename = "tenantId")]
  pub tenant_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredTokenSet {
  pub access_token: String,
  pub refresh_token: Option<String>,
  pub expires_at: u64,
  pub scope: String,
  pub id_token: Option<String>,
  pub token_type: String,
  pub profile: Option<MicrosoftProfile>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
  pub is_logged_in: bool,
  pub profile: Option<MicrosoftProfile>,
  pub token_info: Option<TokenInfo>,
  pub secure_storage_available: bool,
  pub message: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenInfo {
  pub expires_at: u64,
  pub scopes: String,
  pub is_expired: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
pub struct DeviceLoginPoll {
  pub status: String,
  pub profile: Option<MicrosoftProfile>,
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
struct TokenSuccessResponse {
  access_token: String,
  refresh_token: Option<String>,
  id_token: Option<String>,
  expires_in: u64,
  scope: Option<String>,
  token_type: String,
}

#[derive(Deserialize)]
struct TokenErrorResponse {
  error: String,
  error_description: Option<String>,
}

#[derive(Deserialize)]
struct GraphUserResponse {
  id: String,
  #[serde(rename = "displayName")]
  display_name: String,
  #[serde(rename = "userPrincipalName")]
  user_principal_name: Option<String>,
  mail: Option<String>,
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Initiate a Device Code Flow login. Returns the code the user must enter
/// at the Microsoft login page. The system browser is opened automatically.
#[tauri::command]
pub async fn auth_begin_microsoft_device_login(
  state: State<'_, AuthState>,
  config: State<'_, EntraConfig>,
) -> Result<DeviceLoginStart, String> {
  let start = request_device_code(&config).await?;

  let session_id = uuid::Uuid::new_v4().to_string();
  let session = DeviceFlowSession {
    device_code: start.device_code.clone(),
    user_code: start.user_code.clone(),
    verification_uri: start.verification_uri.clone(),
    verification_uri_complete: start.verification_uri_complete.clone(),
    expires_in_seconds: start.expires_in,
    interval_seconds: start.interval,
  };

  {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    sessions.insert(session_id.clone(), session);
  }

  // Open the browser to the complete verification URL
  let url = start
    .verification_uri_complete
    .as_deref()
    .unwrap_or(&start.verification_uri);
  let _ = open::that(url);

  Ok(DeviceLoginStart {
    session_id,
    user_code: start.user_code,
    verification_uri: start.verification_uri,
    verification_uri_complete: start.verification_uri_complete,
    expires_in_seconds: start.expires_in,
    interval_seconds: start.interval,
    message: start.message,
  })
}

/// Convenience command: wraps begin + poll loop. Returns immediately after
/// starting the flow; the frontend should call poll on the returned session.
#[tauri::command]
pub async fn microsoft_login(
  state: State<'_, AuthState>,
  config: State<'_, EntraConfig>,
) -> Result<DeviceLoginStart, String> {
  auth_begin_microsoft_device_login(state, config).await
}

/// Poll the token endpoint to check whether the user has completed the
/// device login on Microsoft's website.
#[tauri::command]
pub async fn auth_poll_microsoft_device_login(
  session_id: String,
  state: State<'_, AuthState>,
  config: State<'_, EntraConfig>,
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
        message: Some("Session not found or expired. Please start login again.".to_string()),
      });
    }
  };

  let client = reqwest::Client::new();
  let params = [
    ("client_id", config.client_id.as_str()),
    ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
    ("device_code", &session.device_code),
  ];

  let response = client
    .post(&config.token_url)
    .form(&params)
    .send()
    .await
    .map_err(|e| format!("Token poll request failed: {}", e))?;

  if response.status().is_success() {
    let token_resp: TokenSuccessResponse = response.json().await.map_err(|e| e.to_string())?;

    // Fetch user profile from Microsoft Graph
    let profile = fetch_microsoft_profile(&client, &token_resp.access_token).await;

    // Calculate expiry timestamp (current_unix + expires_in - safety_margin)
    let now = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .unwrap_or_default()
      .as_secs();
    let expires_at = now + token_resp.expires_in.saturating_sub(60); // 1-minute safety margin

    let token_set = StoredTokenSet {
      access_token: token_resp.access_token,
      refresh_token: token_resp.refresh_token,
      expires_at,
      scope: token_resp.scope.unwrap_or_else(|| EntraConfig::scope_string()),
      id_token: token_resp.id_token,
      token_type: token_resp.token_type,
      profile: profile.clone(),
    };

    // Persist tokens to the OS keyring
    persist_token_set(&token_set);

    // Remove session
    {
      let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
      sessions.remove(&session_id);
    }

    return Ok(DeviceLoginPoll {
      status: "complete".to_string(),
      profile,
      retry_after_seconds: None,
      message: Some("Login complete".to_string()),
    });
  }

  // Handle pending/error responses from the token endpoint
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
      message: Some("Polling too fast, slowing down.".to_string()),
    }),
    "expired_token" => {
      let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
      sessions.remove(&session_id);

      Ok(DeviceLoginPoll {
        status: "error".to_string(),
        profile: None,
        retry_after_seconds: None,
        message: Some(
          "Login timed out. The device code expired. Please try again.".to_string(),
        ),
      })
    }
    _ => Ok(DeviceLoginPoll {
      status: "error".to_string(),
      profile: None,
      retry_after_seconds: None,
      message: Some(
        error_body
          .error_description
          .unwrap_or_else(|| format!("Authentication error: {}", error_body.error)),
      ),
    }),
  }
}

/// Return the current authentication status, loading from secure storage.
#[tauri::command]
pub async fn auth_get_status() -> Result<AuthStatus, String> {
  let token_set = load_token_set_from_storage();

  match token_set {
    Some(tokens) => {
      let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
      let is_expired = now >= tokens.expires_at;

      Ok(AuthStatus {
        is_logged_in: !is_expired,
        profile: tokens.profile.clone(),
        token_info: Some(TokenInfo {
          expires_at: tokens.expires_at,
          scopes: tokens.scope.clone(),
          is_expired,
        }),
        secure_storage_available: true,
        message: if is_expired {
          Some("Token is expired. Attempting refresh or re-login.".to_string())
        } else {
          None
        },
      })
    }
    None => Ok(AuthStatus {
      is_logged_in: false,
      profile: None,
      token_info: None,
      secure_storage_available: true,
      message: Some("No stored session found.".to_string()),
    }),
  }
}

/// Refresh the access token using the stored refresh token.
#[tauri::command]
pub async fn auth_refresh_token(
  config: State<'_, EntraConfig>,
) -> Result<AuthStatus, String> {
  let stored = load_token_set_from_storage().ok_or_else(|| {
    "No stored tokens found. Please login first.".to_string()
  })?;

  let refresh_token = stored
    .refresh_token
    .as_deref()
    .ok_or_else(|| "No refresh token available. Please re-authenticate.".to_string())?;

  let client = reqwest::Client::new();
  let params = [
    ("client_id", config.client_id.as_str()),
    ("grant_type", "refresh_token"),
    ("refresh_token", refresh_token),
    ("scope", &EntraConfig::scope_string()),
  ];

  let response = client
    .post(&config.token_url)
    .form(&params)
    .send()
    .await
    .map_err(|e| format!("Token refresh request failed: {}", e))?;

  if !response.status().is_success() {
    let error_body: TokenErrorResponse = response.json().await.unwrap_or(TokenErrorResponse {
      error: "unknown".to_string(),
      error_description: None,
    });

    // If refresh fails (e.g. invalid_grant), clear stored tokens
    if error_body.error == "invalid_grant" {
      clear_stored_tokens();
      return Ok(AuthStatus {
        is_logged_in: false,
        profile: None,
        token_info: None,
        secure_storage_available: true,
        message: Some(
          "Session expired. Please login again.".to_string(),
        ),
      });
    }

    return Err(format!(
      "Token refresh failed: {} - {}",
      error_body.error,
      error_body.error_description.unwrap_or_default()
    ));
  }

  let token_resp: TokenSuccessResponse =
    response.json().await.map_err(|e| e.to_string())?;

  let profile = fetch_microsoft_profile(&client, &token_resp.access_token).await;

  let now = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default()
    .as_secs();
  let expires_at = now + token_resp.expires_in.saturating_sub(60);

  let token_set = StoredTokenSet {
    access_token: token_resp.access_token,
    refresh_token: token_resp.refresh_token.or(stored.refresh_token),
    expires_at,
    scope: token_resp.scope.unwrap_or_else(|| EntraConfig::scope_string()),
    id_token: token_resp.id_token.or(stored.id_token),
    token_type: token_resp.token_type,
    profile: profile.clone(),
  };

  persist_token_set(&token_set);

  Ok(AuthStatus {
    is_logged_in: true,
    profile,
    token_info: Some(TokenInfo {
      expires_at,
      scopes: token_set.scope.clone(),
      is_expired: false,
    }),
    secure_storage_available: true,
    message: None,
  })
}

/// Logout: clear secure storage and attempt token revocation (best-effort).
#[tauri::command]
pub async fn auth_logout_microsoft(
  config: State<'_, EntraConfig>,
) -> Result<AuthStatus, String> {
  // Attempt to revoke the refresh token (best-effort; never fail logout)
  if let Ok(Some(tokens)) = load_token_set() {
    if let Some(refresh_token) = tokens.refresh_token {
      let client = reqwest::Client::new();
      let revoke_url = format!(
        "{}/oauth2/v2.0/revoke",
        config.authority.trim_end_matches('/')
      );
      let _ = client
        .post(&revoke_url)
        .form(&[
          ("client_id", config.client_id.as_str()),
          ("token_type_hint", "refresh_token"),
          ("token", &refresh_token),
        ])
        .send()
        .await;
    }
  }

  clear_stored_tokens();

  Ok(AuthStatus {
    is_logged_in: false,
    profile: None,
    token_info: None,
    secure_storage_available: true,
    message: Some("Logged out successfully.".to_string()),
  })
}

/// Return the stored access token for internal use (e.g. Xbox Live auth).
/// This is NOT a Tauri command — called from other Rust modules.
pub fn get_stored_access_token() -> Option<String> {
  load_token_set().ok().flatten().map(|t| t.access_token)
}

/// Return the stored profile.
pub fn get_stored_profile() -> Option<MicrosoftProfile> {
  load_token_set().ok().flatten().and_then(|t| t.profile)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async fn request_device_code(config: &EntraConfig) -> Result<DeviceCodeResponse, String> {
  let client = reqwest::Client::new();

  let params = [
    ("client_id", config.client_id.as_str()),
    ("scope", &EntraConfig::scope_string()),
  ];

  let response = client
    .post(&config.device_code_url)
    .form(&params)
    .send()
    .await
    .map_err(|e| format!("Device code request failed: {}", e))?;

  if !response.status().is_success() {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    return Err(format!(
      "Device code endpoint returned {}: {}",
      status, body
    ));
  }

  response
    .json::<DeviceCodeResponse>()
    .await
    .map_err(|e| format!("Failed to parse device code response: {}", e))
}

async fn fetch_microsoft_profile(
  client: &reqwest::Client,
  access_token: &str,
) -> Option<MicrosoftProfile> {
  let resp = client
    .get(GRAPH_ME_URL)
    .bearer_auth(access_token)
    .send()
    .await
    .ok()?;

  if !resp.status().is_success() {
    return None;
  }

  let user: GraphUserResponse = resp.json().await.ok()?;

  // Extract tenant ID from the id_token if available, or from the access token
  let tenant_id = None;

  Some(MicrosoftProfile {
    id: user.id,
    display_name: user.display_name,
    email: user.mail.or(user.user_principal_name),
    tenant_id,
  })
}

// ---------------------------------------------------------------------------
// Secure storage helpers
// ---------------------------------------------------------------------------

fn persist_token_set(tokens: &StoredTokenSet) {
  let _ = secure_storage::write_secret(KEYRING_KEY_ACCESS_TOKEN, &tokens.access_token);
  if let Some(ref rt) = tokens.refresh_token {
    let _ = secure_storage::write_secret(KEYRING_KEY_REFRESH_TOKEN, rt);
  }
  let _ = secure_storage::write_secret(
    KEYRING_KEY_TOKEN_EXPIRY,
    &tokens.expires_at.to_string(),
  );
  if let Some(ref profile) = tokens.profile {
    if let Ok(json) = serde_json::to_string(profile) {
      let _ = secure_storage::write_secret(KEYRING_KEY_USER_PROFILE, &json);
    }
  }
}

fn load_token_set() -> Result<Option<StoredTokenSet>, String> {
  let access_token = secure_storage::read_secret(KEYRING_KEY_ACCESS_TOKEN)?;
  let access_token = match access_token {
    Some(t) => t,
    None => return Ok(None),
  };

  let refresh_token = secure_storage::read_secret(KEYRING_KEY_REFRESH_TOKEN)?;
  let expires_at = secure_storage::read_secret(KEYRING_KEY_TOKEN_EXPIRY)?
    .and_then(|s| s.parse::<u64>().ok())
    .unwrap_or(0);

  let profile = secure_storage::read_secret(KEYRING_KEY_USER_PROFILE)?
    .and_then(|s| serde_json::from_str::<MicrosoftProfile>(&s).ok());

  Ok(Some(StoredTokenSet {
    access_token,
    refresh_token,
    expires_at,
    scope: EntraConfig::scope_string(),
    id_token: None,
    token_type: "Bearer".to_string(),
    profile,
  }))
}

fn load_token_set_from_storage() -> Option<StoredTokenSet> {
  load_token_set().ok().flatten()
}

fn clear_stored_tokens() {
  let _ = secure_storage::delete_secret(KEYRING_KEY_ACCESS_TOKEN);
  let _ = secure_storage::delete_secret(KEYRING_KEY_REFRESH_TOKEN);
  let _ = secure_storage::delete_secret(KEYRING_KEY_TOKEN_EXPIRY);
  let _ = secure_storage::delete_secret(KEYRING_KEY_USER_PROFILE);
}
