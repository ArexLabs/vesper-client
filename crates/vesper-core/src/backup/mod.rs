pub mod schedule;
pub use schedule::BackupSchedule;

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use super::InstanceId;
use super::BackupId;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BackupStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Backup {
    pub id: BackupId,
    pub instance_id: InstanceId,
    pub created_at: DateTime<Utc>,
    pub message: String,
    pub commit_hash: String,
    pub status: BackupStatus,
    pub size_bytes: u64,
    pub file_count: u32,
    pub remote_synced: bool,
}

impl Backup {
    pub fn new(instance_id: InstanceId, message: String, commit_hash: String) -> Self {
        Self {
            id: BackupId::new(),
            instance_id,
            created_at: Utc::now(),
            message,
            commit_hash,
            status: BackupStatus::Completed,
            size_bytes: 0,
            file_count: 0,
            remote_synced: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupManifest {
    pub instance_id: InstanceId,
    pub version: String,
    pub game_version: String,
    pub loader: String,
    pub mod_list: Vec<String>,
    pub created_at: DateTime<Utc>,
}