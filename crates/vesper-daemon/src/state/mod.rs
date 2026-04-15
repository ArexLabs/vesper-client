pub mod db;

pub struct DaemonState {
    pub running: bool,
    pub started_at: std::time::Instant,
}

impl DaemonState {
    pub fn new() -> Self {
        Self {
            running: true,
            started_at: std::time::Instant::now(),
        }
    }

    pub fn uptime(&self) -> std::time::Duration {
        self.started_at.elapsed()
    }
}