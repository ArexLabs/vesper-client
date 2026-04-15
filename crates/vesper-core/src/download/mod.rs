use serde::{Deserialize, Serialize};
use uuid::Uuid;
use super::{InstanceId, DownloadId};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DownloadSource {
    Modrinth,
    CurseForge,
    Local,
    Direct,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DownloadStatus {
    Pending,
    Queued,
    Downloading,
    Verifying,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadTask {
    pub id: DownloadId,
    pub source: DownloadSource,
    pub url: String,
    pub dest_path: String,
    pub expected_size: u64,
    pub expected_sha1: Option<String>,
    pub downloaded_bytes: u64,
    pub status: DownloadStatus,
    pub error_message: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub chunk_size: u32,
    pub chunk_count: u32,
}

impl DownloadTask {
    pub fn new(url: String, dest: String, size: u64) -> Self {
        Self {
            id: DownloadId::new(),
            source: DownloadSource::Direct,
            url,
            dest_path: dest,
            expected_size: size,
            expected_sha1: None,
            downloaded_bytes: 0,
            status: DownloadStatus::Pending,
            error_message: None,
            created_at: chrono::Utc::now(),
            started_at: None,
            completed_at: None,
            chunk_size: 1024 * 1024, // 1 MB chunks
            chunk_count: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub task_id: DownloadId,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub chunks_completed: u32,
    pub chunks_total: u32,
    pub speed_bps: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModRef {
    pub id: String,
    pub name: String,
    pub version: String,
    pub source: DownloadSource,
    pub url: Option<String>,
    pub filename: String,
    pub sha1: Option<String>,
    pub file_id: Option<String>,
    pub project_id: Option<String,
    pub version_id: Option<String>,
}