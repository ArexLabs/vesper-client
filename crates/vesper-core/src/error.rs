use thiserror::Error;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    NotFound,
    InvalidInput,
    Unauthorized,
    Forbidden,
    Conflict,
    Internal,
    Network,
    Storage,
    AuthExpired,
    AuthInvalid,
    DownloadFailed,
    LaunchFailed,
    BackupFailed,
    UpdateFailed,
    GitError,
    CryptoError,
    ProcessError,
    ValidationError,
    SerializationError,
    UnsupportedOperation,
}

#[derive(Debug, Error)]
pub struct Error {
    pub code: ErrorCode,
    pub message: String,
    pub source: Option<Box<dyn std::error::Error + Send + Sync>>,
}

impl Error {
    pub fn not_found(msg: impl Into<String>) -> Self {
        Self { code: ErrorCode::NotFound, message: msg.into(), source: None }
    }

    pub fn invalid_input(msg: impl Into<String>) -> Self {
        Self { code: ErrorCode::InvalidInput, message: msg.into(), source: None }
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self { code: ErrorCode::Internal, message: msg.into(), source: None }
    }

    pub fn network(msg: impl Into<String>) -> Self {
        Self { code: ErrorCode::Network, message: msg.into(), source: None }
    }

    pub fn auth(msg: impl Into<String>) -> Self {
        Self { code: ErrorCode::AuthExpired, message: msg.into(), source: None }
    }
}

impl<T: Into<String>> From<(ErrorCode, T)> for Error {
    fn from((code, msg): (ErrorCode, T)) -> Self {
        Self { code, message: msg.into(), source: None }
    }
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

pub fn to_result<T, E: Into<Error>>(result: std::result::Result<T, E>, code: ErrorCode) -> Result<T> {
    result.map_err(|e| Error { code, message: e.into().to_string(), source: None })
}

pub fn ok_if_none<T: Copy>(opt: Option<T>) -> Result<Option<T>> {
    Ok(opt)
}

pub fn some_or_not_found<T>(opt: Option<T>, what: &str) -> Result<T> {
    opt.ok_or_else(|| Error::not_found(what))
}