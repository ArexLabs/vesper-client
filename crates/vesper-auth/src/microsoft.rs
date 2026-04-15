use serde::{Deserialize, Serialize};
use reqwest::Client;
use vesper_core::account::{Account, MicrosoftTokens, AccountType};
use vesper_core::Result;
use chrono::{DateTime, Utc};

const AUTH_URL: &str = "https://login.live.com/oauth20_authorize.fv";
const TOKEN_URL: &str = "https://login.live.com/oauth20_token.fv";
const CLIENT_ID: &str = "000000004832BD98";

#[derive(Debug, Clone)]
pub struct MicrosoftAuth {
    client: Client,
    redirect_uri: String,
}

impl MicrosoftAuth {
    pub fn new(redirect_uri: String) -> Self {
        Self {
            client: Client::new(),
            redirect_uri,
        }
    }

    pub fn auth_url(&self, state: &str) -> String {
        format!(
            "{}?client_id={}&response_type=code&redirect_uri={}&scope=openid%20profile%20XboxLive.signin%20XboxLive.offline_access",
            AUTH_URL,
            CLIENT_ID,
            urlencoding::encode(&self.redirect_uri)
        )
    }

    pub async fn exchange_code(&self, code: &str) -> Result<MicrosoftTokens> {
        let params = [
            ("client_id", CLIENT_ID),
            ("code", code),
            ("grant_type", "authorization_code"),
            ("redirect_uri", &self.redirect_uri),
        ];

        let response = self.client
            .post(TOKEN_URL)
            .form(&params)
            .send()
            .await
            .map_err(|e| vesper_core::Error::network(e.to_string()))?;

        let token_response: TokenResponse = response.json().await
            .map_err(|e| vesper_core::Error::internal(e.to_string()))?;

        Ok(MicrosoftTokens {
            access_token: token_response.access_token,
            refresh_token: token_response.refresh_token,
            expires_at: Utc::now() + chrono::Duration::seconds(token_response.expires_in),
            client_id: CLIENT_ID.to_string(),
        })
    }

    pub async fn refresh_token(&self, refresh_token: &str) -> Result<MicrosoftTokens> {
        let params = [
            ("client_id", CLIENT_ID),
            ("refresh_token", refresh_token),
            ("grant_type", "refresh_token"),
        ];

        let response = self.client
            .post(TOKEN_URL)
            .form(&params)
            .send()
            .await
            .map_err(|e| vesper_core::Error::network(e.to_string()))?;

        let token_response: TokenResponse = response.json().await
            .map_err(|e| vesper_core::Error::internal(e.to_string()))?;

        Ok(MicrosoftTokens {
            access_token: token_response.access_token,
            refresh_token: token_response.refresh_token,
            expires_at: Utc::now() + chrono::Duration::seconds(token_response.expires_in),
            client_id: CLIENT_ID.to_string(),
        })
    }
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: String,
    expires_in: i64,
    token_type: String,
}

pub mod urlencoding {
    pub fn encode(input: &str) -> String {
        let mut result = String::new();
        for byte in input.bytes() {
            match byte {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    result.push(byte as char);
                }
                _ => {
                    result.push_str(&format!("%{:02X}", byte));
                }
            }
        }
        result
    }
}