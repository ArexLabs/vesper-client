use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct InstanceId(pub Uuid);

impl InstanceId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl Default for InstanceId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for InstanceId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::str::FromStr for InstanceId {
    type Err = uuid::Error;
    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        Ok(Self(Uuid::parse_str(s)?))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AccountId(pub Uuid);

impl AccountId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl Default for AccountId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for AccountId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::str::FromStr for AccountId {
    type Err = uuid::Error;
    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        Ok(Self(Uuid::parse_str(s)?))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct BackupId(pub Uuid);

impl BackupId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl Default for BackupId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for BackupId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::str::FromStr for BackupId {
    type Err = uuid::Error;
    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        Ok(Self(Uuid::parse_str(s)?))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DownloadId(pub Uuid);

impl DownloadId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl Default for DownloadId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for DownloadId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}