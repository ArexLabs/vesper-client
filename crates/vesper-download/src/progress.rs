use vesper_core::DownloadId;

#[derive(Debug, Clone)]
pub struct DownloadProgress {
    pub task_id: DownloadId,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub chunks_completed: u32,
    pub chunks_total: u32,
    pub speed_bps: u64,
}

impl DownloadProgress {
    pub fn percent_complete(&self) -> f64 {
        if self.total_bytes == 0 {
            return 0.0;
        }
        (self.downloaded_bytes as f64 / self.total_bytes as f64) * 100.0
    }
}