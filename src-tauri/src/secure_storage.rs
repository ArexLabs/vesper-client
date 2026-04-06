use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SecureStorageStatus {
    pub success: bool,
    pub message: Option<String>,
}

impl SecureStorageStatus {
    pub fn ok() -> Self {
        Self {
            success: true,
            message: None,
        }
    }

    pub fn err(msg: impl Into<String>) -> Self {
        Self {
            success: false,
            message: Some(msg.into()),
        }
    }
}

pub fn read_secret(key: &str) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new("io.vesper.vesper-client", key).map_err(|e| e.to_string())?;

    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn write_secret(key: &str, value: &str) -> Result<(), String> {
    let entry = keyring::Entry::new("io.vesper.vesper-client", key).map_err(|e| e.to_string())?;

    entry.set_password(value).map_err(|e| e.to_string())
}

pub fn delete_secret(key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new("io.vesper.vesper-client", key).map_err(|e| e.to_string())?;

    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn write_placeholder(key: String, value: String) -> SecureStorageStatus {
    match write_secret(&key, &value) {
        Ok(()) => SecureStorageStatus::ok(),
        Err(e) => SecureStorageStatus::err(e),
    }
}

pub fn read_placeholder(key: String) -> SecureStorageStatus {
    match read_secret(&key) {
        Ok(Some(v)) => SecureStorageStatus::ok(),
        Ok(None) => SecureStorageStatus::err("No entry found"),
        Err(e) => SecureStorageStatus::err(e),
    }
}
