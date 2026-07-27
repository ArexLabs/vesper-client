use crate::auth::models::StoredTokens;
use crate::error::{CoreError, CoreResult};
use oauth2::basic::{
    BasicClient, BasicErrorResponse, BasicRevocationErrorResponse,
    BasicTokenIntrospectionResponse, BasicTokenResponse,
};
use oauth2::{
    AuthorizationCode, AuthUrl, ClientId, CsrfToken, DeviceAuthorizationUrl, EndpointNotSet,
    EndpointSet, PkceCodeChallenge, RefreshToken, RedirectUrl, Scope, StandardRevocableToken,
    TokenResponse, TokenUrl,
};
use std::collections::HashMap;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

const MS_AUTH_URL: &str =
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const MS_DEVICE_CODE_URL: &str =
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const MS_TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const XBOXLIVE_AUTH_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_LOGIN_URL: &str = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";

type OauthClient = oauth2::Client<
    BasicErrorResponse,
    BasicTokenResponse,
    BasicTokenIntrospectionResponse,
    StandardRevocableToken,
    BasicRevocationErrorResponse,
    EndpointSet,
    EndpointSet,
    EndpointNotSet,
    EndpointNotSet,
    EndpointSet,
>;

pub struct AuthManager {
    http_client: reqwest::Client,
    oauth_client: OauthClient,
    client_id: String,
}

impl AuthManager {
    pub fn new(client_id: String) -> CoreResult<Self> {
        let http_client = reqwest::Client::new();

        let auth_url =
            AuthUrl::new(MS_AUTH_URL.to_string()).map_err(|e| CoreError::Auth(e.to_string()))?;
        let device_auth_url = DeviceAuthorizationUrl::new(MS_DEVICE_CODE_URL.to_string())
            .map_err(|e| CoreError::Auth(e.to_string()))?;
        let token_url =
            TokenUrl::new(MS_TOKEN_URL.to_string()).map_err(|e| CoreError::Auth(e.to_string()))?;

        let oauth_client: OauthClient = BasicClient::new(ClientId::new(client_id.clone()))
            .set_auth_uri(auth_url)
            .set_device_authorization_url(device_auth_url)
            .set_token_uri(token_url);

        Ok(Self {
            http_client,
            oauth_client,
            client_id,
        })
    }

    pub fn client_id(&self) -> &str {
        &self.client_id
    }

    pub async fn start_browser_login(&self) -> CoreResult<(oauth2::url::Url, String, String, u16)> {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| CoreError::Auth(format!("Failed to bind local server: {e}")))?;
        let port = listener.local_addr().unwrap().port();
        drop(listener);

        let redirect_uri = format!("http://localhost:{port}");
        let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

        let client = BasicClient::new(ClientId::new(self.client_id.clone()))
            .set_auth_uri(
                AuthUrl::new(MS_AUTH_URL.to_string())
                    .map_err(|e| CoreError::Auth(e.to_string()))?,
            )
            .set_token_uri(
                TokenUrl::new(MS_TOKEN_URL.to_string())
                    .map_err(|e| CoreError::Auth(e.to_string()))?,
            )
            .set_redirect_uri(
                RedirectUrl::new(redirect_uri)
                    .map_err(|e| CoreError::Auth(e.to_string()))?,
            );

        let (auth_url, csrf_token) = client
            .authorize_url(CsrfToken::new_random)
            .add_scope(Scope::new("XboxLive.SignIn".into()))
            .add_scope(Scope::new("XboxLive.offline_access".into()))
            .set_pkce_challenge(pkce_challenge)
            .add_extra_param("prompt", "select_account")
            .url();

