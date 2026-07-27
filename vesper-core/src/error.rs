use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("TOML error: {0}")]
    Toml(#[from] toml::de::Error),

    #[error("TOML serialization error: {0}")]
    TomlSer(#[from] toml::ser::Error),

    #[error("HTTP request error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Authentication error: {0}")]
    Auth(String),

    #[error("Token expired and refresh failed")]
    TokenExpired,

    #[error("Instance not found: {0}")]
    InstanceNotFound(String),

    #[error("Instance already exists: {0}")]
    InstanceAlreadyExists(String),

    #[error("Invalid instance name: {0}")]
    InvalidInstanceName(String),

    #[error("Minecraft launcher error: {0}")]
    Launcher(String),

    #[error("Mod download error: {0}")]
    ModDownload(String),

    #[error("Config error: {0}")]
    Config(String),

    #[error("Path error: {0}")]
    Path(PathBuf),

    #[error("Java not found: {0}")]
    JavaNotFound(String),

    #[error("Setup error: {0}")]
    Setup(String),
}

pub type CoreResult<T> = Result<T, CoreError>;
