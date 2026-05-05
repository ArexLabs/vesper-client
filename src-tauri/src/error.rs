use std::io;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Modrinth API error: {0}")]
    ModrinthApi(#[from] reqwest::Error),
    #[error("Sodium installation failed: {0}")]
    SodiumInstallation(String),
    #[error("Instance creation failed: {0}")]
    InstanceCreation(String),
    #[error("IO error: {0}")]
    Io(#[from] io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("No compatible Sodium version found")]
    NoSodiumVersion,
    #[error("Microsoft authentication error: {0}")]
    AuthError(String),
}

#[derive(Error, Debug)]
pub enum DownloadError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),
    #[error("File already exists (deduplication)")]
    Duplicate,
    #[error("Invalid file URL")]
    InvalidUrl,
}

impl From<DownloadError> for AppError {
    fn from(err: DownloadError) -> Self {
        match err {
            DownloadError::Http(e) => AppError::ModrinthApi(e),
            DownloadError::Duplicate => AppError::SodiumInstallation("File already exists".into()),
            DownloadError::InvalidUrl => {
                AppError::SodiumInstallation("Invalid download URL".into())
            }
        }
    }
}
