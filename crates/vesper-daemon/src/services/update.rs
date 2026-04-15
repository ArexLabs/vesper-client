use vesper_update::check::UpdateInfo;

pub struct UpdateService;

impl UpdateService {
    pub fn new() -> Self {
        Self
    }

    pub async fn check_updates(&self, current: &str) -> Option<UpdateInfo> {
        None
    }

    pub async fn apply_update(&self, info: UpdateInfo) -> Result<(), vesper_core::Error> {
        Ok(())
    }
}