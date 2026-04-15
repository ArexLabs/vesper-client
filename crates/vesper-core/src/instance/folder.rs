use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceFolder {
    pub root: PathBuf,
}

impl InstanceFolder {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn metadata_path(&self) -> PathBuf {
        self.root.join("vesper.json")
    }

    pub fn mods_path(&self) -> PathBuf {
        self.root.join("mods")
    }

    pub fn config_path(&self) -> PathBuf {
        self.root.join("config")
    }

    pub fn logs_path(&self) -> PathBuf {
        self.root.join("logs")
    }

    pub fn Saves_path(&self) -> PathBuf {
        self.root.join("saves")
    }

    pub fn resourcepacks_path(&self) -> PathBuf {
        self.root.join("resourcepacks")
    }

    pub fn shaderpacks_path(&self) -> PathBuf {
        self.root.join("shaderpacks")
    }

    pub fn versions_path(&self) -> PathBuf {
        self.root.join("versions")
    }

    pub fn version_jar(&self, version: &str) -> PathBuf {
        self.versions_path().join(version).join(format!("{}.jar", version))
    }

    pub fn run_path(&self) -> PathBuf {
        self.root.join("run")
    }

    pub fn options_path(&self) -> PathBuf {
        self.root.join("options.txt")
    }

    pub fn icon_path(&self) -> PathBuf {
        self.root.join("icon.png")
    }
}

pub const FOLDER_STRUCTURE: &[&str] = &[
    "mods",
    "config",
    "logs",
    "saves",
    "resourcepacks",
    "shaderpacks",
    "versions",
    "run",
];