        Ok((
            auth_url,
            csrf_token.secret().clone(),
            pkce_verifier.secret().clone(),
            port,
        ))
    }

    pub async fn complete_browser_login(
        &self,
        port: u16,
        pkce_verifier_secret: &str,
        expected_state: &str,
    ) -> CoreResult<StoredTokens> {
        tracing::info!("Binding callback server on port {port}");
        let listener = TcpListener::bind(format!("127.0.0.1:{port}"))
            .await
            .map_err(|e| CoreError::Auth(format!("Failed to bind local server: {e}")))?;

        tracing::info!("Waiting for browser callback...");
        let (mut stream, _) = tokio::time::timeout(Duration::from_secs(300), listener.accept())
            .await
            .map_err(|_| CoreError::Auth("Login timed out after 5 minutes".into()))?
            .map_err(|e| CoreError::Auth(format!("Accept error: {e}")))?;

        let mut buf = [0u8; 4096];
        let n = stream
            .read(&mut buf)
            .await
            .map_err(|e| CoreError::Auth(format!("Read error: {e}")))?;
        let request = String::from_utf8_lossy(&buf[..n]);
        tracing::info!("Received callback request, sending response");

        let html = "<html><body style='font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#11111b;color:#cdd6f4'>\
            <div style='text-align:center'>\
            <h1 style='color:#a6e3a1'>&#10003; Login successful</h1>\
            <p>You can close this tab and return to Vesper Client.</p>\
            </div></body></html>";
        let resp = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            html.len(),
            html
        );
        let _ = stream.write_all(resp.as_bytes()).await;

        let query = request
            .lines()
            .next()
            .and_then(|l| l.split_whitespace().nth(1))
            .and_then(|p| p.split('?').nth(1))
            .unwrap_or("");

        let params: HashMap<String, String> = query
            .split('&')
            .filter_map(|kv| {
                let mut parts = kv.splitn(2, '=');
                Some((
                    parts.next()?.to_string(),
                    urlencoding::decode(parts.next()?)
                        .ok()?
                        .into_owned(),
                ))
            })
            .collect();

        if let Some(error) = params.get("error") {
            let desc = params
                .get("error_description")
                .cloned()
                .unwrap_or_default();
            return Err(CoreError::Auth(format!("Login denied: {error}: {desc}")));
        }

        let state = params
            .get("state")
            .ok_or_else(|| CoreError::Auth("Missing state parameter".into()))?;
        if state != expected_state {
            return Err(CoreError::Auth("CSRF state mismatch".into()));
        }

        let code = params
            .get("code")
            .ok_or_else(|| CoreError::Auth("Missing authorization code".into()))?;

        tracing::info!("Exchanging authorization code for tokens...");
        let redirect_uri = format!("http://localhost:{port}");
        let client = BasicClient::new(ClientId::new(self.client_id.clone()))
            .set_auth_uri(
                AuthUrl::new(MS_AUTH_URL.to_string())
                    .map_err(|e| CoreError::Auth(e.to_string()))?,
            )
            .set_token_uri(
                TokenUrl::new(MS_TOKEN_URL.to_string())
                    .map_err(|e| CoreError::Auth(e.to_string()))?,
            )
            .set_redirect_uri(
                RedirectUrl::new(redirect_uri)
                    .map_err(|e| CoreError::Auth(e.to_string()))?,
            );

        let pkce_verifier = oauth2::PkceCodeVerifier::new(pkce_verifier_secret.to_string());
        let token_result = client
            .exchange_code(AuthorizationCode::new(code.clone()))
            .set_pkce_verifier(pkce_verifier)
            .request_async(&self.http_client)
            .await
            .map_err(|e| CoreError::Auth(format!("Token exchange failed: {e}")))?;

        let ms_access_token = token_result.access_token().secret().clone();
        let refresh_token = token_result
            .refresh_token()
            .map(|r| r.secret().clone())
            .unwrap_or_default();
        let expires_in = token_result.expires_in().map(|d| d.as_secs()).unwrap_or(3600);
        let token_type = format!("{:?}", token_result.token_type());
        let scope = token_result
            .scopes()
            .map(|s| {
                s.iter()
                    .map(|s| s.to_string())
                    .collect::<Vec<_>>()
                    .join(" ")
            })
            .unwrap_or_default();

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mc_tokens = self.exchange_for_minecraft(&ms_access_token).await?;

        Ok(StoredTokens {
            access_token: ms_access_token,
            refresh_token,
            expires_at: now + expires_in,
            scope,
            token_type,
            mc_access_token: Some(mc_tokens.0),
            mc_profile: Some(mc_tokens.1),
        })
    }

    pub async fn start_device_code_flow(
        &self,
    ) -> CoreResult<(
        oauth2::StandardDeviceAuthorizationResponse,
        String,
        String,
        u64,
    )> {
        let details = self
            .oauth_client
            .exchange_device_code()
            .add_scope(Scope::new("XboxLive.SignIn".into()))
            .add_scope(Scope::new("XboxLive.offline_access".into()))
            .request_async(&self.http_client)
            .await
            .map_err(|e| CoreError::Auth(format!("Device code request failed: {e}")))?;

        let user_code = details.user_code().secret().clone();
        let verification_uri = details.verification_uri().url().to_string();
        let expires_in = details.expires_in().as_secs();

        Ok((details, user_code, verification_uri, expires_in))
    }

    pub async fn poll_device_code(
        &self,
        details: &oauth2::StandardDeviceAuthorizationResponse,
    ) -> CoreResult<StoredTokens> {
        let token_result = self
            .oauth_client
            .exchange_device_access_token(details)
            .request_async(&self.http_client, sleep_fn, None)
            .await
            .map_err(|e| CoreError::Auth(format!("Token exchange failed: {e}")))?;

        let ms_access_token = token_result.access_token().secret().clone();
        let refresh_token = token_result
            .refresh_token()
            .map(|r| r.secret().clone())
            .unwrap_or_default();
        let expires_in = token_result.expires_in().map(|d| d.as_secs()).unwrap_or(3600);
        let token_type = format!("{:?}", token_result.token_type());
        let scope = token_result
            .scopes()
            .map(|s| {
                s.iter()
                    .map(|s| s.to_string())
                    .collect::<Vec<_>>()
                    .join(" ")
            })
            .unwrap_or_default();

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mc_tokens = self.exchange_for_minecraft(&ms_access_token).await?;

        Ok(StoredTokens {
            access_token: ms_access_token,
            refresh_token,
            expires_at: now + expires_in,
            scope,
            token_type,
            mc_access_token: Some(mc_tokens.0),
            mc_profile: Some(mc_tokens.1),
        })
    }

    pub async fn refresh_minecraft_tokens(&self, refresh_token: &str) -> CoreResult<StoredTokens> {
        let refresh = RefreshToken::new(refresh_token.to_string());

        let token_result = self
            .oauth_client
            .exchange_refresh_token(&refresh)
            .request_async(&self.http_client)
            .await
            .map_err(|e| CoreError::Auth(format!("Token refresh failed: {e}")))?;

        let ms_access_token = token_result.access_token().secret().clone();
        let new_refresh = token_result
            .refresh_token()
            .map(|r| r.secret().clone())
            .unwrap_or_else(|| refresh_token.to_string());
        let expires_in = token_result.expires_in().map(|d| d.as_secs()).unwrap_or(3600);
        let token_type = format!("{:?}", token_result.token_type());
        let scope = token_result
            .scopes()
            .map(|s| {
                s.iter()
                    .map(|s| s.to_string())
                    .collect::<Vec<_>>()
                    .join(" ")
            })
            .unwrap_or_default();

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mc_tokens = self.exchange_for_minecraft(&ms_access_token).await?;

        Ok(StoredTokens {
            access_token: ms_access_token,
            refresh_token: new_refresh,
            expires_at: now + expires_in,
            scope,
            token_type,
            mc_access_token: Some(mc_tokens.0),
            mc_profile: Some(mc_tokens.1),
        })
    }

    async fn exchange_for_minecraft(
        &self,
        ms_access_token: &str,
    ) -> CoreResult<(String, crate::auth::models::McProfile)> {
        tracing::info!("[auth] Starting Xbox Live authentication...");
        let xbox_token = self.xbox_live_auth(ms_access_token).await?;
        tracing::info!("[auth] Xbox Live auth OK, starting XSTS...");
        let (xsts_token, uhs) = self.xsts_auth(&xbox_token).await?;
        tracing::info!("[auth] XSTS auth OK, logging into Minecraft...");
        let mc_token = self.mc_login(&xsts_token, &uhs).await?;
        tracing::info!("[auth] MC login OK, fetching profile...");
        let mc_profile = self.mc_get_profile(&mc_token).await?;
        tracing::info!("[auth] MC profile fetched: {}", mc_profile.name);
        Ok((mc_token, mc_profile))
    }

    async fn xbox_live_auth(&self, ms_token: &str) -> CoreResult<String> {
        let body = serde_json::json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": format!("d={ms_token}")
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
        });

        let resp: serde_json::Value = self
            .http_client
            .post(XBOXLIVE_AUTH_URL)
            .header("x-xbl-contract-version", "1")
            .json(&body)
            .send()
            .await
            .map_err(|e| CoreError::Auth(format!("Xbox Live auth request failed: {e}")))?
            .json()
            .await
            .map_err(|e| CoreError::Auth(format!("Xbox Live auth response parse failed: {e}")))?;

        let token = resp["Token"]
            .as_str()
            .ok_or_else(|| CoreError::Auth("Missing Xbox Live token".into()))?
            .to_string();

        Ok(token)
    }

    async fn xsts_auth(&self, xbox_token: &str) -> CoreResult<(String, String)> {
        let body = serde_json::json!({
            "Properties": {
                "SandboxId": "RETAIL",
                "UserTokens": [xbox_token]
            },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT"
        });

        let resp: serde_json::Value = self
            .http_client
            .post(XSTS_AUTH_URL)
            .header("x-xbl-contract-version", "1")
            .json(&body)
            .send()
            .await
            .map_err(|e| CoreError::Auth(format!("XSTS auth request failed: {e}")))?
            .json()
            .await
            .map_err(|e| CoreError::Auth(format!("XSTS auth response parse failed: {e}")))?;

        if let Some(err) = resp.get("XErr") {
            let err_code = err.as_u64().unwrap_or(0);
            return Err(CoreError::Auth(format!(
                "XSTS error {err_code}: account may not have Minecraft"
            )));
        }

        let token = resp["Token"]
            .as_str()
            .ok_or_else(|| CoreError::Auth("Missing XSTS token".into()))?
            .to_string();

        let uhs = resp["DisplayClaims"]["xui"][0]["uhs"]
            .as_str()
            .ok_or_else(|| CoreError::Auth("Missing uhs in XSTS display claims".into()))?
            .to_string();

        Ok((token, uhs))
    }

    async fn mc_login(&self, xsts_token: &str, uhs: &str) -> CoreResult<String> {
        let identity_token = format!("XBL3.0 x={uhs};{xsts_token}");
        let body = serde_json::json!({
            "identityToken": identity_token
        });

        let resp: serde_json::Value = self
            .http_client
            .post(MC_LOGIN_URL)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| CoreError::Auth(format!("MC login request failed: {e}")))?
            .json()
            .await
            .map_err(|e| CoreError::Auth(format!("MC login response parse failed: {e}")))?;

        let token = resp["access_token"]
            .as_str()
            .ok_or_else(|| CoreError::Auth("Missing Minecraft access token".into()))?
            .to_string();

        Ok(token)
    }

    async fn mc_get_profile(&self, mc_token: &str) -> CoreResult<crate::auth::models::McProfile> {
        let resp: serde_json::Value = self
            .http_client
            .get(MC_PROFILE_URL)
            .bearer_auth(mc_token)
            .send()
            .await
            .map_err(|e| CoreError::Auth(format!("MC profile request failed: {e}")))?
            .json()
            .await
            .map_err(|e| CoreError::Auth(format!("MC profile response parse failed: {e}")))?;

        if resp.get("error").is_some() {
            return Err(CoreError::Auth("Account does not own Minecraft".into()));
        }

        let id = resp["id"].as_str().unwrap_or("").to_string();
        let name = resp["name"].as_str().unwrap_or("").to_string();

        let skins = resp["skins"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|s| {
                        Some(crate::auth::models::McSkin {
                            id: s["id"].as_str()?.to_string(),
                            state: s["state"].as_str()?.to_string(),
                            url: s["url"].as_str()?.to_string(),
                            variant: s["variant"].as_str()?.to_string(),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(crate::auth::models::McProfile { id, name, skins })
    }
}

async fn sleep_fn(dur: Duration) {
    tokio::time::sleep(dur).await;
}
