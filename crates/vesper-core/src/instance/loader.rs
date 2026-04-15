use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Loader {
    Vanilla,
    Forge,
    Fabric,
    Quilt,
    OptiFine,
    NeoForge,
}

impl Loader {
    pub fn display_name(&self) -> &'static str {
        match self {
            Loader::Vanilla => "Vanilla",
            Loader::Forge => "Forge",
            Loader::Fabric => "Fabric",
            Loader::Quilt => "Quilt",
            Loader::OptiFine => "OptiFine",
            Loader::NeoForge => "NeoForge",
        }
    }

    pub fn loader_id(&self) -> &'static str {
        match self {
            Loader::Vanilla => "vanilla",
            Loader::Forge => "forge",
            Loader::Fabric => "fabric",
            Loader::Quilt => "quilt",
            Loader::OptiFine => "optifine",
            Loader::NeoForge => "neoforge",
        }
    }

    pub fn from_loader_id(s: &str) -> Option<Self> {
        match s {
            "vanilla" => Some(Loader::Vanilla),
            "forge" => Some(Loader::Forge),
            "fabric" => Some(Loader::Fabric),
            "quilt" => Some(Loader::Quilt),
            "optifine" => Some(Loader::OptiFine),
            "neoforge" => Some(Loader::NeoForge),
            _ => None,
        }
    }
}

impl fmt::Display for Loader {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.display_name())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderVersion {
    pub loader: Loader,
    pub version: String,
    pub minecraft_version: String,
    pub url: Option<String>,
    pub sha1: Option<String>,
}

impl LoaderVersion {
    pub fn identifier(&self) -> String {
        format!("{}-{}", self.loader.loader_id(), self.version)
    }
}