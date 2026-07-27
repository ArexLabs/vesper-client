use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LoaderType {
    Vanilla,
    Fabric,
    NeoForge,
}

impl std::fmt::Display for LoaderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LoaderType::Vanilla => write!(f, "Vanilla"),
            LoaderType::Fabric => write!(f, "Fabric"),
            LoaderType::NeoForge => write!(f, "NeoForge"),
        }
    }
}

impl LoaderType {
    pub fn from_str_loose(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "fabric" => LoaderType::Fabric,
            "neoforge" | "neo_forge" | "neo-forge" => LoaderType::NeoForge,
            _ => LoaderType::Vanilla,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceConfig {
    pub name: String,
    pub mc_version: String,
    pub loader_type: LoaderType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub loader_version: Option<String>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_played: Option<String>,
}

impl InstanceConfig {
    pub fn new(name: String, mc_version: String, loader_type: LoaderType, loader_version: Option<String>) -> Self {
        Self {
            name,
            mc_version,
            loader_type,
            loader_version,
            created_at: chrono_now(),
            last_played: None,
        }
    }

    pub fn mark_played(&mut self) {
        self.last_played = Some(chrono_now());
    }
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{secs}")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceInfo {
    pub id: String,
    #[serde(flatten)]
    pub config: InstanceConfig,
}
