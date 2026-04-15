use vesper_update::UpdateChecker;

pub struct Updater;

impl Updater {
    pub fn new() -> Self {
        Self
    }

    pub async fn check(&self, current: &str) -> Option<vesper_update::check::UpdateInfo> {
        None
    }

    pub async fn apply(&self, info: vesper_update::check::UpdateInfo) -> Result<(), vesper_core::Error> {
        Ok(())
    }
}