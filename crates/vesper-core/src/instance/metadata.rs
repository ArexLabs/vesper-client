use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use super::{InstanceId, Loader};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceMetadata {
    pub id: InstanceId,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub game_version: String,
    pub loader: Loader,
    pub java_version: Option<JavaConfig>,
    pub running: bool,
    pub last_played: Option<DateTime<Utc>>,
    pub play_time_seconds: u64,
    pub icon_name: Option<String>,
    pub notes: Option<String>,
    #[serde(default)]
    pub launcher_version: String,
}

impl InstanceMetadata {
    pub fn new(name: String, game_version: String, loader: Loader) -> Self {
        let now = Utc::now();
        Self {
            id: InstanceId::new(),
            name,
            created_at: now,
            updated_at: now,
            game_version,
            loader,
            java_version: None,
            running: false,
            last_played: None,
            play_time_seconds: 0,
            icon_name: None,
            notes: None,
            launcher_version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JavaConfig {
    pub path: String,
    pub version: String,
    pub vendor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceStatus {
    pub id: InstanceId,
    pub running: bool,
    pub pid: Option<u32>,
    pub memory_used_mb: Option<u64>,
    pub cpu_percent: Option<f32>,
}