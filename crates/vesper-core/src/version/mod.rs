pub mod manifest;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameVersion {
    pub id: String,
    pub type: String,
    pub url: String,
    pub time: String,
    pub release_time: String,
    pub sha1: Option<String>,
    pub compliance_level: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionManifest {
    pub latest: LatestVersions,
    pub versions: Vec<GameVersion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatestVersions {
    pub release: String,
    pub snapshot: Option<String>,
}