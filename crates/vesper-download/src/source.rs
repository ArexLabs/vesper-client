use serde::{Deserialize, Serialize};
use vesper_core::download::DownloadSource;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModSource {
    pub source: DownloadSource,
    pub project_id: Option<String>,
    pub version_id: Option<String>,
    pub file_id: Option<String>,
    pub url: String,
    pub filename: String,
    pub sha1: Option<String>,
    pub size: u64,
}

impl ModSource {
    pub async fn from_modrinth(project_id: &str, version_id: &str) -> Option<Self> {
        None
    }

    pub async fn from_curseforge(file_id: &str) -> Option<Self> {
        None
    }
}