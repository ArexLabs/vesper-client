use serde::Serialize;

const KEYRING_SERVICE: &str = "io.vesper.launcher";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecureStorageStatus {
    pub available: bool,
    pub provider: String,
    pub message: String,
    pub key: Option<String>,
}

fn entry_for_key(key: &str) -> Result<keyring_core::Entry, String> {
    keyring_core::Entry::new(KEYRING_SERVICE, key).map_err(|e| e.to_string())
}

pub fn write_secret(key: &str, value: &str) -> Result<(), String> {
    entry_for_key(key)?
        .set_password(value)
        .map_err(|e| e.to_string())
}

pub fn read_secret(key: &str) -> Result<Option<String>, String> {
    match entry_for_key(key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring_core::Error::NoEntry) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

pub fn delete_secret(key: &str) -> Result<(), String> {
    match entry_for_key(key)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring_core::Error::NoEntry) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

pub fn write_placeholder(key: String, value: String) -> SecureStorageStatus {
    match write_secret(&key, &value) {
        Ok(()) => SecureStorageStatus {
            available: true,
            provider: "os-keyring".to_string(),
            message: "Secret written to OS keychain.".to_string(),
            key: Some(key),
        },
        Err(error) => SecureStorageStatus {
            available: false,
            provider: "os-keyring".to_string(),
            message: format!("Failed to write secret: {error}"),
            key: Some(key),
        },
    }
}

pub fn read_placeholder(key: String) -> SecureStorageStatus {
    match read_secret(&key) {
        Ok(Some(_)) => SecureStorageStatus {
            available: true,
            provider: "os-keyring".to_string(),
            message: "Secret exists in OS keychain.".to_string(),
            key: Some(key),
        },
        Ok(None) => SecureStorageStatus {
            available: true,
            provider: "os-keyring".to_string(),
            message: "No secret stored for this key.".to_string(),
            key: Some(key),
        },
        Err(error) => SecureStorageStatus {
            available: false,
            provider: "os-keyring".to_string(),
            message: format!("Failed to read secret: {error}"),
            key: Some(key),
        },
    }
}
