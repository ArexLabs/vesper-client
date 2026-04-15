use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitRemote {
    pub name: String,
    pub url: String,
    pub fetch: String,
}

impl GitRemote {
    pub fn new(name: &str, url: &str) -> Self {
        Self {
            name: name.to_string(),
            url: url.to_string(),
            fetch: format!("+refs/heads/*:refs/remotes/{}/", name),
        }
    }
}