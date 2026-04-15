use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CacheType {
    VersionManifest,
    Asset,
    Library,
    Mod,
    ModMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub key: String,
    pub cache_type: CacheType,
    pub file_path: PathBuf,
    pub size_bytes: u64,
    pub created_at: u64,
    pub expires_at: Option<u64>,
    pub source_url: Option<String>,
    pub sha1: Option<String>,
}

impl CacheEntry {
    pub fn new(key: String, cache_type: CacheType, path: PathBuf) -> Self {
        let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        let created = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        Self {
            key,
            cache_type,
            file_path: path,
            size_bytes: size,
            created_at: created,
            expires_at: None,
            source_url: None,
            sha1: None,
        }
    }

    pub fn is_expired(&self) -> bool {
        if let Some(exp) = self.expires_at {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            now > exp
        } else {
            false
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub total_entries: u64,
    pub total_size_bytes: u64,
    pub by_type: Vec<(CacheType, u64, u64)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub max_size_bytes: u64,
    pub auto_cleanup: bool,
    pub cleanup_interval_hours: u32,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            max_size_bytes: 10 * 1024 * 1024 * 1024, // 10 GB
            auto_cleanup: true,
            cleanup_interval_hours: 24,
        }
    }
}