pub mod global;
pub mod instance;

pub use global::VesperConfig;
pub use instance::{InstanceConfig, LoaderType};

use crate::error::CoreResult;
use directories::ProjectDirs;
use std::path::PathBuf;

pub fn project_dirs() -> CoreResult<ProjectDirs> {
    ProjectDirs::from("", "VOMLabs", "VesperClient")
        .ok_or_else(|| CoreError::Setup("Failed to determine project directories".into()))
}

use crate::error::CoreError;

pub fn data_dir() -> CoreResult<PathBuf> {
    let dirs = project_dirs()?;
    let dir = dirs.data_dir().to_path_buf();
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn config_path() -> CoreResult<PathBuf> {
    Ok(data_dir()?.join("vesper_config.toml"))
}

pub fn instances_dir() -> CoreResult<PathBuf> {
    let dir = data_dir()?.join("instances");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn logs_dir() -> CoreResult<PathBuf> {
    let dir = data_dir()?.join("logs");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}
