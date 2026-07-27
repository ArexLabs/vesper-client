use crate::auth::models::AuthProfile;
use crate::config::{config_path, CoreResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VesperConfig {
    #[serde(default)]
    pub profiles: Vec<crate::auth::models::AuthProfile>,

    #[serde(default)]
    pub active_profile_id: Option<String>,

    pub java_path: Option<String>,

    #[serde(default = "default_max_memory")]
    pub max_memory_mb: u32,

    #[serde(default)]
    pub jvm_args: Option<String>,

    #[serde(default = "default_window_width")]
    pub window_width: u32,

    #[serde(default = "default_window_height")]
    pub window_height: u32,
}

fn default_max_memory() -> u32 {
    let s = sysinfo::System::new();
    let total_bytes = s.total_memory();
    let total_mb = total_bytes / (1024 * 1024);
    let recommended = total_mb / 2;
    (recommended.min(8192).max(1024)) as u32
}

fn default_window_width() -> u32 {
    1100
}

fn default_window_height() -> u32 {
    700
}

impl Default for VesperConfig {
    fn default() -> Self {
        Self {
            profiles: Vec::new(),
            active_profile_id: None,
            java_path: None,
            max_memory_mb: default_max_memory(),
            jvm_args: None,
            window_width: default_window_width(),
            window_height: default_window_height(),
        }
    }
}

impl VesperConfig {
    pub fn load() -> CoreResult<Self> {
        let path = config_path()?;
        if !path.exists() {
            let config = Self::default();
            config.save()?;
            return Ok(config);
        }
        let contents = std::fs::read_to_string(&path)?;
        let config: Self = toml::from_str(&contents)?;
        Ok(config)
    }

    pub fn save(&self) -> CoreResult<()> {
        let path = config_path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let contents = toml::to_string_pretty(self)?;
        std::fs::write(&path, contents)?;
        Ok(())
    }

    pub fn active_profile(&self) -> Option<&AuthProfile> {
        let active_id = self.active_profile_id.as_ref()?;
        self.profiles.iter().find(|p| p.id == *active_id)
    }

    pub fn add_profile(&mut self, profile: AuthProfile) {
        self.profiles.push(profile);
    }

    pub fn remove_profile(&mut self, id: &str) -> bool {
        let before = self.profiles.len();
        self.profiles.retain(|p| p.id != id);
        if self.active_profile_id.as_deref() == Some(id) {
            self.active_profile_id = None;
        }
        self.profiles.len() < before
    }

    pub fn java_executable(&self) -> &str {
        self.java_path
            .as_deref()
            .unwrap_or("java")
    }

    pub fn detect_java() -> Option<PathBuf> {
        let output = std::process::Command::new("java")
            .arg("-version")
            .output()
            .ok()?;
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("java version") || stderr.contains("openjdk version") {
            std::env::var_os("JAVA_HOME")
                .map(PathBuf::from)
                .and_then(|p| {
                    let bin = if cfg!(target_os = "windows") {
                        p.join("bin").join("java.exe")
                    } else {
                        p.join("bin").join("java")
                    };
                    if bin.exists() {
                        Some(bin)
                    } else {
                        None
                    }
                })
                .or_else(|| which_java())
        } else {
            None
        }
    }

    #[allow(dead_code)]
    fn detect_memory_from_system() -> u32 {
        let s = sysinfo::System::new();
        let total_bytes = s.total_memory();
        let total_mb = total_bytes / (1024 * 1024);
        let half = total_mb / 2;
        (half.min(8192).max(1024)) as u32
    }
}

fn which_java() -> Option<PathBuf> {
    let output = std::process::Command::new("which")
        .arg("java")
        .output()
        .ok()?;
    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let p = PathBuf::from(path);
        if p.exists() {
            return Some(p);
        }
    }
    None
}
