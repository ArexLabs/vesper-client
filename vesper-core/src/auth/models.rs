use crate::auth::bedrock::BedrockProfile;
use crate::auth::keys::{DeviceKeys, IdentityKeys};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AccountType {
    Java,
    Bedrock,
}

impl Default for AccountType {
    fn default() -> Self {
        Self::Java
    }
}

impl std::fmt::Display for AccountType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AccountType::Java => write!(f, "Java"),
            AccountType::Bedrock => write!(f, "Bedrock"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthProfile {
    pub id: String,
    pub display_name: String,
    pub email: Option<String>,
    #[serde(default)]
    pub account_type: AccountType,
    pub minecraft_username: Option<String>,
    pub minecraft_uuid: Option<String>,
    pub xbox_gamertag: Option<String>,
    #[serde(default)]
    pub bedrock_profile: Option<BedrockProfile>,
    #[serde(default)]
    pub device_keys: Option<DeviceKeys>,
    #[serde(default)]
    pub identity_keys: Option<IdentityKeys>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: u64,
    pub scope: String,
    pub token_type: String,
    #[serde(default)]
    pub mc_access_token: Option<String>,
    #[serde(default)]
    pub mc_profile: Option<McProfile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McProfile {
    pub id: String,
    pub name: String,
    pub skins: Vec<McSkin>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McSkin {
    pub id: String,
    pub state: String,
    pub url: String,
    pub variant: String,
}
