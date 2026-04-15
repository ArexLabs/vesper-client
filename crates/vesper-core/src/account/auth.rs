use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use super::AccountId;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AccountType {
    Microsoft,
    Cracked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicrosoftTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: DateTime<Utc>,
    pub client_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrackedProfile {
    pub username: String,
    pub uuid: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: AccountId,
    pub account_type: AccountType,
    pub username: String,
    pub uuid: String,
    pub created_at: DateTime<Utc>,
    pub last_used: Option<DateTime<Utc>>,
    pub microsoft_tokens: Option<MicrosoftTokens>,
    pub cracked_profile: Option<CrackedProfile>,
}

impl Account {
    pub fn new_microsoft(username: String, uuid: String, tokens: MicrosoftTokens) -> Self {
        Self {
            id: AccountId::new(),
            account_type: AccountType::Microsoft,
            username,
            uuid,
            created_at: Utc::now(),
            last_used: None,
            microsoft_tokens: Some(tokens),
            cracked_profile: None,
        }
    }

    pub fn new_cracked(username: String, uuid: String) -> Self {
        Self {
            id: AccountId::new(),
            account_type: AccountType::Cracked,
            username,
            uuid,
            created_at: Utc::now(),
            last_used: None,
            microsoft_tokens: None,
            cracked_profile: Some(CrackedProfile { username, uuid }),
        }
    }

    pub fn is_expired(&self) -> bool {
        if let Some(tokens) = &self.microsoft_tokens {
            tokens.expires_at < Utc::now()
        } else {
            false
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountSummary {
    pub id: AccountId,
    pub username: String,
    pub account_type: AccountType,
    pub last_used: Option<DateTime<Utc>>,
}