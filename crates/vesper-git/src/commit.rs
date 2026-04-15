use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommit {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
    pub parent_hashes: Vec<String>,
}

impl GitCommit {
    pub fn new(hash: String, message: String) -> Self {
        Self {
            hash,
            message,
            author: "Vesper".to_string(),
            timestamp: 0,
            parent_hashes: vec![],
        }
    }
}