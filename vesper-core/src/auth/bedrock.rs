use crate::auth::keys::{build_xbox_signature, DeviceKeys, IdentityKeys};
use crate::error::{CoreError, CoreResult};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};

const DEVICE_AUTH_URL: &str = "https://device.auth.xboxlive.com/device/authenticate";
const SISU_AUTH_URL: &str = "https://sisu.xboxlive.com/authorize";
const BEDROCK_AUTH_URL: &str = "https://multiplayer.minecraft.net/authentication";
const XSTS_AUTH_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const PLAYFAB_URL: &str = "https://20ca2.playfabapi.com/Client/LoginWithXbox";
const SESSION_URL: &str =
    "https://authorization.franchise.minecraft-services.net/api/v1.0/session/start";
const MP_SESSION_URL: &str =
    "https://authorization.franchise.minecraft-services.net/api/v1.0/multiplayer/session/start";

const BEDROCK_MULTIPLAYER_RP: &str = "https://multiplayer.minecraft.net/";
const BEDROCK_PLAYFAB_RP: &str = "https://b980a380.minecraft.playfabapi.com/";
const APP_ID: &str = "0000000048183522";
const PLAYFAB_TITLE_ID: &str = "20CA2";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BedrockProfile {
    pub xuid: String,
    pub display_name: String,
    pub title_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BedrockTokens {
    pub device_token: String,
    pub user_token: String,
    pub title_token: String,
    pub xsts_token: String,
    pub user_hash: String,
    pub cert_chain: Vec<String>,
    pub profile: BedrockProfile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BedrockAuthResult {
    pub tokens: BedrockTokens,
    pub ms_access_token: String,
    pub ms_refresh_token: String,
    pub ms_expires_at: u64,
    pub playfab_session_ticket: Option<String>,
    pub playfab_auth_header: Option<String>,
}

pub struct BedrockAuthManager {
    http_client: reqwest::Client,
}

impl BedrockAuthManager {
    pub fn new() -> Self {
        Self {
            http_client: reqwest::Client::new(),
        }
    }

    pub async fn device_auth(
        &self,
        device_keys: &DeviceKeys,
    ) -> CoreResult<(String, String)> {
        let body = serde_json::json!({
            "Properties": {
                "AuthMethod": "ProofOfPossession",
                "DeviceType": "Android",
                "Id": device_keys.device_id_braces(),
                "ProofKey": device_keys.proof_key_jwk(),
                "Version": "10"
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
        });

        let body_str = body.to_string();
        let signature = build_xbox_signature(
            device_keys,
            "POST",
            "/device/authenticate",
            "",
            &body_str,
        );

        let resp: serde_json::Value = self
            .http_client
            .post(DEVICE_AUTH_URL)
            .header("x-xbl-contract-version", "1")
            .header("Content-Type", "application/json")
            .header("Signature", &signature)
            .body(body_str.clone())
            .send()
            .await
            .map_err(|e| CoreError::Auth(format!("Device auth request failed: {e}")))?
            .json()
            .await
            .map_err(|e| CoreError::Auth(format!("Device auth parse failed: {e}")))?;

        let device_token = resp["Token"]
            .as_str()
            .ok_or_else(|| CoreError::Auth("Missing device token".into()))?
            .to_string();

        let device_id = resp["DisplayClaims"]["xdi"]["did"]
            .as_str()
            .unwrap_or(&device_keys.device_id)
            .to_string();

        tracing::info!("[bedrock] Device auth OK, device_id={device_id}");
        Ok((device_token, device_id))
    }

    pub async fn sisu_authorize(
        &self,
        device_keys: &DeviceKeys,
        ms_access_token: &str,
        device_token: &str,
    ) -> CoreResult<(String, String, String, String)> {
        let body = serde_json::json!({
            "AccessToken": format!("t={ms_access_token}"),
            "AppId": APP_ID,
            "DeviceToken": device_token,
            "Sandbox": "RETAIL",
            "UseModernGamertag": true,
            "SiteName": "user.auth.xboxlive.com",
            "RelyingParty": BEDROCK_MULTIPLAYER_RP,
            "ProofKey": device_keys.proof_key_jwk(),
        });

        let body_str = body.to_string();
        let signature = build_xbox_signature(
            device_keys,
            "POST",
            "/authorize",
            "",
            &body_str,
        );

        let resp: serde_json::Value = self
            .http_client
            .post(SISU_AUTH_URL)
            .header("x-xbl-contract-version", "1")
            .header("Content-Type", "application/json")
            .header("Signature", &signature)
            .body(body_str.clone())
            .send()
            .await
            .map_err(|e| CoreError::Auth(format!("SISU request failed: {e}")))?
            .json()
            .await
            .map_err(|e| CoreError::Auth(format!("SISU parse failed: {e}")))?;

        let xsts_token = resp["AuthorizationToken"]["Token"]
            .as_str()
            .ok_or_else(|| CoreError::Auth("Missing XSTS token in SISU".into()))?
            .to_string();

        let user_hash = resp["AuthorizationToken"]["DisplayClaims"]["xui"][0]["uhs"]
            .as_str()
            .ok_or_else(|| CoreError::Auth("Missing user hash in SISU".into()))?
            .to_string();

        let user_token = resp["UserToken"]["Token"]
            .as_str()
            .ok_or_else(|| CoreError::Auth("Missing user token in SISU".into()))?
            .to_string();

        let title_token = resp["TitleToken"]["Token"]
            .as_str()
            .ok_or_else(|| CoreError::Auth("Missing title token in SISU".into()))?
            .to_string();

        tracing::info!("[bedrock] SISU authorize OK, user_hash={user_hash}");
        Ok((xsts_token, user_hash, user_token, title_token))
    }

    pub async fn get_bedrock_cert_chain(
        &self,
        identity_keys: &IdentityKeys,
        xsts_token: &str,
        user_hash: &str,
    ) -> CoreResult<Vec<String>> {
        let body = serde_json::json!({
            "identityPublicKey": identity_keys.public_key_base64(),
        });

        let auth_header = format!("XBL3.0 x={user_hash};{xsts_token}");

        let resp: serde_json::Value = self
            .http_client
            .post(BEDROCK_AUTH_URL)
            .header("Content-Type", "application/json")
            .header("User-Agent", "MCPE/Android")
            .header("Client-Version", "1.21.50")
            .header("Authorization", &auth_header)
            .json(&body)
            .send()
            .await
            .map_err(|e| CoreError::Auth(format!("Bedrock cert request failed: {e}")))?
            .json()
            .await
            .map_err(|e| CoreError::Auth(format!("Bedrock cert parse failed: {e}")))?;

        let chain = resp["chain"]
            .as_array()
            .ok_or_else(|| CoreError::Auth("Missing cert chain".into()))?;

        let chain_strs: Vec<String> = chain
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect();

        if chain_strs.len() < 2 {
            return Err(CoreError::Auth(format!(
                "Expected 2 cert chain elements, got {}",
                chain_strs.len()
            )));
        }

        tracing::info!("[bedrock] Cert chain retrieved ({} elements)", chain_strs.len());
        Ok(chain_strs)
    }

    pub async fn playfab_login(
        &self,
        user_hash: &str,
        xsts_token: &str,
    ) -> CoreResult<(String, String)> {
        let auth_header = format!("XBL3.0 x={user_hash};{xsts_token}");

        let resp: serde_json::Value = self
            .http_client
            .post(XSTS_AUTH_URL)
            .header("Content-Type", "application/json")
            .header("x-xbl-contract-version", "1")
            .json(&serde_json::json!({
                "Properties": {
                    "SandboxId": "RETAIL",
                    "UserTokens": [xsts_token]
                },
                "RelyingParty": BEDROCK_PLAYFAB_RP,
                "TokenType": "JWT"
            }))
            .send()
            .await
            .map_err(|e| CoreError::Auth(format!("PlayFab XSTS request failed: {e}")))?
            .json()
            .await
            .map_err(|e| CoreError::Auth(format!("PlayFab XSTS parse failed: {e}")))?;

        let playfab_xsts_token = resp["Token"]
            .as_str()
            .ok_or_else(|| CoreError::Auth("Missing PlayFab XSTS token".into()))?
            .to_string();
        let playfab_uhs = resp["DisplayClaims"]["xui"][0]["uhs"]
            .as_str()
            .ok_or_else(|| CoreError::Auth("Missing PlayFab uhs".into()))?
            .to_string();

        let playfab_auth = format!("XBL3.0 x={playfab_uhs};{playfab_xsts_token}");

        let login_resp: serde_json::Value = self
            .http_client
            .post(PLAYFAB_URL)
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({
                "TitleId": PLAYFAB_TITLE_ID,
                "CreateAccount": true,
                "XboxToken": &playfab_auth,
            }))
            .send()
            .await
            .map_err(|e| CoreError::Auth(format!("PlayFab login request failed: {e}")))?
            .json()
            .await
            .map_err(|e| CoreError::Auth(format!("PlayFab login parse failed: {e}")))?;

        let session_ticket = login_resp["data"]["SessionTicket"]
            .as_str()
            .ok_or_else(|| CoreError::Auth("Missing PlayFab session ticket".into()))?
            .to_string();

        tracing::info!("[bedrock] PlayFab login OK");
        Ok((session_ticket, playfab_auth))
    }

    pub async fn session_start(
        &self,
        session_ticket: &str,
        device_id: &str,
    ) -> CoreResult<String> {
        let resp: serde_json::Value = self
            .http_client
            .post(SESSION_URL)
            .header("Content-Type", "application/json")
            .header("Authorization", session_ticket)
            .json(&serde_json::json!({
                "Device": {
                    "ApplicationType": "MinecraftPE",
                    "Capabilities": [],
                    "GameVersion": "1.21.50",
                    "Id": device_id,
                    "IsPreview": false,
                    "Memory": "1024",
                    "Platform": "Android",
                    "PlayFabTitleId": PLAYFAB_TITLE_ID,
                    "StorePlatform": "google.play.store",
                    "TreatmentOverrides": null,
                    "Type": "Android"
                },
                "User": {
                    "Language": "en",
                    "LanguageCode": "en-US",
                    "RegionCode": "US",
                    "Token": session_ticket,
                    "TokenType": "PlayFab"
                }
            }))
            .send()
            .await
            .map_err(|e| CoreError::Auth(format!("Session start request failed: {e}")))?
            .json()
            .await
            .map_err(|e| CoreError::Auth(format!("Session start parse failed: {e}")))?;

        let auth_header = resp["result"]["authorizationHeader"]
            .as_str()
            .ok_or_else(|| CoreError::Auth("Missing session authorization header".into()))?
            .to_string();

        tracing::info!("[bedrock] Session start OK");
        Ok(auth_header)
    }

    pub async fn multiplayer_session_start(
        &self,
        auth_header: &str,
        identity_keys: &IdentityKeys,
    ) -> CoreResult<String> {
        let resp: serde_json::Value = self
            .http_client
            .post(MP_SESSION_URL)
            .header("Content-Type", "application/json")
            .header("Authorization", auth_header)
            .json(&serde_json::json!({
                "publicKey": identity_keys.public_key_base64(),
            }))
            .send()
            .await
            .map_err(|e| CoreError::Auth(format!("MP session request failed: {e}")))?
            .json()
            .await
            .map_err(|e| CoreError::Auth(format!("MP session parse failed: {e}")))?;

        let signed_token = resp["result"]["signedToken"]
            .as_str()
            .ok_or_else(|| CoreError::Auth("Missing multiplayer signed token".into()))?
            .to_string();

        tracing::info!("[bedrock] Multiplayer session OK");
        Ok(signed_token)
    }

    pub async fn full_bedrock_auth(
        &self,
        ms_access_token: &str,
        device_keys: &DeviceKeys,
        identity_keys: &IdentityKeys,
    ) -> CoreResult<BedrockAuthResult> {
        tracing::info!("[bedrock] Starting full Bedrock auth chain...");

        let (device_token, _device_id) = self.device_auth(device_keys).await?;

        let (xsts_token, user_hash, user_token, title_token) =
            self.sisu_authorize(device_keys, ms_access_token, &device_token).await?;

        let cert_chain = self
            .get_bedrock_cert_chain(identity_keys, &xsts_token, &user_hash)
            .await?;

        let profile = self.extract_profile_from_cert(&cert_chain[1])?;

        let _playfab = self.playfab_login(&user_hash, &xsts_token).await;

        let tokens = BedrockTokens {
            device_token,
            user_token,
            title_token,
            xsts_token,
            user_hash,
            cert_chain,
            profile,
        };

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        tracing::info!("[bedrock] Full auth chain completed for {}", tokens.profile.display_name);

        Ok(BedrockAuthResult {
            tokens,
            ms_access_token: ms_access_token.to_string(),
            ms_refresh_token: String::new(),
            ms_expires_at: now + 3600,
            playfab_session_ticket: None,
            playfab_auth_header: None,
        })
    }

    fn extract_profile_from_cert(&self, jwt: &str) -> CoreResult<BedrockProfile> {
        let parts: Vec<&str> = jwt.split('.').collect();
        if parts.len() != 3 {
            return Err(CoreError::Auth("Invalid JWT format for cert".into()));
        }

        let payload_b64 = parts[1];
        let payload_bytes = URL_SAFE_NO_PAD
            .decode(payload_b64)
            .map_err(|e| CoreError::Auth(format!("Cert payload decode failed: {e}")))?;
        let payload: serde_json::Value = serde_json::from_slice(&payload_bytes)
            .map_err(|e| CoreError::Auth(format!("Cert payload parse failed: {e}")))?;

        let extra = &payload["extraData"];
        let xuid = extra["XUID"]
            .as_str()
            .unwrap_or("")
            .to_string();
        let display_name = extra["displayName"]
            .as_str()
            .unwrap_or("Unknown")
            .to_string();
        let title_id = extra["titleId"]
            .as_str()
            .unwrap_or("")
            .to_string();

        Ok(BedrockProfile {
            xuid,
            display_name,
            title_id,
        })
    }
}

pub fn launch_mcpelauncher(game_dir: &str) -> CoreResult<std::process::Child> {
    let cmd = std::process::Command::new("mcpelauncher-client")
        .arg("-dg")
        .arg(game_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| CoreError::Launch(format!("Failed to launch mcpelauncher-client: {e}")))?;

    tracing::info!("[bedrock] Launched mcpelauncher-client with game_dir={game_dir}");
    Ok(cmd)
}

pub fn find_mcpelauncher() -> Option<String> {
    let output = std::process::Command::new("which")
        .arg("mcpelauncher-client")
        .output()
        .ok()?;
    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Some(path);
        }
    }
    None
}
