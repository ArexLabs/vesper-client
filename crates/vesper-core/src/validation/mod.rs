pub mod instance;
pub mod account;
pub mod version;

use super::Error;

pub fn validate_instance_name(name: &str) -> Result<(), Error> {
    if name.is_empty() {
        return Err(Error::invalid_input("Instance name cannot be empty"));
    }
    if name.len() > 255 {
        return Err(Error::invalid_input("Instance name too long (max 255)"));
    }
    let invalid = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    if name.chars().any(|c| invalid.contains(&c)) {
        return Err(Error::invalid_input("Instance name contains invalid characters"));
    }
    Ok(())
}

pub fn validate_java_path(path: &str) -> Result<(), Error> {
    if path.is_empty() {
        return Err(Error::invalid_input("Java path cannot be empty"));
    }
    let p = std::path::Path::new(path);
    if !p.exists() {
        return Err(Error::not_found("Java executable not found"));
    }
    if p.file_name().map(|n| n != "java").unwrap_or(true) {
        if !p.is_dir() {
            return Err(Error::invalid_input("Not a valid Java executable"));
        }
    }
    Ok(())
}

pub fn validate_url(url: &str) -> Result<(), Error> {
    if url::Url::parse(url).is_err() {
        return Err(Error::invalid_input("Invalid URL"));
    }
    Ok(())
}