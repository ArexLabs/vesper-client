use vesper_core::download::{DownloadTask, DownloadProgress};

pub struct DownloadService {
    active_tasks: std::sync::RwLock<Vec<DownloadTask>>,
}

impl DownloadService {
    pub fn new() -> Self {
        Self {
            active_tasks: std::sync::RwLock::new(Vec::new()),
        }
    }
}