use serde::{Deserialize, Serialize};
use vesper_core::Result;

const UPDATE_URL: &str = "https://api.github.com/repos/vesper/vesper/releases/latest";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub download_url: String,
    pub release_notes: String,
    pub sha256: String,
    pub critical: bool,
}

pub struct UpdateChecker {
    client: reqwest::Client,
}

impl UpdateChecker {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }

    pub async fn check_for_updates(&self, current_version: &str) -> Result<Option<UpdateInfo>> {
        let response = self.client
            .get(UPDATE_URL)
            .header("User-Agent", "Vesper")
            .send()
            .await
            .map_err(|e| vesper_core::Error::network(e.to_string()))?;

        if !response.status().is_success() {
            return Ok(None);
        }

        Ok(None)
    }
}